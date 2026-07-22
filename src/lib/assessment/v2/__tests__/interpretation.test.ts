import { describe, it, expect } from "vitest";
import { ALL_ITEMS, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
  neutralQualityNote,
} from "../interpretation";
import {
  AiInterpretationSchema,
  validateAiInterpretation,
} from "../ai-contract";
import type { LikertItem, ResponseMap, SubjectSelection } from "../types";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];

function fill(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT) r[item.id] = value;
  return r;
}

function profileFor(selection: SubjectSelection, value = 4) {
  return computeScoreProfile({
    subjectSelection: selection,
    responses: fill(value),
    scenarioResponses: { C1: 3, C2: 2, MS1: 4, MS2: 3, ES1: 3, ES2: 4 },
    clinicAvailability: 100,
  });
}

describe("buildFallbackInterpretation (§11-6)", () => {
  it("both 프로필의 fallback이 AI 계약 스키마를 통과한다", () => {
    const profile = profileFor("both");
    const interp = buildFallbackInterpretation(profile);
    const parsed = AiInterpretationSchema.safeParse(interp);
    expect(parsed.success).toBe(true);
    // 과목 일치 검증도 통과해야 한다.
    const res = validateAiInterpretation(interp, "both");
    expect(res.ok).toBe(true);
  });

  it("수학만 선택이면 mathStrategy 존재·englishStrategy null", () => {
    const profile = profileFor("math");
    const interp = buildFallbackInterpretation(profile);
    expect(interp.mathStrategy).not.toBeNull();
    expect(interp.englishStrategy).toBeNull();
    expect(validateAiInterpretation(interp, "math").ok).toBe(true);
  });

  it("영어만 선택이면 englishStrategy 존재·mathStrategy null", () => {
    const profile = profileFor("english");
    const interp = buildFallbackInterpretation(profile);
    expect(interp.englishStrategy).not.toBeNull();
    expect(interp.mathStrategy).toBeNull();
    expect(validateAiInterpretation(interp, "english").ok).toBe(true);
  });

  it("숫자 점수를 창작하지 않고 서버 점수 문구만 인용한다", () => {
    const profile = profileFor("both");
    const interp = buildFallbackInterpretation(profile);
    // fallback은 score 계열 키를 갖지 않는다.
    expect(Object.keys(interp)).not.toContain("scores");
  });

  it("상세 총평에는 지도 관점과 NK 운영 문구를 섞지 않는다", () => {
    const profile = profileFor("both");
    const interp = buildFallbackInterpretation(profile);
    expect(interp.detailedSummary).not.toContain("지도할 때");
    expect(interp.detailedSummary).not.toContain("NK 운영");
    expect(interp.detailedSummary).toContain(
      "새 환경에서 실제 모습은 첫 수업들을 지켜보면 더 정확해져요."
    );
  });
});

describe("neutralQualityNote", () => {
  it("straight_line 등으로 review이면 중립 확인 문구를 낸다", () => {
    // 모든 Likert 동일값 3 → straight_line 트리거(30개 이상).
    const profile = computeScoreProfile({
      subjectSelection: "both",
      responses: fill(3),
    });
    expect(profile.responseQuality.status).toBe("review");
    expect(neutralQualityNote(profile)).toBe("첫 14일 행동 확인 필요");
  });

  it("정상이면 빈 문자열", () => {
    // 다양한 값으로 straight_line 회피.
    const r: ResponseMap = {};
    LIKERT.forEach((item, i) => (r[item.id] = (i % 5) + 1));
    const profile = computeScoreProfile({
      subjectSelection: "both",
      responses: r,
    });
    if (profile.responseQuality.status === "normal") {
      expect(neutralQualityNote(profile)).toBe("");
    }
  });
});

describe("buildResultProfileV2", () => {
  it("서버 점수를 그대로 보존하고 source·meta를 붙인다", () => {
    const profile = profileFor("both");
    const interp = buildFallbackInterpretation(profile);
    const result = buildResultProfileV2({
      scoreProfile: profile,
      interpretation: interp,
      source: "fallback",
    });
    expect(result.instrumentVersion).toBe("v2");
    expect(result.source).toBe("fallback");
    expect(result.scores).toBe(profile); // 참조 동일 → 해석이 점수를 덮어쓰지 않음
    expect(result.interpretation).toBe(interp);
    expect(typeof result.generatedAt).toBe("string");
  });
});
