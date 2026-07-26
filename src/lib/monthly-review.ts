import type { Withdrawal } from "@/types";
import { EARLY_MONTHS, getMonthFromDate, isCurrentYearMonth } from "@/lib/withdrawal-analytics";
import { retrospectiveStatus } from "@/lib/withdrawal-retrospective";

export interface RepeatPattern {
  id: string;
  severity: "심각" | "주의";
  title: string;
  evidence: string;
}

export interface MonthlyLesson {
  name: string;
  teacher: string;
  lesson: string;
  author: string;
}

const MISSING_LABEL = "미입력";
/** duration_months 유효 상한 (10년 초과는 비정상 데이터) */
const MAX_VALID_DURATION = 120;
/** 반 클러스터 판정 창 (대상 월 포함 최근 N개월) */
const CLUSTER_WINDOW = 3;

/** 대상 월(연도 인지)에 해당하는 퇴원 전건 */
export function collectMonthWithdrawals(
  withdrawals: Withdrawal[],
  month: number,
  currentYear: number
): Withdrawal[] {
  return withdrawals.filter(
    (w) =>
      getMonthFromDate(w.withdrawal_date) === month &&
      isCurrentYearMonth(w.withdrawal_date, currentYear)
  );
}

export function buildMonthlyLessons(
  withdrawals: Withdrawal[],
  month: number,
  currentYear: number
): MonthlyLesson[] {
  return collectMonthWithdrawals(withdrawals, month, currentYear)
    .filter(
      (w) =>
        retrospectiveStatus(w.retrospective) === "complete" &&
        (w.retrospective?.lesson || "").trim() !== ""
    )
    .map((w) => ({
      name: w.name,
      teacher: w.teacher || "미지정",
      lesson: (w.retrospective?.lesson || "").trim(),
      author: (w.retrospective?.author || "").trim() || "미기재",
    }));
}

function hasReason(w: Withdrawal): boolean {
  return !!w.reason_category && w.reason_category !== MISSING_LABEL;
}

function isEarly(w: Withdrawal): boolean {
  const d = w.duration_months;
  return d != null && d > 0 && d <= MAX_VALID_DURATION && d <= EARLY_MONTHS;
}

/** 월별로 퇴원 건을 미리 묶어 반복 조회를 피한다. */
function groupByMonth(
  withdrawals: Withdrawal[],
  currentYear: number
): Map<number, Withdrawal[]> {
  const map = new Map<number, Withdrawal[]>();
  withdrawals.forEach((w) => {
    const m = getMonthFromDate(w.withdrawal_date);
    if (!m || !isCurrentYearMonth(w.withdrawal_date, currentYear)) return;
    const bucket = map.get(m);
    if (bucket) bucket.push(w);
    else map.set(m, [w]);
  });
  return map;
}

/** 최다 항목 1건. 동점이면 이름 오름차순으로 고정해 결과를 안정시킨다. */
function topOf(counts: Map<string, number>): { name: string; count: number } | null {
  const sorted = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  if (sorted.length === 0) return null;
  return { name: sorted[0][0], count: sorted[0][1] };
}

function detectReasonStreak(
  byMonth: Map<number, Withdrawal[]>,
  targetMonth: number
): RepeatPattern | null {
  let reason: string | null = null;
  let streak = 0;

  for (let m = targetMonth; m >= 1; m -= 1) {
    const rows = (byMonth.get(m) ?? []).filter(hasReason);
    // 사유 입력이 3건 미만인 달은 판단 근거가 약해 건너뛴다(연속은 끊지 않는다).
    if (rows.length < 3) continue;

    const counts = new Map<string, number>();
    rows.forEach((w) => {
      const key = w.reason_category as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const top = topOf(counts);
    if (!top) continue;

    if (reason === null) {
      reason = top.name;
      streak = 1;
    } else if (top.name === reason) {
      streak += 1;
    } else {
      break;
    }
  }

  if (reason === null || streak < 2) return null;
  return {
    id: "reason-streak",
    severity: streak >= 3 ? "심각" : "주의",
    title: "같은 사유가 반복되고 있습니다",
    evidence: `『${reason}』 ${streak}개월 연속 최다 사유`,
  };
}

function detectTeacherStreaks(
  byMonth: Map<number, Withdrawal[]>,
  targetMonth: number
): RepeatPattern[] {
  const teachers = new Set<string>();
  byMonth.forEach((rows) => rows.forEach((w) => w.teacher && teachers.add(w.teacher)));

  const patterns: RepeatPattern[] = [];
  Array.from(teachers)
    .sort()
    .forEach((teacher) => {
      let streak = 0;
      let total = 0;
      for (let m = targetMonth; m >= 1; m -= 1) {
        const count = (byMonth.get(m) ?? []).filter((w) => w.teacher === teacher).length;
        if (count < 1) break;
        streak += 1;
        total += count;
      }
      if (streak < 3) return;
      patterns.push({
        id: `teacher-streak:${teacher}`,
        severity: total >= 5 ? "심각" : "주의",
        title: `${teacher} T 담당에서 퇴원이 이어지고 있습니다`,
        evidence: `${teacher} T 담당 퇴원 ${streak}개월 연속 (총 ${total}건)`,
      });
    });
  return patterns;
}

function detectEarlyStreak(
  byMonth: Map<number, Withdrawal[]>,
  targetMonth: number
): RepeatPattern | null {
  let streak = 0;
  let total = 0;

  for (let m = targetMonth; m >= 1; m -= 1) {
    const count = (byMonth.get(m) ?? []).filter(isEarly).length;
    if (count < 2) break;
    streak += 1;
    total += count;
  }

  if (streak < 2) return null;
  return {
    id: "early-streak",
    severity: streak >= 3 ? "심각" : "주의",
    title: "조기 퇴원이 반복되고 있습니다",
    evidence: `재원 ${EARLY_MONTHS}개월 이하 퇴원이 ${streak}개월 연속 (총 ${total}건) — 신입 온보딩 90일 케어 점검 필요`,
  };
}

function detectClassClusters(
  byMonth: Map<number, Withdrawal[]>,
  targetMonth: number
): RepeatPattern[] {
  const counts = new Map<string, number>();
  for (let m = targetMonth; m >= Math.max(1, targetMonth - CLUSTER_WINDOW + 1); m -= 1) {
    (byMonth.get(m) ?? []).forEach((w) => {
      if (!w.class_name) return;
      counts.set(w.class_name, (counts.get(w.class_name) ?? 0) + 1);
    });
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([className, count]) => ({
      id: `class-cluster:${className}`,
      severity: count >= 4 ? ("심각" as const) : ("주의" as const),
      title: `${className} 반에 퇴원이 몰려 있습니다`,
      evidence: `${className} 최근 ${CLUSTER_WINDOW}개월 ${count}건`,
    }));
}

function detectRetroGap(monthRows: Withdrawal[]): RepeatPattern | null {
  const total = monthRows.length;
  if (total === 0) return null;

  const incomplete = monthRows.filter(
    (w) => retrospectiveStatus(w.retrospective) !== "complete"
  ).length;
  const pct = Math.round((incomplete / total) * 1000) / 10;
  if (pct < 50 && incomplete < 5) return null;

  return {
    id: "retro-gap",
    severity: "주의",
    title: "회고가 밀려 있습니다",
    evidence: `회고 미완료 ${incomplete}건 (${pct}%) — 배움이 축적되지 않고 있습니다`,
  };
}

export function detectRepeatPatterns(
  withdrawals: Withdrawal[],
  targetMonth: number,
  currentYear: number
): RepeatPattern[] {
  const byMonth = groupByMonth(withdrawals, currentYear);
  const monthRows = byMonth.get(targetMonth) ?? [];

  const patterns: RepeatPattern[] = [
    detectReasonStreak(byMonth, targetMonth),
    ...detectTeacherStreaks(byMonth, targetMonth),
    detectEarlyStreak(byMonth, targetMonth),
    ...detectClassClusters(byMonth, targetMonth),
    detectRetroGap(monthRows),
  ].filter((p): p is RepeatPattern => p !== null);

  // 심각을 앞세우되 같은 등급 안에서는 탐지 순서를 유지한다.
  return patterns.sort(
    (a, b) => (a.severity === "심각" ? 0 : 1) - (b.severity === "심각" ? 0 : 1)
  );
}
