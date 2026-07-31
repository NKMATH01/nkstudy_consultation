import { describe, expect, it } from "vitest";
import {
  deriveTenureMonths,
  eventMonth,
  groupWithdrawalEvents,
  normalizeStudentName,
  tenureBandOf,
} from "../events";
import type { Withdrawal } from "@/types";

let seq = 0;
function mk(overrides: Partial<Withdrawal> = {}): Withdrawal {
  seq += 1;
  return {
    id: `row-${seq}`,
    name: "김지민",
    school: "안산고",
    subject: "수학",
    class_name: "고1-A",
    teacher: "김선생",
    grade: "고1",
    enrollment_start: null,
    enrollment_end: null,
    duration_months: null,
    withdrawal_date: "2026-03-10",
    reason_category: null,
    student_opinion: null,
    parent_opinion: null,
    teacher_opinion: null,
    final_consult_date: null,
    final_consult_summary: null,
    special_notes: null,
    retrospective: null,
    ...overrides,
  } as Withdrawal;
}

describe("normalizeStudentName", () => {
  it("앞뒤·내부 공백을 모두 제거한다", () => {
    expect(normalizeStudentName("  김 지 민 ")).toBe("김지민");
    expect(normalizeStudentName(null)).toBe("");
  });
});

describe("tenureBandOf", () => {
  it("개월수를 밴드로 나눈다", () => {
    expect(tenureBandOf(0)).toBe("0-2");
    expect(tenureBandOf(2.9)).toBe("0-2");
    expect(tenureBandOf(3)).toBe("3-6");
    expect(tenureBandOf(6.9)).toBe("3-6");
    expect(tenureBandOf(7)).toBe("7-12");
    expect(tenureBandOf(12.9)).toBe("7-12");
    expect(tenureBandOf(13)).toBe("13+");
    expect(tenureBandOf(null)).toBe("unknown");
  });
});

describe("deriveTenureMonths", () => {
  it("등록일과 퇴원일이 있으면 날짜 차이를 우선한다", () => {
    const months = deriveTenureMonths(
      mk({ enrollment_start: "2026-01-01", withdrawal_date: "2026-04-01", duration_months: 99 }),
    );
    expect(months).toBeCloseTo(2.96, 1);
  });

  it("날짜가 없으면 duration_months로 대체한다", () => {
    expect(deriveTenureMonths(mk({ withdrawal_date: null, duration_months: 8 }))).toBe(8);
  });

  it("비정상 duration_months(10년 초과)는 버린다", () => {
    expect(deriveTenureMonths(mk({ withdrawal_date: null, duration_months: 999 }))).toBeNull();
  });

  it("근거가 전혀 없으면 null", () => {
    expect(deriveTenureMonths(mk({ withdrawal_date: null }))).toBeNull();
  });
});

describe("groupWithdrawalEvents — 완전 중복 병합", () => {
  it("이름·퇴원일·반·강사가 같은 4행을 1사건으로 묶는다", () => {
    const rows = [mk(), mk(), mk(), mk()];
    const events = groupWithdrawalEvents(rows);

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(rows[0].id);
    expect(events[0].duplicateRowIds).toEqual(rows.map((r) => r.id));
  });

  it("이름의 공백 차이는 같은 사건으로 본다", () => {
    const events = groupWithdrawalEvents([mk({ name: "김지민" }), mk({ name: "김 지민 " })]);
    expect(events).toHaveLength(1);
    expect(events[0].duplicateRowIds).toHaveLength(2);
  });

  it("반이나 강사가 다르면 별개 사건이다", () => {
    const events = groupWithdrawalEvents([
      mk({ class_name: "고1-A" }),
      mk({ class_name: "고1-E" }),
      mk({ teacher: "박선생" }),
    ]);
    expect(events).toHaveLength(3);
  });
});

describe("groupWithdrawalEvents — 동일 학생 다과목 연결", () => {
  it("같은 학생이 14일 이내에 과목별로 이탈하면 서로 연결한다", () => {
    const math = mk({ subject: "수학", class_name: "고1-M", withdrawal_date: "2026-03-10" });
    const eng = mk({ subject: "영어", class_name: "고1-E", withdrawal_date: "2026-03-20" });
    const events = groupWithdrawalEvents([math, eng]);

    expect(events).toHaveLength(2);
    expect(events[0].relatedEventIds).toEqual([eng.id]);
    expect(events[1].relatedEventIds).toEqual([math.id]);
  });

  it("14일을 넘으면 연결하지 않는다", () => {
    const events = groupWithdrawalEvents([
      mk({ class_name: "고1-M", withdrawal_date: "2026-03-01" }),
      mk({ class_name: "고1-E", withdrawal_date: "2026-04-01" }),
    ]);
    expect(events.every((e) => e.relatedEventIds.length === 0)).toBe(true);
  });

  it("이름이 같아도 학교가 다르면 동일 학생으로 보지 않는다", () => {
    const events = groupWithdrawalEvents([
      mk({ school: "안산고", class_name: "고1-M" }),
      mk({ school: "성포고", class_name: "고1-E" }),
    ]);
    expect(events.every((e) => e.relatedEventIds.length === 0)).toBe(true);
  });

  it("퇴원일이 없으면 근접 여부를 단정하지 않는다", () => {
    const events = groupWithdrawalEvents([
      mk({ class_name: "고1-M", withdrawal_date: null }),
      mk({ class_name: "고1-E", withdrawal_date: "2026-03-10" }),
    ]);
    expect(events.every((e) => e.relatedEventIds.length === 0)).toBe(true);
  });
});

describe("eventMonth", () => {
  it("퇴원 월을 1~12로 준다", () => {
    const [event] = groupWithdrawalEvents([mk({ withdrawal_date: "2026-07-05" })]);
    expect(eventMonth(event)).toBe(7);
  });

  it("날짜가 없으면 null", () => {
    const [event] = groupWithdrawalEvents([mk({ withdrawal_date: null })]);
    expect(eventMonth(event)).toBeNull();
  });
});
