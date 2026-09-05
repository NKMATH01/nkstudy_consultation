import { describe, it, expect } from "vitest";
import { ALL_ITEMS, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "../interpretation";
import {
  buildParentSafeProfile,
  buildBehaviorEvidence,
  buildMbtiSafe,
  buildPeerResponses,
  findForbiddenKeys,
  PARENT_FORBIDDEN_KEYS,
  toEntranceReportWording,
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
    // R2는 강제선택(1|2). 상황문항과 같은 버킷을 쓴다.
    scenarioResponses: { R2: 2, C1: 3, C2: 2, MS1: 4, MS2: 3, ES1: 3, ES2: 4 },
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
    expect(safe.scores.common.learningAttitude).toBeDefined();
    expect(safe.display.name).toBe("가상학생");
  });

  it("과거 점수 프로필에 새 축이 없으면 undefined 대신 정보 부족으로 정규화한다", () => {
    const full = resultProfileFor("both");
    delete (full.scores.common as unknown as Record<string, unknown>).helpSeeking;
    delete (full.scores.common as unknown as Record<string, unknown>).feedbackExecution;
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.scores.common.helpSeeking).toBe("insufficient");
    expect(safe.scores.common.feedbackExecution).toBe("insufficient");
  });

  it("과거 14일·2주 표현의 여러 변형을 입학 상담 문맥으로 바꾼다", () => {
    for (const text of [
      "향후 14일간 확인합니다.",
      "14일 후 다시 봅니다.",
      "첫 2주 동안 관찰합니다.",
      "2주 후에 평가합니다.",
    ]) {
      const converted = toEntranceReportWording(text);
      expect(converted).not.toMatch(/14일|2주/);
      expect(converted).toContain("입학 상담");
    }
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

  it("공개에 필요한 다문항 핵심 점수만 원본 값 그대로 담는다", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.scores.common).toEqual({
      learningAttitude: full.scores.common.learningAttitude,
      homeworkReliability: full.scores.common.homeworkReliability,
      helpSeeking: full.scores.common.helpSeeking,
      feedbackExecution: full.scores.common.feedbackExecution,
      phoneBoundary: full.scores.common.phoneBoundary,
      longTermPersistence: full.scores.common.longTermPersistence,
      shortTermRecovery: full.scores.common.shortTermRecovery,
    });
    expect(safe.scores.math).toEqual({ mathStrategy: full.scores.math?.mathStrategy });
    expect(JSON.stringify(safe)).not.toContain('"nkFit"');
    expect(JSON.stringify(safe)).not.toContain("nkFitInterpretation");
    expect(JSON.stringify(safe)).not.toContain("mathSelfEfficacy");
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

// 또래 문항은 합산 점수 대신 "문항 요지 + 고른 보기"로만 내보낸다.
describe("buildPeerResponses", () => {
  it("F1~F4를 문항 원문과 보기 문구로 바꾼다", () => {
    const out = buildPeerResponses({ F1: 4, F2: 5, F3: 3, F4: 2 });
    expect(out).toHaveLength(4);
    expect(out[0].question).toContain("먼저 질문");
    expect(out[0].answerLabel).toBe("대체로 맞다");
    expect(out[1].answerLabel).toBe("매우 잘 맞다");
    expect(out[3].answerLabel).toBe("별로 맞지 않다");
  });

  it("점수를 담지 않는다", () => {
    for (const item of buildPeerResponses({ F1: 4, F2: 5, F4: 2 })) {
      expect(Object.keys(item).sort()).toEqual(["answerLabel", "question"]);
    }
  });

  it("F3도 점수 없이 학생이 고른 답 그대로 포함한다", () => {
    const out = buildPeerResponses({ F1: 3, F3: 5 });
    expect(out).toHaveLength(2);
    expect(JSON.stringify(out)).toContain("대화 때문에");
  });

  it("응답이 없거나 범위를 벗어나면 건너뛴다", () => {
    expect(buildPeerResponses(null)).toEqual([]);
    expect(buildPeerResponses({})).toEqual([]);
    expect(buildPeerResponses({ F1: 0, F2: 6, F4: "3" })).toEqual([]);
  });
});

describe("buildParentSafeProfile — peerResponses", () => {
  it("응답을 주면 peerResponses가 담긴다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, { F1: 4, F2: 4, F3: 2, F4: 4 });
    expect(p.peerResponses).toHaveLength(4);
  });

  // 예전에 발급된 공유 토큰에는 이 필드가 없다. 화면이 없을 때도 동작해야 한다.
  it("응답을 주지 않으면 필드 자체가 없다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY);
    expect(p.peerResponses).toBeUndefined();
  });

  it("peerResponses에도 금지 키가 섞이지 않는다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, { F1: 4 });
    const json = JSON.stringify(p.peerResponses);
    for (const key of PARENT_FORBIDDEN_KEYS) {
      expect(json).not.toContain(key);
    }
  });
});

describe("buildBehaviorEvidence — 핵심 행동의 답변 근거", () => {
  it("구인별로 중간에서 멀리 떨어진 답을 최대 2개만 담고 점수는 담지 않는다", () => {
    const evidence = buildBehaviorEvidence({ H1: 5, H2: 3, H3: 1, H4: 4, Q1: 5 });
    expect(evidence.homeworkReliability).toHaveLength(2);
    expect(evidence.homeworkReliability?.map((item) => item.answerLabel)).toEqual([
      "할 때마다 했다",
      "거의 하지 않았다",
    ]);
    expect(Object.keys(evidence.homeworkReliability?.[0] ?? {}).sort()).toEqual([
      "answerLabel",
      "question",
    ]);
    expect(evidence.helpSeeking).toHaveLength(1);
  });
});

// MBTI는 "잘 모르겠다"고 답한 경우 결과지에 싣지 않는다(근거 없는 단정 방지).
describe("buildMbtiSafe — 표시 게이트", () => {
  it("확신도 high/medium이면 통과한다", () => {
    expect(buildMbtiSafe({ type: "ENFP", confidence: "high" })).toEqual({
      type: "ENFP",
      confidence: "high",
    });
    expect(buildMbtiSafe({ type: "istj", confidence: "medium" })?.type).toBe("ISTJ");
  });

  it("확신도 low/none/미선택이면 표시하지 않는다", () => {
    for (const c of ["low", "none", "", null, undefined]) {
      expect(buildMbtiSafe({ type: "ENFP", confidence: c }), String(c)).toBeUndefined();
    }
  });

  it("MBTI 형식이 아니면 표시하지 않는다", () => {
    for (const t of ["ENF", "ENFPX", "XXXX", "", null]) {
      expect(buildMbtiSafe({ type: t, confidence: "high" }), String(t)).toBeUndefined();
    }
  });

  it("입력 자체가 없으면 표시하지 않는다", () => {
    expect(buildMbtiSafe(null)).toBeUndefined();
    expect(buildMbtiSafe(undefined)).toBeUndefined();
  });
});

describe("buildParentSafeProfile — mbti", () => {
  it("확신도가 높으면 스냅샷에 담긴다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, {
      type: "ENFP",
      confidence: "high",
    });
    expect(p.mbti).toEqual({ type: "ENFP", confidence: "high" });
  });

  it("확신도가 낮으면 필드 자체가 없다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, {
      type: "ENFP",
      confidence: "low",
    });
    expect(p.mbti).toBeUndefined();
  });

  it("지도 선호는 축 점수 없이 학생이 고른 보기만 담는다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, {
      R2: 2,
      R3: 4,
      R4: 3,
      R5: 5,
      R6: 4,
    }, {
      type: "ENFP",
      confidence: "high",
    });
    expect(p.preferenceResponses).toHaveLength(5);
    expect(p.preferenceResponses?.[0].answerLabel).toContain("수업이 끝난 뒤");
    expect(JSON.stringify(p)).not.toContain("mbtiAxes");
  });
});

describe("buildParentSafeProfile — 이전 경험 전환 약속", () => {
  it("학생의 입학 상담 우선 도움은 개인정보를 지운 뒤 새 이름으로만 담는다", () => {
    const p = buildParentSafeProfile(
      resultProfileFor("both"),
      DISPLAY,
      null,
      null,
      {
        entryPriority: "가상학생은 숙제 시작을 돕고 010-1234-5678로 알려주세요",
      },
    );
    expect(p.entryPriority).toContain("숙제 시작");
    expect(p.entryPriority).toContain("[연락처 삭제]");
    expect(JSON.stringify(p)).not.toContain("commitment14");
  });

  it("구조화 범주만 공개 가능한 고정 약속으로 담는다", () => {
    const p = buildParentSafeProfile(
      resultProfileFor("both"),
      DISPLAY,
      null,
      null,
      {
        prevConcerns: ["질문·오답 피드백 부족"],
        prevComplaint: "OO학원의 김선생님은 질문을 받아주지 않았다",
      },
    );
    expect(p.transitionPlan?.[0].title).toBe("질문과 오답을 남기지 않기");
    const json = JSON.stringify(p);
    expect(json).not.toContain("OO학원");
    expect(json).not.toContain("김선생님");
    expect(findForbiddenKeys(p)).toEqual([]);
  });
});
