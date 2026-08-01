// 설문 V2 공유 Zod 검증 모듈.
// 클라이언트(설문 UI)와 서버(제출 액션)가 동일 계약을 공유한다.
// 구현 명세서 §6(기본정보·서술형), §10(validation·서버 액션) 계약을 구현한다.
//
// 주의: 클라이언트가 보낸 점수는 신뢰하지 않는다. 이 모듈은 raw 응답만 검증하고,
// 실제 점수는 서버가 computeScoreProfile()로 재계산한다(submission action 참조).

import { z } from "zod";
import { GRADES } from "@/types";
import {
  RETIRED_ITEM_IDS,
  getItemsForSubject,
  isChoiceItem,
  isLikert,
} from "./definition";
import type {
  ClinicAvailability,
  MbtiConfidence,
  NkFeature,
  ScoreProfile,
  ScoringInput,
  SubjectSelection,
} from "./types";

// ── 선택지 상수 (UI·서버 공유) ───────────────────────────────────────

export const SUBJECT_OPTIONS: { value: SubjectSelection; label: string }[] = [
  { value: "math", label: "수학" },
  { value: "english", label: "영어" },
  { value: "both", label: "수학+영어" },
];

/** §6.3 NK 기대(최대 3개 복수선택). */
export const NK_EXPECTATION_OPTIONS = [
  "강한 관리·명확한 기준",
  "철저한 숙제 관리",
  "1:1 질문·개별 피드백",
  "클리닉·보완학습",
  "주간 테스트·재보완",
  "진도·과제 즉시 확인",
  "학생 수준에 맞는 진도",
  "공부 습관 형성",
  "진로·학습 상담",
] as const;

export const NK_EXPECTATION_MAX = 3;

/** §6.3 기대 항목 → §8.6 NK 운영 영역(featureFit 계산 대상)만 매핑. 나머지는 매핑 없음. */
const EXPECTATION_TO_FEATURE: Partial<Record<string, NkFeature>> = {
  "클리닉·보완학습": "clinic",
  "주간 테스트·재보완": "weeklyTest",
  "철저한 숙제 관리": "homework",
  "진도·과제 즉시 확인": "immediateFeedback",
};

/** §6.4 희망 수업 요일. */
export const PREFERRED_DAYS_V2 = [
  "월수금",
  "화목금",
  "화목토",
  "주말 집중",
  "상관없음",
] as const;

/** §8.6 클리닉 참여 가능값(구조화). 서술을 숫자로 추측하지 않는다. */
export const CLINIC_CONDITION_OPTIONS: {
  label: string;
  value: ClinicAvailability;
}[] = [
  { label: "정규수업 뒤 정기 참여 가능", value: 100 },
  { label: "요일·시간이 맞으면 가능", value: 75 },
  { label: "사전 조율하면 가능", value: 50 },
  { label: "현재 참여 어려움", value: 25 },
  { label: "잘 모르겠음", value: null },
];

const CLINIC_LABELS = CLINIC_CONDITION_OPTIONS.map((o) => o.label) as [
  string,
  ...string[],
];

export function clinicAvailabilityFromLabel(
  label: string | undefined | null
): ClinicAvailability {
  const match = CLINIC_CONDITION_OPTIONS.find((o) => o.label === label);
  return match ? match.value : null;
}

/** §6.6 MBTI 확신도. Korean label ↔ scoring MbtiConfidence. */
export const MBTI_CONFIDENCE_OPTIONS: { label: string; value: MbtiConfidence }[] =
  [
    { label: "높음", value: "high" },
    { label: "보통", value: "medium" },
    { label: "낮음", value: "low" },
    { label: "잘 모르겠음", value: "none" },
  ];

const MBTI_PATTERN = /^[EI][SN][TF][JP]$/;

/** §6.2 유입 경로 선택지(친구소개 선택 시 소개자 이름 별도 저장). */
export const REFERRAL_OPTIONS = [
  "친구 소개",
  "학부모 소개",
  "지인 소개",
  "인터넷 검색",
  "블로그·카페",
  "전단지",
  "학원 앞 방문",
  "기타",
] as const;

// ── 헬퍼 스키마 ──────────────────────────────────────────────────────

const optStr = z.string().max(2000).optional();

/** 전화번호 정규화(기존 public-survey.ts 로직 재사용). 숫자만 추출 후 010-####-#### 형태. */
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = "0" + digits.slice(2);
  if (/^01[016789]\d{7,8}$/.test(digits)) {
    const mid = digits.length === 11 ? digits.slice(3, 7) : digits.slice(3, 6);
    const last = digits.slice(-4);
    return `${digits.slice(0, 3)}-${mid}-${last}`;
  }
  return digits;
}

/** 정규화 후 하이픈 제거한 숫자열(dedup·rate limit 키용, 로그 노출 금지). */
export function phoneDigits(raw: string | undefined | null): string {
  return normalizePhone(raw).replace(/\D/g, "");
}

const requiredPhone = z
  .string()
  .min(1, "연락처를 입력해주세요")
  .transform((v) => normalizePhone(v))
  .refine(
    (v) => /^01[016789]-\d{3,4}-\d{4}$/.test(v),
    "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)"
  );

const mbtiField = z
  .string()
  .max(4)
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase() : ""))
  .refine(
    (v) => v === "" || MBTI_PATTERN.test(v),
    "MBTI 4글자를 정확히 입력해주세요 (예: ENFP)"
  );

// ── §6 기본정보·서술형 intake 스키마 ─────────────────────────────────

export const intakeSchema = z.object({
  // 6.1 기본 필수정보
  name: z.string().trim().min(1, "이름을 입력해주세요").max(40),
  school: z.string().trim().min(1, "학교를 입력해주세요").max(60),
  grade: z.enum(GRADES),
  subject_selection: z.enum(["math", "english", "both"]),
  student_phone: requiredPhone,
  parent_phone: requiredPhone,

  // 6.2 기존 학원과 유입 (구조화 유지, text 병합 금지)
  prev_academy: optStr,
  prev_academy_duration: optStr,
  prev_leave_reason: optStr,
  prev_complaint: optStr,
  referral: optStr,
  referral_friend: optStr,
  nk_knowledge: optStr,

  // 6.3 NK 기대 (최대 3)
  nk_expectations: z
    .array(z.enum(NK_EXPECTATION_OPTIONS))
    .max(NK_EXPECTATION_MAX, `최대 ${NK_EXPECTATION_MAX}개까지 선택할 수 있습니다`)
    .default([]),

  // 6.4 일정
  preferred_days: z.enum(PREFERRED_DAYS_V2).or(z.literal("")).optional(),
  available_time: optStr,
  weekday_selfstudy: optStr,
  clinic_condition: z.enum(CLINIC_LABELS).or(z.literal("")).optional(),
  commute_method: optStr,
  commute_time: optStr,

  // 6.5 미래와 과목 서술
  has_future_plan: optStr,
  dream: optStr,
  target_university: optStr,
  study_core: optStr,
  problem_self: optStr,
  math_difficulty: optStr,
  english_difficulty: optStr,
  health_note: optStr,
  requests: optStr,

  // 6.6 MBTI
  mbti: mbtiField,
  // 미선택("") 또는 누락은 "none"으로 처리한다(무효 MBTI와 함께 점수 미반영).
  mbti_confidence: z.preprocess(
    (v) => (v === "" || v == null ? "none" : v),
    z.enum(["high", "medium", "low", "none"])
  ),
});

export type IntakeInput = z.input<typeof intakeSchema>;
export type IntakeData = z.output<typeof intakeSchema>;

// ── 응답 스키마 ──────────────────────────────────────────────────────

/** Likert 응답값: 1~5 정수 또는 "unknown". */
const likertValue = z.union([
  z.literal("unknown"),
  z.number().int().min(1).max(5),
]);

const metaSchema = z
  .object({
    activeSeconds: z.number().nonnegative().max(86400).optional(),
    firstSelectDelays: z.array(z.number().nonnegative()).optional(),
    items: z
      .record(
        z.string(),
        z.object({
          exposedAt: z.number().optional(),
          firstSelectAt: z.number().optional(),
          lastEditAt: z.number().optional(),
        })
      )
      .optional(),
  })
  .optional();

/**
 * V2 제출 전체 스키마.
 * 응답 허용 문항 ID는 subject_selection에 따라 서버에서 다시 계산한다(§10).
 */
export const v2SubmissionSchema = z
  .object({
    intake: intakeSchema,
    responses: z.record(z.string(), likertValue).default({}),
    scenarios: z.record(z.string(), z.number().int().min(1).max(4)).default({}),
    supplements: z.record(z.string(), z.string().max(200)).default({}),
    commitment14: z
      .string()
      .trim()
      .min(1, "첫 14일 실천 약속을 입력해주세요")
      .max(1000),
    meta: metaSchema,
  })
  .superRefine((data, ctx) => {
    const sel = data.intake.subject_selection as SubjectSelection;
    const items = getItemsForSubject(sel);
    const likertItems = items.filter(isLikert);
    // 상황문항과 강제선택은 응답 형태(선택지 index)가 같아 같은 버킷을 쓴다.
    const scenarioItems = items.filter(isChoiceItem);
    const likertIds = new Set(likertItems.map((i) => i.id));
    const scenarioIds = new Set(scenarioItems.map((i) => i.id));

    // 과목 불일치·미정의 문항 거부 (클라이언트 조작 차단).
    // 폐기 문항은 예외 — 설문 도중 배포되면 학생 저장분에 남아 있어 제출을 막으면 안 된다.
    for (const key of Object.keys(data.responses)) {
      if (RETIRED_ITEM_IDS.has(key)) continue;
      if (!likertIds.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `허용되지 않은 문항입니다: ${key}`,
          path: ["responses", key],
        });
      }
    }
    for (const key of Object.keys(data.scenarios)) {
      if (RETIRED_ITEM_IDS.has(key)) continue;
      if (!scenarioIds.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `허용되지 않은 상황문항입니다: ${key}`,
          path: ["scenarios", key],
        });
      }
    }

    // 필수 Likert 응답 검증 + unknown 허용 여부.
    for (const item of likertItems) {
      const v = data.responses[item.id];
      if (v === undefined || v === null) {
        if (item.required) {
          ctx.addIssue({
            code: "custom",
            message: `필수 문항에 응답해주세요: ${item.id}`,
            path: ["responses", item.id],
          });
        }
        continue;
      }
      if (v === "unknown" && !item.allowUnknown) {
        ctx.addIssue({
          code: "custom",
          message: `이 문항은 '잘 모르겠음'을 선택할 수 없습니다: ${item.id}`,
          path: ["responses", item.id],
        });
      }
    }

    // 필수 상황문항·강제선택 응답 검증(선택 index가 실제 옵션 범위인지).
    for (const item of scenarioItems) {
      const v = data.scenarios[item.id];
      if (v === undefined || v === null) {
        ctx.addIssue({
          code: "custom",
          message: `필수 문항에 응답해주세요: ${item.id}`,
          path: ["scenarios", item.id],
        });
        continue;
      }
      if (!item.options.some((o) => o.index === v)) {
        ctx.addIssue({
          code: "custom",
          message: `선택지가 올바르지 않습니다: ${item.id}`,
          path: ["scenarios", item.id],
        });
      }
    }
  })
  // 폐기 문항은 검증만 통과시키고 저장·채점에는 넘기지 않는다.
  .transform((data) => ({
    ...data,
    responses: dropRetired(data.responses),
    scenarios: dropRetired(data.scenarios),
  }));

function dropRetired<T>(values: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!RETIRED_ITEM_IDS.has(key)) out[key] = value;
  }
  return out;
}

export type V2SubmissionInput = z.input<typeof v2SubmissionSchema>;
export type V2SubmissionData = z.output<typeof v2SubmissionSchema>;

// ── 파생 helper ──────────────────────────────────────────────────────

/** §6.3 우선 선택 기대 → §8.6 priorityConcerns 대상 NkFeature. 중복 제거. */
export function expectationsToFeatures(expectations: string[]): NkFeature[] {
  const out: NkFeature[] = [];
  for (const exp of expectations) {
    const feature = EXPECTATION_TO_FEATURE[exp];
    if (feature && !out.includes(feature)) out.push(feature);
  }
  return out;
}

export function isValidMbtiString(type: string | undefined | null): boolean {
  return typeof type === "string" && MBTI_PATTERN.test(type.trim().toUpperCase());
}

/**
 * 검증된 제출 데이터로 서버 재채점용 ScoringInput을 구성한다.
 * 클라이언트가 보낸 점수는 사용하지 않는다 — raw 응답만 사용한다.
 */
export function buildScoringInput(data: V2SubmissionData): ScoringInput {
  const intake = data.intake;
  const validMbti = isValidMbtiString(intake.mbti);
  return {
    subjectSelection: intake.subject_selection as SubjectSelection,
    responses: data.responses,
    scenarioResponses: data.scenarios,
    mbti: validMbti
      ? { type: intake.mbti, confidence: intake.mbti_confidence }
      : null,
    clinicAvailability: clinicAvailabilityFromLabel(intake.clinic_condition),
    priorityFeatures: expectationsToFeatures(intake.nk_expectations),
    meta: {
      activeSeconds: data.meta?.activeSeconds,
      firstSelectDelays: data.meta?.firstSelectDelays,
    },
  };
}

/**
 * 검증된 제출 데이터 + 서버 재계산 점수로 surveys insert payload를 구성한다.
 * 순수 함수(DB 접근 없음) — 단위 테스트로 필드 유실 없음을 검증한다(§10, §15.2).
 *
 * - instrument_version='v2'로 V1과 구분(§9).
 * - q1~q35·factor_* 컬럼은 채우지 않는다(V2 원본은 *_v2 jsonb).
 * - 목록/상세 호환을 위해 이름·연락처 등 공용 텍스트 컬럼도 함께 채운다.
 * - prev_leave_reason·referral·nk_expectations 등은 text로 병합하지 않고 intake_v2에 구조 유지.
 */
export function buildV2InsertPayload(
  data: V2SubmissionData,
  score: ScoreProfile
): Record<string, unknown> {
  const intake = data.intake;
  const referralText = intake.referral
    ? intake.referral_friend
      ? `${intake.referral} (${intake.referral_friend})`
      : intake.referral
    : null;
  const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

  return {
    instrument_version: "v2",
    subject_selection: intake.subject_selection,

    // 공용 컬럼(관리자 목록/상세 호환).
    name: intake.name,
    school: orNull(intake.school),
    grade: intake.grade,
    student_phone: intake.student_phone || null,
    parent_phone: intake.parent_phone || null,
    referral: referralText,
    prev_academy: orNull(intake.prev_academy),
    prev_complaint: orNull(intake.prev_complaint),
    target_university: orNull(intake.target_university),
    available_time: orNull(intake.available_time),
    commute_method: orNull(intake.commute_method),
    commute_distance: orNull(intake.commute_time),
    prefer_days: intake.preferred_days || null,
    study_core: orNull(intake.study_core),
    problem_self: orNull(intake.problem_self),
    dream: orNull(intake.dream),
    math_difficulty: orNull(intake.math_difficulty),
    english_difficulty: orNull(intake.english_difficulty),
    mbti: intake.mbti || null,
    health_note: orNull(intake.health_note),
    requests: orNull(intake.requests),

    // V2 구조화 원본(진실의 원천).
    intake_v2: {
      subject_selection: intake.subject_selection,
      prev_academy: orNull(intake.prev_academy),
      prev_academy_duration: orNull(intake.prev_academy_duration),
      prev_leave_reason: orNull(intake.prev_leave_reason),
      prev_complaint: orNull(intake.prev_complaint),
      referral: orNull(intake.referral),
      referral_friend: orNull(intake.referral_friend),
      nk_knowledge: orNull(intake.nk_knowledge),
      nk_expectations: intake.nk_expectations,
      preferred_days: intake.preferred_days || null,
      available_time: orNull(intake.available_time),
      weekday_selfstudy: orNull(intake.weekday_selfstudy),
      clinic_condition: intake.clinic_condition || null,
      commute_method: orNull(intake.commute_method),
      commute_time: orNull(intake.commute_time),
      has_future_plan: orNull(intake.has_future_plan),
      dream: orNull(intake.dream),
      target_university: orNull(intake.target_university),
      study_core: orNull(intake.study_core),
      problem_self: orNull(intake.problem_self),
      math_difficulty: orNull(intake.math_difficulty),
      english_difficulty: orNull(intake.english_difficulty),
      health_note: orNull(intake.health_note),
      requests: orNull(intake.requests),
      mbti: intake.mbti || null,
      mbti_confidence: intake.mbti_confidence,
      commitment14: data.commitment14,
    },
    responses_v2: {
      responses: data.responses,
      scenarios: data.scenarios,
      supplements: data.supplements,
    },
    response_meta_v2: data.meta ?? {},
    score_profile_v2: score,
  };
}
