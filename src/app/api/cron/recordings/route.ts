// Vercel Cron(하루 1회, vercel.json) — 만료 원본 정리 + 남은 조각 전사(시간 예산 안에서 여러 개, D4·D6).
// 인증: Authorization: Bearer CRON_SECRET. CRON_SECRET 이 비어 있으면 503 으로 아무것도 하지 않는다.
// 삭제가 하나라도 실패하면 500(알림이 보이도록).

import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseOrphanStore,
  createSupabasePurgeStore,
  purgeExpiredRecordings,
  sweepOrphanFolders,
} from "@/lib/recording/purge";
import { pickPendingSegment, transcribeSegment } from "@/lib/recording/service";
import { CRON_PURGE_LIMIT, TRANSCRIBE_TIMEOUT_MS } from "@/lib/recording/constants";
import { jsonError, jsonOk } from "@/lib/recording/http";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const START_BUDGET_MS = 200_000;
const HARD_BUDGET_MS = 280_000;
const MIN_TRANSCRIBE_MS = 60_000;
const ORPHAN_LIMIT = 20;

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!env.CRON_SECRET) return jsonError(503, "CRON_SECRET 미설정");
  if (!bearerMatches(req.headers.get("authorization"), env.CRON_SECRET)) return jsonError(401, "Unauthorized");

  const startedAt = Date.now();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError(503, "서비스 롤 키 미설정");
  }

  let purge = { checked: 0, deleted: 0, failed: 0 };
  let purgeError = false;
  try {
    purge = await purgeExpiredRecordings(createSupabasePurgeStore(admin), {
      now: new Date(),
      limit: CRON_PURGE_LIMIT,
    });
  } catch (e) {
    purgeError = true;
    console.error("[cron/recordings] 만료 정리 예외", { error: e instanceof Error ? e.message : "unknown" });
  }

  // 고아 폴더 정리: 행이 없거나 'deleting' 인 채 24시간 넘은 녹음 폴더(최대 20개).
  let orphans = { swept: [] as string[], failed: [] as string[] };
  let orphanError = false;
  try {
    orphans = await sweepOrphanFolders(createSupabaseOrphanStore(admin), { now: new Date(), limit: ORPHAN_LIMIT });
  } catch (e) {
    orphanError = true;
    console.error("[cron/recordings] 고아 폴더 정리 예외", { error: e instanceof Error ? e.message : "unknown" });
  }

  // 남은 조각을 시간 예산 안에서 여러 개 전사(G). 시작 후 약 200초까지 새 조각을 시작하고,
  // 각 전사 타임아웃은 남은 예산(280초 기준)으로 줄여 maxDuration(300초)을 넘지 않게 한다.
  const transcribed: { recordingId: string; seq: number; ok: boolean }[] = [];
  const tried = new Set<string>();
  try {
    while (Date.now() - startedAt < START_BUDGET_MS) {
      const remaining = HARD_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < MIN_TRANSCRIBE_MS) break;
      const next = await pickPendingSegment(admin, { excludeKeys: tried });
      if (!next) break;
      tried.add(`${next.recordingId}|${next.seq}`);
      const r = await transcribeSegment(admin, next.recordingId, next.seq, {
        timeoutMs: Math.min(TRANSCRIBE_TIMEOUT_MS, remaining),
      });
      transcribed.push({ ...next, ok: r.claimed && r.ok });
    }
  } catch (e) {
    console.error("[cron/recordings] 전사 예외", { error: e instanceof Error ? e.message : "unknown" });
  }

  const status = purgeError || purge.failed > 0 || orphanError || orphans.failed.length > 0 ? 500 : 200;
  return jsonOk(
    { purge, orphans: { swept: orphans.swept.length, failed: orphans.failed.length }, transcribed },
    status,
  );
}
