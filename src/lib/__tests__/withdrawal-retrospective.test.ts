import { describe, expect, it } from "vitest";
import {
  computeRetrospectiveRate,
  EMPTY_RETROSPECTIVE,
  isRetrospectiveComplete,
  parseRetrospective,
  retrospectiveStatus,
  type WithdrawalRetrospective,
} from "../withdrawal-retrospective";

function makeRetro(partial: Partial<WithdrawalRetrospective> = {}): WithdrawalRetrospective {
  return {
    first_sign: "3월 중순 숙제 미제출 증가",
    our_attempts: "담당 강사 면담 2회",
    do_differently: "첫 징후 시점에 학부모 공유",
    system_change: "숙제 2회 미제출 시 자동 알림",
    lesson: "징후는 숙제에서 먼저 보인다",
    manager_comment: "",
    author: "원장",
    completed_at: null,
    ...partial,
  };
}

describe("parseRetrospective", () => {
  it("객체가 아니면 null을 반환한다", () => {
    expect(parseRetrospective(null)).toBeNull();
    expect(parseRetrospective(undefined)).toBeNull();
    expect(parseRetrospective("문자열")).toBeNull();
    expect(parseRetrospective([{ lesson: "배움" }])).toBeNull();
  });

  it("누락되거나 문자열이 아닌 필드는 빈 문자열로 보정한다", () => {
    expect(parseRetrospective({ lesson: "배움", first_sign: 123 })).toEqual({
      ...EMPTY_RETROSPECTIVE,
      lesson: "배움",
    });
  });

  it("정상 객체는 값을 그대로 보존한다", () => {
    const retro = makeRetro({ completed_at: "2026-07-27T00:00:00.000Z" });
    expect(parseRetrospective(retro)).toEqual(retro);
  });

  it("completed_at이 문자열이 아니면 null로 만든다", () => {
    expect(parseRetrospective({ completed_at: 12345 })?.completed_at).toBeNull();
  });
});

describe("isRetrospectiveComplete", () => {
  it("4문항과 배움이 모두 채워지면 true", () => {
    expect(isRetrospectiveComplete(makeRetro())).toBe(true);
  });

  it("배움이 비면 false", () => {
    expect(isRetrospectiveComplete(makeRetro({ lesson: "" }))).toBe(false);
  });

  it("문항이 공백 문자뿐이면 false", () => {
    expect(isRetrospectiveComplete(makeRetro({ system_change: "  " }))).toBe(false);
  });

  it("null이면 false", () => {
    expect(isRetrospectiveComplete(null)).toBe(false);
  });

  it("원장 코멘트가 비어도 완료로 본다", () => {
    expect(isRetrospectiveComplete(makeRetro({ manager_comment: "" }))).toBe(true);
  });
});

describe("retrospectiveStatus", () => {
  it("null이면 none", () => {
    expect(retrospectiveStatus(null)).toBe("none");
  });

  it("모든 필드가 공백이면 none", () => {
    expect(retrospectiveStatus({ ...EMPTY_RETROSPECTIVE, author: "원장" })).toBe("none");
  });

  it("일부만 입력되면 draft", () => {
    expect(retrospectiveStatus({ ...EMPTY_RETROSPECTIVE, first_sign: "숙제 미제출" })).toBe("draft");
  });

  it("완료 조건을 채우면 complete", () => {
    expect(retrospectiveStatus(makeRetro())).toBe("complete");
  });
});

describe("computeRetrospectiveRate", () => {
  it("빈 배열이면 0", () => {
    expect(computeRetrospectiveRate([])).toEqual({ total: 0, completed: 0, rate: 0 });
  });

  it("3건 중 1건 완료면 33.3%", () => {
    expect(
      computeRetrospectiveRate([
        { retrospective: makeRetro() },
        { retrospective: null },
        { retrospective: makeRetro({ lesson: "" }) },
      ])
    ).toEqual({ total: 3, completed: 1, rate: 33.3 });
  });

  it("전건 완료면 100%", () => {
    expect(
      computeRetrospectiveRate([{ retrospective: makeRetro() }, { retrospective: makeRetro() }])
    ).toEqual({ total: 2, completed: 2, rate: 100 });
  });
});
