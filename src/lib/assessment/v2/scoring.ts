// 결정론적 점수 엔진. 순수 함수만 포함한다.
// 모든 숫자는 이 모듈에서만 만들며 AI·클라이언트가 점수를 생성하지 않는다.
// 구현 명세서 §8.1~§8.7 계약을 그대로 구현한다.

import {
  ALL_ITEMS,
  MIN_VALID_RATIO,
  REVERSE_IDS,
  getItemsForSubject,
  isLikert,
  isScenario,
} from "./definition";
import type {
  AxisScore,
  Band,
  CommonScores,
  Construct,
  CoachingProfile,
  EnglishScores,
  LikertItem,
  MathScores,
  MbtiAxes,
  MbtiConfidence,
  MbtiInput,
  NkFeature,
  NkFit,
  NkFitArea,
  NkFitStage,
  ResponseMap,
  ResponseQuality,
  ResponseQualityReason,
  Score,
  ScoreProfile,
  ScoringInput,
  ScoringMeta,
  SituationEvidence,
  SubjectSelection,
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
 * 유효 응답(숫자, unknown 제외)이 전체의 75% 미만이면 "insufficient".
 */
function rawComposite(items: LikertItem[], responses: ResponseMap): Score {
  let weightedSum = 0;
  let weightTotal = 0;
  let validCount = 0;

  for (const item of items) {
    const value = responses[item.id];
    if (!isNumericResponse(value)) continue; // unknown / 결측 제외
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

function isNum(score: Score): score is number {
  return typeof score === "number";
}

/** Score를 저장·표시용으로 반올림한다. insufficient는 그대로 둔다. */
function display(score: Score): Score {
  return isNum(score) ? round1(score) : score;
}

// ── 8.3 학습 성실성 ─────────────────────────────────────────────────

/**
 * conscientiousness = 0.30·LA + 0.45·HR + 0.25·LTP.
 * 세 구성요소 중 하나라도 insufficient면 insufficient이며 재정규화하지 않는다.
 */
export function deriveConscientiousness(
  learningAttitude: Score,
  homeworkReliability: Score,
  longTermPersistence: Score
): Score {
  if (
    !isNum(learningAttitude) ||
    !isNum(homeworkReliability) ||
    !isNum(longTermPersistence)
  ) {
    return "insufficient";
  }
  return clamp(
    0.3 * learningAttitude + 0.45 * homeworkReliability + 0.25 * longTermPersistence
  );
}

// ── 8.4 지도 방식 분류 ──────────────────────────────────────────────

export function band(score: Score): Band | null {
  if (!isNum(score)) return null;
  if (score >= 60) return "high";
  if (score <= 40) return "low";
  return "mixed";
}

/** directFeedbackAcceptance × relationshipSafetyNeed 4분면. */
export function classifyCoaching(
  challengeBand: Band | null,
  safetyBand: Band | null
): string {
  if (
    !challengeBand ||
    !safetyBand ||
    challengeBand === "mixed" ||
    safetyBand === "mixed"
  ) {
    return "혼합 반응·14일 관찰형";
  }
  if (challengeBand === "high" && safetyBand === "high") return "따뜻한 도전형";
  if (challengeBand === "high" && safetyBand === "low") return "직접 도전형";
  if (challengeBand === "low" && safetyBand === "high") return "안전 기반 점진형";
  return "낮은 압력의 구조 관찰형";
}

/**
 * autonomyNeed × structureNeed 분류. 명세는 둘 다 high일 때 "구조 속 선택권"만
 * 명시하므로 나머지 조합은 보수적으로 이름 붙였다(보고서에서 문구 조정 가능).
 */
export function classifyAutonomyStructure(
  autonomyBand: Band | null,
  structureBand: Band | null
): string {
  if (
    !autonomyBand ||
    !structureBand ||
    autonomyBand === "mixed" ||
    structureBand === "mixed"
  ) {
    return "혼합 반응·14일 관찰형";
  }
  if (autonomyBand === "high" && structureBand === "high") return "구조 속 선택권";
  if (autonomyBand === "high" && structureBand === "low") return "자기 주도 우선형";
  if (autonomyBand === "low" && structureBand === "high") return "명확한 구조 우선형";
  return "낮은 압력의 점진 관찰형";
}

/** 8.7.1 설명용 해석 band. 접근·등록 판정에 사용하지 않는다. */
export function interpretBand(score: Score): string {
  if (!isNum(score)) return "정보 부족·상담 확인 필요";
  if (score >= 75) return "최근 행동에서 비교적 안정적으로 관찰됨";
  if (score >= 60) return "대체로 작동하나 조건의 영향을 받음";
  if (score >= 40) return "상황에 따른 변동이 큼";
  return "초기 구조와 짧은 확인 주기가 필요함";
}

// ── 8.5 / 8.7.4 MBTI 보조축 ─────────────────────────────────────────

export const MBTI_CONFIDENCE_WEIGHT: Record<MbtiConfidence, number> = {
  high: 0.08,
  medium: 0.04,
  low: 0,
  none: 0,
};

const MBTI_PATTERN = /^[EI][SN][TF][JP]$/;

export function isValidMbti(type: string | null | undefined): boolean {
  return typeof type === "string" && MBTI_PATTERN.test(type.toUpperCase());
}

/**
 * 8.5 보조식: finalAxis = clamp(raw + (target - raw) * weight, 0, 100).
 * raw axis 50, target 100 → 높음 54.0 / 보통 52.0 / 낮음·모름 50.0.
 */
export function adjustAxis(
  raw: number,
  target: 0 | 100,
  confidence: MbtiConfidence
): number {
  const weight = MBTI_CONFIDENCE_WEIGHT[confidence];
  return clamp(raw + (target - raw) * weight);
}

function axisFromRaw(
  raw: Score,
  target: 0 | 100 | null,
  confidence: MbtiConfidence,
  lowEvidence = false
): AxisScore {
  if (!isNum(raw)) {
    return { raw, delta: null, final: raw, ...(lowEvidence ? { lowEvidence } : {}) };
  }
  // 유효 MBTI/확신도가 없으면 target null → delta 0, final = raw.
  if (target === null || MBTI_CONFIDENCE_WEIGHT[confidence] === 0) {
    return {
      raw: round1(raw),
      delta: 0,
      final: round1(raw),
      ...(lowEvidence ? { lowEvidence } : {}),
    };
  }
  const final = adjustAxis(raw, target, confidence);
  return {
    raw: round1(raw),
    delta: round1(final - raw),
    final: round1(final),
    ...(lowEvidence ? { lowEvidence } : {}),
  };
}

function computeMbtiAxes(
  responses: ResponseMap,
  mbti: MbtiInput | null | undefined
): MbtiAxes {
  const r2 = responses.R2;
  const r1 = responses.R1;
  const r3 = responses.R3;
  const r4 = responses.R4;
  const r5 = responses.R5;
  const r6 = responses.R6;

  const norm = (v: unknown) => normalizeResponse(v as number, false);

  // interactionAxis: raw = 100 - normalize(R2). R2 결측 → insufficient.
  const interactionRaw: Score = isNumericResponse(r2)
    ? clamp(100 - norm(r2))
    : "insufficient";

  // conceptAxis: 직접 관찰 문항 없음 → raw=50 + lowEvidence (결측 대체가 아닌 설계값).
  const conceptRaw: Score = 50;

  // relationalFeedbackAxis: raw = mean(normalize(R4), 100 - normalize(R3)).
  const relationalRaw: Score =
    isNumericResponse(r3) && isNumericResponse(r4)
      ? clamp((norm(r4) + (100 - norm(r3))) / 2)
      : "insufficient";

  // flexibilityAxis: raw = mean(100-normalize(R1), normalize(R5), 100-normalize(R6)).
  const flexibilityRaw: Score =
    isNumericResponse(r1) && isNumericResponse(r5) && isNumericResponse(r6)
      ? clamp((100 - norm(r1) + norm(r5) + (100 - norm(r6))) / 3)
      : "insufficient";

  const valid = isValidMbti(mbti?.type);
  const type = valid ? mbti!.type.toUpperCase() : "";
  const confidence: MbtiConfidence = valid ? mbti!.confidence : "none";
  const applied = valid && MBTI_CONFIDENCE_WEIGHT[confidence] > 0;

  // target: E/N/F/P=100, I/S/T/J=0.
  const targetFor = (letter: string, high: string): 0 | 100 | null =>
    !valid ? null : letter === high ? 100 : 0;

  return {
    interactionAxis: axisFromRaw(interactionRaw, targetFor(type[0], "E"), confidence),
    conceptAxis: axisFromRaw(conceptRaw, targetFor(type[1], "N"), confidence, true),
    relationalFeedbackAxis: axisFromRaw(relationalRaw, targetFor(type[2], "F"), confidence),
    flexibilityAxis: axisFromRaw(flexibilityRaw, targetFor(type[3], "P"), confidence),
    applied,
    confidenceWeight: valid ? MBTI_CONFIDENCE_WEIGHT[confidence] : 0,
  };
}

// ── 8.6 NK 적합도 ───────────────────────────────────────────────────

function preferenceFrom(value: unknown): number | null {
  return isNumericResponse(value) ? clamp(normalizeResponse(value, false)) : null;
}

function blend(a: Score, b: Score): number | null {
  return isNum(a) && isNum(b) ? clamp(0.5 * a + 0.5 * b) : null;
}

function buildArea(preference: number | null, readiness: number | null): NkFitArea {
  const featureFit =
    preference !== null && readiness !== null
      ? clamp(0.6 * preference + 0.4 * readiness)
      : null;
  const gap =
    preference !== null && readiness !== null
      ? Math.abs(preference - readiness)
      : null;
  return {
    preference: preference === null ? null : round1(preference),
    readiness: readiness === null ? null : round1(readiness),
    featureFit: featureFit === null ? null : round1(featureFit),
    gap: gap === null ? null : round1(gap),
  };
}

function computeNkFit(
  responses: ResponseMap,
  common: {
    learningAttitude: Score;
    homeworkReliability: Score;
    shortTermRecovery: Score;
    directFeedbackAcceptance: Score;
    structureNeed: Score;
  },
  clinicAvailability: NkFitArea["readiness"],
  priorityFeatures: NkFeature[]
): NkFit {
  const areas: Record<NkFeature, NkFitArea> = {
    clinic: buildArea(preferenceFrom(responses.N1), clinicAvailability),
    weeklyTest: buildArea(
      preferenceFrom(responses.N2),
      blend(common.learningAttitude, common.shortTermRecovery)
    ),
    homework: buildArea(
      preferenceFrom(responses.N3),
      isNum(common.homeworkReliability) ? round1(common.homeworkReliability) : null
    ),
    immediateFeedback: buildArea(
      preferenceFrom(responses.N4),
      blend(common.directFeedbackAcceptance, common.structureNeed)
    ),
  };

  const validAreas = (Object.values(areas) as NkFitArea[]).filter(
    (a) => a.preference !== null && a.readiness !== null && a.featureFit !== null
  );

  let overall: number | null = null;
  let stage: NkFitStage;

  if (validAreas.length < 3) {
    stage = "상담 확인 필요";
  } else {
    overall = round1(
      validAreas.reduce((sum, a) => sum + (a.featureFit as number), 0) /
        validAreas.length
    );
    const allReadinessOk = validAreas.every((a) => (a.readiness as number) >= 50);
    const maxGap = Math.max(...validAreas.map((a) => a.gap as number));
    if (overall >= 75 && allReadinessOk && maxGap < 20) {
      stage = "자연스러운 일치";
    } else if (overall >= 60) {
      stage = "지원 전제 일치";
    } else {
      stage = "조건 조율 필요";
    }
  }

  // 우선 선택한 기능의 featureFit이 60 미만이면 총점과 별개로 상담 질문에 올린다.
  const priorityConcerns = priorityFeatures.filter((feature) => {
    const fit = areas[feature].featureFit;
    return fit !== null && fit < 60;
  });

  return { areas, overall, stage, priorityConcerns };
}

// ── 8.7.5 응답 품질 ─────────────────────────────────────────────────

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

  // opposite_pair_review: positive 환산 pair 절대차 75 이상이 2개 이상.
  const pairs: Array<[string, string]> = [
    ["P1", "P2"],
    ["G2", "G4"],
    ["B3", "B2"],
  ];
  let bigGaps = 0;
  for (const [a, b] of pairs) {
    const va = responses[a];
    const vb = responses[b];
    if (!isNumericResponse(va) || !isNumericResponse(vb)) continue;
    const na = normalizeResponse(va, REVERSE_IDS.has(a));
    const nb = normalizeResponse(vb, REVERSE_IDS.has(b));
    if (Math.abs(na - nb) >= 75) bigGaps += 1;
  }
  if (bigGaps >= 2) {
    reasons.push({
      code: "opposite_pair_review",
      detail: `${bigGaps}개 반대 문항쌍 강한 불일치`,
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
    mathSelfEfficacy: display(scoreByConstruct("mathSelfEfficacy", responses)),
    mathNoveltyAvoidance: display(scoreByConstruct("mathNoveltyAvoidance", responses)),
    mathTestInterference: display(scoreByConstruct("mathTestInterference", responses)),
  };
}

function computeEnglish(responses: ResponseMap): EnglishScores {
  return {
    englishStrategy: display(scoreByConstruct("englishStrategy", responses)),
    englishSelfEfficacy: display(scoreByConstruct("englishSelfEfficacy", responses)),
    englishReadingAvoidance: display(scoreByConstruct("englishReadingAvoidance", responses)),
    englishTestInterference: display(scoreByConstruct("englishTestInterference", responses)),
  };
}

// ── 최상위 오케스트레이터 ────────────────────────────────────────────

export function computeScoreProfile(input: ScoringInput): ScoreProfile {
  const { subjectSelection, responses, mbti } = input;
  const scenarioResponses = input.scenarioResponses ?? {};

  // 공통 composite (full precision 원천값 유지).
  const learningAttitude = scoreByConstruct("learningAttitude", responses);
  const homeworkReliability = scoreByConstruct("homeworkReliability", responses);
  const phoneBoundary = scoreByConstruct("phoneBoundary", responses);
  const longTermPersistence = scoreByConstruct("longTermPersistence", responses);
  const shortTermRecovery = scoreByConstruct("shortTermRecovery", responses);
  const peerLearningResource = scoreByConstruct("peerLearningResource", responses);
  const peerFocusBoundary = scoreByConstruct("peerFocusBoundary", responses);
  const reflectiveProcessingNeed = scoreByConstruct("reflectiveProcessingNeed", responses);
  const directFeedbackAcceptance = scoreByConstruct("directFeedbackAcceptance", responses);
  const relationshipSafetyNeed = scoreByConstruct("relationshipSafetyNeed", responses);
  const autonomyNeed = scoreByConstruct("autonomyNeed", responses);
  const structureNeed = scoreByConstruct("structureNeed", responses);
  const conscientiousness = deriveConscientiousness(
    learningAttitude,
    homeworkReliability,
    longTermPersistence
  );

  const common: CommonScores = {
    learningAttitude: display(learningAttitude),
    homeworkReliability: display(homeworkReliability),
    phoneBoundary: display(phoneBoundary),
    longTermPersistence: display(longTermPersistence),
    shortTermRecovery: display(shortTermRecovery),
    peerLearningResource: display(peerLearningResource),
    peerFocusBoundary: display(peerFocusBoundary),
    reflectiveProcessingNeed: display(reflectiveProcessingNeed),
    directFeedbackAcceptance: display(directFeedbackAcceptance),
    relationshipSafetyNeed: display(relationshipSafetyNeed),
    autonomyNeed: display(autonomyNeed),
    structureNeed: display(structureNeed),
    conscientiousness: display(conscientiousness),
  };

  const challengeBand = band(directFeedbackAcceptance);
  const safetyBand = band(relationshipSafetyNeed);
  const autonomyBand = band(autonomyNeed);
  const structureBand = band(structureNeed);
  const coaching: CoachingProfile = {
    challenge: display(directFeedbackAcceptance),
    safety: display(relationshipSafetyNeed),
    challengeBand,
    safetyBand,
    coachingType: classifyCoaching(challengeBand, safetyBand),
    autonomy: display(autonomyNeed),
    structure: display(structureNeed),
    autonomyBand,
    structureBand,
    autonomyStructureType: classifyAutonomyStructure(autonomyBand, structureBand),
  };

  const includeMath = subjectSelection === "math" || subjectSelection === "both";
  const includeEnglish = subjectSelection === "english" || subjectSelection === "both";

  const mbtiAxes = computeMbtiAxes(responses, mbti);

  const nkFit = computeNkFit(
    responses,
    {
      learningAttitude,
      homeworkReliability,
      shortTermRecovery,
      directFeedbackAcceptance,
      structureNeed,
    },
    input.clinicAvailability ?? null,
    input.priorityFeatures ?? []
  );

  // insufficient 목록(응답 품질 정보용).
  const insufficientConstructs: string[] = [];
  const commonEntries: Array<[string, Score]> = [
    ["learningAttitude", learningAttitude],
    ["homeworkReliability", homeworkReliability],
    ["phoneBoundary", phoneBoundary],
    ["longTermPersistence", longTermPersistence],
    ["shortTermRecovery", shortTermRecovery],
    ["peerLearningResource", peerLearningResource],
    ["peerFocusBoundary", peerFocusBoundary],
    ["reflectiveProcessingNeed", reflectiveProcessingNeed],
    ["directFeedbackAcceptance", directFeedbackAcceptance],
    ["relationshipSafetyNeed", relationshipSafetyNeed],
    ["autonomyNeed", autonomyNeed],
    ["structureNeed", structureNeed],
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
    subjectSelection,
    common,
    coaching,
    math: includeMath ? computeMath(responses) : null,
    english: includeEnglish ? computeEnglish(responses) : null,
    mbtiAxes,
    nkFit,
    situations: collectSituations(subjectSelection, scenarioResponses),
    responseQuality,
  };
}
