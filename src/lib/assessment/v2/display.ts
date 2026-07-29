// 설문 V2 표시·연동용 단일 어댑터.
// 상세/미리보기/상담기록/목록/등록안내가 DB JSONB를 각자 해석하지 않고
// 현재 typed definition의 문항·선택지·척도 문구를 함께 사용하도록 한다.

import { getItemsForSubject, isLikert } from "./definition";
import type {
  AssessmentItem,
  LikertResponse,
  Scale,
  Score,
  ScoreProfile,
  StoredIntakeV2,
  StoredResponsesV2,
  Subject,
  SubjectSelection,
} from "./types";

export const SUBJECT_LABEL_V2: Record<SubjectSelection, string> = {
  math: "수학",
  english: "영어",
  both: "수학+영어",
};

export const SUBJECT_SECTION_LABEL_V2: Record<Subject, string> = {
  common: "공통 학습·생활 성향",
  math: "수학 학습 성향",
  english: "영어 학습 성향",
};

/** 학생 입력 화면과 관리자 표시 화면이 동일한 선택지 문구를 사용한다. */
export const SCALE_LABELS_V2: Record<Scale, readonly string[]> = {
  frequency: ["거의 없었다", "한두 번", "절반 정도", "자주", "거의 매번"],
  agreement: ["전혀 맞지 않다", "별로 맞지 않다", "반반이다", "대체로 맞다", "매우 잘 맞다"],
  fit: ["전혀 아니다", "별로 아니다", "반반이다", "대체로 그렇다", "매우 그렇다"],
};

export interface SurveyV2Source {
  name?: string | null;
  school?: string | null;
  grade?: string | null;
  student_phone?: string | null;
  parent_phone?: string | null;
  subject_selection?: SubjectSelection | string | null;
  intake_v2?: StoredIntakeV2 | Record<string, unknown> | null;
  responses_v2?: StoredResponsesV2 | Record<string, unknown> | null;
  score_profile_v2?: ScoreProfile | Record<string, unknown> | null;
}

export interface DisplayFieldV2 {
  key: string;
  label: string;
  value: string | null;
}

export interface DisplaySectionV2 {
  key: string;
  title: string;
  fields: DisplayFieldV2[];
}

export interface DisplaySupplementV2 {
  id: string;
  label: string;
  value: string | null;
}

export interface DisplayQuestionV2 {
  id: string;
  number: number;
  subject: Subject;
  evidenceLabel: string;
  question: string;
  answer: string | null;
  rawValue: LikertResponse | number | null;
  supplements: DisplaySupplementV2[];
}

export interface DisplayQuestionGroupV2 {
  subject: Subject;
  title: string;
  questions: DisplayQuestionV2[];
}

export interface V2Metric {
  key: string;
  label: string;
  score: number | null;
}

export type SurveyManagementFactorKey =
  | "attitude"
  | "self_directed"
  | "assignment"
  | "willingness"
  | "social"
  | "management";

export interface SurveyManagementFactorScore {
  key: SurveyManagementFactorKey;
  label: string;
  value: number | null;
  scale: 5 | 100;
  sourceLabel: string;
  /** true면 점수가 높을수록 손이 더 가는 지표라 색 규칙을 반전해야 한다. */
  highIsRisk: boolean;
}

export interface SurveyManagementScoreSource extends SurveyV2Source {
  instrument_version?: string | null;
  factor_attitude?: number | null;
  factor_self_directed?: number | null;
  factor_assignment?: number | null;
  factor_willingness?: number | null;
  factor_social?: number | null;
  factor_management?: number | null;
}

const MANAGEMENT_FACTOR_CONFIG = [
  {
    key: "attitude",
    label: "태도",
    legacyField: "factor_attitude",
    v2Field: "learningAttitude",
    v2SourceLabel: "학습 태도",
  },
  {
    key: "self_directed",
    label: "자주",
    legacyField: "factor_self_directed",
    v2Field: "conscientiousness",
    v2SourceLabel: "학습 성실성",
  },
  {
    key: "assignment",
    label: "과제",
    legacyField: "factor_assignment",
    v2Field: "homeworkReliability",
    v2SourceLabel: "숙제 신뢰도",
  },
  {
    key: "willingness",
    label: "의지",
    legacyField: "factor_willingness",
    v2Field: "longTermPersistence",
    v2SourceLabel: "장기 의지",
  },
  {
    key: "social",
    label: "사회",
    legacyField: "factor_social",
    v2Field: "peerLearningResource",
    v2SourceLabel: "또래 학습 자원",
  },
  {
    key: "management",
    label: "관리",
    legacyField: "factor_management",
    v2Field: "structureNeed",
    v2SourceLabel: "구조·관리 필요",
    // V2 structureNeed는 "관리가 얼마나 필요한가"라서 높을수록 부담이 크다.
    // V1 factor_management(관리 선호도)는 반대 방향이므로 V2에서만 반전한다.
    v2HighIsRisk: true,
  },
] as const;

export interface SurveyV2DisplayData {
  subject: SubjectSelection;
  subjectLabel: string;
  intakeSections: DisplaySectionV2[];
  questionGroups: DisplayQuestionGroupV2[];
  answeredCount: number;
  questionCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asStoredIntake(value: SurveyV2Source["intake_v2"]): StoredIntakeV2 {
  return isRecord(value) ? (value as StoredIntakeV2) : {};
}

function asStoredResponses(value: SurveyV2Source["responses_v2"]): StoredResponsesV2 {
  return isRecord(value) ? (value as StoredResponsesV2) : {};
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function listValue(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(textValue).filter((item): item is string => !!item);
  return items.length ? items.join(", ") : null;
}

function validSubject(value: unknown): value is SubjectSelection {
  return value === "math" || value === "english" || value === "both";
}

export function getSurveyV2Subject(survey: SurveyV2Source): SubjectSelection {
  const intake = asStoredIntake(survey.intake_v2);
  if (validSubject(survey.subject_selection)) return survey.subject_selection;
  if (validSubject(intake.subject_selection)) return intake.subject_selection;
  const profile = survey.score_profile_v2;
  if (isRecord(profile) && validSubject(profile.subjectSelection)) {
    return profile.subjectSelection;
  }
  // 손상된 과거 데이터에서도 화면 전체가 깨지지 않도록 가장 좁은 범위로 표시한다.
  return "math";
}

function mbtiConfidenceLabel(value: unknown): string | null {
  const labels: Record<string, string> = {
    high: "높음",
    medium: "보통",
    low: "낮음",
    none: "잘 모르겠음",
  };
  return typeof value === "string" ? labels[value] ?? textValue(value) : null;
}

function field(key: string, label: string, value: unknown): DisplayFieldV2 {
  return { key, label, value: textValue(value) };
}

export function buildV2IntakeSections(survey: SurveyV2Source): DisplaySectionV2[] {
  const i = asStoredIntake(survey.intake_v2);
  const subject = getSurveyV2Subject(survey);
  const futureFields: DisplayFieldV2[] = [
    field("has_future_plan", "미래 계획이 있나요?", i.has_future_plan),
    field("dream", "하고 싶은 직업 또는 목표", i.dream),
    field("target_university", "목표 대학·계열·전공", i.target_university),
    field("study_core", "공부의 핵심이 무엇이라고 생각하나요?", i.study_core),
    field("problem_self", "공부할 때 스스로 느끼는 문제점은?", i.problem_self),
  ];
  if (subject === "math" || subject === "both") {
    futureFields.push(field("math_difficulty", "수학에서 가장 어려운 단원·영역", i.math_difficulty));
  }
  if (subject === "english" || subject === "both") {
    futureFields.push(field("english_difficulty", "영어에서 가장 어려운 영역", i.english_difficulty));
  }
  futureFields.push(
    field("health_note", "건강·특이사항", i.health_note),
    field("requests", "학원에 바라는 점", i.requests)
  );

  return [
    {
      key: "identity",
      title: "기본 정보",
      fields: [
        field("name", "학생 이름", survey.name),
        field("school", "학교", survey.school),
        field("grade", "학년", survey.grade),
        field("subject_selection", "진단 과목", SUBJECT_LABEL_V2[subject]),
        field("student_phone", "학생 연락처", survey.student_phone),
        field("parent_phone", "학부모 연락처", survey.parent_phone),
      ],
    },
    {
      key: "history",
      title: "학습 이력",
      fields: [
        field("prev_academy", "기존에 다녔던 학원", i.prev_academy),
        field("prev_academy_duration", "기존 학원 재원 기간", i.prev_academy_duration),
        field("prev_leave_reason", "기존 학원을 옮기려는 결정적 이유", i.prev_leave_reason),
        field("prev_complaint", "기존 학원에서 아쉬웠던 점", i.prev_complaint),
        field("referral", "NK를 알게 된 경로", i.referral),
        field("referral_friend", "소개한 친구 이름", i.referral_friend),
        field("nk_knowledge", "NK 운영을 얼마나 알고 있나요?", i.nk_knowledge),
      ],
    },
    {
      key: "schedule",
      title: "학원·일정",
      fields: [
        { key: "nk_expectations", label: "NK에 기대하는 점", value: listValue(i.nk_expectations) },
        field("preferred_days", "희망 수업 요일", i.preferred_days),
        field("available_time", "등원 가능 시간대", i.available_time),
        field("weekday_selfstudy", "주중 자습 가능 시간", i.weekday_selfstudy),
        field("clinic_condition", "클리닉 참여 가능 조건", i.clinic_condition),
        field("commute_method", "통학 수단", i.commute_method),
        field("commute_time", "통원 소요 시간", i.commute_time),
      ],
    },
    { key: "future", title: "미래와 과목", fields: futureFields },
    {
      key: "personality",
      title: "성향 참고",
      fields: [
        field("mbti", "알고 있는 MBTI 4글자", i.mbti),
        { key: "mbti_confidence", label: "MBTI 확신도", value: mbtiConfidenceLabel(i.mbti_confidence) },
      ],
    },
    {
      key: "commitment",
      title: "첫 14일 실천 약속",
      fields: [field("commitment14", "학생이 직접 정한 실천 약속", i.commitment14)],
    },
  ];
}

export function formatLikertResponseV2(
  item: Extract<AssessmentItem, { kind: "likert" }>,
  value: unknown
): string | null {
  if (value === "unknown" && item.allowUnknown) return "아직 잘 모르겠음";
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return null;
  return `${value}점 · ${SCALE_LABELS_V2[item.scale][value - 1]}`;
}

function buildQuestion(
  item: AssessmentItem,
  number: number,
  stored: StoredResponsesV2
): DisplayQuestionV2 {
  const responses = isRecord(stored.responses) ? stored.responses : {};
  const scenarios = isRecord(stored.scenarios) ? stored.scenarios : {};
  const supplements = isRecord(stored.supplements) ? stored.supplements : {};

  if (isLikert(item)) {
    const raw = responses[item.id];
    const rawValue = raw === "unknown" || typeof raw === "number" ? raw : null;
    return {
      id: item.id,
      number,
      subject: item.subject,
      evidenceLabel: item.evidenceLabel,
      question: item.text,
      answer: formatLikertResponseV2(item, raw),
      rawValue,
      supplements:
        item.supplement?.fields.map((supplement) => ({
          id: supplement.id,
          label: supplement.label,
          value: textValue(supplements[supplement.id]),
        })) ?? [],
    };
  }

  const raw = scenarios[item.id];
  const option = typeof raw === "number" ? item.options.find((candidate) => candidate.index === raw) : undefined;
  return {
    id: item.id,
    number,
    subject: item.subject,
    evidenceLabel: item.evidenceLabel,
    question: item.text,
    answer: option ? `${option.choice} · ${option.text}` : null,
    rawValue: typeof raw === "number" ? raw : null,
    supplements: [],
  };
}

export function buildV2QuestionGroups(survey: SurveyV2Source): DisplayQuestionGroupV2[] {
  const subject = getSurveyV2Subject(survey);
  const stored = asStoredResponses(survey.responses_v2);
  const questions = getItemsForSubject(subject).map((item, index) => buildQuestion(item, index + 1, stored));
  const subjects: Subject[] = ["common"];
  if (subject === "math" || subject === "both") subjects.push("math");
  if (subject === "english" || subject === "both") subjects.push("english");
  return subjects.map((sectionSubject) => ({
    subject: sectionSubject,
    title: SUBJECT_SECTION_LABEL_V2[sectionSubject],
    questions: questions.filter((question) => question.subject === sectionSubject),
  }));
}

export function buildSurveyV2DisplayData(survey: SurveyV2Source): SurveyV2DisplayData {
  const subject = getSurveyV2Subject(survey);
  const questionGroups = buildV2QuestionGroups(survey);
  const questions = questionGroups.flatMap((group) => group.questions);
  return {
    subject,
    subjectLabel: SUBJECT_LABEL_V2[subject],
    intakeSections: buildV2IntakeSections(survey),
    questionGroups,
    answeredCount: questions.filter((question) => question.answer !== null).length,
    questionCount: questions.length,
  };
}

function numericScore(score: Score | unknown): number | null {
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function getV2CoreMetrics(profile: ScoreProfile | Record<string, unknown> | null | undefined): V2Metric[] {
  if (!isRecord(profile) || !isRecord(profile.common)) return [];
  const common = profile.common as Record<string, unknown>;
  return [
    { key: "learningAttitude", label: "학습 태도", score: numericScore(common.learningAttitude) },
    { key: "homeworkReliability", label: "숙제 신뢰도", score: numericScore(common.homeworkReliability) },
    { key: "longTermPersistence", label: "장기 의지", score: numericScore(common.longTermPersistence) },
    { key: "shortTermRecovery", label: "단기 회복력", score: numericScore(common.shortTermRecovery) },
    { key: "phoneBoundary", label: "휴대폰 자기조절", score: numericScore(common.phoneBoundary) },
    { key: "conscientiousness", label: "학습 성실성", score: numericScore(common.conscientiousness) },
  ];
}

/**
 * 설문 관리 목록의 기존 6개 열을 V1/V2 모두에서 채운다.
 * V2는 임의 평균을 만들지 않고 의미가 대응되는 서버 계산 0~100 원점수를 그대로 사용한다.
 */
export function getSurveyManagementFactorScores(
  survey: SurveyManagementScoreSource
): SurveyManagementFactorScore[] {
  if (survey.instrument_version === "v2") {
    const profile = survey.score_profile_v2;
    const common = isRecord(profile) && isRecord(profile.common)
      ? (profile.common as Record<string, unknown>)
      : {};

    return MANAGEMENT_FACTOR_CONFIG.map((factor) => ({
      key: factor.key,
      label: factor.label,
      value: numericScore(common[factor.v2Field]),
      scale: 100 as const,
      sourceLabel: factor.v2SourceLabel,
      highIsRisk: "v2HighIsRisk" in factor && factor.v2HighIsRisk === true,
    }));
  }

  return MANAGEMENT_FACTOR_CONFIG.map((factor) => ({
    key: factor.key,
    label: factor.label,
    value: numericScore(survey[factor.legacyField]),
    scale: 5 as const,
    sourceLabel: factor.label,
    highIsRisk: false,
  }));
}

export function v2PositiveBandLabel(score: number | null): string {
  if (score === null) return "확인 필요";
  if (score >= 75) return "안정적";
  if (score >= 60) return "대체로 잘 됨";
  if (score >= 40) return "들쭉날쭉";
  return "먼저 도와줄 부분";
}

/** 등록안내 생성 등 서버 프롬프트에서 V1 q1~q35를 섞지 않도록 하는 V2 전용 직렬화. */
export function surveyV2ToText(survey: SurveyV2Source): string {
  const data = buildSurveyV2DisplayData(survey);
  const lines: string[] = [
    `설문 버전: V2 학습 프로필`,
    `학생 이름: ${survey.name ?? ""}`,
    `학교/학년: ${[survey.school, survey.grade].filter(Boolean).join(" ")}`,
    `진단 과목: ${data.subjectLabel}`,
    `학생 연락처: ${survey.student_phone ?? ""}`,
    `학부모 연락처: ${survey.parent_phone ?? ""}`,
  ];

  for (const section of data.intakeSections.slice(1)) {
    lines.push("", `=== ${section.title} ===`);
    for (const item of section.fields) lines.push(`${item.label}: ${item.value ?? "미입력"}`);
  }

  lines.push("", `=== 최신 V2 문항 응답 (${data.answeredCount}/${data.questionCount}) ===`);
  for (const group of data.questionGroups) {
    lines.push(`[${group.title}]`);
    for (const question of group.questions) {
      lines.push(`${question.number}. (${question.id}·${question.evidenceLabel}) ${question.question}: ${question.answer ?? "미응답"}`);
      for (const supplement of question.supplements) {
        lines.push(`  - ${supplement.label}: ${supplement.value ?? "미선택"}`);
      }
    }
  }

  const metrics = getV2CoreMetrics(survey.score_profile_v2);
  if (metrics.length) {
    lines.push("", "=== 서버 계산 V2 핵심 점수 (0~100) ===");
    for (const metric of metrics) {
      lines.push(`${metric.label}: ${metric.score === null ? "정보 부족" : `${metric.score.toFixed(1)}점`}`);
    }
    const profile = survey.score_profile_v2;
    if (isRecord(profile) && isRecord(profile.nkFit)) {
      lines.push(`NK 운영 적합 단계: ${textValue(profile.nkFit.stage) ?? "확인 필요"}`);
      const overall = numericScore(profile.nkFit.overall);
      lines.push(`NK 운영 적합도: ${overall === null ? "정보 부족" : `${overall.toFixed(1)}점`}`);
    }
  }
  return lines.join("\n");
}
