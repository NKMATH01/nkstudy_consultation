import { z } from "zod";

export const registrationAdminSchema = z.object({
  registration_date: z.string().min(1, "등록일을 입력하세요"),
  grade: z.string().min(1, "학년을 선택하세요"),
  subject: z.string().min(1, "과목을 선택하세요"),
  preferred_days: z.string().min(1, "등원 요일을 선택하세요"),
  assigned_class: z.string().min(1, "배정반을 선택하세요"),
  teacher: z.string().min(1, "담임을 선택하세요"),
  math_class_days: z.string().optional(),
  math_class_time: z.string().min(1, "수학 수업 시간을 입력하세요"),
  math_clinic_time: z.string().min(1, "수학 클리닉 시간을 입력하세요"),
  assigned_class_2: z.string().optional(),
  teacher_2: z.string().optional(),
  eng_class_days: z.string().optional(),
  eng_class_time: z.string().optional(),
  eng_clinic_time: z.string().optional(),
  use_vehicle: z.string().optional(),
  test_score: z.string().optional(),
  test_note: z.string().optional(),
  school_score: z.string().optional(),
  location: z.string().optional(),
  consult_date: z.string().optional(),
  additional_note: z.string().optional(),
  tuition_fee: z.coerce.number().optional(),
}).refine(
  (data) => {
    if (data.subject === "영어수학" || data.subject === "영어") {
      return !!data.assigned_class_2 && !!data.teacher_2 && !!data.eng_class_time;
    }
    return true;
  },
  {
    message: "영어 배정반, 담임, 수업 시간을 입력하세요",
    path: ["assigned_class_2"],
  }
).refine(
  (data) => {
    const hasMath = data.subject === "영어수학" || data.subject === "수학";
    if (hasMath) return !!data.math_class_days;
    return true;
  },
  { message: "수학 수업 요일을 선택하세요", path: ["math_class_days"] }
).refine(
  (data) => {
    const hasEng = data.subject === "영어수학" || data.subject === "영어";
    if (hasEng) return !!data.eng_class_days;
    return true;
  },
  { message: "영어 수업 요일을 선택하세요", path: ["eng_class_days"] }
);

export type RegistrationAdminFormData = z.infer<typeof registrationAdminSchema>;
