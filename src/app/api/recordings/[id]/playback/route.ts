// GET: 원본 재생용 서명 URL(10분). 열람 권한(D1) 확인 후, 원본이 삭제되기 전까지만.

import { authorizeRecording } from "@/lib/recording/guard";
import { createPlaybackUrls } from "@/lib/recording/storage";
import { jsonError, jsonOk } from "@/lib/recording/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeRecording(id, "view");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  if (auth.recording.audio_deleted_at) return jsonError(410, "원본 오디오는 삭제되었습니다.");

  const { data, error } = await auth.admin
    .from("consultation_recording_segments")
    .select("seq, path, status")
    .eq("recording_id", id)
    .neq("status", "pending")
    .order("seq", { ascending: true });
  if (error) return jsonError(500, "조각 조회 실패");
  const segs = (data ?? []) as { seq: number; path: string }[];
  try {
    const urls = await createPlaybackUrls(auth.admin, segs.map((s) => s.path));
    const byPath = new Map(urls.map((u) => [u.path, u.url]));
    return jsonOk({
      segments: segs.map((s) => ({ seq: s.seq, url: byPath.get(s.path) ?? null })),
      expiresInSec: 600,
    });
  } catch (e) {
    console.error("[recording] 재생 URL 발급 실패", { recordingId: id, error: e instanceof Error ? e.message : "unknown" });
    return jsonError(500, "재생 주소를 만들지 못했습니다.");
  }
}
