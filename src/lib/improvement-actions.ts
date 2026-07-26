/** 월간 개선 액션. 대시보드 처방 채택분과 수동 추가분을 함께 담는다. */
export interface ImprovementAction {
  id: string;
  /** "2026-07" */
  year_month: string;
  action_text: string;
  /** 'diagnosis' | 'manual' 등 채택 출처 */
  source: string;
  source_title: string | null;
  owner: string | null;
  status: "pending" | "done" | "dropped";
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

export function computeCompletionRate(actions: ImprovementAction[]): {
  total: number;
  done: number;
  pending: number;
  dropped: number;
  rate: number;
} {
  const done = actions.filter((a) => a.status === "done").length;
  const pending = actions.filter((a) => a.status === "pending").length;
  const dropped = actions.filter((a) => a.status === "dropped").length;
  // 보류(dropped)는 이행률 분모에서 제외한다.
  const denominator = done + pending;
  const rate = denominator > 0 ? Math.round((done / denominator) * 1000) / 10 : 0;
  return { total: actions.length, done, pending, dropped, rate };
}

export function currentYearMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function prevYearMonth(yearMonth: string): string {
  const [yearPart, monthPart] = yearMonth.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  if (month <= 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function formatYearMonthLabel(yearMonth: string): string {
  const [yearPart, monthPart] = yearMonth.split("-");
  const month = Number(monthPart);
  if (!yearPart || !Number.isFinite(month)) return yearMonth;
  return `${yearPart}년 ${month}월`;
}
