import { describe, it, expect } from "vitest";
import {
  ALL_ITEMS,
  REVERSE_IDS,
  isLikert,
} from "../definition";
import {
  adjustAxis,
  MBTI_CONFIDENCE_WEIGHT,
  band,
  classifyCoaching,
  computeScoreProfile,
  deriveConscientiousness,
  normalizeResponse,
} from "../scoring";
import type { LikertItem, ResponseMap, ScenarioResponseMap } from "../types";

const LIKERT_ITEMS = ALL_ITEMS.filter(isLikert) as LikertItem[];

/** 모든 Likert를 정방향 최대(역문항=1, 정문항=5)로 채운다 → 모든 composite 100. */
function positiveMaxResponses(): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT_ITEMS) {
    r[item.id] = REVERSE_IDS.has(item.id) ? 1 : 5;
  }
  return r;
}

/** 모든 Likert를 동일한 raw 값으로 채운다. */
function uniformResponses(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT_ITEMS) r[item.id] = value;
  return r;
}

// 상황문항 + 강제선택(R2). 둘 다 선택지 index로 답한다.
const ALL_SCENARIOS: ScenarioResponseMap = {
  R2: 2,
  C1: 1,
  C2: 1,
  MS1: 1,
  MS2: 1,
  ES1: 1,
  ES2: 1,
};

// ── definition 무결성 ────────────────────────────────────────────────

describe("definition 무결성", () => {
  // [스펙 변경] R3-1·R3-2 추가(공통 +2), M5 폐기(수학 -1) → 순증 +1문항.
  it("문항 수: 공통 38 / 수학 11 / 영어 12", () => {
    const common = ALL_ITEMS.filter((i) => i.subject === "common");
    const math = ALL_ITEMS.filter((i) => i.subject === "math");
    const english = ALL_ITEMS.filter((i) => i.subject === "english");
    expect(common).toHaveLength(38);
    expect(math).toHaveLength(11);
    expect(english).toHaveLength(12);
  });

  it("direction=reverse인 문항은 정확히 REVERSE_IDS와 일치한다", () => {
    const reverse = LIKERT_ITEMS.filter((i) => i.direction === "reverse")
      .map((i) => i.id)
      .sort();
    expect(reverse).toEqual([...REVERSE_IDS].sort());
  });

  it("M6/M10/E7/E10은 역채점하지 않는다(원방향 위험축)", () => {
    for (const id of ["M6", "M10", "E7", "E10"]) {
      const item = LIKERT_ITEMS.find((i) => i.id === id)!;
      expect(item.direction).toBe("positive");
      expect(REVERSE_IDS.has(id)).toBe(false);
    }
  });
});

// ── 8.1 기본 환산 / clamp ────────────────────────────────────────────

describe("정방향/역방향 환산", () => {
  it("정방향 1~5 → 0/25/50/75/100", () => {
    expect([1, 2, 3, 4, 5].map((v) => normalizeResponse(v, false))).toEqual([
      0, 25, 50, 75, 100,
    ]);
  });

  it("역채점 1~5 → 100/75/50/25/0", () => {
    expect([1, 2, 3, 4, 5].map((v) => normalizeResponse(v, true))).toEqual([
      100, 75, 50, 25, 0,
    ]);
  });

  it("환산값은 0~100 범위를 벗어나지 않는다", () => {
    for (let v = 1; v <= 5; v++) {
      const p = normalizeResponse(v, false);
      const n = normalizeResponse(v, true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
});

// ── 8.7.6 fixture 1, 2 ───────────────────────────────────────────────

describe("고정 fixture — 극단값", () => {
  it("정방향=5·역문항=1이면 핵심 composite와 conscientiousness가 100.0", () => {
    const p = computeScoreProfile({
      subjectSelection: "both",
      responses: positiveMaxResponses(),
      scenarioResponses: ALL_SCENARIOS,
    });
    expect(p.common.learningAttitude).toBe(100.0);
    expect(p.common.homeworkReliability).toBe(100.0);
    expect(p.common.phoneBoundary).toBe(100.0);
    expect(p.common.longTermPersistence).toBe(100.0);
    expect(p.common.shortTermRecovery).toBe(100.0);
    expect(p.common.conscientiousness).toBe(100.0);
  });

  it("모든 Likert=3이면 정·역 모두 50.0이고 conscientiousness도 50.0", () => {
    const p = computeScoreProfile({
      subjectSelection: "both",
      responses: uniformResponses(3),
      scenarioResponses: ALL_SCENARIOS,
    });
    expect(p.common.learningAttitude).toBe(50.0);
    expect(p.common.homeworkReliability).toBe(50.0);
    expect(p.common.phoneBoundary).toBe(50.0);
    expect(p.common.longTermPersistence).toBe(50.0);
    expect(p.common.shortTermRecovery).toBe(50.0);
    expect(p.common.conscientiousness).toBe(50.0);
  });
});

// ── 75% 미만 / unknown 제외 ──────────────────────────────────────────

describe("유효응답 비율과 unknown 처리", () => {
  it("유효응답 75% 미만이면 insufficient (2/4)", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { LT1: 5, LT2: 5 },
    });
    expect(p.common.learningAttitude).toBe("insufficient");
  });

  it("정확히 75%(3/4)면 점수를 산출한다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { LT1: 5, LT2: 5, LT3: 5 },
    });
    expect(p.common.learningAttitude).toBe(100.0);
  });

  it("unknown은 0점이 아니라 계산에서 제외한다", () => {
    // LT1~3=5(각 100), LT4=unknown → 유효 3/4, 평균 100 (unknown을 0으로 넣으면 75가 됨)
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { LT1: 5, LT2: 5, LT3: 5, LT4: "unknown" },
    });
    expect(p.common.learningAttitude).toBe(100.0);
  });
});

// ── 장기 의지 vs 단기 회복 분리 ──────────────────────────────────────

describe("장기 의지와 단기 회복 분리", () => {
  it("G/B 문항이 서로 다른 composite로 분리된다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: {
        // longTermPersistence 높음
        G1: 5,
        G2: 5,
        G3: 5,
        G4: 1, // reverse → 100
        // shortTermRecovery 낮음
        B1: 1,
        B2: 5, // reverse → 0
        B3: 1,
        B4: 1,
      },
    });
    expect(p.common.longTermPersistence).toBe(100.0);
    expect(p.common.shortTermRecovery).toBe(0.0);
  });
});

// ── 8.3 성실성 파생식 ───────────────────────────────────────────────

describe("학습 성실성 파생식", () => {
  it("conscientiousness = 0.30·LA + 0.45·HR + 0.25·LTP", () => {
    expect(deriveConscientiousness(100, 0, 50)).toBe(42.5);
    expect(deriveConscientiousness(80, 60, 40)).toBe(0.3 * 80 + 0.45 * 60 + 0.25 * 40);
  });

  it("구성요소가 하나라도 insufficient면 insufficient (재정규화 없음)", () => {
    expect(deriveConscientiousness(100, "insufficient", 50)).toBe("insufficient");
    expect(deriveConscientiousness("insufficient", 50, 50)).toBe("insufficient");
  });

  it("HR이 insufficient면 프로필의 conscientiousness도 insufficient", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: {
        LT1: 5, LT2: 5, LT3: 5, LT4: 1,
        H1: 5, H2: 5, // 2/4 → insufficient
        G1: 5, G2: 5, G3: 5, G4: 1,
      },
    });
    expect(p.common.conscientiousness).toBe("insufficient");
  });
});

// ── 8.4 지도 유형 4분면 ─────────────────────────────────────────────

describe("지도 유형 4분면", () => {
  it("band: high>=60, low<=40, 사이는 mixed", () => {
    expect(band(60)).toBe("high");
    expect(band(40)).toBe("low");
    expect(band(50)).toBe("mixed");
    expect(band("insufficient")).toBeNull();
  });

  it("4분면 이름 매핑", () => {
    expect(classifyCoaching("high", "high")).toBe("따뜻한 도전형");
    expect(classifyCoaching("high", "low")).toBe("직접 도전형");
    expect(classifyCoaching("low", "high")).toBe("안전 기반 점진형");
    expect(classifyCoaching("low", "low")).toBe("낮은 압력의 구조 관찰형");
  });

  it("한 축이라도 mixed면 혼합 반응·14일 관찰형", () => {
    expect(classifyCoaching("mixed", "high")).toBe("혼합 반응·14일 관찰형");
    expect(classifyCoaching("high", "mixed")).toBe("혼합 반응·14일 관찰형");
    expect(classifyCoaching(null, "high")).toBe("혼합 반응·14일 관찰형");
  });

  // [스펙 변경] 직접 피드백 수용이 3문항이 되어 R3 하나만으로는 유효응답 75%에 미치지 못한다.
  it("프로필에서 직접 피드백 3문항·R4 조합으로 coachingType을 결정한다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      // 직접 피드백 3문항 전부 5, 관계 안전 R4=5 → 둘 다 100 → high/high
      responses: { R3: 5, "R3-1": 5, "R3-2": 5, R4: 5 },
    });
    expect(p.coaching.coachingType).toBe("따뜻한 도전형");
  });
});

// ── MBTI 가중 폐기: 지도 선호 축은 학생 설문 응답(raw)만으로 정한다 ────
// [스펙 변경] 예전에는 확신도에 따라 축을 4~8% 밀었다. 그러면 화면에 보이는 위치가
// "학생이 실제로 답한 위치"가 아니게 돼, MBTI가 위치를 정하지 않도록 가중치를 0으로 고정했다.
// 아래 테스트는 기능 유지가 아니라 "MBTI가 축을 움직이지 않음"을 지킨다.

describe("MBTI 보조축 가중 폐기", () => {
  it("어떤 확신도에서도 raw를 움직이지 않는다", () => {
    for (const conf of ["high", "medium", "low", "none"] as const) {
      expect(adjustAxis(50, 100, conf), `${conf}/target100`).toBe(50.0);
      expect(adjustAxis(50, 0, conf), `${conf}/target0`).toBe(50.0);
    }
  });

  it("모든 확신도 가중치가 0이다", () => {
    for (const conf of ["high", "medium", "low", "none"] as const) {
      expect(MBTI_CONFIDENCE_WEIGHT[conf], conf).toBe(0);
    }
  });

  it("clamp 경계에서도 raw 그대로", () => {
    expect(adjustAxis(100, 100, "high")).toBe(100.0);
    expect(adjustAxis(0, 0, "high")).toBe(0.0);
  });
});

// ── MBTI가 핵심 행동점수에 영향을 주지 않음 (fixture 3) ───────────────

describe("MBTI는 핵심 행동점수에 무영향", () => {
  it("행동 응답이 같으면 MBTI만 바꿔도 core/과목/NK readiness가 동일", () => {
    const responses = positiveMaxResponses();
    const base = {
      subjectSelection: "both" as const,
      responses,
      scenarioResponses: ALL_SCENARIOS,
      clinicAvailability: 100 as const,
    };
    const none = computeScoreProfile({ ...base, mbti: null });
    const enfp = computeScoreProfile({
      ...base,
      mbti: { type: "ENFP", confidence: "high" },
    });
    const istj = computeScoreProfile({
      ...base,
      mbti: { type: "ISTJ", confidence: "high" },
    });

    expect(enfp.common).toEqual(none.common);
    expect(istj.common).toEqual(none.common);
    expect(enfp.coaching).toEqual(none.coaching);
    expect(enfp.math).toEqual(none.math);
    expect(enfp.english).toEqual(none.english);
    for (const key of ["clinic", "weeklyTest", "homework", "immediateFeedback"] as const) {
      expect(enfp.nkFit.areas[key].readiness).toBe(none.nkFit.areas[key].readiness);
      expect(istj.nkFit.areas[key].readiness).toBe(none.nkFit.areas[key].readiness);
    }

    // MBTI는 축도 움직이지 않는다(가중 폐기) — applied는 항상 false.
    expect(enfp.mbtiAxes.applied).toBe(false);
    expect(none.mbtiAxes.applied).toBe(false);
    expect(enfp.mbtiAxes.interactionAxis.final).toBe(enfp.mbtiAxes.interactionAxis.raw);
    expect(enfp.mbtiAxes.interactionAxis.delta).toBe(0);
  });

  it("conceptAxis는 lowEvidence로 표시된다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
      mbti: { type: "ENFP", confidence: "high" },
    });
    expect(p.mbtiAxes.conceptAxis.lowEvidence).toBe(true);
    expect(p.mbtiAxes.conceptAxis.raw).toBe(50.0);
  });

  it("원천 문항이 결측이면 해당 축은 insufficient (50 대체 없음)", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: {}, // R1/R3/R4 등 없음, R2 강제선택도 미응답
      mbti: { type: "ENFP", confidence: "high" },
    });
    expect(p.mbtiAxes.interactionAxis.raw).toBe("insufficient");
    expect(p.mbtiAxes.relationalFeedbackAxis.raw).toBe("insufficient");
    expect(p.mbtiAxes.flexibilityAxis.raw).toBe("insufficient");
    // conceptAxis는 결측이 아니라 설계값 50.
    expect(p.mbtiAxes.conceptAxis.raw).toBe(50.0);
  });
});

// ── 8.6 NK 선호/준비도 간극 (fixture 5) ─────────────────────────────

describe("NK 적합도", () => {
  it("N1~N4가 모두 unknown이면 전체 숫자 대신 상담 확인 필요", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: {
        ...positiveMaxResponses(),
        N1: "unknown",
        N2: "unknown",
        N3: "unknown",
        N4: "unknown",
      },
    });
    expect(p.nkFit.stage).toBe("상담 확인 필요");
    expect(p.nkFit.overall).toBeNull();
  });

  it("선호-준비도 간극이 크면 자연스러운 일치로 올라가지 않는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: {
        ...positiveMaxResponses(), // LA/STR/HR/DFA/structure 모두 100
        N1: 5,
        N2: 5,
        N3: 5,
        N4: 5,
      },
      clinicAvailability: 25, // clinic readiness 25 → 큰 간극
    });
    expect(p.nkFit.areas.clinic.gap).toBe(75.0);
    expect(p.nkFit.stage).toBe("지원 전제 일치");
  });

  it("readiness 원천이 insufficient면 readiness와 featureFit이 null", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { N3: 5 }, // homework readiness = homeworkReliability(insufficient)
    });
    expect(p.nkFit.areas.homework.preference).toBe(100.0);
    expect(p.nkFit.areas.homework.readiness).toBeNull();
    expect(p.nkFit.areas.homework.featureFit).toBeNull();
  });
});

// ── 8.7.6 fixture 6 — 과목 분기 ──────────────────────────────────────

describe("과목 분기", () => {
  it("수학 선택은 영어 점수를 만들지 않는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
    });
    expect(p.math).not.toBeNull();
    expect(p.english).toBeNull();
  });

  it("영어 선택은 수학 점수를 만들지 않는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "english",
      responses: positiveMaxResponses(),
    });
    expect(p.english).not.toBeNull();
    expect(p.math).toBeNull();
  });

  it("복합 선택은 두 프로필을 모두 만든다", () => {
    const p = computeScoreProfile({
      subjectSelection: "both",
      responses: positiveMaxResponses(),
    });
    expect(p.math).not.toBeNull();
    expect(p.english).not.toBeNull();
    expect(p.math!.mathStrategy).toBe(100.0);
    expect(p.english!.englishStrategy).toBe(100.0);
  });

  it("위험축(M6/M10/E7/E10)은 전략 점수와 분리되어 원방향으로 계산된다", () => {
    const responses: ResponseMap = { ...positiveMaxResponses() };
    // 위험 문항만 최대(=위험 신호 큼)로, 전략 문항은 최대 유지
    responses.M6 = 5;
    responses.M10 = 5;
    const p = computeScoreProfile({ subjectSelection: "math", responses });
    expect(p.math!.mathNoveltyAvoidance).toBe(100.0); // 원방향: 5 → 100
    expect(p.math!.mathTestInterference).toBe(100.0);
    expect(p.math!.mathStrategy).toBe(100.0); // 전략은 위험축에 섞이지 않음
  });
});

// ── 8.7.6 fixture 7 — 상황문항 무영향 ────────────────────────────────

describe("상황문항 semantic evidence", () => {
  it("option을 A→D로 바꿔도 숫자 composite는 동일하고 태그만 바뀐다", () => {
    const responses = positiveMaxResponses();
    const pA = computeScoreProfile({
      subjectSelection: "both",
      responses,
      scenarioResponses: { C1: 1, C2: 1, MS1: 1, MS2: 1, ES1: 1, ES2: 1 },
    });
    const pD = computeScoreProfile({
      subjectSelection: "both",
      responses,
      scenarioResponses: { C1: 4, C2: 4, MS1: 4, MS2: 4, ES1: 4, ES2: 4 },
    });

    expect(pD.common).toEqual(pA.common);
    expect(pD.math).toEqual(pA.math);
    expect(pD.english).toEqual(pA.english);
    expect(pD.nkFit).toEqual(pA.nkFit);

    expect(pA.situations.C1.choice).toBe("A");
    expect(pA.situations.C1.tags).toEqual([
      "phone_first",
      "delayed_restart",
      "mood_before_action",
    ]);
    expect(pD.situations.C1.choice).toBe("D");
    expect(pD.situations.C1.tags).toEqual([
      "support_seeking",
      "external_structure",
      "scheduled_check",
    ]);
    expect(pA.situations.C1.tags).not.toEqual(pD.situations.C1.tags);
  });

  it("상황문항은 숫자 점수를 만들지 않는다(태그 배열만)", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
      scenarioResponses: { MS1: 3 },
    });
    expect(p.situations.MS1.tags).toEqual(["hint_then_retry"]);
    expect(typeof p.situations.MS1.choice).toBe("string");
  });
});

// ── 8.7.5 응답 품질 ─────────────────────────────────────────────────

describe("응답 품질 flag", () => {
  it("동일 응답이 90% 이상이면 straight_line이며 status=review", () => {
    const p = computeScoreProfile({
      subjectSelection: "both",
      responses: uniformResponses(3), // 54개 Likert 전부 동일
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).toContain("straight_line");
    expect(p.responseQuality.status).toBe("review");
  });

  it("반대 문항쌍 강한 불일치 2개 이상이면 opposite_pair_review", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: {
        // P1↔P2(R): 5 vs 5 → 100 vs 0, 차이 100
        P1: 5,
        P2: 5,
        // G2↔G4(R): 5 vs 5 → 100 vs 0, 차이 100
        G2: 5,
        G4: 5,
      },
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).toContain("opposite_pair_review");
    expect(p.responseQuality.status).toBe("review");
  });

  it("insufficient 사유는 status를 review로 만들지 않는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { LT1: 5, LT2: 4, LT3: 3 }, // 대부분 결측 → insufficient 다수, 그러나 review 아님
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).toContain("insufficient");
    expect(p.responseQuality.status).toBe("normal");
  });

  it("meta 활성시간이 임계값 미만이면 too_fast", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
      meta: { activeSeconds: 120 }, // 단일과목 임계 180초 미만
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).toContain("too_fast");
    expect(p.responseQuality.status).toBe("review");
  });
});

// ── Phase 3 문항 1차 패키지 ──────────────────────────────────────────

describe("R2 강제선택 채점", () => {
  it("A(그 자리에서 질문)는 0, B(끝난 뒤 따로)는 100이며 중간값이 없다", () => {
    const a = computeScoreProfile({
      subjectSelection: "math",
      responses: {},
      scenarioResponses: { R2: 1 },
    });
    const b = computeScoreProfile({
      subjectSelection: "math",
      responses: {},
      scenarioResponses: { R2: 2 },
    });
    expect(a.common.reflectiveProcessingNeed).toBe(0);
    expect(b.common.reflectiveProcessingNeed).toBe(100);
  });

  it("R2를 리커트로 답해도(응답 버킷) 점수가 만들어지지 않는다", () => {
    // 강제선택은 scenarios 버킷에서만 읽는다. 옛 클라이언트가 responses.R2를 보내도 무시된다.
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { R2: 5 } as never,
      scenarioResponses: {},
    });
    expect(p.common.reflectiveProcessingNeed).toBe("insufficient");
  });

  it("interactionAxis는 R2의 반대편이며 0 또는 100만 나온다", () => {
    const a = computeScoreProfile({
      subjectSelection: "math",
      responses: {},
      scenarioResponses: { R2: 1 },
    });
    const b = computeScoreProfile({
      subjectSelection: "math",
      responses: {},
      scenarioResponses: { R2: 2 },
    });
    // A(바로 질문) → 함께 이야기 쪽 100, B(나중에 따로) → 혼자 정리 쪽 0.
    expect(a.mbtiAxes.interactionAxis.raw).toBe(100);
    expect(b.mbtiAxes.interactionAxis.raw).toBe(0);
  });

  it("R2 미응답이면 숙고 처리 선호와 interactionAxis 모두 insufficient", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
      scenarioResponses: {},
    });
    expect(p.common.reflectiveProcessingNeed).toBe("insufficient");
    expect(p.mbtiAxes.interactionAxis.raw).toBe("insufficient");
  });
});

describe("직접 피드백 수용 3문항 확장", () => {
  it("R3·R3-1·R3-2 세 문항의 평균으로 계산한다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      // 100 / 50 / 0 → 평균 50
      responses: { R3: 5, "R3-1": 3, "R3-2": 1 },
    });
    expect(p.common.directFeedbackAcceptance).toBe(50.0);
    expect(p.coaching.challenge).toBe(50.0);
  });

  it("한 문항만 답하면 유효응답 75%에 못 미쳐 insufficient", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { R3: 5 },
    });
    expect(p.common.directFeedbackAcceptance).toBe("insufficient");
  });

  it("세 문항 중 둘만 답해도 75% 미만이라 insufficient (2/3)", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { R3: 5, "R3-1": 5 },
    });
    expect(p.common.directFeedbackAcceptance).toBe("insufficient");
  });
});

describe("M5 폐기", () => {
  it("mathStrategy는 M5 없이 계산된다", () => {
    const items = ALL_ITEMS.filter((i) => i.id === "M5");
    expect(items).toHaveLength(0);
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
      scenarioResponses: ALL_SCENARIOS,
    });
    expect(p.math?.mathStrategy).toBe(100.0);
  });

  it("옛 응답에 M5가 남아 있어도 점수를 흔들지 않는다", () => {
    const withM5 = computeScoreProfile({
      subjectSelection: "math",
      responses: { ...positiveMaxResponses(), M5: 1 },
      scenarioResponses: ALL_SCENARIOS,
    });
    expect(withM5.math?.mathStrategy).toBe(100.0);
  });
});

describe("반대 문항쌍 임계 50", () => {
  it("두 칸 차이(환산 50)가 2쌍이면 review로 올린다", () => {
    // P1=5(100) vs P2=3(reverse→50) → 차이 50. G2=5(100) vs G4=3(reverse→50) → 차이 50.
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { P1: 5, P2: 3, G2: 5, G4: 3 },
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).toContain("opposite_pair_review");
    expect(p.responseQuality.status).toBe("review");
  });

  it("한 칸 차이(환산 25)만 있으면 올리지 않는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { P1: 5, P2: 2, G2: 5, G4: 2 },
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).not.toContain("opposite_pair_review");
  });

  it("임계를 넘는 쌍이 하나뿐이면 올리지 않는다(2쌍 조건 유지)", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { P1: 5, P2: 5 },
    });
    const codes = p.responseQuality.reasons.map((r) => r.code);
    expect(codes).not.toContain("opposite_pair_review");
  });
});
