import { describe, expect, it } from "vitest";
import {
  FIRST14_ROWS,
  first14ItemText,
  isFirst14Due,
  mapPlanToRows,
} from "../first14";

describe("mapPlanToRows", () => {
  it("항상 3행을 돌려준다", () => {
    expect(mapPlanToRows([])).toHaveLength(3);
    expect(mapPlanToRows(null)).toHaveLength(3);
    expect(mapPlanToRows(["관계없는 문장"])).toHaveLength(3);
  });

  it("키워드가 맞는 행에 확인 계획 문장을 붙인다", () => {
    const rows = mapPlanToRows([
      "숙제 시작 시각과 기한 준수 여부를 첫 2주간 기록",
      "공부 시작 시 휴대폰 분리 습관 관찰",
      "낮은 점수·막힘 직후 재시작까지 걸리는 시간 관찰",
    ]);
    expect(rows[0].hint).toContain("휴대폰");
    expect(rows[1].hint).toContain("숙제");
    expect(rows[2].hint).toContain("재시작");
  });

  it("매핑에 실패한 행은 보조문구가 비고 구조는 유지된다", () => {
    const rows = mapPlanToRows(["숙제를 기한 안에 제출하는지 확인"]);
    expect(rows[1].hint).not.toBeNull();
    expect(rows[0].hint).toBeNull();
    expect(rows[2].hint).toBeNull();
    expect(rows.map((r) => r.index)).toEqual([1, 2, 3]);
  });

  it("같은 문장을 두 행에 붙이지 않는다", () => {
    // "숙제를 시작"은 1행(시작)과 2행(숙제) 키워드에 모두 걸린다.
    const rows = mapPlanToRows(["숙제를 시작하는 시각 확인"]);
    const hints = rows.map((r) => r.hint).filter(Boolean);
    expect(hints).toHaveLength(1);
  });

  it("빈 문자열·공백은 보조문구로 쓰지 않는다", () => {
    const rows = mapPlanToRows(["   ", ""]);
    expect(rows.every((r) => r.hint === null)).toBe(true);
  });
});

describe("first14ItemText", () => {
  it("보조문구가 있으면 그 문장을, 없으면 기본 문장을 남긴다", () => {
    const [row] = mapPlanToRows(["공부 시작 시 휴대폰 분리 습관 관찰"]);
    expect(first14ItemText(row)).toBe("공부 시작 시 휴대폰 분리 습관 관찰");

    const [empty] = mapPlanToRows([]);
    expect(first14ItemText(empty)).toBe(FIRST14_ROWS[0].fallback);
  });
});

describe("isFirst14Due", () => {
  const today = new Date("2026-08-02T00:00:00Z");

  it("등록일이 없으면 판단하지 않는다", () => {
    expect(isFirst14Due(null, today)).toBe(false);
    expect(isFirst14Due("", today)).toBe(false);
  });

  it("14일 미만이면 아직이다", () => {
    expect(isFirst14Due("2026-07-25", today)).toBe(false);
  });

  it("정확히 14일째부터 표시한다", () => {
    expect(isFirst14Due("2026-07-19", today)).toBe(true);
    expect(isFirst14Due("2026-07-01", today)).toBe(true);
  });

  it("날짜로 읽을 수 없는 값은 판단하지 않는다", () => {
    expect(isFirst14Due("작년 여름", today)).toBe(false);
  });
});
