export type BookingConsultType = "inperson" | "phone";

export interface BookingSlot {
  code: number;
  days: readonly number[];
  label: string;
  testStart: string;
  testEnd: string;
  inpersonStart: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const SATURDAY = [6] as const;

export const WEEKDAY_SLOT_CODES = [15, 16, 17, 18, 19, 20] as const;
export const SATURDAY_SLOT_CODES = [1, 2, 3, 4] as const;
export const ALL_SLOT_CODES = [
  ...SATURDAY_SLOT_CODES,
  ...WEEKDAY_SLOT_CODES,
] as const;

const weekdaySlots: BookingSlot[] = WEEKDAY_SLOT_CODES.map((code) => ({
  code,
  days: WEEKDAYS,
  label: `${code}:00`,
  testStart: `${code}:00`,
  testEnd: `${code + 1}:00`,
  // 기존 예약→상담 레코드의 평일 대면 시각(HH:30)을 이번 단계에서는 유지한다.
  inpersonStart: `${code}:30`,
}));

const saturdaySlots: BookingSlot[] = [
  {
    code: 1,
    days: SATURDAY,
    label: "1교시 (11:30~13:00)",
    testStart: "11:30",
    testEnd: "13:00",
    // 토요일 상담 레코드는 현재 교시 시작 시각을 저장하는 규칙을 유지한다.
    inpersonStart: "11:30",
  },
  {
    code: 2,
    days: SATURDAY,
    label: "2교시 (13:00~14:30)",
    testStart: "13:00",
    testEnd: "14:30",
    inpersonStart: "13:00",
  },
  {
    code: 3,
    days: SATURDAY,
    label: "3교시 (14:30~16:00)",
    testStart: "14:30",
    testEnd: "16:00",
    inpersonStart: "14:30",
  },
  {
    code: 4,
    days: SATURDAY,
    label: "4교시 (16:00~17:30)",
    testStart: "16:00",
    testEnd: "17:30",
    inpersonStart: "16:00",
  },
];

export const SLOTS: readonly BookingSlot[] = [
  ...saturdaySlots,
  ...weekdaySlots,
];

export const SATURDAY_LABELS: Readonly<Record<number, string>> =
  Object.fromEntries(saturdaySlots.map((slot) => [slot.code, slot.label]));

function toLocalDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function findSlot(date: Date | string, code: number): BookingSlot | null {
  const parsedDate = toLocalDate(date);
  if (!parsedDate) return null;

  const day = parsedDate.getDay();
  return (
    SLOTS.find((slot) => slot.code === code && slot.days.includes(day)) ?? null
  );
}

function setTime(date: Date, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function getSlotCodesForDate(date: Date | string): number[] {
  const parsedDate = toLocalDate(date);
  if (!parsedDate) return [];

  const day = parsedDate.getDay();
  return SLOTS.filter((slot) => slot.days.includes(day)).map(
    (slot) => slot.code,
  );
}

export function getSlotLabel(code: number): string {
  return SATURDAY_LABELS[code] ?? `${code}:00`;
}

export function getSlot(code: number, date: Date | string): BookingSlot | null {
  return findSlot(date, code);
}

export function isSaturdayCode(code: number): boolean {
  return SATURDAY_SLOT_CODES.includes(
    code as (typeof SATURDAY_SLOT_CODES)[number],
  );
}

export function isPastSlot(date: Date, code: number): boolean {
  const slot = findSlot(date, code);
  if (!slot) return false;
  return setTime(date, slot.testStart).getTime() < Date.now();
}

export function slotToConsultTime(
  code: number,
  date: Date,
  consultType: BookingConsultType,
): string {
  const slot = findSlot(date, code);
  if (!slot) return "";
  return consultType === "inperson" ? slot.inpersonStart : slot.testStart;
}

export function consultTimeToSlot(
  date: Date | string,
  time: string,
): number | null {
  const normalizedTime = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!normalizedTime) return null;

  const hour = Number(normalizedTime[1]);
  const minute = Number(normalizedTime[2]);
  if (hour > 23 || minute > 59) return null;

  const comparableTime = `${normalizedTime[1]}:${normalizedTime[2]}`;
  const candidates = getSlotCodesForDate(date)
    .map((code) => findSlot(date, code))
    .filter((slot): slot is BookingSlot => slot !== null)
    .filter(
      (slot) =>
        slot.testStart === comparableTime ||
        slot.inpersonStart === comparableTime,
    );

  if (candidates.length !== 1) return null;
  return candidates[0].code;
}
