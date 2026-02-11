import { z } from "zod";

const scoreField = z.coerce.number().min(1).max(5).optional();

export const surveyFormSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  school: z.string().optional(),
  grade: z.string().optional(),
  student_phone: z.string().optional(),
  parent_phone: z.string().optional(),
  referral: z.string().optional(),
  prev_academy: z.string().optional(),
  prev_complaint: z.string().optional(),
  // 30문항
  q1: scoreField, q2: scoreField, q3: scoreField, q4: scoreField, q5: scoreField,
  q6: scoreField, q7: scoreField, q8: scoreField, q9: scoreField, q10: scoreField,
  q11: scoreField, q12: scoreField, q13: scoreField, q14: scoreField, q15: scoreField,
  q16: scoreField, q17: scoreField, q18: scoreField, q19: scoreField, q20: scoreField,
  q21: scoreField, q22: scoreField, q23: scoreField, q24: scoreField, q25: scoreField,
  q26: scoreField, q27: scoreField, q28: scoreField, q29: scoreField, q30: scoreField,
  // 주관식
  study_core: z.string().optional(),
  problem_self: z.string().optional(),
  dream: z.string().optional(),
  prefer_days: z.string().optional(),
  requests: z.string().optional(),
});

export type SurveyFormValues = z.infer<typeof surveyFormSchema>;
