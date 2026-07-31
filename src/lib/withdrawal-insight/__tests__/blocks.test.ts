import { describe, expect, it } from "vitest";
import {
  analyzeEvents,
  buildEarlyExit,
  buildPersistence,
  buildRecentShift,
  buildReliability,
  buildTeacherQueue,
  MIN_EVENTS_FOR_READING,
} from "../blocks";
import { groupWithdrawalEvents } from "../events";
import type { Withdrawal } from "@/types";

let seq = 0;
function row(overrides: Partial<Withdrawal> = {}): Withdrawal {
  seq += 1;
  return {
    id: `row-${seq}`,
    name: `학생${seq}`,
    school: "안산고",
    class_name: `반${seq}`,
    teacher: "김선생",
    withdrawal_date: "2026-03-10",
    enrollment_start: null,
    duration_months: null,
    student_opinion: null,
    parent_opinion: null,
    teacher_opinion: null,
    final_consult_date: "3.10",
    final_consult_summary: "가".repeat(40),
    special_notes: null,
    retrospective: null,
    ...overrides,
  } as Withdrawal;
}

function analyze(rows: Withdrawal[]) {
  return analyzeEvents(groupWithdrawalEvents(rows));
}

describe("buildPersistence", () => {
  it("주제별 월 분포와 지속 개월 수를 센다", () => {
    const analyzed = analyze([
      row({ withdrawal_date: "2026-01-05", teacher_opinion: "숙제를 자주 미제출" }),
      row({ withdrawal_date: "2026-02-05", teacher_opinion: "숙제 미제출이 잦음" }),
      row({ withdrawal_date: "2026-03-05", teacher_opinion: "숙제 부담" }),
      row({ withdrawal_date: "2026-03-06", student_opinion: "성적이 오르지 않음" }),
    ]);
    const { months, topics } = buildPersistence(analyzed);

    expect(months).toEqual([1, 2, 3]);
    const engagement = topics.find((t) => t.topic === "engagement")!;
    expect(engagement.monthsWithEvents).toBe(3);
    expect(engagement.totalEvents).toBe(3);
    expect(engagement.monthlyCounts).toEqual({ 1: 1, 2: 1, 3: 1 });

    // 오래 이어진 주제가 앞에 온다(등급이 아니라 지속 순).
    expect(topics[0].topic).toBe("engagement");
  });

  it("신호가 없으면 모든 주제가 0이다", () => {
    const { topics } = buildPersistence(analyze([row()]));
    expect(topics.every((t) => t.totalEvents === 0)).toBe(true);
  });
});

describe("buildEarlyExit", () => {
  it("6개월/2개월 이내 사건과 주제 분포를 센다", () => {
    const analyzed = analyze([
      row({ enrollment_start: "2026-01-01", withdrawal_date: "2026-02-01", teacher_opinion: "숙제 미제출" }),
      row({ enrollment_start: "2026-01-01", withdrawal_date: "2026-05-01", student_opinion: "진도가 어려움" }),
      row({ enrollment_start: "2024-01-01", withdrawal_date: "2026-03-01" }),
    ]);
    const block = buildEarlyExit(analyzed);

    expect(block.totalEvents).toBe(3);
    expect(block.within2).toBe(1);
    expect(block.within6).toBe(2);
    expect(block.topicCounts.engagement).toBe(1);
    expect(block.topicCounts.fit).toBe(1);
  });
});

describe("buildRecentShift", () => {
  it("최근 월이 직전 3개월 평균보다 늘어난 주제만 고른다", () => {
    const analyzed = analyze([
      row({ withdrawal_date: "2026-01-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-02-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-03-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-04-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-04-06", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-04-07", teacher_opinion: "숙제 미제출" }),
    ]);
    const block = buildRecentShift(analyzed);

    expect(block.latestMonth).toBe(4);
    expect(block.baselineMonths).toEqual([1, 2, 3]);
    const engagement = block.risen.find((r) => r.topic === "engagement")!;
    expect(engagement.latestCount).toBe(3);
    expect(engagement.baselineAvg).toBe(1);
    expect(engagement.delta).toBe(2);
  });

  it("비교할 이전 월이 없으면 빈 결과", () => {
    const block = buildRecentShift(analyze([row({ withdrawal_date: "2026-03-05" })]));
    expect(block.baselineMonths).toEqual([]);
    expect(block.risen).toEqual([]);
  });
});

describe("buildTeacherQueue", () => {
  it("수업·소통 신호와 기록 공백을 센다", () => {
    const rows = [
      row({ teacher: "김선생", student_opinion: "수업이 지루함" }),
      row({ teacher: "김선생", final_consult_date: null }),
      row({ teacher: "김선생", final_consult_summary: "위와 동일" }),
      row({ teacher: "박선생" }),
    ];
    const queue = buildTeacherQueue(analyze(rows));

    const kim = queue.find((q) => q.teacher === "김선생")!;
    expect(kim.eventCount).toBe(3);
    expect(kim.teachingCount).toBe(1);
    expect(kim.recordGapCount).toBe(2);

    // 수업·소통 신호가 있는 행이 먼저 온다(읽을 순서일 뿐 서열 아님).
    expect(queue[0].teacher).toBe("김선생");
  });

  it(`사건이 ${MIN_EVENTS_FOR_READING}건 미만이면 판단 보류로 표시한다`, () => {
    const queue = buildTeacherQueue(analyze([row({ teacher: "박선생" })]));
    expect(queue[0].holdJudgement).toBe(true);
  });

  it("사건이 충분하면 판단 보류가 아니다", () => {
    const rows = Array.from({ length: MIN_EVENTS_FOR_READING }, () => row({ teacher: "이선생" }));
    const queue = buildTeacherQueue(analyze(rows));
    expect(queue[0].holdJudgement).toBe(false);
  });

  it("3개월 이상 반복된 주제만 반복 주제로 본다", () => {
    const rows = [
      row({ teacher: "이선생", withdrawal_date: "2026-01-05", teacher_opinion: "숙제 미제출" }),
      row({ teacher: "이선생", withdrawal_date: "2026-02-05", teacher_opinion: "숙제 미제출" }),
      row({ teacher: "이선생", withdrawal_date: "2026-03-05", teacher_opinion: "숙제 미제출" }),
      row({ teacher: "이선생", withdrawal_date: "2026-04-05", student_opinion: "성적 하락" }),
    ];
    const queue = buildTeacherQueue(analyze(rows));
    expect(queue[0].repeatedTopics).toEqual(["engagement"]);
  });

  it("담당이 없는 사건은 큐에 올리지 않는다", () => {
    expect(buildTeacherQueue(analyze([row({ teacher: null })]))).toEqual([]);
  });
});

describe("buildReliability", () => {
  it("기록 공백을 사실 그대로 센다", () => {
    const rows = [
      row({ final_consult_date: null }),
      row({ final_consult_date: "12.30" }),
      row({ final_consult_date: "2026-03-10" }),
      row({ final_consult_summary: "위와 동일" }),
      row({ student_opinion: "성적 불만족", parent_opinion: "성적 불만족" }),
    ];
    const analyzed = analyze(rows);
    const panel = buildReliability(analyzed, rows.length);

    expect(panel.totalRows).toBe(5);
    expect(panel.totalEvents).toBe(5);
    expect(panel.missingConsultDate).toBe(1);
    expect(panel.consultDateRecorded).toBe(4);
    // "12.30"처럼 연도가 없으면 경과일을 계산할 수 없다.
    expect(panel.consultDateWithYear).toBe(1);
    expect(panel.thinSummary).toBe(1);
    expect(panel.parentCopiedFromStudent).toBe(1);
    expect(panel.retrospectiveDone).toBe(0);
  });

  it("병합된 행 수를 보고한다", () => {
    const dup = { name: "같은학생", class_name: "반A", teacher: "김선생", withdrawal_date: "2026-03-10" };
    const rows = [row(dup), row(dup), row(dup)];
    const analyzed = analyze(rows);
    expect(buildReliability(analyzed, rows.length).mergedRows).toBe(2);
  });
});
