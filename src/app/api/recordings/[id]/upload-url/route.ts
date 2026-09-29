// POST {seq}: 조각 서명 업로드 URL 발급(D3). 경로는 서버가 만든다. 덮어쓰기 불가.

import { authorizeRecording } from "@/lib/recording/guard";
import { validateUploadRequest } from "@/lib/recording/upload";
import { createSegmentUploadUrl, segmentPath } from "@/lib/recording/storage";
import { jsonError, jsonOk, parseSeq, readJson } from "@/lib/recording/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeRecording(id, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);

  const body = await readJson(req);
  const seq = parseSeq(body.seq);
  const { data: existing, error } = await auth.admin
    .from("consultation_recording_segments")
    .select("id, status, path")
    .eq("recording_id", id)
    .eq("seq", seq ?? -1)
    .maybeSingle();
  if (error) return jsonError(500, "조각 조회 실패");

  const check = validateUploadRequest({
    seq: seq ?? NaN,
    recordingStatus: auth.recording.status,
    existing: existing as { status: string } | null,
    audioDeleteAfter: auth.recording.audio_delete_after,
    audioDeletedAt: auth.recording.audio_deleted_at,
    now: new Date(),
  });
  if (!check.ok) return jsonError(check.status, check.error);

  const path = segmentPath(id, seq as number, auth.recording.mime);
  if (!existing) {
    const { error: insErr } = await auth.admin
      .from("consultation_recording_segments")
      .insert({ recording_id: id, seq, path, status: "pending" });
    if (insErr) {
      // unique(recording_id, seq) 충돌 = 동시에 같은 순번 요청 → 거부
      return jsonError(409, "이미 요청된 조각입니다.");
    }
  }

  try {
    const signed = await createSegmentUploadUrl(auth.admin, path);
    return jsonOk({ path: signed.path, token: signed.token, signedUrl: signed.signedUrl, contentType: auth.recording.mime });
  } catch (e) {
    // 파일이 이미 있으면(업로드는 됐는데 완료 기록 전) 여기서 실패한다 → 완료 기록으로 이어 가게 알린다.
    console.error("[recording] 업로드 URL 발급 실패", { recordingId: id, seq, error: e instanceof Error ? e.message : "unknown" });
    return jsonError(409, "업로드 주소를 만들지 못했습니다(이미 올라간 파일일 수 있음).");
  }
}
