import { z } from "zod";

export const bookingFormSchema = z.object({
  branch: z.enum(["gojan-math", "gojan-eng", "zai-both"], {
    message: "관을 선택해주세요",
  }),
  consult_type: z.enum(["phone", "inperson"], {
    message: "상담 유형을 선택해주세요",
  }),
  booking_date: z.string().min(1, "날짜를 선택해주세요"),
  booking_hour: z.coerce.number().min(13).max(20),
  student_name: z.string().min(1, "학생 이름을 입력해주세요"),
  parent_name: z.string().min(1, "학부모 성함을 입력해주세요"),
  phone: z
    .string()
    .min(1, "연락처를 입력해주세요")
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 전화번호 형식이 아닙니다"),
  school: z.string().optional(),
  grade: z.string().min(1, "학년을 선택해주세요"),
  subject: z.enum(["math", "eng", "both"], {
    message: "과목을 선택해주세요",
  }),
  progress: z.string().optional(),
  pay_method: z.enum(["done", "will"], {
    message: "입금 상태를 선택해주세요",
  }),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;
