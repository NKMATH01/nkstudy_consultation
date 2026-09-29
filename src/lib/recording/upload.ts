// 서명 업로드 URL 발급 조건(D3) — 순수 함수.

import { MAX_SEGMENT_SEQ } from "@/lib/recording/constants";

export type UploadCheck = { ok: true } | { ok: false; status: number; error: string };

export function validateUploadRequest(input: {
  seq: number;
  recordingStatus: string;
  existing: { status: string } | null;
  /** 원본 보관 기한·삭제 시각(D6). 기한이 지났거나 삭제됐으면 새 업로드를 받지 않는다. */
  audioDeleteAfter: string;
  audioDeletedAt: string | null;
  now: Date;
}): UploadCheck {
  const { seq, recordingStatus, existing } = input;
  if (!Number.isInteger(seq) || seq < 1 || seq > MAX_SEGMENT_SEQ) {
    return { ok: false, status: 400, error: `부분 순번은 1~${MAX_SEGMENT_SEQ} 사이여야 합니다.` };
  }
  if (input.audioDeletedAt) {
    return { ok: false, status: 410, error: "원본 오디오가 이미 삭제된 녹음입니다." };
  }
  const deleteAfter = Date.parse(input.audioDeleteAfter);
  if (Number.isNaN(deleteAfter) || input.now.getTime() > deleteAfter) {
    return { ok: false, status: 410, error: "원본 보관 기간이 지난 녹음입니다." };
  }
  if (recordingStatus === "deleting") {
    return { ok: false, status: 409, error: "삭제 중인 녹음입니다." };
  }
  if (recordingStatus !== "recording") {
    return { ok: false, status: 409, error: "이미 마감된 녹음입니다." };
  }
  if (existing && existing.status !== "pending") {
    return { ok: false, status: 409, error: "이미 올라간 부분입니다." };
  }
  return { ok: true };
}
