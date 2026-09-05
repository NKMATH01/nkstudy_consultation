import { describe, it, expect } from "vitest";
import {
  ALL_ITEMS,
  GUIDANCE_CHOICE_ID,
  MANAGEMENT_DIRECT_ID,
  RETIRED_ITEM_IDS,
  REVERSE_IDS,
  getItemsForSubject,
  isLikert,
  isScenario,
  isForcedChoice,
} from "../definition";
import {
  band,
  computeScoreProfile,
  gradeLabelOf,
  gradeOf,
  judgeGuidance,
  judgeManagement,
  lenientComposite,
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

// 직접 질문(MA5 4지선다·CR5 강제선택) + 과목 상황문항. 전부 선택지 index로 답한다.
const ALL_SCENARIOS: ScenarioResponseMap = {
  [MANAGEMENT_DIRECT_ID]: 2,
  [GUIDANCE_CHOICE_ID]: 2,
  MS1: 1,
  MS2: 1,
  ES1: 1,
  ES2: 1,
};

const CHOICE_TEXTS = { A: "틀린 것을 바로 세게 짚어 주는 선생님", B: "먼저 잘한 점을 말하고 차분히 고쳐 주는 선생님" };

// ── definition 무결성 (v2.3 문항표) ──────────────────────────────────

describe("definition 무결성", () => {
  it("문항 수: 공통 리커트 36 + 직접 질문 2 / 수학 10 / 영어 10", () => {
    const common = ALL_ITEMS.filter((i) => i.subject === "common");
    expect(common.filter(isLikert)).toHaveLength(36);
    expect(common.filter(isScenario).map((i) => i.id)).toEqual([MANAGEMENT_DIRECT_ID]);
    expect(common.filter(isForcedChoice).map((i) => i.id)).toEqual([GUIDANCE_CHOICE_ID]);
    expect(ALL_ITEMS.filter((i) => i.subject === "math")).toHaveLength(10);
    expect(ALL_ITEMS.filter((i) => i.subject === "english")).toHaveLength(10);
  });

  it("선택 과목에 따라 수학 48 / 영어 48 / 둘 다 58문항을 제공한다", () => {
    expect(getItemsForSubject("math")).toHaveLength(48);
    expect(getItemsForSubject("english")).toHaveLength(48);
    expect(getItemsForSubject("both")).toHaveLength(58);
  });

  it("척도별 문항 수: 학습 태도4·숙제4·목표4·회복5·관리4·지도 반응4·질문4·휴대폰4·친구3", () => {
    const count = (c: string) => LIKERT_ITEMS.filter((i) => i.construct === c).length;
    expect(count("learningAttitude")).toBe(4);
    expect(count("homeworkReliability")).toBe(4);
    expect(count("goalClarity")).toBe(4);
    expect(count("shortTermRecovery")).toBe(5);
    expect(count("managementAcceptance")).toBe(4);
    expect(count("coachingResponse")).toBe(4);
    expect(count("questionInitiative")).toBe(4);
    expect(count("phoneBoundary")).toBe(4);
    expect(count("peerFocusBoundary")).toBe(3);
  });

  it("direction=reverse인 문항은 정확히 REVERSE_IDS와 일치하고 척도당 최대 1개다", () => {
    const reverse = LIKERT_ITEMS.filter((i) => i.direction === "reverse");
    expect(reverse.map((i) => i.id).sort()).toEqual([...REVERSE_IDS].sort());
    const perConstruct = new Map<string, number>();
    for (const item of reverse) perConstruct.set(item.construct, (perConstruct.get(item.construct) ?? 0) + 1);
    for (const [construct, n] of perConstruct) expect(n, construct).toBeLessThanOrEqual(1);
  });

  it("M6/M10/E7/E10은 역채점하지 않는다(원방향 위험축)", () => {
    for (const id of ["M6", "M10", "E7", "E10"]) {
      const item = LIKERT_ITEMS.find((i) => i.id === id)!;
      expect(item.direction).toBe("positive");
      expect(REVERSE_IDS.has(id)).toBe(false);
    }
  });

  it("관리 수용 경험 문항(MA1·MA2)은 '지금까지' 기준이고 경험 없음을 허용한다", () => {
    for (const id of ["MA1", "MA2"]) {
      const item = LIKERT_ITEMS.find((i) => i.id === id)!;
      expect(item.recall).toBe("ever");
      expect(item.allowUnknown).toBe(true);
    }
  });

  it("옛 공통 문항 ID는 전부 폐기 목록에 있다(설문 도중 배포 관용)", () => {
    for (const id of ["LT1", "H1", "Q1", "FB1", "P1", "G1", "B1", "R2", "R3", "F1", "C1", "N1", "M5"]) {
      expect(RETIRED_ITEM_IDS.has(id), id).toBe(true);
    }
    // 새 ID는 폐기 목록에 없다.
    for (const item of ALL_ITEMS) expect(RETIRED_ITEM_IDS.has(item.id), item.id).toBe(false);
  });
});

// ── 8.1 기본 환산 ────────────────────────────────────────────────────

describe("정방향/역방향 환산", () => {
  it("정방향 1~5 → 0/25/50/75/100", () => {
    expect([1, 2, 3, 4, 5].map((v) => normalizeResponse(v, false))).toEqual([0, 25, 50, 75, 100]);
  });

  it("역채점 1~5 → 100/75/50/25/0", () => {
    expect([1, 2, 3, 4, 5].map((v) => normalizeResponse(v, true))).toEqual([100, 75, 50, 25, 0]);
  });
});

// ── 극단값 fixture ───────────────────────────────────────────────────

describe("고정 fixture — 극단값", () => {
  it("정방향=5·역문항=1이면 공통 아홉 척도가 전부 100.0", () => {
    const p = computeScoreProfile({
      subjectSelection: "both",
      responses: positiveMaxResponses(),
      scenarioResponses: ALL_SCENARIOS,
    });
    for (const value of Object.values(p.common)) expect(value).toBe(100.0);
  });

  it("모든 Likert=3이면 정·역 모두 50.0이고, 3점은 '먼저 도울 것'이다", () => {
    const p = computeScoreProfile({
      subjectSelection: "both",
      responses: uniformResponses(3),
      scenarioResponses: ALL_SCENARIOS,
    });
    for (const value of Object.values(p.common)) {
      expect(value).toBe(50.0);
      expect(gradeOf(value)).toBe("help");
    }
  });
});

// ── 75% 미만 / unknown 제외 ──────────────────────────────────────────

describe("유효응답 비율과 unknown 처리", () => {
  it("유효응답 75% 미만이면 insufficient (2/4)", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: { LA1: 5, LA2: 5 } });
    expect(p.common.learningAttitude).toBe("insufficient");
  });

  it("정확히 75%(3/4)면 점수를 산출한다", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: { LA1: 5, LA2: 5, LA3: 5 } });
    expect(p.common.learningAttitude).toBe(100.0);
  });

  it("unknown은 0점이 아니라 계산에서 제외한다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { LA1: 5, LA2: 5, LA3: 5, LA4: "unknown" },
    });
    expect(p.common.learningAttitude).toBe(100.0);
  });
});

// ── 등급 ─────────────────────────────────────────────────────────────

describe("등급: 잘 되고 있음 ≥75 / 지켜볼 것 ≥62.5 / 먼저 도울 것", () => {
  it("경계값", () => {
    expect(gradeOf(100)).toBe("good");
    expect(gradeOf(75)).toBe("good");
    expect(gradeOf(74.9)).toBe("watch");
    expect(gradeOf(62.5)).toBe("watch");
    expect(gradeOf(62.4)).toBe("help");
    expect(gradeOf(50)).toBe("help");
    expect(gradeOf("insufficient")).toBeNull();
  });

  it("band는 등급의 별칭이다", () => {
    expect(band(80)).toBe("high");
    expect(band(70)).toBe("mixed");
    expect(band(50)).toBe("low");
    expect(band("insufficient")).toBeNull();
  });

  it("등급 라벨", () => {
    expect(gradeLabelOf(80)).toBe("잘 되고 있음");
    expect(gradeLabelOf(70)).toBe("지켜볼 것");
    expect(gradeLabelOf(50)).toBe("먼저 도울 것");
    expect(gradeLabelOf("insufficient")).toBe("정보 부족");
  });
});

// ── 관리 수용 예외 규칙 ──────────────────────────────────────────────

describe("관리 수용 — 학원 경험이 없는 학생", () => {
  const MA_ITEMS = LIKERT_ITEMS.filter((i) => i.construct === "managementAcceptance");

  it("MA1·MA2가 경험 없음이면 남은 두 문항으로 평균을 낸다", () => {
    const { score, answered } = lenientComposite(MA_ITEMS, {
      MA1: "not_applicable",
      MA2: "not_applicable",
      MA3: 5,
      MA4: 1, // 역 → 100
    });
    expect(score).toBe(100);
    expect(answered).toBe(2);
  });

  it("답한 문항이 하나뿐이면 insufficient", () => {
    const { score, answered } = lenientComposite(MA_ITEMS, { MA3: 5 });
    expect(score).toBe("insufficient");
    expect(answered).toBe(1);
  });

  it("프로필에 두 문항 기준 안내가 붙는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { ...positiveMaxResponses(), MA1: "not_applicable", MA2: "not_applicable" },
      scenarioResponses: ALL_SCENARIOS,
    });
    expect(p.common.managementAcceptance).toBe(100);
    expect(p.verdicts?.management.basisItems).toBe(2);
    expect(p.verdicts?.management.basisNote).toContain("두 문항");
  });
});

// ── ★ 판정 1: 철저한 관리를 버틸 수 있는가 ──────────────────────────

describe("판정 — 관리를 버틸 수 있는가", () => {
  const base = { answeredItems: 4 };

  it("관리 수용 ≥75, 본인 답 허용, 회복 ≥62.5 → 버틸 수 있음", () => {
    const v = judgeManagement({ ...base, managementAcceptance: 80, shortTermRecovery: 70, directAnswerIndex: 1 });
    expect(v.verdict).toBe("버틸 수 있음");
    expect(v.directAnswer).toBe("버틸 수 있다");
    const v2 = judgeManagement({ ...base, managementAcceptance: 80, shortTermRecovery: 70, directAnswerIndex: 2 });
    expect(v2.verdict).toBe("버틸 수 있음");
  });

  it("본인이 '힘들 것 같다'고 답하면 점수와 무관하게 지금은 어려움", () => {
    const v = judgeManagement({ ...base, managementAcceptance: 100, shortTermRecovery: 100, directAnswerIndex: 4 });
    expect(v.verdict).toBe("지금은 어려움");
  });

  it("관리 수용 <62.5 그리고 회복 <62.5 → 지금은 어려움", () => {
    const v = judgeManagement({ ...base, managementAcceptance: 50, shortTermRecovery: 50, directAnswerIndex: 2 });
    expect(v.verdict).toBe("지금은 어려움");
  });

  it("그 밖은 도움이 있으면 버팀(본인 답 없음·잘 모르겠다 포함)", () => {
    expect(judgeManagement({ ...base, managementAcceptance: 100, shortTermRecovery: 100, directAnswerIndex: null }).verdict).toBe("도움이 있으면 버팀");
    expect(judgeManagement({ ...base, managementAcceptance: 80, shortTermRecovery: 70, directAnswerIndex: 3 }).verdict).toBe("도움이 있으면 버팀");
    expect(judgeManagement({ ...base, managementAcceptance: 69, shortTermRecovery: 55, directAnswerIndex: 2 }).verdict).toBe("도움이 있으면 버팀");
  });

  it("점수가 없으면 판정 보류", () => {
    const v = judgeManagement({ ...base, managementAcceptance: "insufficient", shortTermRecovery: 70, directAnswerIndex: 2 });
    expect(v.verdict).toBe("판정 보류");
  });

  it("basisNote는 4문항 미만일 때만 붙는다", () => {
    expect(judgeManagement({ answeredItems: 4, managementAcceptance: 80, shortTermRecovery: 80, directAnswerIndex: 1 }).basisNote).toBeNull();
    expect(judgeManagement({ answeredItems: 3, managementAcceptance: 80, shortTermRecovery: 80, directAnswerIndex: 1 }).basisNote).toContain("세 문항");
    expect(judgeManagement({ answeredItems: 2, managementAcceptance: 80, shortTermRecovery: 80, directAnswerIndex: 1 }).basisNote).toContain("두 문항");
  });
});

// ── ★ 판정 2: 강하게 밀어도 되는가, 다독여야 하는가 ─────────────────

describe("판정 — 강하게 vs 다독임", () => {
  it("점수 구간 그대로: ≥75 강하게 / 62.5~75 가운데 / <62.5 다독임", () => {
    expect(judgeGuidance({ coachingResponse: 80, choiceIndex: 1, choiceTexts: CHOICE_TEXTS }).verdict).toBe("강하게 밀어도 됨");
    expect(judgeGuidance({ coachingResponse: 69, choiceIndex: null, choiceTexts: CHOICE_TEXTS }).verdict).toBe("강하게 하되 다독임을 같이");
    expect(judgeGuidance({ coachingResponse: 50, choiceIndex: 2, choiceTexts: CHOICE_TEXTS }).verdict).toBe("차분히 다독이며");
  });

  it("본인 선택이 점수와 반대면 한 단계 가운데로 당기고 상담에서 확인한다", () => {
    const a = judgeGuidance({ coachingResponse: 50, choiceIndex: 1, choiceTexts: CHOICE_TEXTS });
    expect(a.verdict).toBe("강하게 하되 다독임을 같이");
    expect(a.confirmInCounseling).toBe(true);
    const b = judgeGuidance({ coachingResponse: 80, choiceIndex: 2, choiceTexts: CHOICE_TEXTS });
    expect(b.verdict).toBe("강하게 하되 다독임을 같이");
    expect(b.confirmInCounseling).toBe(true);
  });

  it("같은 방향이면 확인 표시를 붙이지 않는다", () => {
    expect(judgeGuidance({ coachingResponse: 80, choiceIndex: 1, choiceTexts: CHOICE_TEXTS }).confirmInCounseling).toBe(false);
    expect(judgeGuidance({ coachingResponse: 50, choiceIndex: 2, choiceTexts: CHOICE_TEXTS }).confirmInCounseling).toBe(false);
  });

  it("가운데 판정에 선택이 있으면 확인만 붙인다", () => {
    const v = judgeGuidance({ coachingResponse: 69, choiceIndex: 2, choiceTexts: CHOICE_TEXTS });
    expect(v.verdict).toBe("강하게 하되 다독임을 같이");
    expect(v.confirmInCounseling).toBe(true);
    expect(v.choice).toBe("B");
    expect(v.choiceText).toContain("차분히");
  });

  it("점수가 없으면 판정 보류", () => {
    expect(judgeGuidance({ coachingResponse: "insufficient", choiceIndex: 1, choiceTexts: CHOICE_TEXTS }).verdict).toBe("판정 보류");
  });
});

describe("computeScoreProfile — 판정 통합", () => {
  it("전부 최고 응답 + 버틸 수 있다 + 세게 짚어 주는 선생님 → 두 판정 모두 최고", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: positiveMaxResponses(),
      scenarioResponses: { [MANAGEMENT_DIRECT_ID]: 1, [GUIDANCE_CHOICE_ID]: 1, MS1: 1, MS2: 1 },
    });
    expect(p.verdicts?.management.verdict).toBe("버틸 수 있음");
    expect(p.verdicts?.management.directAnswer).toBe("버틸 수 있다");
    expect(p.verdicts?.guidance.verdict).toBe("강하게 밀어도 됨");
    expect(p.verdicts?.guidance.choice).toBe("A");
  });

  it("전부 3점 + 힘들 것 같다 → 지금은 어려움 / 차분히 다독이며", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: uniformResponses(3),
      scenarioResponses: { [MANAGEMENT_DIRECT_ID]: 4, [GUIDANCE_CHOICE_ID]: 2, MS1: 1, MS2: 1 },
    });
    expect(p.verdicts?.management.verdict).toBe("지금은 어려움");
    expect(p.verdicts?.guidance.verdict).toBe("차분히 다독이며");
  });

  it("직접 질문에 답하지 않아도 프로필은 만들어진다", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: positiveMaxResponses() });
    expect(p.verdicts?.management.directAnswer).toBeNull();
    expect(p.verdicts?.management.verdict).toBe("도움이 있으면 버팀");
    expect(p.verdicts?.guidance.choice).toBeNull();
  });
});

// ── 과목 분기 ────────────────────────────────────────────────────────

describe("과목 분기", () => {
  it("수학 선택은 영어 점수를 만들지 않는다", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: positiveMaxResponses() });
    expect(p.math).not.toBeNull();
    expect(p.english).toBeNull();
  });

  it("복합 선택은 두 프로필을 모두 만든다", () => {
    const p = computeScoreProfile({ subjectSelection: "both", responses: positiveMaxResponses() });
    expect(p.math!.mathStrategy).toBe(100.0);
    expect(p.english!.englishStrategy).toBe(100.0);
  });

  it("위험축(M6/M10/E7/E10)은 전략 점수와 분리되어 원방향으로 계산된다", () => {
    const responses: ResponseMap = { ...positiveMaxResponses(), M6: 5, M10: 5 };
    const p = computeScoreProfile({ subjectSelection: "math", responses });
    expect(p.math!.mathNoveltyAvoidance).toBe(100.0);
    expect(p.math!.mathTestInterference).toBe(100.0);
    expect(p.math!.mathStrategy).toBe(100.0);
  });
});

// ── 상황문항 evidence ────────────────────────────────────────────────

describe("상황문항 semantic evidence", () => {
  it("직접 질문 MA5는 점수 없이 태그만 남고, 선택지에 따라 태그가 달라진다", () => {
    const a = computeScoreProfile({ subjectSelection: "math", responses: positiveMaxResponses(), scenarioResponses: { [MANAGEMENT_DIRECT_ID]: 1 } });
    const d = computeScoreProfile({ subjectSelection: "math", responses: positiveMaxResponses(), scenarioResponses: { [MANAGEMENT_DIRECT_ID]: 4 } });
    expect(a.common).toEqual(d.common);
    expect(a.situations[MANAGEMENT_DIRECT_ID].tags).toEqual(["endure_yes"]);
    expect(d.situations[MANAGEMENT_DIRECT_ID].tags).toEqual(["endure_no"]);
  });

  it("과목 상황문항은 숫자 점수를 만들지 않는다(태그 배열만)", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: positiveMaxResponses(), scenarioResponses: { MS1: 3 } });
    expect(p.situations.MS1.tags).toEqual(["hint_then_retry"]);
  });
});

// ── 응답 품질 ────────────────────────────────────────────────────────

describe("응답 품질 flag", () => {
  it("동일 응답이 90% 이상이면 straight_line이며 status=review", () => {
    const p = computeScoreProfile({ subjectSelection: "both", responses: uniformResponses(3) });
    expect(p.responseQuality.reasons.map((r) => r.code)).toContain("straight_line");
    expect(p.responseQuality.status).toBe("review");
  });

  it("반대 문항쌍 강한 불일치 2개 이상이면 opposite_pair_review", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { PH1: 5, PH2: 5, QI1: 5, QI4: 5 },
    });
    expect(p.responseQuality.reasons.map((r) => r.code)).toContain("opposite_pair_review");
    expect(p.responseQuality.status).toBe("review");
  });

  it("두 칸 차이(환산 50)가 2쌍이면 review, 한 칸 차이는 아니다", () => {
    const two = computeScoreProfile({ subjectSelection: "math", responses: { PH1: 5, PH2: 3, QI1: 5, QI4: 3 } });
    expect(two.responseQuality.reasons.map((r) => r.code)).toContain("opposite_pair_review");
    const one = computeScoreProfile({ subjectSelection: "math", responses: { PH1: 5, PH2: 2, QI1: 5, QI4: 2 } });
    expect(one.responseQuality.reasons.map((r) => r.code)).not.toContain("opposite_pair_review");
  });

  it("insufficient 사유는 status를 review로 만들지 않는다", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: { LA1: 5, LA2: 4, LA3: 3 } });
    expect(p.responseQuality.reasons.map((r) => r.code)).toContain("insufficient");
    expect(p.responseQuality.status).toBe("normal");
  });

  it("meta 활성시간이 임계값 미만이면 too_fast", () => {
    const p = computeScoreProfile({ subjectSelection: "math", responses: positiveMaxResponses(), meta: { activeSeconds: 120 } });
    expect(p.responseQuality.reasons.map((r) => r.code)).toContain("too_fast");
  });
});

// ── MBTI 무영향 ──────────────────────────────────────────────────────

describe("MBTI는 점수·판정에 무영향", () => {
  it("행동 응답이 같으면 MBTI만 바꿔도 공통 점수와 판정이 동일", () => {
    const responses = positiveMaxResponses();
    const none = computeScoreProfile({ subjectSelection: "both", responses, scenarioResponses: ALL_SCENARIOS, mbti: null });
    const enfp = computeScoreProfile({ subjectSelection: "both", responses, scenarioResponses: ALL_SCENARIOS, mbti: { type: "ENFP", confidence: "high" } });
    expect(enfp.common).toEqual(none.common);
    expect(enfp.verdicts).toEqual(none.verdicts);
    expect(enfp.math).toEqual(none.math);
  });
});

// ── 폐기 문항 관용 ───────────────────────────────────────────────────

describe("옛 문항 관용", () => {
  it("옛 응답(LT1·M5)이 남아 있어도 점수를 흔들지 않는다", () => {
    const p = computeScoreProfile({
      subjectSelection: "math",
      responses: { ...positiveMaxResponses(), LT1: 1, M5: 1 } as ResponseMap,
      scenarioResponses: ALL_SCENARIOS,
    });
    expect(p.common.learningAttitude).toBe(100.0);
    expect(p.math?.mathStrategy).toBe(100.0);
  });
});
