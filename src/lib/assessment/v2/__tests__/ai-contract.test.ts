import { describe, it, expect } from "vitest";
import {
  validateAiInterpretation,
  containsNumericScoreClaim,
  type AiInterpretation,
} from "../ai-contract";

function validInterp(overrides: Partial<AiInterpretation> = {}): AiInterpretation {
  return {
    studentType: "따뜻한 도전형",
    detailedSummary: "관찰 근거와 의미, 지도 행동, 14일 확인 지표를 담은 총평.",
    coreObservation: "핵심 관찰.",
    operatingCause: "원인 가설.",
    recommendedCoaching: "권장 지도.",
    verificationPlan14Days: ["숙제 시작 시각 기록"],
    teacherBrief: ["지도 유형 확인"],
    strengths: ["숙제 신뢰도"],
    growthAreas: ["단기 회복력"],
    crossEvidence: [],
    nkFitInterpretation: "지원 전제 일치.",
    mathStrategy: "수학 전략 해석.",
    englishStrategy: "영어 전략 해석.",
    roadmap12Weeks: [{ weeks: "1~4주", focus: "구조 형성", actions: ["담임 확인"] }],
    parentSummary: "학부모 요약.",
    cautions: [],
    ...overrides,
  };
}

describe("validateAiInterpretation (§11)", () => {
  it("정상 출력을 통과시킨다", () => {
    const res = validateAiInterpretation(validInterp(), "both");
    expect(res.ok).toBe(true);
  });

  it("숫자 점수 조작 필드가 있으면 거부한다", () => {
    const tampered = { ...validInterp(), scores: { learningAttitude: 99 } };
    const res = validateAiInterpretation(tampered, "both");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("numeric");
  });

  it("필수 필드 누락은 schema 오류로 거부한다", () => {
    const partial = validInterp();
    // @ts-expect-error 의도적 누락
    delete partial.detailedSummary;
    const res = validateAiInterpretation(partial, "both");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("schema");
  });

  it("계약에 없는 필드(strict)는 거부한다", () => {
    const extra = { ...validInterp(), mbtiVerdict: "확정 게으름" };
    const res = validateAiInterpretation(extra, "both");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("schema");
  });

  it("수학 선택인데 mathStrategy가 null이면 subject 오류로 거부한다", () => {
    const res = validateAiInterpretation(
      validInterp({ mathStrategy: null }),
      "math"
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("subject");
  });

  it("영어 선택인데 englishStrategy가 null이면 subject 오류로 거부한다", () => {
    const res = validateAiInterpretation(
      validInterp({ englishStrategy: null }),
      "english"
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("subject");
  });

  it("미선택 과목 전략은 null로 정규화한다", () => {
    // 영어만 선택인데 AI가 mathStrategy를 창작 → 제거되어야 한다.
    const res = validateAiInterpretation(validInterp(), "english");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.mathStrategy).toBeNull();
      expect(res.data.englishStrategy).not.toBeNull();
    }
  });

  it("빈 문자열 필드는 통과하지 못한다", () => {
    const res = validateAiInterpretation(
      validInterp({ studentType: "   " }),
      "both"
    );
    expect(res.ok).toBe(false);
  });
});

describe("containsNumericScoreClaim", () => {
  it("score 계열 키를 감지한다", () => {
    expect(containsNumericScoreClaim({ scores: {} })).toBe(true);
    expect(containsNumericScoreClaim({ nkFit: {} })).toBe(true);
    expect(containsNumericScoreClaim({ studentType: "x" })).toBe(false);
    expect(containsNumericScoreClaim(null)).toBe(false);
  });
});

// studentType은 학부모 화면 첫 줄에 그대로 나가므로 내부 표현이 새면 안 된다.
describe("studentType 계약", () => {
  function withType(studentType: string) {
    return { ...validInterp(), studentType };
  }

  it("행동 조합 문장은 통과한다", () => {
    const res = validateAiInterpretation(
      withType("숙제는 기한 안에 챙기지만, 낮은 점수 뒤 다시 시작까지 시간이 걸리는 학생"),
      "both",
      "강현찬",
    );
    expect(res.ok).toBe(true);
  });

  it("내부 분류명이 들어가면 거부한다", () => {
    for (const bad of ["혼합 반응 유형", "14일 관찰형", "자기주도형 학생"]) {
      const res = validateAiInterpretation(withType(bad), "both");
      expect(res.ok, bad).toBe(false);
      if (!res.ok) expect(res.reason).toBe("studentType");
    }
  });

  it("영문 키·문항 ID가 들어가면 거부한다", () => {
    for (const bad of ["learningAttitude가 높은 학생", "M9 문항이 높은 학생"]) {
      const res = validateAiInterpretation(withType(bad), "both");
      expect(res.ok, bad).toBe(false);
    }
  });

  it("내부 코드(NKFit·상황문항)가 들어가면 거부한다", () => {
    for (const bad of ["NKFit이 높은 학생", "상황문항에서 흔들리는 학생"]) {
      const res = validateAiInterpretation(withType(bad), "both");
      expect(res.ok, bad).toBe(false);
    }
  });

  it("학생 실명이 들어가면 거부한다", () => {
    const res = validateAiInterpretation(
      withType("강현찬은 숙제를 잘 챙기는 학생"),
      "both",
      "강현찬",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.detail).toContain("실명");
  });

  it("이름을 넘기지 않으면 실명 검사는 건너뛴다", () => {
    const res = validateAiInterpretation(withType("숙제를 잘 챙기는 학생"), "both");
    expect(res.ok).toBe(true);
  });
});
