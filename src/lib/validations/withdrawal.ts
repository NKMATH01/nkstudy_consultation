import { z } from "zod";

export const withdrawalFormSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  school: z.string().optional(),
  subject: z.string().optional(),
  class_name: z.string().optional(),
  teacher: z.string().optional(),
  grade: z.string().optional(),
  enrollment_start: z.string().optional(),
  enrollment_end: z.string().optional(),
  duration_months: z.coerce.number().optional(),
  withdrawal_date: z.string().optional(),
  class_attitude: z.string().optional(),
  homework_submission: z.string().optional(),
  attendance: z.string().optional(),
  grade_change: z.string().optional(),
  recent_grade: z.string().optional(),
  reason_category: z.string().optional(),
  student_opinion: z.string().optional(),
  parent_opinion: z.string().optional(),
  teacher_opinion: z.string().optional(),
  final_consult_date: z.string().optional(),
  final_counselor: z.string().optional(),
  final_consult_summary: z.string().optional(),
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
