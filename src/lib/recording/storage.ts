// 녹음 오디오 경로·형식 규칙과 Storage 호출(서비스 롤 클라이언트 전용).
// 경로는 항상 서버가 만든다(D3): {recordingId}/seg-{seq 3자리}.{ext}

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYBACK_URL_TTL_SEC, RECORDING_BUCKET } from "@/lib/recording/constants";

/** "audio/webm;codecs=opus" → "audio/webm" */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export function isAllowedAudioMime(mime: string): boolean {
  return baseMime(mime) in EXT_BY_MIME;
}

export function extForMime(mime: string): string {
  return EXT_BY_MIME[baseMime(mime)] ?? "bin";
}

export function segmentPath(recordingId: string, seq: number, mime: string): string {
  return `${recordingId}/seg-${String(seq).padStart(3, "0")}.${extForMime(mime)}`;
}

export async function createSegmentUploadUrl(admin: SupabaseClient, path: string) {
  // createSignedUploadUrl 은 기본 upsert=false → 이미 있는 파일은 덮어쓰지 못한다.
  const { data, error } = await admin.storage.from(RECORDING_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`upload_url_failed: ${error?.message ?? "no data"}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

/** 폴더 안 실제 파일 목록(전체 경로). */
export async function listRecordingObjects(admin: SupabaseClient, recordingId: string) {
  const { data, error } = await admin.storage
    .from(RECORDING_BUCKET)
    .list(recordingId, { limit: 1000 });
  if (error) throw new Error(`list_failed: ${error.message}`);
  return (data ?? [])
    .filter((o) => o.name && o.id !== null)
    .map((o) => ({ path: `${recordingId}/${o.name}`, size: Number(o.metadata?.size ?? 0) }));
}

export async function downloadSegment(admin: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data, error } = await admin.storage.from(RECORDING_BUCKET).download(path);
  if (error || !data) throw new Error(`download_failed: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeObjects(admin: SupabaseClient, paths: string[]) {
  const { data, error } = await admin.storage.from(RECORDING_BUCKET).remove(paths);
  return { removed: data?.length ?? 0, error: error?.message ?? null };
}

export async function createPlaybackUrls(admin: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return [];
  const { data, error } = await admin.storage
    .from(RECORDING_BUCKET)
    .createSignedUrls(paths, PLAYBACK_URL_TTL_SEC);
  if (error || !data) throw new Error(`playback_url_failed: ${error?.message ?? "no data"}`);
  return data.map((d) => ({ path: d.path ?? "", url: d.signedUrl ?? null }));
}
