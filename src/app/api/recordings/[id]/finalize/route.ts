// POST {durationSec}: 녹음 마감. 조각 수는 서버가 실제 올라간 조각으로 확정한다.

import { authorizeRecording } from "@/lib/recording/guard";
import { finalizeRecording } from "@/lib/recording/service";
import { jsonError, jsonOk, parseDuration, readJson } from "@/lib/recording/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeRecording(id, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  const body = await readJson(req);
  try {
    const r = await finalizeRecording(auth.admin, id, parseDuration(body.durationSec), {
      discardMissing: body.discardMissing === true,
    });
    if (!r.ok) {
      return jsonOk({ error: r.error, missingSeqs: r.missingSeqs ?? [] }, r.status);
    }
    return jsonOk({ ok: true, ready: r.ready, segmentCount: r.segmentCount });
  } catch (e) {
    console.error("[recording] 마감 실패", { recordingId: id, error: e instanceof Error ? e.message : "unknown" });
    return jsonError(500, "녹음 마감 실패");
  }
}
