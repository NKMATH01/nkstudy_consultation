/**
 * 퇴원 기록 날짜 유틸. 폼·붙여넣기 파싱·서버 검증이 같은 규칙을 쓰도록 순수 함수로 모아 둔다.
 *
 * 규칙
 * - 저장 형식은 YYYY-MM-DD 하나뿐이다. "2026.01.15"·"2026/1/5" 표기는 정규화한다.
 * - "2026.01"처럼 월까지만 있거나 "01.29"처럼 연도가 없는 값은 날짜로 인정하지 않는다(null).
 *   반쪽짜리 값이 그대로 저장되던 붙여넣기 경로를 막기 위한 것이다.
 */

/** 저장·검증에 쓰는 유일한 날짜 형식. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 달력에 실재하는 날짜인지 확인한다 (2026-02-30 같은 값을 걸러낸다). */
function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * 붙여넣기 텍스트의 날짜를 YYYY-MM-DD로 정규화한다.
 * 연·월·일이 모두 있고 실재하는 날짜일 때만 문자열을 돌려주고, 그 외에는 null을 돌려준다.
 *
 *   "2026.01.15" → "2026-01-15"
 *   "2026/1/5"   → "2026-01-05"
 *   "2026.01"    → null (월까지만)
 *   "01.29"      → null (연도 없음)
 */
export function normalizeDateInput(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // 공백을 모두 지운 뒤 점·슬래시를 하이픈으로 통일한다 ("2026. 01. 15" 대응).
  const compact = raw.replace(/\s+/g, "").replace(/[./]/g, "-");
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(compact);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!isRealDate(year, month, day)) return null;
  return `${m[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 재원 기간(개월). 등록일~퇴원일 사이의 '꽉 찬 개월 수'를 floor 기준으로 센다.
 *
 *   2024-07-01 ~ 2026-07-15 → 24   (일자를 넘겼으므로 그대로)
 *   2024-07-31 ~ 2024-08-01 → 0    (일자가 덜 찼으면 그 달은 세지 않음)
 *
 * 두 날짜 중 하나라도 형식이 어긋나거나 순서가 뒤집히면 null을 돌려준다.
 */
export function calcDurationMonths(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const from = normalizeDateInput(start);
  const to = normalizeDateInput(end);
  if (!from || !to) return null;
  // YYYY-MM-DD는 사전순 비교가 곧 시간순 비교다.
  if (to < from) return null;

  const [startYear, startMonth, startDay] = from.split("-").map(Number);
  const [endYear, endMonth, endDay] = to.split("-").map(Number);
  let months = (endYear - startYear) * 12 + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  return months < 0 ? 0 : months;
}
