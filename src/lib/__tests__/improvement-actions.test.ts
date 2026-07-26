import { describe, expect, it } from "vitest";
import {
  computeCompletionRate,
  currentYearMonth,
  formatYearMonthLabel,
  prevYearMonth,
  type ImprovementAction,
} from "../improvement-actions";

let seq = 0;

function makeAction(status: ImprovementAction["status"]): ImprovementAction {
  seq += 1;
  return {
    id: `action-${seq}`,
    year_month: "2026-07",
    action_text: `액션 ${seq}`,
    source: "manual",
    source_title: null,
    owner: null,
    status,
    done_at: status === "done" ? "2026-07-20T00:00:00.000Z" : null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function makeActions(counts: Partial<Record<ImprovementAction["status"], number>>): ImprovementAction[] {
  const result: ImprovementAction[] = [];
  (["done", "pending", "dropped"] as const).forEach((status) => {
    for (let i = 0; i < (counts[status] || 0); i += 1) result.push(makeAction(status));
  });
  return result;
}

describe("computeCompletionRate", () => {
  it("빈 배열이면 전부 0", () => {
    expect(computeCompletionRate([])).toEqual({
      total: 0,
      done: 0,
      pending: 0,
      dropped: 0,
      rate: 0,
    });
  });

  it("완료 2건·대기 2건이면 50%", () => {
    const result = computeCompletionRate(makeActions({ done: 2, pending: 2 }));
    expect(result.rate).toBe(50);
    expect(result.total).toBe(4);
  });

  it("보류는 분모에서 제외한다 (완료 1건·보류 2건이면 100%)", () => {
    const result = computeCompletionRate(makeActions({ done: 1, dropped: 2 }));
    expect(result.rate).toBe(100);
    expect(result.dropped).toBe(2);
    expect(result.total).toBe(3);
  });

  it("전부 보류면 분모가 0이라 0%", () => {
    expect(computeCompletionRate(makeActions({ dropped: 3 })).rate).toBe(0);
  });
});

describe("prevYearMonth", () => {
  it("같은 해 안에서는 월만 하나 줄인다", () => {
    expect(prevYearMonth("2026-07")).toBe("2026-06");
  });

  it("1월이면 전년 12월로 넘어간다", () => {
    expect(prevYearMonth("2026-01")).toBe("2025-12");
  });
});

describe("currentYearMonth", () => {
  it("주입한 시각 기준으로 zero-pad된 연월을 만든다", () => {
    expect(currentYearMonth(new Date(2026, 2, 5))).toBe("2026-03");
  });
});

describe("formatYearMonthLabel", () => {
  it("한국어 라벨로 바꾼다", () => {
    expect(formatYearMonthLabel("2026-07")).toBe("2026년 7월");
  });
});
