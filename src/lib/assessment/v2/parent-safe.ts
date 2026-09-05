// 학부모 공유용 parent-safe snapshot (§12.3) — v2.3.
// deny-by-default allowlist: 이 모듈은 result_profile_v2에서 명시적으로 허용된 값만
// 골라 별도 객체를 "새로 조립"한다(spread/얕은 복사 금지). 따라서 아래 금지 항목은
// payload 자체에서 물리적으로 제외된다(CSS 숨김 방식 아님).
//
// 제외(절대 포함 금지):
//   - 연락처(학생/학부모 전화번호), DB id, report token, 학원명(prev_academy)
//   - 내부 확인질문·교사 brief(teacherBrief)·근거 코드(crossEvidence)·운영 메모(cautions)
//   - 상황문항 raw evidence 코드·태그(situations)
//   - 상담자용 원인·내부 확인 질문(coreObservation, operatingCause, verificationPlan14Days)
//   - 응답 품질 상세 사유(reasons) — status만 중립 문구로 전달
//   - 과목 위험축(낯선 유형 회피·시험 긴장) — 공부 방식 점수만
//
// 포함(학부모가 볼 것):
//   - 공통 아홉 척도 점수(등급 표시용 내부 지표), 핵심 판단 두 가지, 학생이 직접 적은 답(이름·연락처 지움),
//     어려운 점 선택, MBTI(확신도 high/medium만), 이전 학원 경험 → 운영 조건, 해석 문장(쉬운 말)
//
// 이 함수는 순수 함수다. 클라이언트(상담자 화면)와 서버(공유 token snapshot 생성)가 동일 함수를 호출한다.

import type { ResultProfileV2 } from "./interpretation";
import { getItemsForSubject, isLikert } from "./definition";
import { applyStudentNameToInterpretation } from "./name-substitution";
import { redactNarrative } from "./serializer";
import {
  buildTransitionPlan,
  type TransitionPlanInput,
  type TransitionPlanItem,
} from "./transition-plan";
import type {
  CommonConstruct,
  CommonScores,
  EnglishScores,
  GuidanceVerdict,
  ManagementDirectAnswer,
  ManagementVerdict,
  MathScores,
  Score,
  SubjectSelection,
} from "./types";

type ParentSafeMathScores = Pick<MathScores, "mathStrategy">;
type ParentSafeEnglishScores = Pick<EnglishScores, "englishStrategy">;

/** 학부모 공유용 점수 subset. PII·근거 코드·상황 태그를 포함하지 않는다. */
export interface ParentSafeScores {
  common: CommonScores;
  math: ParentSafeMathScores | null;
  english: ParentSafeEnglishScores | null;
  /** 상세 사유(reasons)는 제외하고 상태만 전달. review면 UI가 중립 문구로 표시. */
  responseQualityStatus: "normal" | "review";
}

/** ★ 핵심 판단 두 가지(학부모 공개용). */
export interface ParentSafeVerdicts {
  management: {
    verdict: ManagementVerdict;
    directAnswer: ManagementDirectAnswer | null;
    basisNote: string | null;
  };
  guidance: {
    verdict: GuidanceVerdict;
    choiceText: string | null;
    confirmInCounseling: boolean;
  };
}

/** 학부모 공유용 해석 subset. 상담자 전용 필드는 포함하지 않는다. */
export interface ParentSafeInterpretation {
  studentType: string;
  parentSummary: string;
  /** 전 영역 상세 총평(쉬운 한국어). 과거 공유 snapshot에는 없을 수 있어 optional로 둔다. */
  detailedSummary?: string;
  strengths: string[];
  growthAreas: string[];
  /** 등록 시 권장할 초기 수업 제안. */
  initialTeachingSuggestion?: string;
  /** 입학 전 운영 조건 상담 메모. */
  operationsConsultationNote?: string;
  /** 과거 공유 snapshot 하위호환용. 새 snapshot에는 넣지 않는다. */
  nkFitInterpretation?: string;
  mathStrategy: string | null;
  englishStrategy: string | null;
}

/** 학생이 직접 적은 답(이름·연락처·링크는 지운 뒤). 비어 있으면 키 자체를 넣지 않는다. */
export interface StudentAnswersSafe {
  /** 공부할 때 스스로 느끼는 문제점은? */
  problemSelf?: string;
  /** 공부의 핵심이 무엇이라고 생각하나요? */
  studyCore?: string;
  /** 하고 싶은 직업 또는 목표 */
  dream?: string;
  /** 목표 대학·계열·전공 */
  targetUniversity?: string;
  /** 학원에 바라는 점 */
  requests?: string;
  /** 수학에서 가장 어려운 단원·영역 */
  mathDifficulty?: string;
  /** 영어에서 가장 어려운 영역 */
  englishDifficulty?: string;
  /** 입학 상담에서 가장 도움받고 싶은 점 */
  entryPriority?: string;
  /** 기존 학원에서 아쉬웠던 점(학원명은 싣지 않는다 — 원문에 학원명이 있으면 상담자가 지운다). */
  prevComplaint?: string;
}

export const PARENT_BEHAVIOR_KEYS: readonly CommonConstruct[] = [
  "learningAttitude",
  "homeworkReliability",
  "goalClarity",
  "shortTermRecovery",
  "managementAcceptance",
  "coachingResponse",
  "questionInitiative",
  "phoneBoundary",
  "peerFocusBoundary",
] as const;
export type ParentBehaviorKey = CommonConstruct;

/**
 * 학생이 스스로 적어 낸 MBTI. 점수를 만들지 않으며 종합 소견 한두 문장에만 쓴다.
 * 확신도가 low/none이면 결과지에 아예 표시하지 않으므로 여기에도 담지 않는다.
 */
export interface MbtiSafe {
  type: string;
  confidence: "high" | "medium";
}

export interface ParentSafeProfile {
  instrumentVersion: "v2";
  /** 어떤 문항 구성으로 나온 결과인지. 과거 snapshot에는 없다. */
  instrumentRevision?: string;
  subjectSelection: SubjectSelection;
  generatedAt: string;
  /** 표시용 이름·학교급/학년(연락처 없음). 이름은 자녀 본인이므로 공유 허용. */
  display: { name: string; schoolGrade: string };
  scores: ParentSafeScores;
  /** 핵심 판단 두 가지. 과거 snapshot에는 없다. */
  verdicts?: ParentSafeVerdicts;
  interpretation: ParentSafeInterpretation;
  /** 빈도 문항 응답 분포(1~5 선택 수 + 경험 없음). 과거 snapshot에는 없다. */
  responseDistribution?: { counts: number[]; notApplicable: number; total: number };
  /** 학생이 직접 적은 답. */
  studentAnswers?: StudentAnswersSafe;
  /** 과목별 현재 학습의 어려운 점(고른 것). */
  difficultyTags?: { math?: string[]; english?: string[] };
  /** 과거 snapshot 하위호환(새 snapshot은 studentAnswers.entryPriority). */
  entryPriority?: string;
  /** 확신도 high/medium일 때만 존재. 없으면 종합 소견에서 MBTI 문장을 렌더하지 않는다. */
  mbti?: MbtiSafe;
  /** 학원명·서술 원문 없이 고정 문구로 만든 입학 상담용 운영 원칙. */
  transitionPlan?: TransitionPlanItem[];
}

export interface ParentReportContextInput extends TransitionPlanInput {
  /** 입학 상담에서 가장 도움받고 싶은 점. 저장된 과거 데이터는 commitment14 키를 쓴다. */
  entryPriority?: string | null;
  commitment14?: string | null;
  problemSelf?: string | null;
  studyCore?: string | null;
  dream?: string | null;
  targetUniversity?: string | null;
  mathDifficulty?: string | null;
  englishDifficulty?: string | null;
  mathDifficultyTags?: string[] | null;
  englishDifficultyTags?: string[] | null;
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
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parentScore(value: Score | undefined): Score {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : "insufficient";
}

/** 학생이 적은 문장을 이름·연락처 없이, 비어 있으면 undefined로. */
function safeText(value: string | null | undefined, name: string): string | undefined {
  const cleaned = redactNarrative(value, name);
  return cleaned.length > 0 ? cleaned : undefined;
}

function safeTags(values: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const out = values.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 3);
  return out.length > 0 ? out : undefined;
}

/**
 * result_profile_v2(상담자 원본) → 학부모 공유용 parent-safe snapshot.
 * allowlist된 값만 새 객체로 조립한다. 금지 항목은 여기서 아예 참조하지 않는다.
 */
export function buildParentSafeProfile(
  full: ResultProfileV2,
  display: { name: string; schoolGrade: string },
  /** 설문 raw 응답(선택). 문항 문장은 싣지 않고 빈도 문항의 선택지 분포만 센다. */
  responses?: Record<string, unknown> | null,
  /** 학생이 적어 낸 MBTI(선택). 확신도 high/medium만 통과시킨다. */
  mbtiInput?: { type?: string | null; confidence?: string | null } | null,
  /** 학생이 직접 적은 답·이전 학원 경험(선택). 공개본에는 이름·연락처·학원명 없이 통과시킨다. */
  context?: ParentReportContextInput | null,
): ParentSafeProfile {
  const s = full.scores;
  // 저장 경로(analysis-v2)에서 이미 치환됐더라도, 미저장·프리뷰 렌더까지 일관되게
  // 학생 호칭을 실제 이름으로 확정한다(멱등: 토큰·따님/아이가 없으면 그대로).
  const i = applyStudentNameToInterpretation(full.interpretation, display.name);
  const mbti = buildMbtiSafe(mbtiInput);
  const transitionPlan = buildTransitionPlan(context);
  const name = display.name;
  const responseDistribution = buildResponseDistribution(responses, full.subjectSelection);

  const studentAnswers: StudentAnswersSafe = {};
  const entryPriority = safeText(context?.entryPriority ?? context?.commitment14, name);
  if (entryPriority) studentAnswers.entryPriority = entryPriority;
  const problemSelf = safeText(context?.problemSelf, name);
  if (problemSelf) studentAnswers.problemSelf = problemSelf;
  const studyCore = safeText(context?.studyCore, name);
  if (studyCore) studentAnswers.studyCore = studyCore;
  const dream = safeText(context?.dream, name);
  if (dream) studentAnswers.dream = dream;
  const targetUniversity = safeText(context?.targetUniversity, name);
  if (targetUniversity) studentAnswers.targetUniversity = targetUniversity;
  const requests = safeText(context?.requests, name);
  if (requests) studentAnswers.requests = requests;
  const mathDifficulty = safeText(context?.mathDifficulty, name);
  if (mathDifficulty) studentAnswers.mathDifficulty = mathDifficulty;
  const englishDifficulty = safeText(context?.englishDifficulty, name);
  if (englishDifficulty) studentAnswers.englishDifficulty = englishDifficulty;
  const prevComplaint = safeText(context?.prevComplaint, name);
  if (prevComplaint) studentAnswers.prevComplaint = prevComplaint;

  const difficultyTags: { math?: string[]; english?: string[] } = {};
  const mathTags = safeTags(context?.mathDifficultyTags);
  if (mathTags) difficultyTags.math = mathTags;
  const englishTags = safeTags(context?.englishDifficultyTags);
  if (englishTags) difficultyTags.english = englishTags;

  const verdicts: ParentSafeVerdicts | undefined = s.verdicts
    ? {
        management: {
          verdict: s.verdicts.management.verdict,
          directAnswer: s.verdicts.management.directAnswer,
          basisNote: s.verdicts.management.basisNote,
        },
        guidance: {
          verdict: s.verdicts.guidance.verdict,
          choiceText: s.verdicts.guidance.choiceText,
          confirmInCounseling: s.verdicts.guidance.confirmInCounseling,
        },
      }
    : undefined;

  return {
    instrumentVersion: "v2",
    ...(s.instrumentRevision ? { instrumentRevision: s.instrumentRevision } : {}),
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
        goalClarity: parentScore(s.common.goalClarity),
        shortTermRecovery: parentScore(s.common.shortTermRecovery),
        managementAcceptance: parentScore(s.common.managementAcceptance),
        coachingResponse: parentScore(s.common.coachingResponse),
        questionInitiative: parentScore(s.common.questionInitiative),
        phoneBoundary: parentScore(s.common.phoneBoundary),
        peerFocusBoundary: parentScore(s.common.peerFocusBoundary),
      },
      math: s.math ? { mathStrategy: parentScore(s.math.mathStrategy) } : null,
      english: s.english ? { englishStrategy: parentScore(s.english.englishStrategy) } : null,
      responseQualityStatus: s.responseQuality.status,
    },
    ...(verdicts ? { verdicts } : {}),
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
    ...(Object.keys(studentAnswers).length > 0 ? { studentAnswers } : {}),
    ...(Object.keys(difficultyTags).length > 0 ? { difficultyTags } : {}),
    ...(responseDistribution ? { responseDistribution } : {}),
    ...(entryPriority ? { entryPriority } : {}),
    ...(mbti ? { mbti } : {}),
    ...(transitionPlan.length > 0 ? { transitionPlan } : {}),
  };
}

/**
 * 빈도 문항(최근 2주 행동)의 선택지 분포. 문항 문장은 싣지 않고 숫자만 센다.
 * 동의 문항은 라벨이 달라 섞지 않는다. 응답이 없으면 undefined.
 */
export function buildResponseDistribution(
  responses: Record<string, unknown> | null | undefined,
  subject: SubjectSelection,
): { counts: number[]; notApplicable: number; total: number } | undefined {
  if (!responses) return undefined;
  const counts = [0, 0, 0, 0, 0];
  let notApplicable = 0;
  let total = 0;
  for (const item of getItemsForSubject(subject)) {
    if (!isLikert(item) || item.scale !== "frequency") continue;
    const v = responses[item.id];
    if (typeof v === "number" && v >= 1 && v <= 5) {
      counts[v - 1] += 1;
      total += 1;
    } else if (v === "not_applicable") {
      notApplicable += 1;
      total += 1;
    }
  }
  return total > 0 ? { counts, notApplicable, total } : undefined;
}

/**
 * MBTI를 학부모 화면에 실어도 되는지 판정한다.
 * 4글자 형식이 맞고 확신도가 high/medium일 때만 통과 — low/none/미입력은 표시하지 않는다.
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
  "mathNoveltyAvoidance",
  "mathTestInterference",
  "englishReadingAvoidance",
  "englishTestInterference",
  "situations",
  "reasons",
  "priorityConcerns",
  "basisItems",
  "prevAcademy",
  "prev_academy",
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
