// 퇴원 "행"을 "사건"으로 묶는 순수 레이어.
//
// 왜 필요한가: withdrawals 테이블은 한 학생의 한 번의 이탈이 여러 행으로 들어온다
// (같은 학생·같은 퇴원일이 과목/반별로 중복 입력, 완전 동일 행 중복 등).
// 행을 그대로 세면 같은 사건이 여러 번 집계돼 모든 비율이 부풀려진다.
//
// 이 모듈은 DB를 바꾸지 않고 읽은 행에서 사건을 파생한다(신규 컬럼 0개).

import type { Withdrawal } from "@/types";

/** 재원기간 밴드. 어느 단계에서 이탈했는지만 본다(비율·등급 아님). */
export type TenureBand = "0-2" | "3-6" | "7-12" | "13+" | "unknown";

export const TENURE_BAND_LABEL: Record<TenureBand, string> = {
  "0-2": "0~2개월",
  "3-6": "3~6개월",
  "7-12": "7~12개월",
  "13+": "13개월+",
  unknown: "불명",
};

export interface WithdrawalEvent {
  /** 대표 행 id. 사건 식별자로 쓴다. */
  id: string;
  /** 병합된 원본 행 id 전부(대표 포함). 원문 추적용. */
  duplicateRowIds: string[];
  /** 대표 행. 표시용 원문은 여기서 읽는다. */
  row: Withdrawal;
  /** 재원 개월수(파생). 계산 불가면 null. */
  tenureMonths: number | null;
  tenureBand: TenureBand;
  /**
   * 같은 학생이 비슷한 시기(±14일)에 남긴 다른 사건들.
   * 다과목 수강생이 한 번에 이탈한 경우를 "동일 학생 이탈"로 보여주기 위한 것이며,
   * 사건 자체는 합치지 않는다(과목별 원인이 다를 수 있다).
   */
  relatedEventIds: string[];
}

/** 이름 정규화: 앞뒤 공백 제거 + 내부 공백 전부 제거. */
export function normalizeStudentName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s+/g, "");
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;
/** 다과목 동시 이탈로 볼 최대 간격(일). */
export const RELATED_EVENT_WINDOW_DAYS = 14;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // withdrawal_date/enrollment_start는 DATE 컬럼이라 YYYY-MM-DD로 온다.
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tenureBandOf(months: number | null): TenureBand {
  if (months === null || !Number.isFinite(months) || months < 0) return "unknown";
  if (months < 3) return "0-2";
  if (months < 7) return "3-6";
  if (months < 13) return "7-12";
  return "13+";
}

/**
 * 재원 개월수. 실제 날짜 차이를 우선하고, 불가하면 duration_months를 쓴다.
 * final_consult_date는 형식이 깨져 있어(연도 없는 "12.30" 등) 어떤 계산에도 쓰지 않는다.
 */
export function deriveTenureMonths(row: Withdrawal): number | null {
  const start = parseDate(row.enrollment_start);
  const end = parseDate(row.withdrawal_date) ?? parseDate(row.enrollment_end);
  if (start && end && end.getTime() >= start.getTime()) {
    return (end.getTime() - start.getTime()) / MS_PER_DAY / DAYS_PER_MONTH;
  }
  if (typeof row.duration_months === "number" && Number.isFinite(row.duration_months)) {
    // 10년(120개월) 초과는 기존 코드에서도 비정상 데이터로 보고 있다.
    return row.duration_months >= 0 && row.duration_months <= 120 ? row.duration_months : null;
  }
  return null;
}

/** 완전 중복 판정 키: 이름(정규화) + 퇴원일 + 반 + 강사. */
function duplicateKey(row: Withdrawal): string {
  return [
    normalizeStudentName(row.name),
    row.withdrawal_date ?? "",
    (row.class_name ?? "").trim(),
    (row.teacher ?? "").trim(),
  ].join("|");
}

/** 학생 식별 키. 학교가 있으면 이름+학교, 없으면 이름만 쓴다(전화번호 컬럼 없음). */
function studentKey(row: Withdrawal): string {
  const name = normalizeStudentName(row.name);
  const school = (row.school ?? "").trim();
  return school ? `${name}@${school}` : name;
}

/**
 * 행 목록을 사건 목록으로 변환한다.
 * ① 완전 중복 병합 ② 동일 학생 근접 이탈 연결 ③ 재원 밴드 파생.
 * 입력 순서를 보존하며(먼저 나온 행이 대표), 원본 배열을 변형하지 않는다.
 */
export function groupWithdrawalEvents(rows: readonly Withdrawal[]): WithdrawalEvent[] {
  const byKey = new Map<string, WithdrawalEvent>();

  for (const row of rows) {
    const key = duplicateKey(row);
    const existing = byKey.get(key);
    if (existing) {
      existing.duplicateRowIds.push(row.id);
      continue;
    }
    const tenureMonths = deriveTenureMonths(row);
    byKey.set(key, {
      id: row.id,
      duplicateRowIds: [row.id],
      row,
      tenureMonths,
      tenureBand: tenureBandOf(tenureMonths),
      relatedEventIds: [],
    });
  }

  const events = Array.from(byKey.values());

  // 동일 학생 + ±14일 → 서로 relatedEventIds에 등록(사건은 분리 유지).
  const byStudent = new Map<string, WithdrawalEvent[]>();
  for (const event of events) {
    const key = studentKey(event.row);
    const list = byStudent.get(key);
    if (list) list.push(event);
    else byStudent.set(key, [event]);
  }

  for (const group of byStudent.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = parseDate(group[i].row.withdrawal_date);
        const b = parseDate(group[j].row.withdrawal_date);
        // 날짜가 없으면 같은 학생이라도 근접 여부를 단정하지 않는다.
        if (!a || !b) continue;
        const gapDays = Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
        if (gapDays > RELATED_EVENT_WINDOW_DAYS) continue;
        group[i].relatedEventIds.push(group[j].id);
        group[j].relatedEventIds.push(group[i].id);
      }
    }
  }

  return events;
}

/** 사건의 퇴원 월(1~12). 날짜가 없으면 null. */
export function eventMonth(event: WithdrawalEvent): number | null {
  const d = parseDate(event.row.withdrawal_date);
  return d ? d.getMonth() + 1 : null;
}
