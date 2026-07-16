import { describe, expect, it } from "vitest";
import {
  bookingFormSchema,
  SATURDAY_BOOKING_ENABLED,
} from "../validations/booking";

function bookingData(date: string, hour: number) {
  return {
    branch: "gojan-math",
    consult_type: "phone",
    booking_date: date,
    booking_hour: hour,
    student_name: "테스트학생",
    parent_name: "테스트학부모",
    phone: "010-1234-5678",
    school: "테스트중",
    grade: "중1",
    subject: "math",
    pay_method: "will",
  };
}

describe("bookingFormSchema slot validation", () => {
  it.each([15, 16, 17, 18, 19, 20])(
    "평일 %i시는 허용한다",
    (hour) => {
      expect(
        bookingFormSchema.safeParse(bookingData("2026-07-13", hour)).success,
      ).toBe(true);
    },
  );

  it.each([13, 14])("평일 %i시는 거부한다", (hour) => {
    expect(
      bookingFormSchema.safeParse(bookingData("2026-07-13", hour)).success,
    ).toBe(false);
  });

  it("일요일 예약을 거부한다", () => {
    expect(
      bookingFormSchema.safeParse(bookingData("2026-07-12", 15)).success,
    ).toBe(false);
  });

  it("토요일 기능 플래그가 false인 동안 교시 예약을 거부한다", () => {
    expect(SATURDAY_BOOKING_ENABLED).toBe(false);
    expect(
      bookingFormSchema.safeParse(bookingData("2026-07-18", 1)).success,
    ).toBe(false);
  });
});
