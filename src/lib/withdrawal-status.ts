/**
 * 퇴원 상태(퇴원/휴원/복귀) 판정 순수 함수 모음.
 *
 * 집계 규칙 — 퇴원 통계는 status='withdrawn'만 센다. paused·returned는 제외한다.
 * 목록 화면은 전체를 보여 주므로, 필터는 통계 계산 직전에만 건다.
 */

import type { Withdrawal, WithdrawalStatusValue } from "@/types";
import { ISO_DATE_PATTERN } from "@/lib/withdrawal-dates";
import { retrospectiveStatus } from "@/lib/withdrawal-retrospective";

const MS_PER_DAY = 86_400_000;

/** 회고 리마인더 기준일. 퇴원일 + 이 일수가 지나면 독촉으로 본다. */
export const RETROSPECTIVE_DUE_DAYS = 7;

const VALID_STATUSES: readonly WithdrawalStatusValue[] = ["withdrawn", "paused", "returned"];

/** 통계·필터에 쓰는 최소 형태. 테스트에서 부분 객체만 넘길 수 있게 좁게 잡는다. */
type StatusRow = Pick<Withdrawal, "status"> &
  Partial<Pick<Withdrawal, "withdrawal_date" | "expected_comeback_date" | "retrospective">>;

/**
 * 상태 값을 안전하게 읽는다.
 * status 컬럼이 없는 DB나 알 수 없는 값이면 '퇴원'으로 본다(기존 동작 유지).
 */
export function statusOf(row: { status?: string | null } | null | undefined): WithdrawalStatusValue {
  const raw = row?.status;
  return VALID_STATUSES.includes(raw as WithdrawalStatusValue)
    ? (raw as WithdrawalStatusValue)
    : "withdrawn";
}

/** 퇴원 통계에 세는 건인지. 휴원·복귀는 세지 않는다. */
export function isCountedWithdrawal(row: { status?: string | null } | null | undefined): boolean {
  return statusOf(row) === "withdrawn";
}

/** Date 또는 'YYYY-MM-DD' 문자열을 로컬 기준 'YYYY-MM-DD'로 맞춘다. */
export function toIsoDay(value: Date | string): string {
  if (typeof value === "string") return value.trim();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 'YYYY-MM-DD'만 Date로 바꾼다. 그 외 표기는 null. */
function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE_PATTERN.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 두 날짜의 일수 차이(뒤 - 앞). 하나라도 파싱 안 되면 null. */
function daysBetween(from: string | null | undefined, to: string): number | null {
  const start = parseIsoDay(from);
  const end = parseIsoDay(to);
  if (!start || !end) return null;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * 휴원인데 예상 복귀 시기가 지났는지.
 *
 * expected_comeback_date는 "9월 초" 같은 서술형이 섞인 자유 텍스트라,
 * 'YYYY-MM-DD'로 또렷하게 적힌 경우에만 경과를 판정한다.
 * 형식이 아니면 판정하지 않고 false를 돌려준다(억지 추측 금지).
 */
export function isPausedOverdue(row: StatusRow, today: Date | string): boolean {
  if (statusOf(row) !== "paused") return false;
  const diff = daysBetween(row.expected_comeback_date, toIsoDay(today));
  return diff !== null && diff > 0;
}

/** 퇴원일로부터 며칠 지났는지. 퇴원일이 온전한 날짜가 아니면 null. */
export function daysSinceWithdrawal(row: StatusRow, today: Date | string): number | null {
  return daysBetween(row.withdrawal_date, toIsoDay(today));
}

export type RetrospectiveReminder = "none" | "waiting" | "overdue";

/**
 * 회고 리마인더 상태.
 * - 퇴원(withdrawn) 건이 아니거나, 회고가 이미 완료됐거나, 퇴원일이 온전치 않으면 'none'
 * - 퇴원일 + 7일이 지났는데 회고가 미완이면 'overdue'
 * - 아직 7일이 안 됐으면 'waiting'
 */
export function retrospectiveReminder(
  row: StatusRow,
  today: Date | string,
): RetrospectiveReminder {
  if (statusOf(row) !== "withdrawn") return "none";
  if (retrospectiveStatus(row.retrospective) === "complete") return "none";
  const days = daysSinceWithdrawal(row, today);
  if (days === null) return "none";
  return days >= RETROSPECTIVE_DUE_DAYS ? "overdue" : "waiting";
}

/**
 * 붙여넣기 텍스트에 휴원 신호가 있는지.
 * 확정이 아니라 '제안'이다 — 폼에서 사용자가 상태를 확인하고 저장한다.
 */
const PAUSED_TEXT_PATTERNS = [/휴원/, /복귀\s*예정/];

export function detectPausedFromText(text: string | null | undefined): boolean {
  if (!text) return false;
  return PAUSED_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

/** 목록 상단 한 줄 요약용 집계. */
export function summarizeStatuses(
  rows: StatusRow[],
  today: Date | string,
): { paused: number; pausedOverdue: number; returned: number; retrospectiveMissing: number } {
  let paused = 0;
  let pausedOverdue = 0;
  let returned = 0;
  let retrospectiveMissing = 0;

  for (const row of rows) {
    const status = statusOf(row);
    if (status === "paused") {
      paused += 1;
      if (isPausedOverdue(row, today)) pausedOverdue += 1;
    }
    if (status === "returned") returned += 1;
    if (status === "withdrawn" && retrospectiveStatus(row.retrospective) !== "complete") {
      retrospectiveMissing += 1;
    }
  }

  return { paused, pausedOverdue, returned, retrospectiveMissing };
}
