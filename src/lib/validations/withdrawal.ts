import { z } from "zod";
import { ISO_DATE_PATTERN } from "@/lib/withdrawal-dates";

/** 상담 요약에 요구하는 최소 글자 수. 폼 카운터도 이 값을 쓴다. */
export const CONSULT_SUMMARY_MIN_LENGTH = 30;

export const WITHDRAWAL_REQUIRED_MESSAGES = {
  withdrawal_date: "퇴원일(마지막 등원일)을 선택해주세요",
  reason_category: "퇴원 사유 분류를 선택해주세요",
  final_consult_date: "최종 상담일을 선택해주세요",
  final_consult_summary: `상담 요약을 ${CONSULT_SUMMARY_MIN_LENGTH}자 이상 입력해주세요`,
} as const;

/** 필수 날짜: 값이 없어도(undefined) 같은 안내가 나가도록 error 메시지를 고정한다. */
const requiredDate = (message: string) =>
  z.string({ error: message }).regex(ISO_DATE_PATTERN, message);

/** 선택 날짜: 비어 있으면 통과, 값이 있으면 YYYY-MM-DD 여야 한다. */
const optionalDate = (message: string) =>
  z
    .string()
    .optional()
    .refine((v) => !v || ISO_DATE_PATTERN.test(v), { message });

export const withdrawalFormSchema = z.object({
  // 필수 조건은 그대로(1자 이상)고, 값이 아예 안 넘어왔을 때도 같은 한국어 안내가 나가게만 맞춘다.
  name: z.string({ error: "이름을 입력해주세요" }).min(1, "이름을 입력해주세요"),
  school: z.string().optional(),
  subject: z.string().optional(),
  class_name: z.string().optional(),
  teacher: z.string().optional(),
  grade: z.string().optional(),
  enrollment_start: z.string().optional(),
  // enrollment_end는 폼에서 내렸지만 과거 기록 보존을 위해 스키마에는 남긴다.
  enrollment_end: z.string().optional(),
  /** 퇴원 인지일 — 학원이 퇴원 사실을 알게 된 날. 퇴원일(마지막 등원일)과 별개. */
  notice_date: optionalDate("퇴원 인지일은 달력에서 선택해주세요"),
  duration_months: z.coerce.number().optional(),
  /** 퇴원일 = 마지막 등원일. 월까지만 있는 "2026.01" 류 유입을 여기서 끊는다. */
  withdrawal_date: requiredDate(WITHDRAWAL_REQUIRED_MESSAGES.withdrawal_date),
  class_attitude: z.string().optional(),
  homework_submission: z.string().optional(),
  attendance: z.string().optional(),
  grade_change: z.string().optional(),
  recent_grade: z.string().optional(),
  reason_category: z
    .string({ error: WITHDRAWAL_REQUIRED_MESSAGES.reason_category })
    .min(1, WITHDRAWAL_REQUIRED_MESSAGES.reason_category),
  student_opinion: z.string().optional(),
  parent_opinion: z.string().optional(),
  teacher_opinion: z.string().optional(),
  final_consult_date: requiredDate(WITHDRAWAL_REQUIRED_MESSAGES.final_consult_date),
  final_counselor: z.string().optional(),
  final_consult_summary: z
    .string({ error: WITHDRAWAL_REQUIRED_MESSAGES.final_consult_summary })
    .min(CONSULT_SUMMARY_MIN_LENGTH, WITHDRAWAL_REQUIRED_MESSAGES.final_consult_summary),
  parent_thanks: z.boolean().optional(),
  comeback_possibility: z.string().optional(),
  expected_comeback_date: z.string().optional(),
  special_notes: z.string().optional(),
  raw_text: z.string().optional(),
});

export type WithdrawalFormValues = z.infer<typeof withdrawalFormSchema>;

/** 퇴원 회고 폼. completed_at은 서버에서 계산하므로 받지 않는다. */
export const retrospectiveFormSchema = z.object({
  first_sign: z.string().optional(),
  our_attempts: z.string().optional(),
  do_differently: z.string().optional(),
  system_change: z.string().optional(),
  lesson: z.string().max(120, "배움 한 줄은 120자 이내로 입력해주세요").optional(),
  manager_comment: z.string().optional(),
  author: z.string().optional(),
});

export type RetrospectiveFormValues = z.infer<typeof retrospectiveFormSchema>;

/** 월간 개선 액션. 서버 액션 내부 검증용. */
export const improvementActionSchema = z.object({
  action_text: z.string().min(1, "실행 항목 내용을 입력해주세요"),
  owner: z.string().optional(),
  source: z.string().optional(),
  source_title: z.string().optional(),
  year_month: z.string().regex(/^\d{4}-\d{2}$/, "연월 형식이 올바르지 않습니다"),
});

export type ImprovementActionValues = z.infer<typeof improvementActionSchema>;
