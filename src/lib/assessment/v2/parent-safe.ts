// 학부모 공유용 parent-safe snapshot (§12.3).
// deny-by-default allowlist: 이 모듈은 result_profile_v2에서 명시적으로 허용된 값만
// 골라 별도 객체를 "새로 조립"한다(spread/얕은 복사 금지). 따라서 아래 금지 항목은
// payload 자체에서 물리적으로 제외된다(CSS 숨김 방식 아님, §12.3).
//
// 제외(절대 포함 금지):
//   - 연락처(학생/학부모 전화번호), DB id, report token
//   - 내부 확인질문·교사 brief(teacherBrief)·근거 코드(crossEvidence)·운영 메모(cautions)
//   - 상황문항 raw evidence 코드·태그(situations)
//   - 상담자용 원인·내부 확인 질문(coreObservation, operatingCause,
//     verificationPlan14Days). recommendedCoaching은 쉬운 문장으로 정리해 초기 수업 제안만 허용한다.
//   ※ detailedSummary(상세 총평)는 학부모용으로 허용한다: "쉬운 한국어" 프롬프트로 생성되어
//     전 영역(태도·숙제·휴대폰·의지·회복·친구·과목·NK 적합)을 아우르므로 01 종합 분석 본문에 쓴다.
//   - 응답 품질 상세 사유(reasons) — status만 중립 문구로 전달
//
// 이 함수는 순수 함수다. 클라이언트(상담자 화면의 학부모 미리보기 토글)와
// 서버(공유 token snapshot 생성)가 동일 함수를 호출하므로 두 화면이 항상 일치한다.

import type { ResultProfileV2 } from "./interpretation";
import { applyStudentNameToInterpretation } from "./name-substitution";
import { ALL_ITEMS, isChoiceItem, isLikert } from "./definition";
import { SCALE_LABELS_V2 } from "./display";
import { redactNarrative } from "./serializer";
import {
  buildTransitionPlan,
  type TransitionPlanInput,
  type TransitionPlanItem,
} from "./transition-plan";
import type {
  CommonScores,
  EnglishScores,
  LikertItem,
  MathScores,
  Score,
  SubjectSelection,
} from "./types";

type ParentSafeCommonScores = Pick<
  CommonScores,
  | "learningAttitude"
  | "homeworkReliability"
  | "helpSeeking"
  | "feedbackExecution"
  | "phoneBoundary"
  | "longTermPersistence"
  | "shortTermRecovery"
>;
type ParentSafeMathScores = Pick<MathScores, "mathStrategy">;
type ParentSafeEnglishScores = Pick<EnglishScores, "englishStrategy">;

/** 학부모 공유용 점수 subset. PII·근거 코드·상황 태그를 포함하지 않는다. */
export interface ParentSafeScores {
  common: ParentSafeCommonScores;
  math: ParentSafeMathScores | null;
  english: ParentSafeEnglishScores | null;
  /** 상세 사유(reasons)는 제외하고 상태만 전달. review면 UI가 중립 문구로 표시. */
  responseQualityStatus: "normal" | "review";
}

/** 학부모 공유용 해석 subset. 상담자 전용 필드는 포함하지 않는다. */
export interface ParentSafeInterpretation {
  studentType: string;
  parentSummary: string;
  /** 전 영역 상세 총평(쉬운 한국어). 과거 공유 snapshot에는 없을 수 있어 optional로 둔다. */
  detailedSummary?: string;
  strengths: string[];
  growthAreas: string[];
  /** 입학 상담에서 설명할 수 있는 등록 후 초기 수업 제안. 과거 snapshot에는 없을 수 있다. */
  initialTeachingSuggestion?: string;
  /** 입학 전 운영 조건 상담 메모. */
  operationsConsultationNote?: string;
  /** 과거 공유 snapshot 하위호환용. 새 snapshot에는 넣지 않는다. */
  nkFitInterpretation?: string;
  mathStrategy: string | null;
  englishStrategy: string | null;
}

/**
 * "친구와 공부" 카드용 문항 응답.
 * 또래 관련 문항은 합산 점수로 묶으면 뜻이 흐려져(도움 받는 힘 + 집중 흔들림이 상쇄)
 * 문항 요지와 학생이 고른 보기만 그대로 보여 준다. **점수·밴드는 담지 않는다.**
 */
export interface PeerResponseSafe {
  /** 문항이 묻는 내용(정의 원문) */
  question: string;
  /** 학생이 고른 보기 문구(예: "대체로 맞다") */
  answerLabel: string;
}

/** 점수로 확대하지 않고 학생이 고른 문장 그대로 보여 주는 응답 근거. */
export type ResponseEvidenceSafe = PeerResponseSafe;

export const PARENT_BEHAVIOR_KEYS = [
  "learningAttitude",
  "homeworkReliability",
  "helpSeeking",
  "feedbackExecution",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
] as const;
export type ParentBehaviorKey = (typeof PARENT_BEHAVIOR_KEYS)[number];

/**
 * 학생이 스스로 적어 낸 MBTI. 점수를 만들지 않으며 지도 방식 참고용으로만 쓴다.
 * 확신도가 low/none이면 결과지에 아예 표시하지 않으므로 여기에도 담지 않는다.
 */
export interface MbtiSafe {
  type: string;
  confidence: "high" | "medium";
}

export interface ParentSafeProfile {
  instrumentVersion: "v2";
  subjectSelection: SubjectSelection;
  generatedAt: string;
  /** 표시용 이름·학교급/학년(연락처 없음). 이름은 자녀 본인이므로 공유 허용. */
  display: { name: string; schoolGrade: string };
  scores: ParentSafeScores;
  interpretation: ParentSafeInterpretation;
  /**
   * 또래 문항 응답(F1~F4). 응답 원본이 없으면 생략된다.
   * 기존에 발급된 공유 토큰에는 이 필드가 없으므로 화면은 없을 때도 동작해야 한다.
   */
  peerResponses?: PeerResponseSafe[];
  /** 단일·소수 문항인 지도 선호는 점수축 대신 원문 응답으로만 공개한다. */
  preferenceResponses?: ResponseEvidenceSafe[];
  /** 핵심 학습행동별로 학생 답변 근거를 최대 2개씩 그대로 보여 준다. */
  behaviorEvidence?: Partial<Record<ParentBehaviorKey, ResponseEvidenceSafe[]>>;
  /** 학생이 마지막에 자기 말로 적은 입학 상담 우선 도움. */
  entryPriority?: string;
  /** 확신도 high/medium일 때만 존재. 없으면 화면에서 MBTI 블록 자체를 렌더하지 않는다. */
  mbti?: MbtiSafe;
  /** 학원명·서술 원문 없이 고정 문구로 만든 입학 상담용 운영 원칙. */
  transitionPlan?: TransitionPlanItem[];
}

/** "친구와 공부" 카드에 쓰는 또래 문항. 점수로 묶지 않고 네 답을 각각 보여 준다. */
const PEER_ITEM_IDS = ["F1", "F2", "F3", "F4"] as const;
const PREFERENCE_ITEM_IDS = ["R2", "R3", "R4", "R5", "R6"] as const;

function buildResponseEvidence(
  responses: Record<string, unknown> | null | undefined,
  ids: readonly string[],
): ResponseEvidenceSafe[] {
  if (!responses) return [];
  const result: ResponseEvidenceSafe[] = [];
  for (const id of ids) {
    const item = ALL_ITEMS.find((candidate) => candidate.id === id);
    if (!item) continue;
    const value = responses[id];

    if (isLikert(item) && typeof value === "number" && value >= 1 && value <= 5) {
      result.push({
        question: item.text,
        answerLabel: SCALE_LABELS_V2[item.scale][value - 1],
      });
      continue;
    }

    if (isChoiceItem(item) && typeof value === "number") {
      const option = item.options.find((candidate) => candidate.index === value);
      if (option) result.push({ question: item.text, answerLabel: option.text });
    }
  }
  return result;
}

/**
 * 또래 문항의 "문항 요지 + 고른 보기"만 뽑는다.
 * 숫자는 담지 않으므로 학부모 화면에서 점수로 오해될 여지가 없다.
 */
export function buildPeerResponses(
  responses: Record<string, unknown> | null | undefined,
): PeerResponseSafe[] {
  return buildResponseEvidence(responses, PEER_ITEM_IDS);
}

/**
 * 각 핵심 행동에서 중간 응답(3)보다 멀리 떨어진 답을 최대 2개 고른다.
 * 점수·방향을 새로 해석하지 않고 문항과 보기만 전달해 결론의 근거를 확인하게 한다.
 */
export function buildBehaviorEvidence(
  responses: Record<string, unknown> | null | undefined,
): Partial<Record<ParentBehaviorKey, ResponseEvidenceSafe[]>> {
  if (!responses) return {};
  const out: Partial<Record<ParentBehaviorKey, ResponseEvidenceSafe[]>> = {};

  for (const key of PARENT_BEHAVIOR_KEYS) {
    const answered: Array<{ item: LikertItem; order: number; value: number }> = [];
    ALL_ITEMS.forEach((item, order) => {
      if (!isLikert(item) || item.construct !== key) return;
      const value = responses[item.id];
      if (typeof value !== "number" || value < 1 || value > 5) return;
      answered.push({ item, order, value });
    });

    const evidence = answered
      .sort(
        (a, b) => Math.abs(b.value - 3) - Math.abs(a.value - 3) || a.order - b.order,
      )
      .slice(0, 2)
      .map(({ item, value }) => ({
        question: item.text,
        answerLabel: SCALE_LABELS_V2[item.scale][value - 1],
      }));
    if (evidence.length > 0) out[key] = evidence;
  }

  return out;
}

export interface ParentReportContextInput extends TransitionPlanInput {
  /** 새 이름. 저장된 과거 데이터는 아래 legacy 키를 사용한다. */
  entryPriority?: string | null;
  commitment14?: string | null;
}

/** 내부 환산점수는 규준처럼 보일 수 있어 학부모 서술에서는 행동 문장만 남긴다. */
function stripInternalScoreNotation(text: string): string {
  return text
    .replace(/\(\s*\d+\s*문항\s*평균\s*\d+(?:\.\d+)?\s*\/\s*5\s*\)/g, "")
    .replace(/\(?\s*\d+(?:\.\d+)?\s*(?:점|\/\s*100|\/\s*5)\s*\)?/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/** 과거 결과에 남은 재원 후 관찰 표현을 입학테스트 당일의 문맥으로 낮춘다. */
export function toEntranceReportWording(text: string): string {
  return text
    .replace(/(?:향후|처음|첫)?\s*(?:14일|2주)\s*(?:동안|간|뒤|후(?:에)?|째|의|에)?/g, "입학 상담에서")
    .replace(/첫\s*14일\s*동안/g, "입학 상담에서")
    .replace(/첫\s*14일의/g, "입학 상담에서 확인할")
    .replace(/첫\s*14일에/g, "입학 상담에서")
    .replace(/첫\s*14일/g, "입학 상담")
    .replace(/14일\s*동안/g, "입학 상담에서")
    .replace(/14일\s*뒤/g, "입학 상담에서")
    .replace(/첫\s*2주\s*동안/g, "입학 상담에서")
    .replace(/첫\s*2주간/g, "입학 상담에서")
    .replace(/첫\s*2주/g, "입학 상담")
    .replace(/처음\s*몇\s*주간/g, "입학 상담에서")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parentScore(value: Score | undefined): Score {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : value === "insufficient"
      ? value
      : "insufficient";
}

/**
 * result_profile_v2(상담자 원본) → 학부모 공유용 parent-safe snapshot.
 * allowlist된 값만 새 객체로 조립한다. 금지 항목은 여기서 아예 참조하지 않는다.
 */
export function buildParentSafeProfile(
  full: ResultProfileV2,
  display: { name: string; schoolGrade: string },
  /** 또래 문항 응답 원본(선택). 없으면 "친구와 공부" 카드가 생략된다. */
  responses?: Record<string, unknown> | null,
  /** 학생이 적어 낸 MBTI(선택). 확신도 high/medium만 통과시킨다. */
  mbtiInput?: { type?: string | null; confidence?: string | null } | null,
  /** 이전 학원 경험(선택). 공개본에는 고정된 운영 약속만 통과시킨다. */
  transitionInput?: ParentReportContextInput | null,
): ParentSafeProfile {
  const s = full.scores;
  // 저장 경로(analysis-v2)에서 이미 치환됐더라도, 미저장·프리뷰 렌더까지 일관되게
  // 학생 호칭을 실제 이름으로 확정한다(멱등: 토큰·따님/아이가 없으면 그대로).
  const i = applyStudentNameToInterpretation(full.interpretation, display.name);
  const peerResponses = buildPeerResponses(responses);
  const preferenceResponses = buildResponseEvidence(responses, PREFERENCE_ITEM_IDS);
  const behaviorEvidence = buildBehaviorEvidence(responses);
  const mbti = buildMbtiSafe(mbtiInput);
  const transitionPlan = buildTransitionPlan(transitionInput);
  const entryPriority = redactNarrative(
    transitionInput?.entryPriority ?? transitionInput?.commitment14,
    display.name,
  );

  return {
    instrumentVersion: "v2",
    subjectSelection: full.subjectSelection,
    generatedAt: full.generatedAt,
    display: {
      name: display.name,
      schoolGrade: display.schoolGrade,
    },
    scores: {
      common: {
        learningAttitude: parentScore(s.common.learningAttitude),
        homeworkReliability: parentScore(s.common.homeworkReliability),
        helpSeeking: parentScore(s.common.helpSeeking),
        feedbackExecution: parentScore(s.common.feedbackExecution),
        phoneBoundary: parentScore(s.common.phoneBoundary),
        longTermPersistence: parentScore(s.common.longTermPersistence),
        shortTermRecovery: parentScore(s.common.shortTermRecovery),
      },
      math: s.math ? { mathStrategy: parentScore(s.math.mathStrategy) } : null,
      english: s.english ? { englishStrategy: parentScore(s.english.englishStrategy) } : null,
      responseQualityStatus: s.responseQuality.status,
    },
    interpretation: {
      studentType: toEntranceReportWording(i.studentType),
      parentSummary: toEntranceReportWording(i.parentSummary),
      detailedSummary: i.detailedSummary
        ? toEntranceReportWording(i.detailedSummary)
        : undefined,
      strengths: i.strengths.map((text) =>
        toEntranceReportWording(stripInternalScoreNotation(text)),
      ),
      growthAreas: i.growthAreas.map((text) =>
        toEntranceReportWording(stripInternalScoreNotation(text)),
      ),
      initialTeachingSuggestion: toEntranceReportWording(
        stripInternalScoreNotation(i.recommendedCoaching),
      ),
      operationsConsultationNote: toEntranceReportWording(
        stripInternalScoreNotation(i.nkFitInterpretation),
      ),
      mathStrategy: i.mathStrategy
        ? toEntranceReportWording(stripInternalScoreNotation(i.mathStrategy))
        : null,
      englishStrategy: i.englishStrategy
        ? toEntranceReportWording(stripInternalScoreNotation(i.englishStrategy))
        : null,
    },
    ...(peerResponses.length > 0 ? { peerResponses } : {}),
    ...(preferenceResponses.length > 0 ? { preferenceResponses } : {}),
    ...(Object.keys(behaviorEvidence).length > 0 ? { behaviorEvidence } : {}),
    ...(entryPriority ? { entryPriority } : {}),
    ...(mbti ? { mbti } : {}),
    ...(transitionPlan.length > 0 ? { transitionPlan } : {}),
  };
}

/**
 * MBTI를 학부모 화면에 실어도 되는지 판정한다.
 * 4글자 형식이 맞고 확신도가 high/medium일 때만 통과 — low/none/미입력은 표시하지 않는다
 * ("잘 모르겠다"고 답한 정보를 결과지에 실으면 근거 없는 단정이 된다).
 */
export function buildMbtiSafe(
  input?: { type?: string | null; confidence?: string | null } | null,
): MbtiSafe | undefined {
  const type = input?.type?.trim().toUpperCase() ?? "";
  const confidence = input?.confidence?.trim() ?? "";
  if (!/^[EI][SN][TF][JP]$/.test(type)) return undefined;
  if (confidence !== "high" && confidence !== "medium") return undefined;
  return { type, confidence };
}

/** parent-safe payload에 절대 존재해서는 안 되는 키(테스트·런타임 감사용). */
export const PARENT_FORBIDDEN_KEYS = [
  "teacherBrief",
  "crossEvidence",
  "coreObservation",
  "operatingCause",
  "recommendedCoaching",
  "verificationPlan14Days",
  "commitment14",
  "cautions",
  "roadmap12Weeks",
  "coaching",
  "coachingType",
  "autonomyStructureType",
  "nkFit",
  "nkFitInterpretation",
  "mbtiAxes",
  "mathSelfEfficacy",
  "mathNoveltyAvoidance",
  "mathTestInterference",
  "englishSelfEfficacy",
  "englishReadingAvoidance",
  "englishTestInterference",
  "situations",
  "reasons",
  "priorityConcerns",
  "studentPhone",
  "parentPhone",
  "student_phone",
  "parent_phone",
  "phone",
  "id",
  "surveyId",
  "survey_id",
  "token",
  "report_html",
  "healthNote",
  "health_note",
] as const;

/**
 * 객체 트리에서 금지 키가 하나라도 있으면 그 경로를 반환한다(없으면 []).
 * 런타임 감사·단위 테스트 양쪽에서 사용한다.
 */
export function findForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  const forbidden = new Set<string>(PARENT_FORBIDDEN_KEYS);
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) {
      v.forEach((item, idx) => walk(item, `${p}[${idx}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (forbidden.has(k)) hits.push(`${p}.${k}`);
        walk(val, `${p}.${k}`);
      }
    }
  };
  walk(value, path);
  return hits;
}
