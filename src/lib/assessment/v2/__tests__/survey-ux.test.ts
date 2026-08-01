import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_SECONDS,
  estimateRemainingMinutes,
  median,
} from "../survey-pace";
import {
  emptyIntake,
  INTAKE_OPTIONAL_SCREENS,
  isIntakeScreenComplete,
  isIntakeScreenEmpty,
} from "@/components/assessment-v2/intake-screens";

describe("median", () => {
  it("홀수 개는 가운데 값", () => {
    expect(median([5000, 1000, 3000])).toBe(3000);
  });

  it("짝수 개는 가운데 두 값의 평균", () => {
    expect(median([1000, 2000, 3000, 6000])).toBe(2500);
  });

  it("원본 배열을 정렬하지 않는다", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("estimateRemainingMinutes", () => {
  it("표본이 부족하면 문항당 8초로 가정한다", () => {
    // 30문항 × 8초 = 240초 = 4분
    expect(estimateRemainingMinutes([2000, 2000], 30, 520)).toBe(4);
    expect(DEFAULT_ITEM_SECONDS).toBe(8);
  });

  it("표본이 5개 이상이면 중앙값 + 화면 전환 시간으로 계산한다", () => {
    // 중앙값 5000ms + 전환 1000ms = 6000ms, 20문항 → 120초 = 2분
    const delays = [3000, 4000, 5000, 9000, 20000];
    expect(estimateRemainingMinutes(delays, 20, 1000)).toBe(2);
  });

  it("남은 문항이 있으면 0분으로 떨어지지 않는다", () => {
    expect(estimateRemainingMinutes([100, 100, 100, 100, 100], 1, 0)).toBe(1);
  });

  it("남은 문항이 없으면 0분", () => {
    expect(estimateRemainingMinutes([1000, 1000, 1000, 1000, 1000], 0, 520)).toBe(0);
  });
});

describe("사전정보 건너뛰기 판정", () => {
  it("필수 입력이 있는 첫 화면은 건너뛸 수 없다", () => {
    expect(INTAKE_OPTIONAL_SCREENS.has(0)).toBe(false);
  });

  it("나머지 화면은 비어 있으면 건너뛸 수 있다", () => {
    const s = emptyIntake();
    for (const index of [1, 2, 3, 4]) {
      expect(INTAKE_OPTIONAL_SCREENS.has(index), `화면 ${index}`).toBe(true);
      expect(isIntakeScreenEmpty(index, s), `화면 ${index}`).toBe(true);
      // 비어 있어도 진행 조건은 만족해야 넘어갈 수 있다.
      expect(isIntakeScreenComplete(index, s), `화면 ${index}`).toBe(true);
    }
  });

  it("한 칸이라도 채우면 비어 있지 않다", () => {
    expect(isIntakeScreenEmpty(1, { ...emptyIntake(), prev_academy: "OO학원" })).toBe(false);
    expect(isIntakeScreenEmpty(2, { ...emptyIntake(), nk_expectations: ["철저한 숙제 관리"] })).toBe(false);
    expect(isIntakeScreenEmpty(3, { ...emptyIntake(), dream: "개발자" })).toBe(false);
    expect(isIntakeScreenEmpty(4, { ...emptyIntake(), mbti: "ENFP" })).toBe(false);
  });

  it("공백만 적은 것은 비어 있는 것으로 본다", () => {
    expect(isIntakeScreenEmpty(3, { ...emptyIntake(), dream: "   " })).toBe(true);
  });
});
