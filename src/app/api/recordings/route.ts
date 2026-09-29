// POST: 녹음 시작(동의 확인 + 행 생성) — principal·admin 만.
// GET ?consultationId=: 녹음 목록 — 열람 권한(D1) 있는 사람만.

import { authorizeConsultation } from "@/lib/recording/guard";
import { buildRecordingInsert } from "@/lib/recording/create";
import { CONSENT_VERSION } from "@/lib/recording/consent";
import { isAllowedAudioMime } from "@/lib/recording/storage";
import { listRecordingViews } from "@/lib/recording/queries";
import { jsonError, jsonOk, readJson } from "@/lib/recording/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const consultationId = String(body.consultationId ?? "");
  const auth = await authorizeConsultation(consultationId, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);

  if (body.consentChecked !== true || body.consentVersion !== CONSENT_VERSION) {
    return jsonError(400, "녹음 동의 확인이 필요합니다.");
  }
  const mime = typeof body.mime === "string" ? body.mime : "";
  if (!isAllowedAudioMime(mime)) return jsonError(400, "지원하지 않는 녹음 형식입니다.");

  const row = buildRecordingInsert({
    consultationId,
    mime,
    consentVersion: CONSENT_VERSION,
    staffLabel: auth.staff.label,
    now: new Date(),
  });
  const { data, error } = await auth.admin.from("consultation_recordings").insert(row).select("id").single();
  if (error || !data) {
    console.error("[recording] 생성 실패", { consultationId, error: error?.message });
    return jsonError(500, "녹음을 시작하지 못했습니다.");
  }
  return jsonOk({ id: (data as { id: string }).id, mime: row.mime }, 201);
}

export async function GET(req: Request) {
  const consultationId = new URL(req.url).searchParams.get("consultationId") ?? "";
  const auth = await authorizeConsultation(consultationId, "view");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  try {
    const recordings = await listRecordingViews(auth.admin, consultationId);
    return jsonOk({ recordings });
  } catch (e) {
    console.error("[recording] 목록 조회 실패", { consultationId, error: e instanceof Error ? e.message : "unknown" });
    return jsonError(500, "녹음 목록을 불러오지 못했습니다.");
  }
}
