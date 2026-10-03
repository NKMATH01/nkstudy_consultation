import { describe, it, expect } from "vitest";
import { ALL_ITEMS, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "../interpretation";
import {
  MAX_NARRATIVE_LENGTH,
  buildAiSafeInput,
  buildV2AnalysisPrompt,
  redactNarrative,
} from "../serializer";
import { buildParentAnswerRows, buildParentAnswersSafe, buildParentSafeProfile } from "../parent-safe";
import type { LikertItem, ResponseMap } from "../types";

describe("redactNarrative — 전화번호 전반", () => {
  const phones = [
    "010-1234-5678",
    "010 1234 5678",
    "01012345678",
    "(010)1234-5678",
    "02-123-4567",
    "02-1234-5678",
    "(02) 123-4567",
    "031-401-8102",
    "031.401.8102",
    "(031)401-8102",
    "0314018102",
    "070-1234-5678",
    "0505-123-4567",
    "080-123-4567",
    "1588-1234",
    "1588 1234",
    "15881234",
    "1644-0000",
  ];
  for (const phone of phones) {
    it(`지운다: ${phone}`, () => {
      const out = redactNarrative(`연락은 ${phone} 로 주세요`);
      expect(out).toContain("[연락처 삭제]");
      expect(out).not.toMatch(/\d{3,}/);
    });
  }

  const keep = [
    "목표는 90~100점입니다",
    "2026-10-03 에 시험",
    "2026.10.03 시험",
    "3-1 단원이 어려워요",
    "중2-1 과정",
    "고1 2학기 수학 85점",
    "하루 2-3시간 공부",
    "1학년 3반 12번",
  ];
  for (const text of keep) {
    it(`오탐 없음: ${text}`, () => {
      expect(redactNarrative(text)).toBe(text);
    });
  }
});

describe("redactNarrative — 길이 한도", () => {
  it("말줄임표까지 포함해 항상 한도 이하", () => {
    const out = redactNarrative("가".repeat(500));
    expect(out.length).toBeLessThanOrEqual(MAX_NARRATIVE_LENGTH);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("학부모 자유서술 300자 + 이메일 경계", () => {
  const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];
  const responses: ResponseMap = Object.fromEntries(LIKERT.map((i) => [i.id, 4]));
  const sp = computeScoreProfile({ subjectSelection: "both", responses, scenarioResponses: {} });
  const email = "a@b.kr"; // 6자 → "[이메일 삭제]" 8자로 길어진다
  const q8 = (email + " " + "가".repeat(300)).slice(0, 300); // 원문은 정확히 300자
  const answers = { q1: "적당히", q3: "매주", q4: "그렇다", q5: "그렇다", q7: "다독여 주기", q8 };

  it("redaction 으로 길어져도 AI 블록에서 빠지지 않는다", () => {
    // 실제 경로: analysis-v2 가 buildParentAnswersSafe(1차 redaction) 결과를 serializer 에 넘긴다(2차 검증).
    const firstPass = buildParentAnswersSafe(answers);
    expect(firstPass?.q8).toBeDefined();
    const input = buildAiSafeInput({ scoreProfile: sp, intake: { name: "가상학생" }, parentAnswers: firstPass });
    expect(input.parentAnswers?.requests).toBeDefined();
    expect(input.parentAnswers!.requests!.length).toBeLessThanOrEqual(MAX_NARRATIVE_LENGTH);
    expect(buildV2AnalysisPrompt(input)).toContain("[학부모가 학원에 바라는 점]");
    expect(buildV2AnalysisPrompt(input)).not.toContain(email);
  });

  it("결과지 10번에서도 빠지지 않는다", () => {
    const full = buildResultProfileV2({ scoreProfile: sp, interpretation: buildFallbackInterpretation(sp), source: "fallback" });
    // 실제 경로: 저장된 스냅샷은 이미 1차 redaction 을 거친 값이다.
    const stored = buildParentAnswersSafe(answers);
    const safe = buildParentSafeProfile({ ...full, parentAnswers: stored }, { name: "가상학생", schoolGrade: "중2" });
    expect(safe.parentAnswers?.q8).toBeDefined();
    const rows = buildParentAnswerRows(safe.parentAnswers!);
    expect(rows.find((r) => r.no === 8)?.answer).toContain("[이메일 삭제]");
  });
});
