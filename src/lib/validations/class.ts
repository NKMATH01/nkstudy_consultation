import { z } from "zod";

export const classFormSchema = z.object({
  name: z.string().min(1, "반 이름을 입력해주세요"),
  teacher: z.string().optional(),
  target_grade: z.string().optional(),
  class_days: z.string().optional(),
  class_time: z.string().optional(),
  clinic_time: z.string().optional(),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;

export const teacherFormSchema = z.object({
  name: z.string().min(1, "선생님 이름을 입력해주세요"),
  subject: z.string().optional(),
  target_grade: z.string().optional(),
  phone: z.string().optional(),
});

export type TeacherFormValues = z.infer<typeof teacherFormSchema>;
