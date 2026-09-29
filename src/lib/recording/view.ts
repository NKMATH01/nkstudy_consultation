// 화면에 넘기는 녹음 모양과 상태 칩 판정. 서버·브라우저 공용(서버 전용 import 금지).

import type { ConsultAnalysis, TranscriptLine } from "@/lib/recording/analyze";

export type DisplayStatus = "recording" | "transcribing" | "analyzing" | "done" | "failed";

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  recording: "녹음 중",
  transcribing: "전사 중",
  analyzing: "분석 중",
  done: "완료",
  failed: "실패",
};

export interface SegmentView {
  seq: number;
  status: string;
  error: string | null;
}

export interface RecordingView {
  id: string;
  status: string;
  displayStatus: DisplayStatus;
  createdAt: string;
  finalizedAt: string | null;
  segmentCount: number | null;
  durationSec: number | null;
  audioDeleteAfter: string;
  audioDeletedAt: string | null;
  error: string | null;
  /** 분석 선점 시각(analyzing 이 멈췄는지 판단용). */
  lockedAt: string | null;
  analysis: ConsultAnalysis | null;
  transcript: TranscriptLine[] | null;
  segments: SegmentView[];
}

/** analyzing 이 10분 넘게 멈춰 다시 분석할 수 있는지(서버 선점 규칙과 같은 기준). */
export function isStaleAnalyzing(r: Pick<RecordingView, "status" | "lockedAt">, now: number): boolean {
  if (r.status !== "analyzing") return false;
  const t = r.lockedAt ? Date.parse(r.lockedAt) : NaN;
  return Number.isNaN(t) || now - t > 10 * 60_000;
}

export function computeDisplayStatus(status: string, segments: { status: string }[]): DisplayStatus {
  if (status === "failed") return "failed";
  if (segments.some((s) => s.status === "failed")) return "failed";
  switch (status) {
    case "recording":
      return "recording";
    case "transcribing":
      return "transcribing";
    case "transcribed":
    case "analyzing":
      return "analyzing";
    case "analyzed":
      return "done";
    default:
      return "failed";
  }
}
