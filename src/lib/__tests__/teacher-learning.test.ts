import { describe, expect, it } from "vitest";
import type { Withdrawal } from "@/types";
import { makeRetro, makeW } from "./helpers/withdrawal-factory";
import { buildTeacherLearning, listTeachersFromWithdrawals } from "../teacher-learning";

const YEAR = 2026;

function inMonth(month: number, partial: Partial<Withdrawal> = {}): Withdrawal {
  const mm = String(month).padStart(2, "0");
  return makeW({ withdrawal_date: `${YEAR}-${mm}-10`, teacher: "김", ...partial });
}

function manyInMonth(
  count: number,
  month: number,
  partial: Partial<Withdrawal> = {}
): Withdrawal[] {
  return Array.from({ length: count }, () => inMonth(month, partial));
}

describe("listTeachersFromWithdrawals", () => {
  it("담당 건수 내림차순으로 정렬하고 미지정은 제외한다", () => {
    expect(
      listTeachersFromWithdrawals([
        makeW({ teacher: "김" }),
        makeW({ teacher: "이" }),
        makeW({ teacher: "김" }),
        makeW({ teacher: null }),
        makeW({ teacher: "김" }),
        makeW({ teacher: "이" }),
        makeW({ teacher: "박" }),
      ])
    ).toEqual(["김", "이", "박"]);
  });

  it("퇴원이 없으면 빈 배열", () => {
    expect(listTeachersFromWithdrawals([])).toEqual([]);
  });
});

describe("buildTeacherLearning", () => {
  it("담당 건만 모아 사유 분포를 집계하고 미입력을 맨 뒤로 보낸다", () => {
    const result = buildTeacherLearning(
      [
        ...manyInMonth(3, 5, { reason_category: "성적 부진" }),
        ...manyInMonth(4, 5, { reason_category: null }),
        ...manyInMonth(1, 5, { reason_category: "친구 문제" }),
        inMonth(5, { teacher: "이", reason_category: "성적 부진" }),
      ],
      "김",
      YEAR,
      5
    );
    expect(result.history).toHaveLength(8);
    expect(result.reasonDist).toEqual([
      { name: "성적 부진", count: 3 },
      { name: "친구 문제", count: 1 },
      { name: "미입력", count: 4 },
    ]);
  });

  it("월별 추이는 1~12월 슬롯을 모두 채우고 단축형 날짜도 집계한다", () => {
    const result = buildTeacherLearning(
      [
        ...manyInMonth(2, 3),
        makeW({ withdrawal_date: "7.15", teacher: "김" }),
        makeW({ withdrawal_date: "7.20", teacher: "김" }),
        makeW({ withdrawal_date: "7.25", teacher: "김" }),
      ],
      "김",
      YEAR,
      7
    );
    expect(result.monthlyTrend).toHaveLength(12);
    expect(result.monthlyTrend[2]).toEqual({ month: 3, count: 2 });
    expect(result.monthlyTrend[6]).toEqual({ month: 7, count: 3 });
    expect(result.monthlyTrend[0]).toEqual({ month: 1, count: 0 });
  });

  it("본인 담당 건의 완료된 배움만 모은다", () => {
    const result = buildTeacherLearning(
      [
        inMonth(5, { name: "가", retrospective: makeRetro() }),
        inMonth(5, { name: "나", retrospective: null }),
        inMonth(5, { name: "다", teacher: "이", retrospective: makeRetro() }),
      ],
      "김",
      YEAR,
      5
    );
    expect(result.lessons).toEqual([
      { name: "가", lesson: "징후는 숙제에서 먼저 보인다", author: "원장" },
    ]);
  });
});

describe("buildTeacherLearning — improvement", () => {
  /** 1~6월에 걸쳐 데이터를 깔아 추세 판단 가능한 범위를 만든다. */
  function spread(prevCounts: number[], recentCounts: number[]): Withdrawal[] {
    return [
      ...prevCounts.flatMap((count, i) => manyInMonth(count, i + 1)),
      ...recentCounts.flatMap((count, i) => manyInMonth(count, i + 4)),
    ];
  }

  it("최근 3개월이 줄면 improving", () => {
    const result = buildTeacherLearning(spread([2, 2, 1], [1, 1, 0]), "김", YEAR, 6);
    expect(result.improvement.prevCount).toBe(5);
    expect(result.improvement.recentCount).toBe(2);
    expect(result.improvement.trend).toBe("improving");
    expect(result.improvement.message).toContain("감소 추세입니다");
  });

  it("최근 3개월과 직전 3개월이 같으면 flat", () => {
    const result = buildTeacherLearning(spread([1, 1, 1], [1, 1, 1]), "김", YEAR, 6);
    expect(result.improvement.trend).toBe("flat");
    expect(result.improvement.message).toContain("큰 변화가 없습니다");
  });

  it("최근 3개월이 늘면 worsening", () => {
    const result = buildTeacherLearning(spread([1, 1, 0], [2, 2, 1]), "김", YEAR, 6);
    expect(result.improvement.trend).toBe("worsening");
    expect(result.improvement.message).toContain("점검");
  });

  it("데이터 월 범위가 6개월 미만이면 추세로 단정하지 않는다", () => {
    const result = buildTeacherLearning(
      [...manyInMonth(1, 4), ...manyInMonth(5, 5), ...manyInMonth(1, 6)],
      "김",
      YEAR,
      6
    );
    expect(result.improvement.trend).toBe("flat");
    expect(result.improvement.message).toContain("기간이 쌓이지 않았습니다");
  });
});
