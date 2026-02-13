import { FACTOR_MAPPING } from "@/types";

/**
 * 30문항 응답 데이터로부터 6-Factor 점수를 계산합니다.
 * 각 Factor별 해당 문항의 60% 이상 응답 시에만 평균을 계산합니다.
 */
export function calculateFactors(
  data: Record<string, number | undefined | null>
): Record<string, number | null> {
  const factors: Record<string, number | null> = {};

  for (const [key, qNums] of Object.entries(FACTOR_MAPPING)) {
    const values = qNums
      .map((q) => data[`q${q}`])
      .filter((v): v is number => v != null && !isNaN(v));

    const minRequired = Math.ceil(qNums.length * 0.6);
    factors[`factor_${key}`] =
      values.length >= minRequired
        ? Math.round(
            (values.reduce((a, b) => a + b, 0) / values.length) * 10
          ) / 10
        : null;
  }

  return factors;
}
