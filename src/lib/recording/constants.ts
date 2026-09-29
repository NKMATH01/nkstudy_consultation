// 상담 녹음(R4) 공용 상수. 서버·브라우저 양쪽에서 import 한다(비밀값 없음).

export const RECORDING_BUCKET = "consult-audio";

/** 조각 길이(D2): 10분마다 레코더를 새로 시작해 독립 파일로 만든다. */
export const SEGMENT_SECONDS = 600;
/** 레코더 파트(IndexedDB 저장 단위) 간격. */
export const TIMESLICE_MS = 10_000;
/** 조각 순번 상한(D3): 72 × 10분 = 12시간. */
export const MAX_SEGMENT_SEQ = 72;
/** 조각 파일 크기 상한(버킷 한도와 같게). */
export const MAX_SEGMENT_BYTES = 15 * 1024 * 1024;
export const AUDIO_BITS_PER_SECOND = 32_000;

/** 원본 오디오 보관 일수(D6). created_at + 30일에 확정하고 늘리지 않는다. */
export const AUDIO_RETENTION_DAYS = 30;
/** 선점 만료(D4·D5): 이 시간이 지난 transcribing/analyzing 은 다시 선점할 수 있다. */
export const CLAIM_STALE_MS = 10 * 60_000;
/** 전사 전용 타임아웃(D4). gemini.ts 의 60초는 쓰지 않는다. */
export const TRANSCRIBE_TIMEOUT_MS = 240_000;
export const ANALYZE_TIMEOUT_MS = 240_000;
/** 재생 서명 URL 유효 시간(초). */
export const PLAYBACK_URL_TTL_SEC = 600;
/** 패널 백그라운드 만료 정리 한 번에 처리할 최대 건수. */
export const PANEL_PURGE_LIMIT = 20;
export const CRON_PURGE_LIMIT = 200;

export const RECORDING_STATUSES = [
  "recording",
  "transcribing",
  "transcribed",
  "analyzing",
  "analyzed",
  "failed",
  "deleting",
] as const;
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

export const SEGMENT_STATUSES = ["pending", "uploaded", "transcribing", "transcribed", "failed"] as const;
export type SegmentStatus = (typeof SEGMENT_STATUSES)[number];
