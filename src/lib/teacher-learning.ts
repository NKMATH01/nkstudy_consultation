import type { Withdrawal } from "@/types";
import { groupWithdrawalEvents } from "@/lib/withdrawal-insight/events";
import {
  detectSignals,
  hasThinSummary,
  SIGNAL_LABEL,
  SIGNAL_TOPICS,
  type SignalTopic,
} from "@/lib/withdrawal-insight/signals";
import {
  getMonthFromDate,
  isCurrentYearMonth,
  parseWithdrawalYearMonth,
} from "@/lib/withdrawal-analytics";
import { retrospectiveStatus } from "@/lib/withdrawal-retrospective";

export type ImprovementTrend = "improving" | "flat" | "worsening";

export interface TeacherLearning {
  history: Withdrawal[];
  reasonDist: Array<{ name: string; count: number }>;
  monthlyTrend: Array<{ month: number; count: number }>;
  lessons: Array<{ name: string; lesson: string; author: string }>;
  improvement: {
    trend: ImprovementTrend;
    recentCount: number;
    prevCount: number;
    message: string;
  };
  /** 본인 담당 사건에서 자유서술로 잡힌 주제(건수 내림차순). 판정이 아니라 원문 안내다. */
  topicSignals: Array<{ topic: SignalTopic; label: string; count: number }>;
  /** 기록 공백: 상담일 미기록 또는 요약 30자 미만인 사건 수. */
  recordGap: { withGap: number; total: number };
}

const MISSING_LABEL = "미입력";
/** 추세 비교 구간 (최근 N개월 vs 직전 N개월) */
const TREND_WINDOW = 3;
/** 추세를 판단하려면 최소 이만큼의 월 범위가 필요하다. */
const MIN_TREND_SPAN = TREND_WINDOW * 2;

export function listTeachersFromWithdrawals(withdrawals: Withdrawal[]): string[] {
  const counts = new Map<string, number>();
  withdrawals.forEach((w) => {
    if (!w.teacher) return;
    counts.set(w.teacher, (counts.get(w.teacher) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

/** 최신순 정렬 키. 연도가 없으면 현재 연도로 간주한다. */
function recencyKey(w: Withdrawal, currentYear: number): number {
  const { year, month } = parseWithdrawalYearMonth(w.withdrawal_date);
  return (year ?? currentYear) * 100 + (month ?? 0);
}

export function buildTeacherLearning(
  withdrawals: Withdrawal[],
  teacher: string,
  currentYear: number,
  targetMonth: number = new Date().getMonth() + 1
): TeacherLearning {
  const owned = withdrawals.filter((w) => w.teacher === teacher);

  const history = [...owned].sort((a, b) => {
    const diff = recencyKey(b, currentYear) - recencyKey(a, currentYear);
    if (diff !== 0) return diff;
    return (b.withdrawal_date || "").localeCompare(a.withdrawal_date || "");
  });

  // 사유 분포 — "미입력"은 건수와 무관하게 맨 뒤로 보낸다.
  const reasonCounts = new Map<string, number>();
  owned.forEach((w) => {
    const key = w.reason_category || MISSING_LABEL;
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  });
  const reasonDist = Array.from(reasonCounts.entries())
    .sort((a, b) => {
      if (a[0] === MISSING_LABEL) return 1;
      if (b[0] === MISSING_LABEL) return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .map(([name, count]) => ({ name, count }));

  // 월별 추이 — 1~12월 슬롯을 모두 채운다.
  const monthCounts = new Map<number, number>();
  owned.forEach((w) => {
    const m = getMonthFromDate(w.withdrawal_date);
    if (!m || !isCurrentYearMonth(w.withdrawal_date, currentYear)) return;
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  });
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: monthCounts.get(i + 1) ?? 0,
  }));

  const lessons = owned
    .filter(
      (w) =>
        retrospectiveStatus(w.retrospective) === "complete" &&
        (w.retrospective?.lesson || "").trim() !== ""
    )
    .map((w) => ({
      name: w.name,
      lesson: (w.retrospective?.lesson || "").trim(),
      author: (w.retrospective?.author || "").trim() || "미기재",
    }));

  // 최근 3개월 vs 직전 3개월 (대상 월 포함)
  const inWindow = (from: number, to: number) =>
    monthlyTrend
      .filter((m) => m.month >= from && m.month <= to)
      .reduce((sum, m) => sum + m.count, 0);

  const recentCount = inWindow(targetMonth - TREND_WINDOW + 1, targetMonth);
  const prevCount = inWindow(targetMonth - TREND_WINDOW * 2 + 1, targetMonth - TREND_WINDOW);

  // 관측 범위는 첫 데이터가 있는 달부터 대상 월까지로 잰다.
  // 마지막 달이 0건인 경우(= 개선된 경우)에 범위가 짧게 잡히는 것을 막는다.
  const activeMonths = monthlyTrend.filter((m) => m.count > 0).map((m) => m.month);
  const span = activeMonths.length > 0 ? targetMonth - Math.min(...activeMonths) + 1 : 0;

  let trend: ImprovementTrend = "flat";
  let message: string;

  if (span < MIN_TREND_SPAN) {
    // 데이터 범위가 짧으면 추세로 단정하지 않는다.
    message = `아직 추세를 판단할 만큼 기간이 쌓이지 않았습니다 (최근 3개월 ${recentCount}건, 직전 3개월 ${prevCount}건).`;
  } else if (recentCount < prevCount) {
    // 건수 사실만 서술한다. 담당 귀속·재원 분모가 파손된 상태라 개선/악화로 단정할 근거가 없다.
    trend = "improving";
    message = `최근 3개월 ${recentCount}건, 직전 3개월 ${prevCount}건 — 건수가 줄었습니다.`;
  } else if (recentCount > prevCount) {
    trend = "worsening";
    message = `최근 3개월 ${recentCount}건, 직전 3개월 ${prevCount}건 — 건수가 늘었습니다. 배경은 원본 기록으로 확인해 주세요.`;
  } else {
    message = `최근 3개월 ${recentCount}건, 직전 3개월 ${prevCount}건 — 큰 변화가 없습니다.`;
  }

  // 자유서술 주제·기록 공백 — 러닝 뷰는 본인+원장 전용이라 실명 화면이지만,
  // 여기서도 비율·등급은 만들지 않고 건수 사실만 둔다.
  const ownedEvents = groupWithdrawalEvents(owned);
  const topicCounts = new Map<SignalTopic, number>();
  for (const e of ownedEvents) {
    for (const topic of detectSignals(e.row).topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }
  const topicSignals = SIGNAL_TOPICS.map((topic) => ({
    topic,
    label: SIGNAL_LABEL[topic],
    count: topicCounts.get(topic) ?? 0,
  }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const recordGap = {
    withGap: ownedEvents.filter(
      (e) => !e.row.final_consult_date?.trim() || hasThinSummary(e.row),
    ).length,
    total: ownedEvents.length,
  };

  return {
    history,
    reasonDist,
    monthlyTrend,
    lessons,
    improvement: { trend, recentCount, prevCount, message },
    topicSignals,
    recordGap,
  };
}
