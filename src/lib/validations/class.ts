import { z } from "zod";

export const classFormSchema = z.object({
  name: z.string().min(1, "반 이름을 입력해주세요"),
  teacher: z.string().optional(),
  target_grade: z.string().optional(),
  class_days: z.string().optional(),
  class_time: z.string().optional(),
  clinic_time: z.string().optional(),
  weekly_test_time: z.string().optional(),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;

export const teacherFormSchema = z.object({
  name: z.string().min(1, "선생님 이름을 입력해주세요"),
  subject: z.string().optional(),
  target_grade: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["teacher", "clinic", "admin", "director", "principal", "manager", "staff"]).optional(),
  password: z.string().optional(),
});

export type TeacherFormValues = z.infer<typeof teacherFormSchema>;

export const studentFormSchema = z.object({
  name: z.string().min(1, "학생 이름을 입력해주세요"),
  school: z.string().optional(),
  grade: z.string().optional(),
  student_phone: z.string().optional(),
  parent_phone: z.string().optional(),
  assigned_class: z.string().optional(),
  teacher: z.string().optional(),
  memo: z.string().optional(),
  registration_date: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
