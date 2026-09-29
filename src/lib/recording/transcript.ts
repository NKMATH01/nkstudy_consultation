// 조각 전사 → 전체 기준(절대) 시각의 전사문(J) — 순수 함수.
// 조각 시작 시각 = 앞 조각들의 duration_sec 합. 길이를 모르면 그 조각 마지막 발화 끝 시각으로 대신한다.

import type { Utterance } from "@/lib/recording/transcribe";
import type { TranscriptLine } from "@/lib/recording/analyze";

export interface SegmentTranscript {
  seq: number;
  duration_sec: number | null;
  transcript: unknown;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function toAbsoluteLines(segments: SegmentTranscript[]): TranscriptLine[] {
  const sorted = [...segments].sort((a, b) => a.seq - b.seq);
  const lines: TranscriptLine[] = [];
  let offset = 0;
  for (const s of sorted) {
    const utterances = Array.isArray(s.transcript)
      ? (s.transcript as Utterance[]).filter((u) => u && typeof u.text === "string")
      : [];
    for (const u of utterances) {
      lines.push({
        seq: s.seq,
        speaker: u.speaker,
        startSec: round3(offset + (Number(u.startSec) || 0)),
        endSec: round3(offset + (Number(u.endSec) || 0)),
        text: u.text,
      });
    }
    const lastEnd = utterances.reduce((m, u) => Math.max(m, Number(u.endSec) || 0), 0);
    offset += s.duration_sec != null && s.duration_sec > 0 ? s.duration_sec : lastEnd;
  }
  return lines;
}
