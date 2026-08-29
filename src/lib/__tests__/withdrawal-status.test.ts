import { describe, expect, it } from "vitest";
import {
  daysSinceWithdrawal,
  detectPausedFromText,
  isCountedWithdrawal,
  isPausedOverdue,
  retrospectiveReminder,
  statusOf,
  summarizeStatuses,
  toIsoDay,
} from "@/lib/withdrawal-status";
import {
  WITHDRAWAL_REQUIRED_MESSAGES,
  withdrawalFormSchema,
} from "@/lib/validations/withdrawal";
import { makeRetro, makeW } from "@/lib/__tests__/helpers/withdrawal-factory";

const TODAY = "2026-08-29";

describe("statusOf", () => {
  it("세 값만 인정하고 나머지는 퇴원으로 본다", () => {
    expect(statusOf({ status: "withdrawn" })).toBe("withdrawn");
    expect(statusOf({ status: "paused" })).toBe("paused");
    expect(statusOf({ status: "returned" })).toBe("returned");
  });

  it("컬럼이 없거나 알 수 없는 값이면 퇴원으로 본다(기존 동작 유지)", () => {
    expect(statusOf({})).toBe("withdrawn");
    expect(statusOf({ status: null })).toBe("withdrawn");
    expect(statusOf({ status: "" })).toBe("withdrawn");
    expect(statusOf({ status: "unknown" })).toBe("withdrawn");
    expect(statusOf(null)).toBe("withdrawn");
    expect(statusOf(undefined)).toBe("withdrawn");
  });
});

describe("isCountedWithdrawal — 집계 필터", () => {
  it("퇴원만 세고 휴원·복귀는 뺀다", () => {
    expect(isCountedWithdrawal(makeW({ status: "withdrawn" }))).toBe(true);
    expect(isCountedWithdrawal(makeW({ status: "paused" }))).toBe(false);
    expect(isCountedWithdrawal(makeW({ status: "returned" }))).toBe(false);
  });

  it("status 미지정/withdrawn 배열은 필터 전후가 같다 (마이그레이션 직후 화면 숫자 불변)", () => {
    const legacy = [
      makeW(),
      makeW(),
      { ...makeW(), status: undefined } as unknown as ReturnType<typeof makeW>,
      makeW({ status: "withdrawn" }),
    ];
    const filtered = legacy.filter(isCountedWithdrawal);
    expect(filtered).toHaveLength(legacy.length);
    expect(filtered).toEqual(legacy);
  });

  it("휴원 4건을 전환하면 그만큼만 통계에서 빠진다", () => {
    const rows = [
      ...Array.from({ length: 10 }, () => makeW()),
      ...Array.from({ length: 4 }, () => makeW({ status: "paused" })),
    ];
    expect(rows.filter(isCountedWithdrawal)).toHaveLength(10);
  });
});

describe("toIsoDay", () => {
  it("Date를 로컬 기준 YYYY-MM-DD로 바꾼다", () => {
    expect(toIsoDay(new Date(2026, 7, 9))).toBe("2026-08-09");
  });

  it("문자열은 앞뒤 공백만 정리해서 그대로 쓴다", () => {
    expect(toIsoDay(" 2026-08-29 ")).toBe("2026-08-29");
  });
});

describe("isPausedOverdue", () => {
  it("휴원이고 예상 복귀일이 지났으면 true", () => {
    const row = makeW({ status: "paused", expected_comeback_date: "2026-08-01" });
    expect(isPausedOverdue(row, TODAY)).toBe(true);
  });

  it("아직 안 지났거나 오늘이면 false", () => {
    expect(isPausedOverdue(makeW({ status: "paused", expected_comeback_date: "2026-09-01" }), TODAY)).toBe(false);
    expect(isPausedOverdue(makeW({ status: "paused", expected_comeback_date: TODAY }), TODAY)).toBe(false);
  });

  it("서술형 텍스트는 판정하지 않는다 (억지 추측 금지)", () => {
    for (const text of ["9월 초", "미정", "없음", "2026.09", "2026-09"]) {
      expect(isPausedOverdue(makeW({ status: "paused", expected_comeback_date: text }), TODAY)).toBe(false);
    }
    expect(isPausedOverdue(makeW({ status: "paused", expected_comeback_date: null }), TODAY)).toBe(false);
  });

  it("휴원이 아니면 언제나 false", () => {
    expect(isPausedOverdue(makeW({ status: "withdrawn", expected_comeback_date: "2026-01-01" }), TODAY)).toBe(false);
    expect(isPausedOverdue(makeW({ status: "returned", expected_comeback_date: "2026-01-01" }), TODAY)).toBe(false);
  });
});

describe("daysSinceWithdrawal", () => {
  it("퇴원일로부터 지난 일수를 센다", () => {
    expect(daysSinceWithdrawal(makeW({ withdrawal_date: "2026-08-22" }), TODAY)).toBe(7);
    expect(daysSinceWithdrawal(makeW({ withdrawal_date: TODAY }), TODAY)).toBe(0);
  });

  it("퇴원일이 온전한 날짜가 아니면 null", () => {
    expect(daysSinceWithdrawal(makeW({ withdrawal_date: "2026-08" }), TODAY)).toBeNull();
    expect(daysSinceWithdrawal(makeW({ withdrawal_date: null }), TODAY)).toBeNull();
  });
});

describe("retrospectiveReminder — 회고 7일 리마인더", () => {
  it("D+6은 대기", () => {
    const row = makeW({ withdrawal_date: "2026-08-23", retrospective: null });
    expect(daysSinceWithdrawal(row, TODAY)).toBe(6);
    expect(retrospectiveReminder(row, TODAY)).toBe("waiting");
  });

  it("D+7부터 독촉 (기준일 경계)", () => {
    const row = makeW({ withdrawal_date: "2026-08-22", retrospective: null });
    expect(retrospectiveReminder(row, TODAY)).toBe("overdue");
  });

  it("D+8은 독촉", () => {
    const row = makeW({ withdrawal_date: "2026-08-21", retrospective: null });
    expect(daysSinceWithdrawal(row, TODAY)).toBe(8);
    expect(retrospectiveReminder(row, TODAY)).toBe("overdue");
  });

  it("작성 중(draft)이어도 미완이면 독촉 대상이다", () => {
    const row = makeW({
      withdrawal_date: "2026-08-01",
      retrospective: makeRetro({ lesson: "" }),
    });
    expect(retrospectiveReminder(row, TODAY)).toBe("overdue");
  });

  it("회고가 완료됐으면 none", () => {
    const row = makeW({ withdrawal_date: "2026-08-01", retrospective: makeRetro() });
    expect(retrospectiveReminder(row, TODAY)).toBe("none");
  });

  it("휴원·복귀 건은 회고 독촉 대상이 아니다", () => {
    for (const status of ["paused", "returned"] as const) {
      const row = makeW({ status, withdrawal_date: "2026-08-01", retrospective: null });
      expect(retrospectiveReminder(row, TODAY)).toBe("none");
    }
  });

  it("퇴원일이 온전치 않으면 판정하지 않는다", () => {
    const row = makeW({ withdrawal_date: "2026-08", retrospective: null });
    expect(retrospectiveReminder(row, TODAY)).toBe("none");
  });
});

describe("summarizeStatuses", () => {
  it("휴원·경과·복귀·회고 미작성을 한 번에 센다", () => {
    const rows = [
      makeW({ withdrawal_date: "2026-08-01", retrospective: null }),
      makeW({ withdrawal_date: "2026-08-01", retrospective: makeRetro() }),
      makeW({ status: "paused", expected_comeback_date: "2026-08-01" }),
      makeW({ status: "paused", expected_comeback_date: "2026-12-01" }),
      makeW({ status: "paused", expected_comeback_date: "9월 초" }),
      makeW({ status: "returned", returned_at: "2026-08-20" }),
    ];
    expect(summarizeStatuses(rows, TODAY)).toEqual({
      paused: 3,
      pausedOverdue: 1,
      returned: 1,
      retrospectiveMissing: 1,
    });
  });

  it("전건이 퇴원이고 회고가 다 끝났으면 전부 0", () => {
    const rows = Array.from({ length: 3 }, () => makeW({ retrospective: makeRetro() }));
    expect(summarizeStatuses(rows, TODAY)).toEqual({
      paused: 0,
      pausedOverdue: 0,
      returned: 0,
      retrospectiveMissing: 0,
    });
  });
});

describe("detectPausedFromText — 붙여넣기 휴원 감지", () => {
  it("휴원·복귀 예정 문구를 잡는다", () => {
    expect(detectPausedFromText("특이사항: 3개월 휴원 후 복귀 희망")).toBe(true);
    expect(detectPausedFromText("학부모 의견: 9월 복귀 예정입니다")).toBe(true);
    expect(detectPausedFromText("복귀예정")).toBe(true);
  });

  it("평범한 퇴원 기록은 잡지 않는다", () => {
    expect(detectPausedFromText("퇴원일: 2026-01-15\n사유: 성적 부진")).toBe(false);
    expect(detectPausedFromText("복귀 가능성: 중")).toBe(false);
    expect(detectPausedFromText("")).toBe(false);
    expect(detectPausedFromText(null)).toBe(false);
  });
});

/* ─── 스키마 조건부 필수 ─── */

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "김지민",
    withdrawal_date: "2026-01-15",
    reason_category: "성적 부진",
    final_consult_date: "2026-01-10",
    final_consult_summary: "가".repeat(30),
    ...overrides,
  };
}

function firstError(input: Record<string, unknown>): string | null {
  const parsed = withdrawalFormSchema.safeParse(input);
  return parsed.success ? null : parsed.error.issues[0].message;
}

describe("withdrawalFormSchema — 상태별 조건부 필수", () => {
  it("status를 안 주면 퇴원으로 채워진다", () => {
    const parsed = withdrawalFormSchema.safeParse(validInput());
    expect(parsed.success && parsed.data.status).toBe("withdrawn");
  });

  it("휴원인데 예상 복귀 시기가 없으면 실패한다", () => {
    expect(firstError(validInput({ status: "paused" }))).toBe(
      WITHDRAWAL_REQUIRED_MESSAGES.expected_comeback_date,
    );
    expect(firstError(validInput({ status: "paused", expected_comeback_date: "   " }))).toBe(
      "휴원은 예상 복귀 시기를 입력해주세요",
    );
  });

  it("휴원의 예상 복귀 시기는 서술형도 통과한다", () => {
    expect(withdrawalFormSchema.safeParse(validInput({ status: "paused", expected_comeback_date: "9월 초" })).success).toBe(true);
    expect(withdrawalFormSchema.safeParse(validInput({ status: "paused", expected_comeback_date: "2026-09-01" })).success).toBe(true);
  });

  it("복귀인데 복귀일이 없으면 실패한다", () => {
    expect(firstError(validInput({ status: "returned" }))).toBe("복귀일을 선택해주세요");
  });

  it("복귀일은 YYYY-MM-DD 여야 한다", () => {
    expect(firstError(validInput({ status: "returned", returned_at: "2026.09" }))).toBe(
      "복귀일을 선택해주세요",
    );
    const parsed = withdrawalFormSchema.safeParse(
      validInput({ status: "returned", returned_at: "2026-09-01" }),
    );
    expect(parsed.success && parsed.data.returned_at).toBe("2026-09-01");
  });

  it("휴원·복귀도 상담일·요약 기준은 퇴원과 같다", () => {
    expect(firstError(validInput({ status: "paused", expected_comeback_date: "9월 초", final_consult_summary: "짧음" })))
      .toBe(WITHDRAWAL_REQUIRED_MESSAGES.final_consult_summary);
    expect(firstError(validInput({ status: "returned", returned_at: "2026-09-01", final_consult_date: undefined })))
      .toBe(WITHDRAWAL_REQUIRED_MESSAGES.final_consult_date);
    expect(firstError(validInput({ status: "paused", expected_comeback_date: "9월 초", reason_category: "" })))
      .toBe(WITHDRAWAL_REQUIRED_MESSAGES.reason_category);
  });

  it("알 수 없는 상태 값은 거부한다", () => {
    expect(withdrawalFormSchema.safeParse(validInput({ status: "unknown" })).success).toBe(false);
  });
});
