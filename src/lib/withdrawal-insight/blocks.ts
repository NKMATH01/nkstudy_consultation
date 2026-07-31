// 퇴원 분석 첫 화면 4블록 + 데이터 신뢰도 패널의 집계 로직(순수).
//
// 봉인 원칙: 어떤 산출물에도 강사 퇴원율·순위·등급·"심각" 어휘를 넣지 않는다.
// 강사가 등장하는 유일한 곳은 "원문 확인 큐"이며, 거기서도 건수와 기록 공백 같은
// 원시 사실만 담고 정렬은 원장이 무엇을 먼저 읽을지 정하는 순서일 뿐 서열이 아니다.

import {
  eventMonth,
  type WithdrawalEvent,
} from "./events";
import {
  detectSignals,
  hasThinSummary,
  isParentOpinionCopied,
  SIGNAL_TOPICS,
  type SignalMatch,
  type SignalTopic,
} from "./signals";

/** 사건 + 신호를 함께 들고 다니는 뷰 모델. 화면에서 재계산하지 않도록 한 번만 만든다. */
export interface AnalyzedEvent {
  event: WithdrawalEvent;
  month: number | null;
  topics: SignalTopic[];
  matches: SignalMatch[];
}

export function analyzeEvents(events: readonly WithdrawalEvent[]): AnalyzedEvent[] {
  return events.map((event) => {
    const { topics, matches } = detectSignals(event.row);
    return { event, month: eventMonth(event), topics, matches };
  });
}

// ── ① 지속 문제 ──────────────────────────────────────────────────────
export interface TopicPersistence {
  topic: SignalTopic;
  /** 월(1~12) → 사건 수 */
  monthlyCounts: Record<number, number>;
  /** 사건이 하나라도 있는 월 수 */
  monthsWithEvents: number;
  totalEvents: number;
}

export interface PersistenceBlock {
  /** 데이터에 존재하는 퇴원 월 목록(오름차순) */
  months: number[];
  topics: TopicPersistence[];
}

export function buildPersistence(analyzed: readonly AnalyzedEvent[]): PersistenceBlock {
  const months = Array.from(
    new Set(analyzed.map((a) => a.month).filter((m): m is number => m !== null)),
  ).sort((a, b) => a - b);

  const topics: TopicPersistence[] = SIGNAL_TOPICS.map((topic) => {
    const monthlyCounts: Record<number, number> = {};
    let totalEvents = 0;
    for (const a of analyzed) {
      if (!a.topics.includes(topic)) continue;
      totalEvents += 1;
      if (a.month !== null) monthlyCounts[a.month] = (monthlyCounts[a.month] ?? 0) + 1;
    }
    return {
      topic,
      monthlyCounts,
      monthsWithEvents: Object.keys(monthlyCounts).length,
      totalEvents,
    };
  });

  // 지속성(월 수) → 사건 수 순. 등급이 아니라 "오래 이어진 순"이다.
  topics.sort((a, b) => b.monthsWithEvents - a.monthsWithEvents || b.totalEvents - a.totalEvents);
  return { months, topics };
}

// ── ② 초기 이탈 ──────────────────────────────────────────────────────
export interface EarlyExitBlock {
  totalEvents: number;
  within6: number;
  within2: number;
  /** 6개월 이내 이탈 사건의 주제 분포(사건 수) */
  topicCounts: Record<SignalTopic, number>;
}

export function buildEarlyExit(analyzed: readonly AnalyzedEvent[]): EarlyExitBlock {
  const within6List = analyzed.filter(
    (a) => a.event.tenureBand === "0-2" || a.event.tenureBand === "3-6",
  );
  const topicCounts = Object.fromEntries(
    SIGNAL_TOPICS.map((t) => [t, within6List.filter((a) => a.topics.includes(t)).length]),
  ) as Record<SignalTopic, number>;

  return {
    totalEvents: analyzed.length,
    within6: within6List.length,
    within2: analyzed.filter((a) => a.event.tenureBand === "0-2").length,
    topicCounts,
  };
}

// ── ③ 최근 변화 ──────────────────────────────────────────────────────
export interface TopicShift {
  topic: SignalTopic;
  latestCount: number;
  /** 직전 3개월 평균(사건 수) */
  baselineAvg: number;
  delta: number;
}

export interface RecentShiftBlock {
  latestMonth: number | null;
  baselineMonths: number[];
  /** 최근 월이 직전 3개월 평균보다 많은 주제만, 증가폭 순 */
  risen: TopicShift[];
}

export function buildRecentShift(analyzed: readonly AnalyzedEvent[]): RecentShiftBlock {
  const { months, topics } = buildPersistence(analyzed);
  const latestMonth = months.length > 0 ? months[months.length - 1] : null;
  if (latestMonth === null) return { latestMonth: null, baselineMonths: [], risen: [] };

  const baselineMonths = months.filter((m) => m < latestMonth).slice(-3);
  if (baselineMonths.length === 0) return { latestMonth, baselineMonths: [], risen: [] };

  const risen: TopicShift[] = [];
  for (const t of topics) {
    const latestCount = t.monthlyCounts[latestMonth] ?? 0;
    const baselineAvg =
      baselineMonths.reduce((sum, m) => sum + (t.monthlyCounts[m] ?? 0), 0) / baselineMonths.length;
    const delta = latestCount - baselineAvg;
    if (delta > 0) risen.push({ topic: t.topic, latestCount, baselineAvg, delta });
  }
  risen.sort((a, b) => b.delta - a.delta);

  return { latestMonth, baselineMonths, risen };
}

// ── 강사별 확인 포인트 ───────────────────────────────────────────────
/** 이 인원 미만이면 어떤 경향도 읽지 않고 "판단 보류"로 표시한다. */
export const MIN_EVENTS_FOR_READING = 5;

/** 한 주제가 이 개월 수 이상 등장하면 "반복", 1개월뿐이면 "단발"로 본다. */
export const REPEAT_MONTHS = 2;

export interface TopicTally {
  topic: SignalTopic;
  count: number;
  months: number;
  /** months <= 1 이면 단발(반복으로 읽지 않는다) */
  oneOff: boolean;
}

export interface TeacherAnalysis {
  teacher: string;
  eventCount: number;
  /** 사건이 발생한 개월 수 */
  activeMonths: number;
  /** 담당 재원수(외부에서 주입). 모르면 null. */
  enrolledCount: number | null;
  topicTallies: TopicTally[];
  teachingCount: number;
  /** 수업·소통 신호가 잡힌 사건의 근거(최대 3건) */
  teachingSnippets: Array<{ eventId: string; studentName: string; field: string; snippet: string }>;
  missingConsultDate: number;
  thinSummary: number;
  missingRetrospective: number;
  recordGapCount: number;
  holdJudgement: boolean;
  /** 규칙 기반 확인 포인트. 단정하지 않고 "검토/확인" 어투만 쓴다. */
  checkPoints: string[];
  eventIds: string[];
}

/**
 * 강사별 확인 포인트. 원장 전용 화면에서 원문을 어디부터 열어볼지 정하는 자료다.
 * 비율·순위·등급을 만들지 않으며, checkPoints도 판단이 아니라 "무엇을 확인할지"만 적는다.
 */
export function buildTeacherAnalysis(
  analyzed: readonly AnalyzedEvent[],
  enrolledByTeacher?: Record<string, number>,
): TeacherAnalysis[] {
  const byTeacher = new Map<string, AnalyzedEvent[]>();
  for (const a of analyzed) {
    const name = a.event.row.teacher?.trim();
    if (!name) continue;
    const list = byTeacher.get(name);
    if (list) list.push(a);
    else byTeacher.set(name, [a]);
  }

  const rows: TeacherAnalysis[] = [];
  for (const [teacher, list] of byTeacher) {
    const monthsByTopic = new Map<SignalTopic, Set<number>>();
    const countByTopic = new Map<SignalTopic, number>();
    for (const a of list) {
      for (const topic of a.topics) {
        countByTopic.set(topic, (countByTopic.get(topic) ?? 0) + 1);
        if (a.month === null) continue;
        const set = monthsByTopic.get(topic) ?? new Set<number>();
        set.add(a.month);
        monthsByTopic.set(topic, set);
      }
    }

    const topicTallies: TopicTally[] = SIGNAL_TOPICS.map((topic) => {
      const months = monthsByTopic.get(topic)?.size ?? 0;
      return { topic, count: countByTopic.get(topic) ?? 0, months, oneOff: months <= 1 };
    })
      .filter((t) => t.count > 0)
      .sort((a, b) => b.months - a.months || b.count - a.count);

    const teachingEvents = list.filter((a) => a.topics.includes("teaching"));
    const teachingSnippets = teachingEvents
      .flatMap((a) =>
        a.matches
          .filter((m) => m.topic === "teaching")
          .slice(0, 1)
          .map((m) => ({
            eventId: a.event.id,
            studentName: a.event.row.name,
            field: m.field as string,
            snippet: m.snippet,
          })),
      )
      .slice(0, 3);

    const missingConsultDate = list.filter((a) => !a.event.row.final_consult_date?.trim()).length;
    const thinSummary = list.filter((a) => hasThinSummary(a.event.row)).length;
    const missingRetrospective = list.filter((a) => !a.event.row.retrospective?.completed_at).length;
    const recordGapCount = list.filter(
      (a) => !a.event.row.final_consult_date?.trim() || hasThinSummary(a.event.row),
    ).length;
    const activeMonths = new Set(
      list.map((a) => a.month).filter((m): m is number => m !== null),
    ).size;
    const holdJudgement = list.length < MIN_EVENTS_FOR_READING;

    rows.push({
      teacher,
      eventCount: list.length,
      activeMonths,
      enrolledCount: enrolledByTeacher?.[teacher] ?? null,
      topicTallies,
      teachingCount: teachingEvents.length,
      teachingSnippets,
      missingConsultDate,
      thinSummary,
      missingRetrospective,
      recordGapCount,
      holdJudgement,
      checkPoints: buildCheckPoints({
        eventCount: list.length,
        holdJudgement,
        teachingCount: teachingEvents.length,
        topicTallies,
        recordGapCount,
      }),
      eventIds: list.map((a) => a.event.id),
    });
  }

  // 읽을 순서: 수업·소통 신호 → 기록 공백 비중 → 사건 수. 서열이 아니다.
  rows.sort((a, b) => {
    const gapA = a.eventCount > 0 ? a.recordGapCount / a.eventCount : 0;
    const gapB = b.eventCount > 0 ? b.recordGapCount / b.eventCount : 0;
    return (
      b.teachingCount - a.teachingCount ||
      gapB - gapA ||
      b.eventCount - a.eventCount ||
      a.teacher.localeCompare(b.teacher)
    );
  });
  return rows;
}

/** 규칙 기반 확인 포인트. 평가 단정을 피하고 "검토/확인" 어투만 쓴다. */
function buildCheckPoints(input: {
  eventCount: number;
  holdJudgement: boolean;
  teachingCount: number;
  topicTallies: TopicTally[];
  recordGapCount: number;
}): string[] {
  const { eventCount, holdJudgement, teachingCount, topicTallies, recordGapCount } = input;
  if (holdJudgement) return ["표본 부족 — 판단 보류"];

  const points: string[] = [];
  const tally = (t: SignalTopic) => topicTallies.find((x) => x.topic === t);
  const repeated = (t: SignalTopic) => (tally(t)?.months ?? 0) >= 3;

  if (teachingCount >= 1) {
    points.push(`수업·소통 관련 원문 사례 ${teachingCount}건 — 원문 검토 우선`);
  }
  if (repeated("fit")) points.push("과제량·난이도 조정 검토");
  if (repeated("performance")) points.push("성과 중간점검·기대관리 확인");

  const scheduleCount = tally("schedule")?.count ?? 0;
  if (scheduleCount * 2 > eventCount) {
    points.push("시간표·병행 구조 검토 (수업 문제 아님 가능성)");
  }

  const engagement = tally("engagement")?.count ?? 0;
  const otherMax = Math.max(
    0,
    ...topicTallies.filter((t) => t.topic !== "engagement").map((t) => t.count),
  );
  if (engagement > 0 && engagement > otherMax) {
    points.push("초기 개입 시점·학생 구성 확인");
  }

  if (recordGapCount * 2 > eventCount) {
    points.push("원인 분석보다 기록 절차 개선이 먼저");
  }

  return points.length > 0 ? points : ["특이 신호 없음 — 먼저 열어볼 이유 낮음"];
}

// ── 데이터 신뢰도 패널 ───────────────────────────────────────────────
export interface ReliabilityPanel {
  totalRows: number;
  totalEvents: number;
  mergedRows: number;
  missingConsultDate: number;
  consultDateRecorded: number;
  /** 기록된 상담일 중 4자리 연도를 포함한 건수(경과일 계산 가능 여부) */
  consultDateWithYear: number;
  thinSummary: number;
  parentCopiedFromStudent: number;
  retrospectiveDone: number;
}

export function buildReliability(
  analyzed: readonly AnalyzedEvent[],
  totalRows: number,
): ReliabilityPanel {
  const dated = analyzed.filter((a) => a.event.row.final_consult_date?.trim());
  return {
    totalRows,
    totalEvents: analyzed.length,
    mergedRows: totalRows - analyzed.length,
    missingConsultDate: analyzed.length - dated.length,
    consultDateRecorded: dated.length,
    consultDateWithYear: dated.filter((a) => /\d{4}/.test(a.event.row.final_consult_date ?? ""))
      .length,
    thinSummary: analyzed.filter((a) => hasThinSummary(a.event.row)).length,
    parentCopiedFromStudent: analyzed.filter((a) => isParentOpinionCopied(a.event.row)).length,
    retrospectiveDone: analyzed.filter((a) => a.event.row.retrospective?.completed_at).length,
  };
}
