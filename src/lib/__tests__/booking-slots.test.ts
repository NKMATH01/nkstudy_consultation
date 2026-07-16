import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consultTimeToSlot,
  isPastSlot,
  slotToConsultTime,
} from "../booking-slots";

afterEach(() => {
  vi.useRealTimers();
});

describe("booking slot model", () => {
  it("토요일 교시를 새벽 1~4시가 아닌 실제 시작 시각으로 판정한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18, 10, 0));

    const saturday = new Date(2026, 6, 18);
    expect(isPastSlot(saturday, 1)).toBe(false);
  });

  it("토요일 교시 시작 후에는 지난 슬롯으로 판정한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18, 12, 0));

    expect(isPastSlot(new Date(2026, 6, 18), 1)).toBe(true);
  });

  it("평일 슬롯은 해당 시각 정각을 기준으로 판정한다", () => {
    vi.useFakeTimers();
    const monday = new Date(2026, 6, 13);

    vi.setSystemTime(new Date(2026, 6, 13, 14, 59));
    expect(isPastSlot(monday, 15)).toBe(false);

    vi.setSystemTime(new Date(2026, 6, 13, 15, 1));
    expect(isPastSlot(monday, 15)).toBe(true);
  });

  it("상담 시각을 정확히 대응하는 슬롯으로만 역변환한다", () => {
    expect(consultTimeToSlot("2026-07-13", "15:00")).toBe(15);
    expect(consultTimeToSlot("2026-07-13", "15:30")).toBe(15);
    expect(consultTimeToSlot("2026-07-18", "11:30")).toBe(1);
  });

  it("비정각·슬롯 밖 시간·일요일은 null을 반환한다", () => {
    expect(consultTimeToSlot("2026-07-13", "15:10")).toBeNull();
    expect(consultTimeToSlot("2026-07-13", "12:00")).toBeNull();
    expect(consultTimeToSlot("2026-07-12", "15:00")).toBeNull();
  });

  it("토요일 교시를 상담 레코드용 실제 시작 시각으로 변환한다", () => {
    const saturday = new Date(2026, 6, 18);
    expect(slotToConsultTime(1, saturday, "phone")).toBe("11:30");
    expect(slotToConsultTime(3, saturday, "inperson")).toBe("14:30");
  });
});
