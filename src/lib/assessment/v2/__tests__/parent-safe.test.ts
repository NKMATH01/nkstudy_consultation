import { describe, it, expect } from "vitest";
import { ALL_ITEMS, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "../interpretation";
import {
  buildParentSafeProfile,
  findForbiddenKeys,
  PARENT_FORBIDDEN_KEYS,
} from "../parent-safe";
import type { LikertItem, ResponseMap, SubjectSelection } from "../types";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];

function fill(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT) r[item.id] = value;
  return r;
}

function resultProfileFor(selection: SubjectSelection, value = 4) {
  const scoreProfile = computeScoreProfile({
    subjectSelection: selection,
    responses: fill(value),
    scenarioResponses: { C1: 3, C2: 2, MS1: 4, MS2: 3, ES1: 3, ES2: 4 },
    clinicAvailability: 100,
    mbti: { type: "ENFP", confidence: "high" },
  });
  return buildResultProfileV2({
    scoreProfile,
    interpretation: buildFallbackInterpretation(scoreProfile),
    source: "fallback",
  });
}

const DISPLAY = { name: "가상학생", schoolGrade: "중2" };

describe("buildParentSafeProfile allowlist (§12.3)", () => {
  it("금지 필드가 payload 어디에도 존재하지 않는다", () => {
    for (const sel of ["math", "english", "both"] as SubjectSelection[]) {
      const full = resultProfileFor(sel);
      const safe = buildParentSafeProfile(full, DISPLAY);
      const hits = findForbiddenKeys(safe);
      expect(hits, `${sel}: ${hits.join(", ")}`).toEqual([]);
    }
  });

  it("금지 필드 목록이 실제 result_profile_v2에는 존재함을 확인(테스트 자체 검증)", () => {
    // parent-safe가 진짜 제거하는지 보이기 위해, 원본에는 금지 키가 있음을 확인한다.
    const full = resultProfileFor("both");
    const originalHits = findForbiddenKeys(full);
    // 원본에는 teacherBrief·crossEvidence·situations·verificationPlan14Days 등이 있다.
    expect(originalHits.length).toBeGreaterThan(0);
  });

  it("학부모용 필수 표시 필드가 존재한다", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.interpretation.parentSummary.length).toBeGreaterThan(0);
    expect(safe.interpretation.studentType.length).toBeGreaterThan(0);
    expect(safe.interpretation.strengths.length).toBeGreaterThan(0);
    expect(safe.interpretation.roadmap12Weeks.length).toBeGreaterThan(0);
    expect(safe.scores.common.learningAttitude).toBeDefined();
    expect(safe.scores.nkFit.stage.length).toBeGreaterThan(0);
    expect(safe.display.name).toBe("가상학생");
  });

  it("연락처·상담자 전용 문구를 담지 않는다", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    const json = JSON.stringify(safe);
    // 상담자 전용 키(교사 브리핑·14일 확인 계획)는 흘러들어가지 않는다.
    expect(json).not.toContain("teacherBrief");
    expect(json).not.toContain("verificationPlan14Days");
    expect(json).not.toContain("coreObservation");
    expect(json).not.toContain("recommendedCoaching");
  });

  it("상세 총평(detailedSummary)을 학부모 총평으로 허용한다(전 영역 쉬운말 총평)", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    // detailedSummary는 이제 학부모 공유본 01 종합 분석 본문에 쓰이므로 허용·전달된다.
    expect(safe.interpretation.detailedSummary).toBe(full.interpretation.detailedSummary);
    expect((safe.interpretation.detailedSummary ?? "").length).toBeGreaterThan(0);
    // 허용 후에도 forbidden 감사에서 걸리지 않는다.
    expect(findForbiddenKeys(safe)).toEqual([]);
  });

  it("점수는 서버 원본과 동일하다(값 변조 없음)", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.scores.common).toEqual(full.scores.common);
    expect(safe.scores.math).toEqual(full.scores.math);
    expect(safe.scores.nkFit.stage).toBe(full.scores.nkFit.stage);
    expect(safe.scores.nkFit.overall).toBe(full.scores.nkFit.overall);
  });

  it("수학만 선택이면 english 전략이 null이다", () => {
    const full = resultProfileFor("math");
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.scores.english).toBeNull();
    expect(safe.interpretation.englishStrategy).toBeNull();
    expect(safe.interpretation.mathStrategy).not.toBeNull();
  });

  it("findForbiddenKeys는 중첩 배열 안의 금지 키도 찾는다", () => {
    const bad = { a: [{ teacherBrief: ["x"] }] };
    expect(findForbiddenKeys(bad)).toContain("$.a[0].teacherBrief");
  });

  it("PARENT_FORBIDDEN_KEYS에 핵심 상담자 필드가 포함되어 있다", () => {
    expect(PARENT_FORBIDDEN_KEYS).toContain("teacherBrief");
    expect(PARENT_FORBIDDEN_KEYS).toContain("crossEvidence");
    expect(PARENT_FORBIDDEN_KEYS).toContain("parent_phone");
  });
});
