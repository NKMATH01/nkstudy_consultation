import { describe, expect, it } from "vitest";
import {
  PARENT_QUESTIONNAIRE_QUESTIONS,
  PARENT_QUESTIONNAIRE_TEXT_MAX,
  getQuestionnaireTokenState,
  isQuestionnaireTokenFormat,
  parentQuestionnaireAnswersSchema,
} from "../questions";

const validAnswers = {
  q1: "적당히",
  q2: "  숙제는 하지만 오답 정리를 잘 안 해요  ",
  q3: "2주에 한 번",
  q4: "반반이다",
  q5: "그렇다",
  q6_math: 90,
  q6_english: "85",
  q7: "다독여 주기",
  q8: "",
};

describe("PARENT_QUESTIONNAIRE_QUESTIONS", () => {
  it("8문항이고 2번은 자유서술로 바뀌었다", () => {
    expect(PARENT_QUESTIONNAIRE_QUESTIONS).toHaveLength(8);
    const q2 = PARENT_QUESTIONNAIRE_QUESTIONS[1];
    expect(q2.kind).toBe("text");
    expect(q2.q).toBe("학부모님이 보시는 학생의 공부 모습을 한 줄로 적어 주세요");
  });
});

describe("parentQuestionnaireAnswersSchema", () => {
  it("정상 응답을 받아 자유서술은 trim, 빈 칸은 undefined, 점수는 숫자로 바꾼다", () => {
    const r = parentQuestionnaireAnswersSchema.safeParse(validAnswers);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.q2).toBe("숙제는 하지만 오답 정리를 잘 안 해요");
    expect(r.data.q8).toBeUndefined();
    expect(r.data.q6_math).toBe(90);
    expect(r.data.q6_english).toBe(85);
  });

  it("선택지 밖 값은 거절한다", () => {
    const r = parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q1: "아주 강하게" });
    expect(r.success).toBe(false);
  });

  it("선택 문항이 비면 거절한다", () => {
    const r = parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q3: "" });
    expect(r.success).toBe(false);
  });

  it(`자유서술은 ${PARENT_QUESTIONNAIRE_TEXT_MAX}자까지만 받는다`, () => {
    const ok = parentQuestionnaireAnswersSchema.safeParse({
      ...validAnswers,
      q8: "가".repeat(PARENT_QUESTIONNAIRE_TEXT_MAX),
    });
    expect(ok.success).toBe(true);
    const tooLong = parentQuestionnaireAnswersSchema.safeParse({
      ...validAnswers,
      q8: "가".repeat(PARENT_QUESTIONNAIRE_TEXT_MAX + 1),
    });
    expect(tooLong.success).toBe(false);
  });

  it("목표 점수는 0~100 정수만, 비워도 된다", () => {
    expect(parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q6_math: 101 }).success).toBe(false);
    expect(parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q6_math: -1 }).success).toBe(false);
    expect(parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q6_math: 90.5 }).success).toBe(false);
    expect(parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q6_math: "abc" }).success).toBe(false);
    const empty = parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q6_math: "", q6_english: null });
    expect(empty.success).toBe(true);
    if (empty.success) {
      expect(empty.data.q6_math).toBeUndefined();
      expect(empty.data.q6_english).toBeUndefined();
    }
  });

  it("'다른 목표'는 5번이 '다른 목표가 있다'가 아니면 버린다", () => {
    const r = parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q5: "그렇다", q5_other: "의대" });
    expect(r.success && r.data.q5_other).toBeFalsy();
    const r2 = parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, q5: "다른 목표가 있다", q5_other: " 해외 유학 " });
    expect(r2.success && r2.data.q5_other).toBe("해외 유학");
  });

  it("모르는 키는 저장하지 않는다", () => {
    const r = parentQuestionnaireAnswersSchema.safeParse({ ...validAnswers, parent_phone: "01012345678" });
    expect(r.success).toBe(true);
    if (r.success) expect("parent_phone" in r.data).toBe(false);
  });
});

describe("getQuestionnaireTokenState", () => {
  const now = new Date("2026-10-03T00:00:00Z");
  const base = {
    expires_at: "2026-11-02T00:00:00Z",
    answered_at: null,
    revoked_at: null,
  };

  it("행이 없으면 not_found", () => {
    expect(getQuestionnaireTokenState(null, now)).toBe("not_found");
  });
  it("열려 있으면 open", () => {
    expect(getQuestionnaireTokenState(base, now)).toBe("open");
  });
  it("회수가 가장 먼저", () => {
    expect(
      getQuestionnaireTokenState(
        { ...base, revoked_at: "2026-10-02T00:00:00Z", answered_at: "2026-10-01T00:00:00Z" },
        now,
      ),
    ).toBe("revoked");
  });
  it("이미 답했으면 기한이 지나도 answered", () => {
    expect(
      getQuestionnaireTokenState(
        { ...base, answered_at: "2026-10-01T00:00:00Z", expires_at: "2026-10-02T00:00:00Z" },
        now,
      ),
    ).toBe("answered");
  });
  it("기한이 지났으면 expired (경계 포함)", () => {
    expect(getQuestionnaireTokenState({ ...base, expires_at: "2026-10-02T23:59:59Z" }, now)).toBe("expired");
    expect(getQuestionnaireTokenState({ ...base, expires_at: "2026-10-03T00:00:00Z" }, now)).toBe("expired");
  });
});

describe("isQuestionnaireTokenFormat", () => {
  it("32자리 소문자 hex 만 통과", () => {
    expect(isQuestionnaireTokenFormat("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isQuestionnaireTokenFormat("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isQuestionnaireTokenFormat("abc")).toBe(false);
    expect(isQuestionnaireTokenFormat("0123456789abcdef0123456789abcdef%")).toBe(false);
  });
});
