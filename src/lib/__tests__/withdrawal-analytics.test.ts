import { describe, expect, it } from "vitest";
import { WITHDRAWAL_REASONS } from "@/types";
import type { Withdrawal } from "@/types";
import { makeMany, makeW } from "./helpers/withdrawal-factory";
import {
  buildPrescriptions,
  computeDataQuality,
  diagnoseWithdrawals,
  getMonthFromDate,
  isCurrentYearMonth,
  parseWithdrawalYearMonth,
  pickHeroDiagnoses,
  REASON_ACTION_MAP,
  type Diagnosis,
  type DiagnoseInput,
} from "../withdrawal-analytics";

function runDiagnose(input: Partial<DiagnoseInput> & { filtered: Withdrawal[] }): Diagnosis[] {
  return diagnoseWithdrawals({
    allSubjectFiltered: input.filtered,
    activeMonth: null,
    ...input,
  });
}

function find(diagnoses: Diagnosis[], type: Diagnosis["type"]): Diagnosis | undefined {
  return diagnoses.find((d) => d.type === type);
}

describe("parseWithdrawalYearMonth", () => {
  it("연도가 있는 날짜는 연·월을 모두 반환한다", () => {
    expect(parseWithdrawalYearMonth("2026.12.15")).toEqual({ year: 2026, month: 12 });
    expect(parseWithdrawalYearMonth("2025-03-07")).toEqual({ year: 2025, month: 3 });
  });

  it("단축형은 연도 없이 월만 반환한다", () => {
    expect(parseWithdrawalYearMonth("2.15")).toEqual({ year: null, month: 2 });
  });

  it("null·해석 불가 문자열은 연·월 모두 null이다", () => {
    expect(parseWithdrawalYearMonth(null)).toEqual({ year: null, month: null });
    expect(parseWithdrawalYearMonth("이상값")).toEqual({ year: null, month: null });
  });
});

describe("getMonthFromDate", () => {
  it("12월도 정상적으로 반환한다", () => {
    expect(getMonthFromDate("2026-12-31")).toBe(12);
    expect(getMonthFromDate("12.03")).toBe(12);
    expect(getMonthFromDate(null)).toBeNull();
  });
});

describe("isCurrentYearMonth", () => {
  it("연도가 없거나 현재 연도와 같으면 true, 다르면 false", () => {
    expect(isCurrentYearMonth("2026-12-31", 2026)).toBe(true);
    expect(isCurrentYearMonth("12.31", 2026)).toBe(true);
    expect(isCurrentYearMonth("2025-12-31", 2026)).toBe(false);
    expect(isCurrentYearMonth(null, 2026)).toBe(false);
  });
});

describe("computeDataQuality", () => {
  it("미입력 건수와 비율을 정확히 집계한다", () => {
    const report = computeDataQuality([
      makeW({ reason_category: "성적 부진", duration_months: 5, comeback_possibility: "상" }),
      makeW({ reason_category: null, duration_months: null, comeback_possibility: null }),
      makeW({ reason_category: "미입력", duration_months: 999, comeback_possibility: null }),
      makeW({ reason_category: "친구 문제", duration_months: 3, comeback_possibility: "중" }),
    ]);
    expect(report.total).toBe(4);
    expect(report.missingReasonCount).toBe(2);
    expect(report.missingReasonPct).toBe(50);
    expect(report.missingDurationCount).toBe(2);
    expect(report.missingComebackCount).toBe(2);
  });

  it("빈 배열이면 모두 0이다", () => {
    expect(computeDataQuality([])).toEqual({
      total: 0,
      missingReasonCount: 0,
      missingReasonPct: 0,
      missingDurationCount: 0,
      missingComebackCount: 0,
    });
  });
});

describe("reason-concentration 탐지", () => {
  it("1위 사유가 60%면 발동하고 점수가 0보다 크다", () => {
    const filtered = [
      ...makeMany(6, { reason_category: "성적 부진" }),
      ...makeMany(2, { reason_category: "친구 문제" }),
      ...makeMany(2, { reason_category: "스케줄 변동" }),
    ];
    const d = find(runDiagnose({ filtered }), "reason-concentration");
    expect(d).toBeDefined();
    expect(d!.score).toBeGreaterThan(0);
    expect(d!.detail).toBe("성적 부진");
    expect(d!.metric).toBe(60);
    expect(d!.evidence).toBe("사유 입력 10건 중 6건 (60.0%)");
    expect(d!.title).toBe("'성적 부진' 사유 편중");
  });

  it("미입력 건은 분모와 1위 산정에서 제외한다", () => {
    const filtered = [
      ...makeMany(4, { reason_category: "성적 부진" }),
      ...makeMany(2, { reason_category: "친구 문제" }),
      ...makeMany(8, { reason_category: null }),
    ];
    const d = find(runDiagnose({ filtered }), "reason-concentration");
    expect(d).toBeDefined();
    expect(d!.detail).toBe("성적 부진");
    expect(d!.evidence).toContain("사유 입력 6건 중 4건");
  });

  it("사유 입력이 4건이면 발동하지 않는다", () => {
    const filtered = [
      ...makeMany(3, { reason_category: "성적 부진" }),
      ...makeMany(1, { reason_category: "친구 문제" }),
    ];
    expect(find(runDiagnose({ filtered }), "reason-concentration")).toBeUndefined();
  });
});

// [봉인 스펙] 강사 실명 퇴원율은 "생성되지 않는 것"이 요구사항이다.
// 분자(퇴원 건)·분모(재원수)가 모두 파손돼 존재하지 않는 퇴원율이 심각 등급으로 표시됐다.
// 아래 테스트는 기능 유지가 아니라 봉인이 유지되는지를 지킨다.
describe("teacher-rate 봉인", () => {
  it("퇴원율이 높아 보이는 데이터에서도 teacher-rate 진단을 만들지 않는다", () => {
    const filtered = makeMany(5, { teacher: "김" });
    expect(
      find(runDiagnose({ filtered, teacherStudentCounts: { 김: 20 } }), "teacher-rate"),
    ).toBeUndefined();
  });

  it("월별 분모가 주어져도 teacher-rate 진단을 만들지 않는다", () => {
    const filtered = makeMany(4, { teacher: "김" });
    expect(
      find(
        runDiagnose({
          filtered,
          activeMonth: 3,
          teacherStudentCounts: { 김: 40 },
          monthlyBaseByTeacher: { 3: { 김: 10 } },
        }),
        "teacher-rate",
      ),
    ).toBeUndefined();
  });

  it("어떤 진단에도 강사 실명이 detail로 남지 않는다", () => {
    const filtered = makeMany(5, { teacher: "김", reason_category: "성적 부진" });
    const details = runDiagnose({ filtered, teacherStudentCounts: { 김: 20 } })
      .map((d) => d.detail)
      .filter(Boolean);
    expect(details).not.toContain("김");
  });
});

describe("early-withdrawal 탐지", () => {
  it("조기 퇴원 비중이 50%면 발동한다", () => {
    const filtered = [
      ...makeMany(5, { duration_months: 2 }),
      ...makeMany(5, { duration_months: 12 }),
    ];
    const d = find(runDiagnose({ filtered }), "early-withdrawal");
    expect(d).toBeDefined();
    expect(d!.metric).toBe(50);
    expect(d!.score).toBe(75);
    expect(d!.evidence).toContain("재원 3개월 이하");
  });

  it("유효 재원기간이 4건이면 발동하지 않는다", () => {
    const filtered = [
      ...makeMany(2, { duration_months: 1 }),
      ...makeMany(2, { duration_months: 20 }),
      ...makeMany(6, { duration_months: null }),
      ...makeMany(3, { duration_months: 200 }),
    ];
    expect(find(runDiagnose({ filtered }), "early-withdrawal")).toBeUndefined();
  });

  it("경계값 3개월은 조기에 포함하고 4개월은 제외한다", () => {
    const three = [
      ...makeMany(4, { duration_months: 3 }),
      ...makeMany(4, { duration_months: 24 }),
    ];
    const four = [
      ...makeMany(4, { duration_months: 4 }),
      ...makeMany(4, { duration_months: 24 }),
    ];
    expect(find(runDiagnose({ filtered: three }), "early-withdrawal")!.metric).toBe(50);
    expect(find(runDiagnose({ filtered: four }), "early-withdrawal")).toBeUndefined();
  });
});

describe("monthly-spike 탐지", () => {
  it("3개월 건수가 균등하면 발동하지 않는다", () => {
    const filtered = [
      ...makeMany(3, { withdrawal_date: "2026-01-05" }),
      ...makeMany(3, { withdrawal_date: "2026-02-05" }),
      ...makeMany(3, { withdrawal_date: "2026-03-05" }),
    ];
    expect(find(runDiagnose({ filtered }), "monthly-spike")).toBeUndefined();
  });

  it("대상월이 나머지 달 평균의 2배면 발동한다", () => {
    const filtered = [
      ...makeMany(3, { withdrawal_date: "2026-01-05" }),
      ...makeMany(3, { withdrawal_date: "2026-02-05" }),
      ...makeMany(6, { withdrawal_date: "2026-03-05" }),
    ];
    const d = find(runDiagnose({ filtered }), "monthly-spike");
    expect(d).toBeDefined();
    expect(d!.metric).toBe(2);
    expect(d!.detail).toBe("3");
    expect(d!.evidence).toContain("3월 6건");
  });

  it("데이터가 있는 달이 2개면 발동하지 않는다", () => {
    const filtered = [
      ...makeMany(3, { withdrawal_date: "2026-01-05" }),
      ...makeMany(9, { withdrawal_date: "2026-02-05" }),
    ];
    expect(find(runDiagnose({ filtered }), "monthly-spike")).toBeUndefined();
  });
});

describe("grade-concentration 탐지", () => {
  it("1위 학년이 75%면 발동한다", () => {
    const filtered = [
      ...makeMany(6, { grade: "고2" }),
      ...makeMany(2, { grade: "중1" }),
    ];
    const d = find(runDiagnose({ filtered }), "grade-concentration");
    expect(d).toBeDefined();
    expect(d!.metric).toBe(75);
    expect(d!.score).toBe(80);
    expect(d!.detail).toBe("고2");
  });
});

describe("data-quality 탐지", () => {
  // 사유 미입력 외에 "강사 귀속 불가(분모 미연결)"·"회고 미작성"도 함께 보고한다.
  // 모두 조직 단위 사실이며 실명은 넣지 않는다.
  it("사유 미입력 40%면 발동하고 근거에 건수와 비율이 들어간다", () => {
    const filtered = [
      ...makeMany(4, { reason_category: null }),
      ...makeMany(6, { reason_category: "성적 부진" }),
    ];
    const d = find(runDiagnose({ filtered }), "data-quality");
    expect(d).toBeDefined();
    expect(d!.metric).toBe(40);
    expect(d!.evidence).toContain("전체 10건 중");
    expect(d!.evidence).toContain("사유 미입력 4건 (40.0%)");
  });

  it("분모에 연결되지 않은 담당은 귀속 불가 건수로 보고한다", () => {
    const filtered = makeMany(5, { teacher: "김", reason_category: "성적 부진" });
    const linked = find(
      runDiagnose({ filtered, teacherStudentCounts: { 김: 20 } }),
      "data-quality",
    );
    expect(linked!.evidence).not.toContain("강사 귀속 불가");

    const unlinked = find(runDiagnose({ filtered }), "data-quality");
    expect(unlinked!.evidence).toContain("강사 귀속 불가 5건 (분모 미연결)");
  });

  it("회고 미작성 건수를 보고한다", () => {
    const filtered = makeMany(5, { teacher: "김", reason_category: "성적 부진" });
    const d = find(runDiagnose({ filtered, teacherStudentCounts: { 김: 20 } }), "data-quality");
    expect(d!.evidence).toContain("회고 미작성 5건");
  });

  it("보고할 품질 문제가 없으면 발동하지 않는다", () => {
    const filtered = makeMany(6, {
      reason_category: "성적 부진",
      teacher: "김",
      retrospective: {
        first_sign: "a",
        our_attempts: "b",
        do_differently: "c",
        system_change: "d",
        lesson: "e",
        manager_comment: "",
        author: "원장",
        completed_at: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(
      find(runDiagnose({ filtered, teacherStudentCounts: { 김: 20 } }), "data-quality"),
    ).toBeUndefined();
  });
});

describe("diagnoseWithdrawals 통합", () => {
  it("score 내림차순으로 정렬한다", () => {
    const filtered = [
      ...makeMany(8, { reason_category: "성적 부진", grade: "고2", duration_months: 2, teacher: "김" }),
      ...makeMany(2, { reason_category: "친구 문제", grade: "중1", duration_months: 24, teacher: "김" }),
    ];
    const diagnoses = runDiagnose({ filtered, teacherStudentCounts: { 김: 20 } });
    expect(diagnoses.length).toBeGreaterThan(1);
    const scores = diagnoses.map((d) => d.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("같은 비율이라도 표본이 작으면 점수가 감쇠된다", () => {
    const small = [
      ...makeMany(4, { reason_category: "성적 부진" }),
      ...makeMany(2, { reason_category: "친구 문제" }),
    ];
    const large = [
      ...makeMany(10, { reason_category: "성적 부진" }),
      ...makeMany(5, { reason_category: "친구 문제" }),
    ];
    const smallScore = find(runDiagnose({ filtered: small }), "reason-concentration")!.score;
    const largeScore = find(runDiagnose({ filtered: large }), "reason-concentration")!.score;
    expect(smallScore).toBe(60);
    expect(largeScore).toBe(100);
    expect(smallScore).toBeLessThan(largeScore);
  });
});

describe("pickHeroDiagnoses", () => {
  const mk = (type: Diagnosis["type"], score: number, affected = 1): Diagnosis => ({
    type,
    score,
    severity: "주의",
    title: type,
    evidence: "",
    metric: score,
    metricUnit: "%",
    affected,
  });

  it("score 40 미만은 제외하고 최대 3개만 남긴다", () => {
    const heroes = pickHeroDiagnoses([
      mk("reason-concentration", 90),
      mk("teacher-rate", 80),
      mk("early-withdrawal", 70),
      mk("monthly-spike", 60),
      mk("grade-concentration", 39),
    ]);
    expect(heroes.map((d) => d.type)).toEqual([
      "reason-concentration",
      "teacher-rate",
      "early-withdrawal",
    ]);
  });

  it("점수가 같으면 영향 인원이 많은 진단을 앞세운다", () => {
    const heroes = pickHeroDiagnoses([
      mk("teacher-rate", 50, 2),
      mk("early-withdrawal", 50, 9),
    ]);
    expect(heroes[0].type).toBe("early-withdrawal");
  });
});

describe("buildPrescriptions", () => {
  const mk = (type: Diagnosis["type"], detail?: string): Diagnosis => ({
    type,
    score: 80,
    severity: "심각",
    title: `${type} 진단`,
    evidence: "",
    metric: 50,
    metricUnit: "%",
    detail,
  });

  it("성적 부진 사유 편중이면 클리닉 연계 액션을 제시한다", () => {
    const [card] = buildPrescriptions([mk("reason-concentration", "성적 부진")]);
    expect(card.diagnosisType).toBe("reason-concentration");
    expect(card.actions.join(" ")).toContain("클리닉");
  });

  it("조기 퇴원 진단이면 온보딩 액션을 제시한다", () => {
    const [card] = buildPrescriptions([mk("early-withdrawal")]);
    expect(card.actions.join(" ")).toContain("온보딩");
  });

  // [봉인 스펙] 실명 코칭 처방은 생성하지 않는다.
  it("teacher-rate 진단이 들어와도 실명 처방을 만들지 않는다", () => {
    const cards = buildPrescriptions([mk("teacher-rate", "김")]);
    expect(cards.flatMap((c) => c.actions).join(" ")).not.toContain("김");
  });

  it("중복 액션은 카드 간에도 한 번만 노출한다", () => {
    const cards = buildPrescriptions([
      mk("reason-concentration", "성적 부진"),
      mk("reason-concentration", "성적 부진"),
    ]);
    expect(cards).toHaveLength(1);
  });

  it("카드당 액션은 최대 4개다", () => {
    const [card] = buildPrescriptions([mk("reason-concentration", "성적 부진")]);
    expect(card.actions.length).toBeLessThanOrEqual(4);
  });

  it("WITHDRAWAL_REASONS 11종이 모두 REASON_ACTION_MAP 키로 존재한다", () => {
    expect(WITHDRAWAL_REASONS).toHaveLength(11);
    WITHDRAWAL_REASONS.forEach((reason) => {
      expect(REASON_ACTION_MAP[reason]).toBeDefined();
      expect(REASON_ACTION_MAP[reason].length).toBeGreaterThan(0);
    });
  });
});
