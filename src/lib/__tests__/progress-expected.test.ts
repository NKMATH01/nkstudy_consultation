import { describe, expect, it } from "vitest";
import { computeExpectedPercent } from "@/lib/progress-expected";

// 공통 기준: 8/1 시작 ~ 9/30 마감 = 60일 구간
const END = "2026-09-30";

describe("computeExpectedPercent", () => {
  it("현재 교재(finished_on 없음)의 started_on 을 시작일로 쓴다", () => {
    // 완료 교재(6/1)와 진도 생성일(2025-06-01)이 더 앞서지만 현재 교재 시작일이 우선
    const result = computeExpectedPercent({
      targetEndDate: END,
      targetPercent: 100,
      history: [
        { started_on: "2026-01-10", finished_on: "2026-06-01" },
        { started_on: "2026-08-01", finished_on: null },
      ],
      progressCreatedAt: "2025-06-01T00:00:00.000Z",
      today: "2026-09-03",
    });
    // 8/1~9/30 = 60일, 8/1~9/3 = 33일 → 55%
    expect(result).toEqual({ percent: 55, startDate: "2026-08-01", source: "current_textbook" });
  });

  it("현재 교재 시작일이 없으면 가장 최근 완료 교재의 finished_on 을 쓴다", () => {
    const result = computeExpectedPercent({
      targetEndDate: END,
      targetPercent: 100,
      history: [
        { started_on: null, finished_on: "2026-06-01" },
        { started_on: null, finished_on: "2026-08-01" },
        { started_on: null, finished_on: null }, // 현재 교재지만 시작일 미입력 → 건너뜀
      ],
      progressCreatedAt: "2025-06-01T00:00:00.000Z",
      today: "2026-09-03",
    });
    expect(result).toEqual({ percent: 55, startDate: "2026-08-01", source: "recent_finished" });
  });

  it("교재 이력이 없으면 진도 생성일을 쓴다", () => {
    const result = computeExpectedPercent({
      targetEndDate: END,
      targetPercent: 100,
      history: [],
      progressCreatedAt: "2026-08-01",
      today: "2026-09-03",
    });
    expect(result).toEqual({ percent: 55, startDate: "2026-08-01", source: "progress_created" });
  });

  it("마감일이 지나도 100%를 넘지 않는다", () => {
    const result = computeExpectedPercent({
      targetEndDate: "2026-09-01",
      targetPercent: 100,
      history: [{ started_on: "2026-08-01", finished_on: null }],
      progressCreatedAt: null,
      today: "2026-09-30",
    });
    expect(result?.percent).toBe(100);
  });

  it("목표 진도율 80%면 경과 절반 시점에 40%로 스케일된다", () => {
    const result = computeExpectedPercent({
      targetEndDate: END,
      targetPercent: 80,
      history: [{ started_on: "2026-08-01", finished_on: null }],
      progressCreatedAt: null,
      today: "2026-08-31", // 60일 중 30일 경과 = 50% → 50 × 80 / 100 = 40
    });
    expect(result?.percent).toBe(40);
  });

  it("시작일이 마감일 이후면 null 을 돌려준다", () => {
    const result = computeExpectedPercent({
      targetEndDate: END,
      targetPercent: 100,
      history: [{ started_on: "2026-10-01", finished_on: null }],
      progressCreatedAt: "2026-08-01",
      today: "2026-09-03",
    });
    expect(result).toBeNull();
  });

  it("마감일이 없으면 null 을 돌려준다", () => {
    const result = computeExpectedPercent({
      targetEndDate: null,
      targetPercent: 100,
      history: [{ started_on: "2026-08-01", finished_on: null }],
      progressCreatedAt: "2026-08-01",
      today: "2026-09-03",
    });
    expect(result).toBeNull();
  });
});
