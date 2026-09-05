import { describe, it, expect } from "vitest";
import { ALL_ITEMS, GUIDANCE_CHOICE_ID, MANAGEMENT_DIRECT_ID, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "../interpretation";
import {
  buildMbtiSafe,
  buildParentSafeProfile,
  buildResponseDistribution,
  findForbiddenKeys,
  PARENT_BEHAVIOR_KEYS,
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

const SCENARIOS = { [MANAGEMENT_DIRECT_ID]: 2, [GUIDANCE_CHOICE_ID]: 2, MS1: 4, MS2: 3, ES1: 3, ES2: 4 };

function resultProfileFor(selection: SubjectSelection, value = 4) {
  const scoreProfile = computeScoreProfile({
    subjectSelection: selection,
    responses: fill(value),
    scenarioResponses: SCENARIOS,
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
      const safe = buildParentSafeProfile(full, DISPLAY, fill(4), { type: "ENFP", confidence: "high" }, {
        prevConcerns: ["질문·오답 피드백 부족"],
        entryPriority: "숙제 시작",
        mathDifficultyTags: ["서술형·증명"],
      });
      const hits = findForbiddenKeys(safe);
      expect(hits, `${sel}: ${hits.join(", ")}`).toEqual([]);
    }
  });

  it("금지 필드 목록이 실제 result_profile_v2에는 존재함을 확인(테스트 자체 검증)", () => {
    const originalHits = findForbiddenKeys(resultProfileFor("both"));
    expect(originalHits.length).toBeGreaterThan(0);
  });

  it("학부모용 필수 표시 필드가 존재한다", () => {
    const safe = buildParentSafeProfile(resultProfileFor("both"), DISPLAY);
    expect(safe.interpretation.parentSummary.length).toBeGreaterThan(0);
    expect(safe.interpretation.studentType.length).toBeGreaterThan(0);
    expect(safe.interpretation.strengths.length).toBeGreaterThan(0);
    expect(safe.scores.common.learningAttitude).toBeDefined();
    expect(safe.display.name).toBe("가상학생");
    expect(safe.instrumentRevision).toBe("v2.3-nine-questions-46");
  });

  it("공통 아홉 척도를 원본 값 그대로 담고 과목 위험축은 담지 않는다", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(Object.keys(safe.scores.common).sort()).toEqual([...PARENT_BEHAVIOR_KEYS].sort());
    for (const key of PARENT_BEHAVIOR_KEYS) {
      expect(safe.scores.common[key]).toBe(full.scores.common[key]);
    }
    expect(safe.scores.math).toEqual({ mathStrategy: full.scores.math?.mathStrategy });
    const json = JSON.stringify(safe);
    expect(json).not.toContain("mathNoveltyAvoidance");
    expect(json).not.toContain('"nkFit"');
    expect(json).not.toContain("situations");
  });

  it("과거 점수 프로필에 새 축이 없으면 undefined 대신 정보 부족으로 정규화한다", () => {
    const full = resultProfileFor("both");
    delete (full.scores.common as unknown as Record<string, unknown>).goalClarity;
    delete (full.scores.common as unknown as Record<string, unknown>).managementAcceptance;
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.scores.common.goalClarity).toBe("insufficient");
    expect(safe.scores.common.managementAcceptance).toBe("insufficient");
  });

  it("핵심 판단 두 가지를 판정·본인 답·확인 여부만 담아 전달한다", () => {
    const safe = buildParentSafeProfile(resultProfileFor("both"), DISPLAY);
    expect(safe.verdicts?.management.verdict).toBe("도움이 있으면 버팀");
    expect(safe.verdicts?.management.directAnswer).toBe("힘들어도 해 보겠다");
    expect(safe.verdicts?.guidance.verdict).toBe("강하게 하되 다독임을 같이");
    expect(safe.verdicts?.guidance.choiceText).toContain("차분히");
    expect(JSON.stringify(safe.verdicts)).not.toContain("basisItems");
  });

  it("과거 14일·2주 표현의 여러 변형을 입학 상담 문맥으로 바꾼다", () => {
    for (const text of ["향후 14일간 확인합니다.", "14일 후 다시 봅니다.", "첫 2주 동안 관찰합니다.", "2주 후에 평가합니다."]) {
      const converted = toEntranceReportWording(text);
      expect(converted).not.toMatch(/14일|2주/);
      expect(converted).toContain("입학 상담");
    }
  });

  it("문단 구분(빈 줄)은 유지한다", () => {
    expect(toEntranceReportWording("첫 문단.\n\n둘째 문단.")).toBe("첫 문단.\n\n둘째 문단.");
  });

  it("연락처·상담자 전용 문구를 담지 않는다", () => {
    const json = JSON.stringify(buildParentSafeProfile(resultProfileFor("both"), DISPLAY));
    expect(json).not.toContain("teacherBrief");
    expect(json).not.toContain("verificationPlan14Days");
    expect(json).not.toContain("coreObservation");
    expect(json).not.toContain("recommendedCoaching");
  });

  it("상세 총평(detailedSummary)을 학부모 총평으로 허용한다", () => {
    const full = resultProfileFor("both");
    const safe = buildParentSafeProfile(full, DISPLAY);
    expect(safe.interpretation.detailedSummary).toBe(full.interpretation.detailedSummary);
    expect((safe.interpretation.detailedSummary ?? "").length).toBeGreaterThan(0);
    expect(findForbiddenKeys(safe)).toEqual([]);
  });

  it("수학만 선택이면 english 전략이 null이다", () => {
    const safe = buildParentSafeProfile(resultProfileFor("math"), DISPLAY);
    expect(safe.scores.english).toBeNull();
    expect(safe.interpretation.englishStrategy).toBeNull();
    expect(safe.interpretation.mathStrategy).not.toBeNull();
  });

  it("findForbiddenKeys는 중첩 배열 안의 금지 키도 찾는다", () => {
    expect(findForbiddenKeys({ a: [{ teacherBrief: ["x"] }] })).toContain("$.a[0].teacherBrief");
  });

  it("PARENT_FORBIDDEN_KEYS에 핵심 상담자 필드가 포함되어 있다", () => {
    expect(PARENT_FORBIDDEN_KEYS).toContain("teacherBrief");
    expect(PARENT_FORBIDDEN_KEYS).toContain("crossEvidence");
    expect(PARENT_FORBIDDEN_KEYS).toContain("parent_phone");
    expect(PARENT_FORBIDDEN_KEYS).toContain("prev_academy");
  });
});

describe("학생이 직접 적은 답", () => {
  it("이름·연락처를 지운 뒤 담고, 비어 있는 칸은 키 자체를 넣지 않는다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, null, {
      entryPriority: "가상학생은 숙제 시작을 돕고 010-1234-5678로 알려주세요",
      problemSelf: "집중이 오래 안 가요",
      dream: "",
      requests: "   ",
    });
    expect(p.studentAnswers?.entryPriority).toContain("숙제 시작");
    expect(p.studentAnswers?.entryPriority).toContain("[연락처 삭제]");
    expect(p.studentAnswers?.entryPriority).not.toContain("가상학생");
    expect(p.studentAnswers?.problemSelf).toBe("집중이 오래 안 가요");
    expect(p.studentAnswers).not.toHaveProperty("dream");
    expect(p.studentAnswers).not.toHaveProperty("requests");
    expect(JSON.stringify(p)).not.toContain("commitment14");
  });

  it("과목별 어려운 점 선택을 최대 3개까지 담는다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, null, {
      mathDifficultyTags: ["서술형·증명", "시간이 모자람", "외우기", "계산·풀이 실수"],
      englishDifficultyTags: [],
    });
    expect(p.difficultyTags?.math).toHaveLength(3);
    expect(p.difficultyTags).not.toHaveProperty("english");
  });

  it("아무것도 적지 않았으면 studentAnswers·difficultyTags 자체가 없다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY);
    expect(p.studentAnswers).toBeUndefined();
    expect(p.difficultyTags).toBeUndefined();
  });
});

describe("buildResponseDistribution — 빈도 문항 선택지 분포", () => {
  it("빈도 문항만 세고 동의 문항은 섞지 않는다", () => {
    const dist = buildResponseDistribution({ ...fill(3), LA1: 5, MA1: "not_applicable" }, "math");
    expect(dist).toBeDefined();
    const frequencyCount = ALL_ITEMS.filter(
      (i) => isLikert(i) && i.scale === "frequency" && (i.subject === "common" || i.subject === "math"),
    ).length;
    expect(dist!.total).toBe(frequencyCount);
    expect(dist!.counts[4]).toBe(1);
    expect(dist!.notApplicable).toBe(1);
  });

  it("응답이 없으면 undefined", () => {
    expect(buildResponseDistribution(null, "math")).toBeUndefined();
    expect(buildResponseDistribution({}, "math")).toBeUndefined();
  });

  it("스냅샷에 응답을 주면 분포가 담기고 문항 문장은 담기지 않는다", () => {
    const p = buildParentSafeProfile(resultProfileFor("math"), DISPLAY, fill(4));
    expect(p.responseDistribution?.total).toBeGreaterThan(0);
    expect(JSON.stringify(p)).not.toContain("숙제를 기한 안에 낸다");
  });
});

describe("buildMbtiSafe — 표시 게이트", () => {
  it("확신도 high/medium이면 통과한다", () => {
    expect(buildMbtiSafe({ type: "ENFP", confidence: "high" })).toEqual({ type: "ENFP", confidence: "high" });
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
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, { type: "ENFP", confidence: "high" });
    expect(p.mbti).toEqual({ type: "ENFP", confidence: "high" });
  });

  it("확신도가 낮으면 필드 자체가 없다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, { type: "ENFP", confidence: "low" });
    expect(p.mbti).toBeUndefined();
  });
});

describe("buildParentSafeProfile — 이전 경험 전환 약속", () => {
  it("구조화 범주만 공개 가능한 고정 약속으로 담고 학원명은 싣지 않는다", () => {
    const p = buildParentSafeProfile(resultProfileFor("both"), DISPLAY, null, null, {
      prevConcerns: ["질문·오답 피드백 부족"],
      prevComplaint: "질문을 받아주지 않았다",
    });
    expect(p.transitionPlan?.[0].title).toBe("질문과 오답을 남기지 않기");
    expect(p.studentAnswers?.prevComplaint).toBe("질문을 받아주지 않았다");
    expect(findForbiddenKeys(p)).toEqual([]);
  });
});
