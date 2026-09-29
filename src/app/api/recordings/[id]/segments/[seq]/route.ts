// POST {durationSec}: 조각 업로드 완료 기록. 실제 파일이 있는지 서버가 확인한 뒤에만 uploaded 로 올린다.
// 브라우저는 이 응답(ok)을 받은 뒤에만 IndexedDB 파트를 지운다(D2).

import { authorizeRecording } from "@/lib/recording/guard";
import { completeSegmentUpload } from "@/lib/recording/service";
import { jsonError, jsonOk, parseDuration, parseSeq, readJson } from "@/lib/recording/http";
import { MAX_SEGMENT_SEQ } from "@/lib/recording/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; seq: string }> }) {
  const { id, seq: seqRaw } = await params;
  const auth = await authorizeRecording(id, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  const seq = parseSeq(seqRaw);
  if (seq == null || seq < 1 || seq > MAX_SEGMENT_SEQ) return jsonError(400, "잘못된 부분 순번");
  const body = await readJson(req);
  try {
    const r = await completeSegmentUpload(auth.admin, id, seq, parseDuration(body.durationSec));
    if (!r.ok) return jsonError(r.status, r.error);
    return jsonOk({ ok: true });
  } catch (e) {
    console.error("[recording] 조각 완료 기록 실패", { recordingId: id, seq, error: e instanceof Error ? e.message : "unknown" });
    return jsonError(500, "부분 완료 기록 실패");
  }
}
