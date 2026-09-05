import { describe, expect, it } from "vitest";
import {
  buildTransitionPlan,
  normalizePreviousAcademyConcerns,
} from "../transition-plan";

describe("이전 학원 경험 → 개인정보 없는 전환 약속", () => {
  it("구조화 선택을 최대 3개의 고정 약속으로 바꾼다", () => {
    const plan = buildTransitionPlan({
      prevConcerns: [
        "수준·진도 불일치",
        "질문·오답 피드백 부족",
        "교사·상담 소통 부족",
      ],
    });
    expect(plan).toHaveLength(3);
    expect(plan.map((item) => item.title)).toContain("질문과 오답을 남기지 않기");
    expect(plan.every((item) => item.check.includes("상담"))).toBe(true);
  });

  it("과거 자유서술은 원문을 반환하지 않고 범주만 추론한다", () => {
    const input = {
      prevComplaint: "OO학원은 질문해도 피드백이 없고 숙제 관리가 약했습니다",
      requests: "강현찬은 편하게 질문하고 싶어요",
    };
    const concerns = normalizePreviousAcademyConcerns(input);
    const serialized = JSON.stringify({ concerns, plan: buildTransitionPlan(input) });
    expect(concerns).toContain("질문·오답 피드백 부족");
    expect(concerns).toContain("숙제·복습 관리 부족");
    expect(serialized).not.toContain("OO학원");
    expect(serialized).not.toContain("강현찬");
  });

  it("특별한 불만 없음은 전환 경고를 만들지 않는다", () => {
    expect(buildTransitionPlan({ prevConcerns: ["특별한 불만 없음"] })).toEqual([]);
  });

  it("분류하기 어려운 과거 서술은 상담 확인 약속 하나로 제한한다", () => {
    const plan = buildTransitionPlan({ prevLeaveReason: "개인 사정으로 옮김" });
    expect(plan).toHaveLength(1);
    expect(plan[0].concern).toBe("추가 확인 필요");
  });
});
