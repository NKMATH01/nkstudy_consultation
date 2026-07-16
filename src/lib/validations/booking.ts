import { z } from "zod";
import { getSlotCodesForDate } from "@/lib/booking-slots";

// DB의 booking_hour CHECK가 토요일 교시(1~4)를 허용하도록 교체된 뒤 true로 전환한다.
export const SATURDAY_BOOKING_ENABLED = false;

const bookingFormBaseSchema = z.object({
  branch: z.enum(["gojan-math", "gojan-eng", "zai-both"], {
    message: "관을 선택해주세요",
  }),
  consult_type: z.enum(["phone", "inperson"], {
    message: "상담 유형을 선택해주세요",
  }),
  booking_date: z.string().min(1, "날짜를 선택해주세요"),
  booking_hour: z.coerce.number().int(),
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

export const bookingFormSchema = bookingFormBaseSchema.superRefine(
  (data, context) => {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.booking_date);
    if (!dateMatch) {
      context.addIssue({
        code: "custom",
        path: ["booking_date"],
        message: "올바른 날짜를 선택해주세요",
      });
      return;
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const dayOfMonth = Number(dateMatch[3]);
    const date = new Date(year, month - 1, dayOfMonth);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== dayOfMonth
    ) {
      context.addIssue({
        code: "custom",
        path: ["booking_date"],
        message: "올바른 날짜를 선택해주세요",
      });
      return;
    }

    const day = date.getDay();
    if (day === 0) {
      context.addIssue({
        code: "custom",
        path: ["booking_date"],
        message: "일요일은 예약할 수 없습니다",
      });
      return;
    }

    if (day === 6 && !SATURDAY_BOOKING_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["booking_date"],
        message: "토요일 예약은 현재 준비 중입니다",
      });
      return;
    }

    if (!getSlotCodesForDate(date).includes(data.booking_hour)) {
      context.addIssue({
        code: "custom",
        path: ["booking_hour"],
        message:
          day === 6
            ? "토요일 예약 교시는 1~4교시만 선택할 수 있습니다"
            : "평일 예약 시간은 15시부터 20시까지입니다",
      });
    }
  },
);

export type BookingFormData = z.infer<typeof bookingFormSchema>;
