// POST: 녹음 패널이 뜬 뒤 백그라운드로 부르는 만료 정리(D6) — 최대 20건, principal·admin 만.

import { authorizeMaintenance } from "@/lib/recording/guard";
import { createSupabasePurgeStore, purgeExpiredRecordings } from "@/lib/recording/purge";
import { PANEL_PURGE_LIMIT } from "@/lib/recording/constants";
import { jsonError, jsonOk } from "@/lib/recording/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await authorizeMaintenance();
  if (!auth.ok) return jsonError(auth.status, auth.error);
  try {
    const result = await purgeExpiredRecordings(createSupabasePurgeStore(auth.admin), {
      now: new Date(),
      limit: PANEL_PURGE_LIMIT,
    });
    return jsonOk({ ...result });
  } catch (e) {
    console.error("[recording] 만료 정리 실패", { error: e instanceof Error ? e.message : "unknown" });
    return jsonError(500, "만료 정리 실패");
  }
}
