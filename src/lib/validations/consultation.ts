import { z } from "zod";

export const consultationFormSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  school: z.string().optional(),
  grade: z.string().optional(),
  parent_phone: z.string().optional(),
  consult_date: z.string().optional(),
  consult_time: z.string().optional(),
  subject: z.string().optional(),
  location: z.string().optional(),
  consult_type: z.string().optional(),
  memo: z.string().optional(),
});

export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

export const textParseSchema = z.object({
  text: z.string().min(1, "텍스트를 입력해주세요"),
});

export type TextParseValues = z.infer<typeof textParseSchema>;
