import { describe, expect, it } from "vitest";
import type { Withdrawal } from "@/types";
import { makeRetro, makeW } from "./helpers/withdrawal-factory";
import {
  buildMonthlyLessons,
  detectRepeatPatterns,
  type RepeatPattern,
} from "../monthly-review";

const YEAR = 2026;

/** 지정한 달에 놓인 퇴원 건을 만든다. */
function inMonth(month: number, partial: Partial<Withdrawal> = {}): Withdrawal {
  const mm = String(month).padStart(2, "0");
  return makeW({ withdrawal_date: `${YEAR}-${mm}-10`, ...partial });
}

function manyInMonth(
  count: number,
  month: number,
  partial: Partial<Withdrawal> = {}
): Withdrawal[] {
  return Array.from({ length: count }, () => inMonth(month, partial));
}

function find(patterns: RepeatPattern[], idPrefix: string): RepeatPattern | undefined {
  return patterns.find((p) => p.id === idPrefix || p.id.startsWith(`${idPrefix}:`));
}

describe("buildMonthlyLessons", () => {
  it("회고가 완료된 건의 배움만 모은다", () => {
    const lessons = buildMonthlyLessons(
      [
        inMonth(7, { name: "가", teacher: "김", retrospective: makeRetro() }),
        inMonth(7, { name: "나", retrospective: null }),
        inMonth(7, { name: "다", retrospective: makeRetro({ first_sign: "" }) }),
        inMonth(6, { name: "라", retrospective: makeRetro() }),
      ],
      7,
      YEAR
    );
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toEqual({
      name: "가",
      teacher: "김",
      lesson: "징후는 숙제에서 먼저 보인다",
      author: "원장",
    });
  });

  it("배움이 공백뿐이면 제외한다", () => {
    const lessons = buildMonthlyLessons(
      [inMonth(7, { retrospective: makeRetro({ lesson: "   " }) })],
      7,
      YEAR
    );
    expect(lessons).toHaveLength(0);
  });

  it("연도 없는 단축형 날짜도 해당 월로 잡는다", () => {
    const lessons = buildMonthlyLessons(
      [makeW({ withdrawal_date: "7.15", name: "마", retrospective: makeRetro() })],
      7,
      YEAR
    );
    expect(lessons.map((l) => l.name)).toEqual(["마"]);
  });
});

describe("detectRepeatPatterns — reason-streak", () => {
  const reasonMonth = (month: number, reason: string, count = 3) =>
    manyInMonth(count, month, { reason_category: reason });

  it("3개월 연속 같은 1위 사유면 심각", () => {
    const pattern = find(
      detectRepeatPatterns(
        [
          ...reasonMonth(5, "성적 부진"),
          ...reasonMonth(4, "성적 부진"),
          ...reasonMonth(3, "성적 부진"),
        ],
        5,
        YEAR
      ),
      "reason-streak"
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("심각");
    expect(pattern!.evidence).toBe("『성적 부진』 3개월 연속 최다 사유");
  });

  it("2개월 연속이면 주의", () => {
    const pattern = find(
      detectRepeatPatterns([...reasonMonth(5, "성적 부진"), ...reasonMonth(4, "성적 부진")], 5, YEAR),
      "reason-streak"
    );
    expect(pattern?.severity).toBe("주의");
  });

  it("사유 입력이 3건 미만인 달은 건너뛰고 연속을 이어간다", () => {
    const pattern = find(
      detectRepeatPatterns(
        [
          ...reasonMonth(5, "성적 부진"),
          ...reasonMonth(4, "친구 문제", 2),
          ...reasonMonth(3, "성적 부진"),
        ],
        5,
        YEAR
      ),
      "reason-streak"
    );
    expect(pattern?.evidence).toBe("『성적 부진』 2개월 연속 최다 사유");
  });

  it("1위 사유가 바뀌면 발동하지 않는다", () => {
    const patterns = detectRepeatPatterns(
      [...reasonMonth(5, "성적 부진"), ...reasonMonth(4, "친구 문제")],
      5,
      YEAR
    );
    expect(find(patterns, "reason-streak")).toBeUndefined();
  });
});

describe("detectRepeatPatterns — teacher-streak", () => {
  // [봉인 스펙] 실명·등급 경보가 아니라 실명 없는 조직 신호만 낸다.
  it("3개월 연속이면 실명 없는 조직 신호로 보고한다", () => {
    const pattern = find(
      detectRepeatPatterns(
        [inMonth(5, { teacher: "김" }), inMonth(4, { teacher: "김" }), inMonth(3, { teacher: "김" })],
        5,
        YEAR
      ),
      "teacher-streak"
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("주의");
    expect(pattern!.title).not.toContain("김");
    expect(pattern!.evidence).not.toContain("김");
    expect(pattern!.evidence).toContain("담당 구간 1곳");
  });

  it("건수가 많아도 심각 등급으로 올리지 않는다", () => {
    const pattern = find(
      detectRepeatPatterns(
        [
          ...manyInMonth(1, 5, { teacher: "김" }),
          ...manyInMonth(2, 4, { teacher: "김" }),
          ...manyInMonth(2, 3, { teacher: "김" }),
        ],
        5,
        YEAR
      ),
      "teacher-streak"
    );
    expect(pattern?.severity).toBe("주의");
    expect(pattern?.evidence).toContain("합계 5건");
    expect(pattern?.evidence).not.toContain("김");
  });

  it("2개월 연속이면 발동하지 않는다", () => {
    const patterns = detectRepeatPatterns(
      [inMonth(5, { teacher: "김" }), inMonth(4, { teacher: "김" })],
      5,
      YEAR
    );
    expect(find(patterns, "teacher-streak")).toBeUndefined();
  });
});

describe("detectRepeatPatterns — early-streak", () => {
  it("2개월 연속 각 2건이면 주의", () => {
    const pattern = find(
      detectRepeatPatterns(
        [...manyInMonth(2, 5, { duration_months: 2 }), ...manyInMonth(2, 4, { duration_months: 3 })],
        5,
        YEAR
      ),
      "early-streak"
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("주의");
    expect(pattern!.evidence).toContain("신입 온보딩 90일 케어 점검 필요");
  });

  it("3개월 연속이면 심각", () => {
    const pattern = find(
      detectRepeatPatterns(
        [
          ...manyInMonth(2, 5, { duration_months: 1 }),
          ...manyInMonth(2, 4, { duration_months: 1 }),
          ...manyInMonth(2, 3, { duration_months: 1 }),
        ],
        5,
        YEAR
      ),
      "early-streak"
    );
    expect(pattern?.severity).toBe("심각");
  });

  it("월 1건씩이면 발동하지 않는다", () => {
    const patterns = detectRepeatPatterns(
      [inMonth(5, { duration_months: 2 }), inMonth(4, { duration_months: 2 })],
      5,
      YEAR
    );
    expect(find(patterns, "early-streak")).toBeUndefined();
  });

  it("재원기간이 없거나 비정상(121개월)이면 조기로 세지 않는다", () => {
    const patterns = detectRepeatPatterns(
      [
        ...manyInMonth(2, 5, { duration_months: null }),
        ...manyInMonth(2, 5, { duration_months: 121 }),
        ...manyInMonth(2, 4, { duration_months: null }),
      ],
      5,
      YEAR
    );
    expect(find(patterns, "early-streak")).toBeUndefined();
  });
});

describe("detectRepeatPatterns — class-cluster", () => {
  it("최근 3개월 창에 3건이면 주의", () => {
    const pattern = find(
      detectRepeatPatterns(
        [
          inMonth(5, { class_name: "고1-A" }),
          inMonth(4, { class_name: "고1-A" }),
          inMonth(3, { class_name: "고1-A" }),
        ],
        5,
        YEAR
      ),
      "class-cluster"
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("주의");
    expect(pattern!.evidence).toBe("고1-A 최근 3개월 3건");
  });

  it("4건이면 심각", () => {
    const pattern = find(
      detectRepeatPatterns(manyInMonth(4, 5, { class_name: "고1-A" }), 5, YEAR),
      "class-cluster"
    );
    expect(pattern?.severity).toBe("심각");
  });

  it("창 밖(3개월 이전) 건은 세지 않는다", () => {
    const patterns = detectRepeatPatterns(
      [...manyInMonth(2, 5, { class_name: "고1-A" }), ...manyInMonth(2, 2, { class_name: "고1-A" })],
      5,
      YEAR
    );
    expect(find(patterns, "class-cluster")).toBeUndefined();
  });
});

describe("detectRepeatPatterns — retro-gap", () => {
  it("미완료 비율이 50% 이상이면 발동한다", () => {
    const pattern = find(
      detectRepeatPatterns(
        [inMonth(5, { retrospective: makeRetro() }), inMonth(5, { retrospective: null })],
        5,
        YEAR
      ),
      "retro-gap"
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("주의");
    expect(pattern!.evidence).toBe("회고 미완료 1건 (50%) — 배움이 축적되지 않고 있습니다");
  });

  it("비율이 낮아도 미완료가 5건 이상이면 발동한다", () => {
    const pattern = find(
      detectRepeatPatterns(
        [
          ...manyInMonth(15, 5, { retrospective: makeRetro() }),
          ...manyInMonth(5, 5, { retrospective: null }),
        ],
        5,
        YEAR
      ),
      "retro-gap"
    );
    expect(pattern).toBeDefined();
    expect(pattern!.evidence).toContain("미완료 5건 (25%)");
  });

  it("전건 회고가 완료되면 발동하지 않는다", () => {
    const patterns = detectRepeatPatterns(
      manyInMonth(4, 5, { retrospective: makeRetro() }),
      5,
      YEAR
    );
    expect(find(patterns, "retro-gap")).toBeUndefined();
  });
});

describe("detectRepeatPatterns — 정렬", () => {
  it("심각을 주의보다 앞에 둔다", () => {
    const patterns = detectRepeatPatterns(
      [
        // 조기 퇴원 3개월 연속 → 심각
        ...manyInMonth(2, 5, { duration_months: 1 }),
        ...manyInMonth(2, 4, { duration_months: 1 }),
        ...manyInMonth(2, 3, { duration_months: 1 }),
      ],
      5,
      YEAR
    );
    expect(patterns.length).toBeGreaterThan(1);
    expect(patterns[0].severity).toBe("심각");
    expect(patterns[patterns.length - 1].severity).toBe("주의");
  });
});
