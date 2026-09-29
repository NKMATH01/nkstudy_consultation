// DELETE: 녹음 한 건 삭제(M) — principal·admin 만. 동의 철회·실패·빈 녹음 정리용.
// 오디오 전부 삭제(결과 수 확인) → 행 삭제(조각 행은 CASCADE). 일부만 지워지면 행을 남기고 500.

import { authorizeRecording } from "@/lib/recording/guard";
import { createSupabaseDeleteStore, deleteRecordingWithAudio } from "@/lib/recording/purge";
import { jsonError, jsonOk } from "@/lib/recording/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeRecording(id, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  const r = await deleteRecordingWithAudio(createSupabaseDeleteStore(auth.admin), id);
  if (!r.ok) {
    console.error("[recording] 녹음 삭제 실패", { recordingId: id });
    return jsonError(500, r.error);
  }
  return jsonOk({ ok: true });
}
