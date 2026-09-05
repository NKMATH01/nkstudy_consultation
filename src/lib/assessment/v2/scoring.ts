// 결정론적 점수 엔진. 순수 함수만 포함한다.
// 모든 숫자는 이 모듈에서만 만들며 AI·클라이언트가 점수를 생성하지 않는다.
//
// v2.3(2026-09-04): 공통 아홉 척도 + 핵심 판단 두 가지(관리를 버틸 수 있는가 · 강하게 vs 다독임).
// 등급 구간은 잘 되고 있음 ≥75 / 지켜볼 것 62.5~75 / 먼저 도울 것 <62.5 — 3점(절반쯤)은 50점이라 '먼저 도울 것'.
// 판정 규칙: docs/assessment-v2.3-blueprint-2026-09-04.md §4.

import {
  ALL_ITEMS,
  GUIDANCE_CHOICE_ID,
  INSTRUMENT_REVISION,
  MANAGEMENT_DIRECT_ID,
  MIN_VALID_RATIO,
  REVERSE_IDS,
  getItemsForSubject,
  isForcedChoice,
  isLikert,
  isScenario,
} from "./definition";
import type {
  Band,
  CommonScores,
  Construct,
  EnglishScores,
  GuidanceVerdict,
  GuidanceVerdictResult,
  LikertItem,
  ManagementDirectAnswer,
  ManagementVerdict,
  ManagementVerdictResult,
  MathScores,
  ResponseMap,
  ResponseQuality,
  ResponseQualityReason,
  Score,
  ScoreProfile,
  ScoringInput,
  ScoringMeta,
  SituationEvidence,
  SubjectSelection,
  Verdicts,
} from "./types";

// ── 기본 수치 헬퍼 ───────────────────────────────────────────────────

/** 8.1 정방향/역방향 1~5 → 0~100 환산. */
export function normalizeResponse(response: number, reverse: boolean): number {
  return reverse ? ((5 - response) / 4) * 100 : ((response - 1) / 4) * 100;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** 저장·표시용 소수 첫째 자리 반올림. 내부 계산은 full precision을 사용한다. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isNumericResponse(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function isNum(score: Score): score is number {
  return typeof score === "number";
}

/** Score를 저장·표시용으로 반올림한다. insufficient는 그대로 둔다. */
function display(score: Score): Score {
  return isNum(score) ? round1(score) : score;
}

// ── composite 계산 ──────────────────────────────────────────────────

// construct → Likert 문항 목록. definition을 단일 원천으로 삼아 그룹화한다.
const LIKERT_BY_CONSTRUCT = ((): Record<string, LikertItem[]> => {
  const map: Record<string, LikertItem[]> = {};
  for (const item of ALL_ITEMS) {
    if (!isLikert(item)) continue;
    (map[item.construct] ??= []).push(item);
  }
  return map;
})();

/**
 * 주어진 문항 집합의 가중 평균을 full precision으로 계산한다.
 * 유효 응답(숫자, unknown·경험 없음 제외)이 전체의 75% 미만이면 "insufficient".
 */
function rawComposite(items: LikertItem[], responses: ResponseMap): Score {
  let weightedSum = 0;
  let weightTotal = 0;
  let validCount = 0;

  for (const item of items) {
    const value = responses[item.id];
    if (!isNumericResponse(value)) continue; // unknown / 경험 없음 / 결측 제외
    const normalized = normalizeResponse(value, item.direction === "reverse");
    weightedSum += normalized * item.weight;
    weightTotal += item.weight;
    validCount += 1;
  }

  if (items.length === 0 || validCount / items.length < MIN_VALID_RATIO) {
    return "insufficient";
  }
  return clamp(weightedSum / weightTotal);
}

function scoreByConstruct(construct: Construct, responses: ResponseMap): Score {
  return rawComposite(LIKERT_BY_CONSTRUCT[construct] ?? [], responses);
}

/**
 * 관리 수용 전용 계산. 학원을 처음 다니는 학생은 MA1·MA2(남아서 하기·매주 시험 준비)에
 * '경험 없음'으로 답하므로, 유효 응답 최소 비율을 적용하지 않고 답한 문항만으로 평균을 낸다.
 * 답한 문항이 2개 미만이면 insufficient. 답한 문항 수를 함께 돌려 결과지에 "두 문항 기준"을 표시한다.
 */
export function lenientComposite(
  items: LikertItem[],
  responses: ResponseMap,
): { score: Score; answered: number } {
  let sum = 0;
  let answered = 0;
  for (const item of items) {
    const value = responses[item.id];
    if (!isNumericResponse(value)) continue;
    sum += normalizeResponse(value, item.direction === "reverse");
    answered += 1;
  }
  if (answered < 2) return { score: "insufficient", answered };
  return { score: clamp(sum / answered), answered };
}

// ── 등급 ────────────────────────────────────────────────────────────

/** 등급 경계. 잘 되고 있음 ≥ good / 지켜볼 것 ≥ watch / 그 아래 먼저 도울 것. */
export const GRADE_THRESHOLD = { good: 75, watch: 62.5 } as const;

export type GradeKey = "good" | "watch" | "help";

export const GRADE_LABEL: Record<GradeKey, string> = {
  good: "잘 되고 있음",
  watch: "지켜볼 것",
  help: "먼저 도울 것",
};

export const GRADE_INSUFFICIENT_LABEL = "정보 부족";

export function gradeOf(score: Score): GradeKey | null {
  if (!isNum(score)) return null;
  if (score >= GRADE_THRESHOLD.good) return "good";
  if (score >= GRADE_THRESHOLD.watch) return "watch";
  return "help";
}

export function gradeLabelOf(score: Score): string {
  const grade = gradeOf(score);
  return grade ? GRADE_LABEL[grade] : GRADE_INSUFFICIENT_LABEL;
}

/** Band는 등급의 별칭이다(high=good, mixed=watch, low=help). 기존 호출부 호환용. */
export function band(score: Score): Band | null {
  const grade = gradeOf(score);
  if (!grade) return null;
  return grade === "good" ? "high" : grade === "watch" ? "mixed" : "low";
}

/** 설명용 해석 문구. 접근·등록 판정에 사용하지 않는다. */
export function interpretBand(score: Score): string {
  if (!isNum(score)) return "정보 부족·상담 확인 필요";
  if (score >= GRADE_THRESHOLD.good) return "이번 응답에서 잘 되고 있다고 나타남";
  if (score >= GRADE_THRESHOLD.watch) return "이번 응답에서 대체로 되지만 지켜볼 것으로 나타남";
  return "이번 응답에서 먼저 도울 것으로 나타남";
}

// ── 핵심 판단 두 가지 ────────────────────────────────────────────────

/** MA5 보기 순서 = 이 배열 순서. */
export const MANAGEMENT_DIRECT_ANSWERS: readonly ManagementDirectAnswer[] = [
  "버틸 수 있다",
  "힘들어도 해 보겠다",
  "잘 모르겠다",
  "힘들 것 같다",
];

function managementBasisNote(answered: number): string | null {
  if (answered >= 4) return null;
  if (answered === 3) return "학원 경험이 적어 세 문항 기준입니다";
  return "학원 경험이 없어 두 문항 기준입니다";
}

/**
 * ★ 철저한 관리를 버틸 수 있는가 (§4.1).
 * - 버틸 수 있음: 관리 수용 ≥75 그리고 본인 답이 "버틸 수 있다/힘들어도 해 보겠다" 그리고 단기 회복력 ≥62.5
 * - 지금은 어려움: 본인 답이 "힘들 것 같다" 이거나 (관리 수용 <62.5 그리고 단기 회복력 <62.5)
 * - 도움이 있으면 버팀: 그 밖의 전부
 * - 판정 보류: 점수가 나오지 않았을 때(본인 답이 "힘들 것 같다"면 보류 대신 지금은 어려움)
 */
export function judgeManagement(params: {
  managementAcceptance: Score;
  answeredItems: number;
  shortTermRecovery: Score;
  directAnswerIndex: number | null | undefined;
}): ManagementVerdictResult {
  const idx = params.directAnswerIndex;
  const directAnswer: ManagementDirectAnswer | null =
    isNumericResponse(idx) && idx >= 1 && idx <= MANAGEMENT_DIRECT_ANSWERS.length
      ? MANAGEMENT_DIRECT_ANSWERS[idx - 1]
      : null;
  const basisNote = params.answeredItems > 0 ? managementBasisNote(params.answeredItems) : null;

  let verdict: ManagementVerdict;
  const ma = params.managementAcceptance;
  const rc = params.shortTermRecovery;

  if (directAnswer === "힘들 것 같다") {
    verdict = "지금은 어려움";
  } else if (!isNum(ma) || !isNum(rc)) {
    verdict = "판정 보류";
  } else if (
    ma >= GRADE_THRESHOLD.good &&
    (directAnswer === "버틸 수 있다" || directAnswer === "힘들어도 해 보겠다") &&
    rc >= GRADE_THRESHOLD.watch
  ) {
    verdict = "버틸 수 있음";
  } else if (ma < GRADE_THRESHOLD.watch && rc < GRADE_THRESHOLD.watch) {
    verdict = "지금은 어려움";
  } else {
    verdict = "도움이 있으면 버팀";
  }

  return { verdict, directAnswer, basisItems: params.answeredItems, basisNote };
}

/**
 * ★ 강하게 밀어도 되는가, 차분히 다독여야 하는가 (§4.2).
 * 지도 방식 반응 ≥75 강하게 밀어도 됨 / 62.5~75 강하게 하되 다독임을 같이 / <62.5 차분히 다독이며.
 * CR5 본인 선택이 점수와 반대면 한 단계 가운데로 당기고 상담에서 확인을 붙인다.
 * 가운데 판정에서 선택이 있으면 그대로 두고 상담에서 확인만 붙인다.
 */
export function judgeGuidance(params: {
  coachingResponse: Score;
  choiceIndex: number | null | undefined;
  choiceTexts: { A: string; B: string };
}): GuidanceVerdictResult {
  const idx = params.choiceIndex;
  const choice: "A" | "B" | null = idx === 1 ? "A" : idx === 2 ? "B" : null;
  const choiceText = choice ? params.choiceTexts[choice] : null;
  const cr = params.coachingResponse;

  if (!isNum(cr)) {
    return { verdict: "판정 보류", choice, choiceText, confirmInCounseling: false };
  }

  let verdict: GuidanceVerdict =
    cr >= GRADE_THRESHOLD.good
      ? "강하게 밀어도 됨"
      : cr >= GRADE_THRESHOLD.watch
        ? "강하게 하되 다독임을 같이"
        : "차분히 다독이며";
  let confirmInCounseling = false;

  if (choice === "A" && cr < GRADE_THRESHOLD.watch) {
    verdict = "강하게 하되 다독임을 같이";
    confirmInCounseling = true;
  } else if (choice === "B" && cr >= GRADE_THRESHOLD.good) {
    verdict = "강하게 하되 다독임을 같이";
    confirmInCounseling = true;
  } else if (verdict === "강하게 하되 다독임을 같이" && choice !== null) {
    confirmInCounseling = true;
  }

  return { verdict, choice, choiceText, confirmInCounseling };
}

// ── 8.7.5 응답 품질 ─────────────────────────────────────────────────

/** 서로 반대 방향을 묻는 문항 쌍(정방향, 역방향). 환산 차이가 크면 확인 신호. */
const OPPOSITE_PAIRS: Array<[string, string]> = [
  ["PH1", "PH2"],
  ["QI1", "QI4"],
  ["RC3", "RC2"],
  ["PF2", "PF1"],
  ["CR1", "CR2"],
];

function computeResponseQuality(
  responses: ResponseMap,
  subjectSelection: SubjectSelection,
  insufficientConstructs: string[],
  meta: ScoringMeta | undefined
): ResponseQuality {
  const reasons: ResponseQualityReason[] = [];

  // 점수형 Likert 유효 응답 수집(subject 범위 내, unknown 제외).
  const scoringItems = getItemsForSubject(subjectSelection).filter(isLikert);
  const validValues: number[] = [];
  for (const item of scoringItems) {
    const v = responses[item.id];
    if (isNumericResponse(v)) validValues.push(v);
  }

  // too_fast: active time 또는 25% 이상 800ms 미만 첫 선택.
  if (meta) {
    const threshold = subjectSelection === "both" ? 240 : 180;
    const tooShort =
      typeof meta.activeSeconds === "number" && meta.activeSeconds < threshold;
    const delays = meta.firstSelectDelays ?? [];
    const fastFirstRatio =
      delays.length > 0
        ? delays.filter((d) => d < 800).length / delays.length
        : 0;
    if (tooShort || fastFirstRatio >= 0.25) {
      reasons.push({
        code: "too_fast",
        detail: `active=${meta.activeSeconds ?? "?"}s(<${threshold}s), fast_first=${Math.round(
          fastFirstRatio * 100
        )}%`,
      });
    }
  }

  // straight_line: 30개 이상 유효 Likert 중 동일 번호 90% 이상.
  if (validValues.length >= 30) {
    const counts = new Map<number, number>();
    for (const v of validValues) counts.set(v, (counts.get(v) ?? 0) + 1);
    const maxSame = Math.max(...counts.values());
    if (maxSame / validValues.length >= 0.9) {
      reasons.push({
        code: "straight_line",
        detail: `${maxSame}/${validValues.length} 동일 응답`,
      });
    }
  }

  // opposite_pair_review: positive 환산 pair 절대차가 임계 이상인 쌍이 2개 이상.
  // 임계 50 = 두 칸 차이부터. 상담 전에 "이 부분은 직접 물어보라"고 알려주는 게 목적이다.
  const OPPOSITE_PAIR_GAP = 50;
  let bigGaps = 0;
  for (const [a, b] of OPPOSITE_PAIRS) {
    const va = responses[a];
    const vb = responses[b];
    if (!isNumericResponse(va) || !isNumericResponse(vb)) continue;
    const na = normalizeResponse(va, REVERSE_IDS.has(a));
    const nb = normalizeResponse(vb, REVERSE_IDS.has(b));
    if (Math.abs(na - nb) >= OPPOSITE_PAIR_GAP) bigGaps += 1;
  }
  if (bigGaps >= 2) {
    reasons.push({
      code: "opposite_pair_review",
      detail: `${bigGaps}개 반대 문항쌍 불일치(환산 차이 ${OPPOSITE_PAIR_GAP} 이상)`,
    });
  }

  // insufficient: 정보용. status(review) 판정에는 넣지 않는다.
  if (insufficientConstructs.length > 0) {
    reasons.push({
      code: "insufficient",
      detail: `유효응답 부족: ${insufficientConstructs.join(", ")}`,
    });
  }

  const triggersReview = reasons.some(
    (r) =>
      r.code === "too_fast" ||
      r.code === "straight_line" ||
      r.code === "opposite_pair_review"
  );

  return { status: triggersReview ? "review" : "normal", reasons };
}

// ── 상황문항 semantic evidence ──────────────────────────────────────

function collectSituations(
  subjectSelection: SubjectSelection,
  scenarioResponses: Record<string, number | null | undefined>
): Record<string, SituationEvidence> {
  const out: Record<string, SituationEvidence> = {};
  for (const item of getItemsForSubject(subjectSelection)) {
    if (!isScenario(item)) continue;
    const answer = scenarioResponses[item.id];
    const option = isNumericResponse(answer)
      ? item.options.find((o) => o.index === answer)
      : undefined;
    out[item.id] = {
      evidenceLabel: item.evidenceLabel,
      choice: option?.choice ?? "",
      tags: option?.tags ?? [],
    };
  }
  return out;
}

// ── 과목 점수 ───────────────────────────────────────────────────────

function computeMath(responses: ResponseMap): MathScores {
  return {
    mathStrategy: display(scoreByConstruct("mathStrategy", responses)),
    mathNoveltyAvoidance: display(scoreByConstruct("mathNoveltyAvoidance", responses)),
    mathTestInterference: display(scoreByConstruct("mathTestInterference", responses)),
  };
}

function computeEnglish(responses: ResponseMap): EnglishScores {
  return {
    englishStrategy: display(scoreByConstruct("englishStrategy", responses)),
    englishReadingAvoidance: display(scoreByConstruct("englishReadingAvoidance", responses)),
    englishTestInterference: display(scoreByConstruct("englishTestInterference", responses)),
  };
}

// ── 최상위 오케스트레이터 ────────────────────────────────────────────

export function computeScoreProfile(input: ScoringInput): ScoreProfile {
  const { subjectSelection, responses } = input;
  const scenarioResponses = input.scenarioResponses ?? {};

  // 공통 composite (full precision 원천값 유지).
  const learningAttitude = scoreByConstruct("learningAttitude", responses);
  const homeworkReliability = scoreByConstruct("homeworkReliability", responses);
  const goalClarity = scoreByConstruct("goalClarity", responses);
  const shortTermRecovery = scoreByConstruct("shortTermRecovery", responses);
  const management = lenientComposite(
    LIKERT_BY_CONSTRUCT.managementAcceptance ?? [],
    responses,
  );
  const managementAcceptance = management.score;
  const coachingResponse = scoreByConstruct("coachingResponse", responses);
  const questionInitiative = scoreByConstruct("questionInitiative", responses);
  const phoneBoundary = scoreByConstruct("phoneBoundary", responses);
  const peerFocusBoundary = scoreByConstruct("peerFocusBoundary", responses);

  const common: CommonScores = {
    learningAttitude: display(learningAttitude),
    homeworkReliability: display(homeworkReliability),
    goalClarity: display(goalClarity),
    shortTermRecovery: display(shortTermRecovery),
    managementAcceptance: display(managementAcceptance),
    coachingResponse: display(coachingResponse),
    questionInitiative: display(questionInitiative),
    phoneBoundary: display(phoneBoundary),
    peerFocusBoundary: display(peerFocusBoundary),
  };

  // 핵심 판단 두 가지.
  const guidanceItem = ALL_ITEMS.find(
    (item) => item.id === GUIDANCE_CHOICE_ID && isForcedChoice(item),
  );
  const choiceTexts =
    guidanceItem && isForcedChoice(guidanceItem)
      ? { A: guidanceItem.options[0].text, B: guidanceItem.options[1].text }
      : { A: "", B: "" };
  const verdicts: Verdicts = {
    management: judgeManagement({
      managementAcceptance,
      answeredItems: management.answered,
      shortTermRecovery,
      directAnswerIndex: scenarioResponses[MANAGEMENT_DIRECT_ID],
    }),
    guidance: judgeGuidance({
      coachingResponse,
      choiceIndex: scenarioResponses[GUIDANCE_CHOICE_ID],
      choiceTexts,
    }),
  };

  const includeMath = subjectSelection === "math" || subjectSelection === "both";
  const includeEnglish = subjectSelection === "english" || subjectSelection === "both";

  // insufficient 목록(응답 품질 정보용).
  const insufficientConstructs: string[] = [];
  const commonEntries: Array<[string, Score]> = [
    ["learningAttitude", learningAttitude],
    ["homeworkReliability", homeworkReliability],
    ["goalClarity", goalClarity],
    ["shortTermRecovery", shortTermRecovery],
    ["managementAcceptance", managementAcceptance],
    ["coachingResponse", coachingResponse],
    ["questionInitiative", questionInitiative],
    ["phoneBoundary", phoneBoundary],
    ["peerFocusBoundary", peerFocusBoundary],
  ];
  for (const [name, score] of commonEntries) {
    if (!isNum(score)) insufficientConstructs.push(name);
  }

  const responseQuality = computeResponseQuality(
    responses,
    subjectSelection,
    insufficientConstructs,
    input.meta
  );

  return {
    instrumentVersion: "v2",
    instrumentRevision: INSTRUMENT_REVISION,
    subjectSelection,
    common,
    math: includeMath ? computeMath(responses) : null,
    english: includeEnglish ? computeEnglish(responses) : null,
    verdicts,
    situations: collectSituations(subjectSelection, scenarioResponses),
    responseQuality,
  };
}
