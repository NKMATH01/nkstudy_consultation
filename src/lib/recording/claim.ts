// 멱등 선점 규칙(D4·D5). 순수 판정 + 조건부 UPDATE 에 쓰는 PostgREST or 필터.
// 판정 함수와 필터는 같은 규칙을 표현해야 한다(테스트로 묶어 둠).

import { CLAIM_STALE_MS } from "@/lib/recording/constants";

function staleBefore(now: Date): string {
  return new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
}

function isStale(lockedAt: string | null, now: Date): boolean {
  if (!lockedAt) return true;
  const t = Date.parse(lockedAt);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > CLAIM_STALE_MS;
}

/** 조각 전사 선점 가능: uploaded|failed, 또는 transcribing 인데 locked_at 이 10분 넘음(없음 포함). */
export function canClaimSegment(seg: { status: string; locked_at: string | null }, now: Date): boolean {
  if (seg.status === "uploaded" || seg.status === "failed") return true;
  if (seg.status === "transcribing") return isStale(seg.locked_at, now);
  return false;
}

/** canClaimSegment 와 같은 규칙의 PostgREST or 필터(값에 : . 이 있어 큰따옴표로 감싼다). */
export function segmentClaimOrFilter(now: Date): string {
  const before = staleBefore(now);
  return `status.in.(uploaded,failed),and(status.eq.transcribing,locked_at.is.null),and(status.eq.transcribing,locked_at.lt."${before}")`;
}

/**
 * 분석 선점 가능: 마감됨 + 조각 수 확정 + 모든 조각 전사 완료 +
 * (transcribed|failed, 또는 analyzing 인데 locked_at 10분 초과).
 */
export function canClaimAnalysis(
  rec: { status: string; finalized_at: string | null; locked_at: string | null; segment_count: number | null },
  segments: { status: string }[],
  now: Date,
): boolean {
  if (!rec.finalized_at || rec.segment_count == null || rec.segment_count < 1) return false;
  if (segments.length !== rec.segment_count) return false;
  if (!segments.every((s) => s.status === "transcribed")) return false;
  if (rec.status === "transcribed" || rec.status === "failed") return true;
  if (rec.status === "analyzing") return isStale(rec.locked_at, now);
  return false;
}

export function analysisClaimOrFilter(now: Date): string {
  const before = staleBefore(now);
  return `status.in.(transcribed,failed),and(status.eq.analyzing,locked_at.is.null),and(status.eq.analyzing,locked_at.lt."${before}")`;
}
