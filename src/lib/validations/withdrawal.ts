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
