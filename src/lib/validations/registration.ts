import { z } from "zod";

export const registrationAdminSchema = z.object({
  registration_date: z.string().min(1, "등록일을 입력하세요"),
  grade: z.string().min(1, "학년을 선택하세요"),
  subject: z.string().min(1, "과목을 선택하세요"),
  preferred_days: z.string().min(1, "희망요일을 선택하세요"),
  assigned_class: z.string().min(1, "배정반을 선택하세요"),
  teacher: z.string().min(1, "담임을 선택하세요"),
  assigned_class_2: z.string().optional(),
  teacher_2: z.string().optional(),
  use_vehicle: z.string().optional(),
  test_score: z.string().optional(),
  test_note: z.string().optional(),
  location: z.string().optional(),
  consult_date: z.string().optional(),
  additional_note: z.string().optional(),
  tuition_fee: z.coerce.number().optional(),
}).refine(
  (data) => {
    if (data.subject === "영어수학") {
      return !!data.assigned_class_2 && !!data.teacher_2;
    }
    return true;
  },
  {
    message: "영어수학 선택 시 두 번째 반과 담임을 입력하세요",
    path: ["assigned_class_2"],
  }
);

export type RegistrationAdminFormData = z.infer<typeof registrationAdminSchema>;
