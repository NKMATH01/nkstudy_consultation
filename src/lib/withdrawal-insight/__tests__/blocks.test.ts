import { describe, expect, it } from "vitest";
import {
  analyzeEvents,
  buildEarlyExit,
  buildPersistence,
  buildRecentShift,
  buildReliability,
  buildTeacherAnalysis,
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

describe("buildTeacherAnalysis", () => {
  function many(n: number, o: Partial<Withdrawal> = {}) {
    return Array.from({ length: n }, () => row(o));
  }

  it("주제별 건수·개월과 단발 여부를 구분한다", () => {
    const rows = [
      row({ withdrawal_date: "2026-01-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-02-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-03-05", teacher_opinion: "숙제 미제출" }),
      row({ withdrawal_date: "2026-03-06", student_opinion: "성적이 오르지 않음" }),
      ...many(2),
    ];
    const [a] = buildTeacherAnalysis(analyze(rows));

    const engagement = a.topicTallies.find((t) => t.topic === "engagement")!;
    expect(engagement.count).toBe(3);
    expect(engagement.months).toBe(3);
    expect(engagement.oneOff).toBe(false);

    const performance = a.topicTallies.find((t) => t.topic === "performance")!;
    expect(performance.months).toBe(1);
    expect(performance.oneOff).toBe(true);
  });

  it("수업·소통 신호의 원문 스니펫을 최대 3건 남긴다", () => {
    const rows = many(6, { student_opinion: "수업이 지루함" });
    const [a] = buildTeacherAnalysis(analyze(rows));
    expect(a.teachingCount).toBe(6);
    expect(a.teachingSnippets).toHaveLength(3);
    expect(a.teachingSnippets[0].snippet).toContain("지루");
  });

  it("기록 공백을 항목별로 센다", () => {
    const rows = [
      row({ final_consult_date: null }),
      row({ final_consult_summary: "위와 동일" }),
      ...many(3),
    ];
    const [a] = buildTeacherAnalysis(analyze(rows));
    expect(a.missingConsultDate).toBe(1);
    expect(a.thinSummary).toBe(1);
    expect(a.missingRetrospective).toBe(5);
    expect(a.recordGapCount).toBe(2);
  });

  it("담당 재원수를 주입받아 그대로 싣는다", () => {
    const [a] = buildTeacherAnalysis(analyze(many(5)), { 김선생: 30 });
    expect(a.enrolledCount).toBe(30);
    expect(buildTeacherAnalysis(analyze(many(5)))[0].enrolledCount).toBeNull();
  });

  it(`사건이 ${MIN_EVENTS_FOR_READING}건 미만이면 확인 포인트를 판단 보류 하나로만 낸다`, () => {
    const few = many(MIN_EVENTS_FOR_READING - 1, { student_opinion: "수업이 지루함" });
    const [a] = buildTeacherAnalysis(analyze(few));
    expect(a.holdJudgement).toBe(true);
    expect(a.checkPoints).toEqual(["표본 부족 — 판단 보류"]);

    // 경계값: 정확히 기준치면 보류가 풀린다.
    const enough = many(MIN_EVENTS_FOR_READING, { student_opinion: "수업이 지루함" });
    expect(buildTeacherAnalysis(analyze(enough))[0].holdJudgement).toBe(false);
  });

  it("수업·소통 신호가 있으면 원문 검토를 우선 안내한다", () => {
    const rows = many(5, { student_opinion: "수업이 지루함" });
    const [a] = buildTeacherAnalysis(analyze(rows));
    expect(a.checkPoints[0]).toContain("원문 검토 우선");
  });

  it("적합 신호가 3개월 이상이면 과제량·난이도 조정 검토를 낸다", () => {
    const rows = [
      row({ withdrawal_date: "2026-01-05", student_opinion: "숙제 양이 많아 부담" }),
      row({ withdrawal_date: "2026-02-05", student_opinion: "진도가 어려움" }),
      row({ withdrawal_date: "2026-03-05", student_opinion: "수준이 안 맞음" }),
      ...many(2),
    ];
    const [a] = buildTeacherAnalysis(analyze(rows));
    expect(a.checkPoints).toContain("과제량·난이도 조정 검토");
  });

  it("일정 신호가 과반이면 수업 문제가 아닐 가능성을 함께 적는다", () => {
    const rows = many(5, { parent_opinion: "픽드랍이 어려워짐" });
    const [a] = buildTeacherAnalysis(analyze(rows));
    expect(a.checkPoints).toContain("시간표·병행 구조 검토 (수업 문제 아님 가능성)");
  });

  it("기록 공백이 절반을 넘으면 기록 절차 개선을 먼저 적는다", () => {
    const rows = many(5, { final_consult_date: null });
    const [a] = buildTeacherAnalysis(analyze(rows));
    expect(a.checkPoints).toContain("원인 분석보다 기록 절차 개선이 먼저");
  });

  it("확인 포인트 문구에 평가·등급 어휘를 쓰지 않는다", () => {
    const rows = many(6, { student_opinion: "수업이 지루함", final_consult_date: null });
    const [a] = buildTeacherAnalysis(analyze(rows));
    for (const p of a.checkPoints) {
      expect(p).not.toMatch(/퇴원율|순위|등급|심각|부족한 강사|역량/);
    }
  });

  it("수업·소통 신호가 많은 담당이 앞에 온다(서열 아님, 읽을 순서)", () => {
    const rows = [
      ...many(5, { teacher: "박선생" }),
      ...many(5, { teacher: "김선생", student_opinion: "수업이 지루함" }),
    ];
    const result = buildTeacherAnalysis(analyze(rows));
    expect(result[0].teacher).toBe("김선생");
  });
});
