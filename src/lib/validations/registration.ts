import { z } from "zod";

export const registrationAdminSchema = z.object({
  registration_date: z.string().min(1, "등록일을 입력하세요"),
  grade: z.string().min(1, "학년을 선택하세요"),
  subject: z.string().min(1, "과목을 선택하세요"),
  preferred_days: z.string().optional().default(""),
  assigned_class: z.string().optional().default(""),
  teacher: z.string().optional().default(""),
  // UI/프롬프트 전용: registrations DB 컬럼이 아니며 안내문 HTML 생성에만 사용.
  math_class_days: z.string().optional(),
  math_class_time: z.string().optional().default(""),
  math_clinic_time: z.string().optional().default(""),
  assigned_class_2: z.string().optional(),
  teacher_2: z.string().optional(),
  // UI/프롬프트 전용: registrations DB 컬럼이 아니며 안내문 HTML 생성에만 사용.
  eng_class_days: z.string().optional(),
  eng_class_time: z.string().optional(),
  eng_clinic_time: z.string().optional(),
  assigned_class_math2: z.string().optional(),
  teacher_math2: z.string().optional(),
  // UI/프롬프트 전용: registrations DB 컬럼이 아니며 안내문 HTML 생성에만 사용.
  math2_class_days: z.string().optional(),
  math2_class_time: z.string().optional(),
  math2_clinic_time: z.string().optional(),
  math2_test_days: z.string().optional(),
  math2_test_time: z.string().optional(),
  math_test_days: z.string().optional(),
  math_test_time: z.string().optional(),
  eng_test_days: z.string().optional(),
  eng_test_time: z.string().optional(),
  use_vehicle: z.string().optional(),
  test_score: z.string().optional(),
  test_note: z.string().optional(),
  school_score: z.string().optional(),
  location: z.string().optional(),
  location_math2: z.string().optional(),
  location_2: z.string().optional(),
  consult_date: z.string().optional(),
  additional_note: z.string().optional(),
  // UI/프롬프트 전용: checklist 항목은 report_html/report_data 생성에만 사용.
  checklist_items: z.string().optional(),
  tuition_fee: z.coerce.number().optional(),
}).refine(
  (data) => {
    const hasMath = data.subject === "영어수학" || data.subject === "수학";
    if (hasMath) return !!data.assigned_class;
    return true;
  },
  { message: "수학 배정반을 선택하세요", path: ["assigned_class"] }
).refine(
  (data) => {
    const hasMath = data.subject === "영어수학" || data.subject === "수학";
    if (hasMath) return !!data.teacher;
    return true;
  },
  { message: "수학 담임을 선택하세요", path: ["teacher"] }
).refine(
  (data) => {
    const hasEng = data.subject === "영어수학" || data.subject === "영어";
    if (hasEng) return !!data.assigned_class_2;
    return true;
  },
  { message: "영어 배정반을 선택하세요", path: ["assigned_class_2"] }
).refine(
  (data) => {
    const hasEng = data.subject === "영어수학" || data.subject === "영어";
    if (hasEng) return !!data.teacher_2;
    return true;
  },
  { message: "영어 담임을 선택하세요", path: ["teacher_2"] }
);

export type RegistrationAdminFormData = z.infer<typeof registrationAdminSchema>;
