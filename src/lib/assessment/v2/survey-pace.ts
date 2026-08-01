// 설문 진행 속도 추정. 순수 함수만 둔다(설문 화면에서 분리해 단위 테스트한다).

/** 표본이 이만큼 쌓이기 전에는 중앙값 대신 고정값을 쓴다. 1~2개 중앙값은 튄다. */
export const PACE_MIN_SAMPLES = 5;

/** 표본이 부족할 때 가정하는 문항당 시간(초). */
export const DEFAULT_ITEM_SECONDS = 8;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 남은 문항을 푸는 데 걸릴 시간(분).
 *
 * 표본(delaysMs)은 "문항 노출 → 첫 선택"까지의 지연이라 자동 이동에 쓰는 시간이 빠져 있다.
 * transitionMs를 더해야 학생이 체감하는 속도에 가깝다.
 *
 * 남은 문항이 있으면 최소 1분으로 올린다 — "0분 남음"은 끝났다는 뜻으로 읽힌다.
 */
export function estimateRemainingMinutes(
  delaysMs: number[],
  remaining: number,
  transitionMs: number,
): number {
  if (remaining <= 0) return 0;
  const perItemMs =
    delaysMs.length >= PACE_MIN_SAMPLES
      ? median(delaysMs) + transitionMs
      : DEFAULT_ITEM_SECONDS * 1000;
  return Math.max(1, Math.round((perItemMs * remaining) / 60000));
}
