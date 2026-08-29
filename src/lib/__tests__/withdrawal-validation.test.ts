import { describe, expect, it } from "vitest";
import {
  CONSULT_SUMMARY_MIN_LENGTH,
  WITHDRAWAL_REQUIRED_MESSAGES,
  withdrawalFormSchema,
} from "@/lib/validations/withdrawal";
import { calcDurationMonths, normalizeDateInput } from "@/lib/withdrawal-dates";

/** 검증을 통과하는 최소 입력. 각 테스트는 여기서 한 칸씩 빼거나 망가뜨린다. */
function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "김지민",
    withdrawal_date: "2026-01-15",
    reason_category: "성적 부진",
    final_consult_date: "2026-01-10",
    final_consult_summary: "가".repeat(CONSULT_SUMMARY_MIN_LENGTH),
    ...overrides,
  };
}

/** 첫 번째 에러 메시지. 서버 액션도 issues[0].message를 그대로 사용자에게 보여준다. */
function firstError(input: Record<string, unknown>): string | null {
  const parsed = withdrawalFormSchema.safeParse(input);
  return parsed.success ? null : parsed.error.issues[0].message;
}

describe("withdrawalFormSchema — 최소 입력", () => {
  it("필수 5칸이 모두 채워지면 통과한다", () => {
    const parsed = withdrawalFormSchema.safeParse(validInput());
    expect(parsed.success).toBe(true);
  });
});

describe("withdrawalFormSchema — 필수 항목 누락", () => {
  it("이름이 없으면 실패한다", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).name;
    expect(firstError(input)).toBe("이름을 입력해주세요");
  });

  it("퇴원일이 없으면 실패한다", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).withdrawal_date;
    expect(firstError(input)).toBe(WITHDRAWAL_REQUIRED_MESSAGES.withdrawal_date);
    expect(firstError(input)).toBe("퇴원일(마지막 등원일)을 선택해주세요");
  });

  it("퇴원 사유 분류가 없으면 실패한다", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).reason_category;
    expect(firstError(input)).toBe("퇴원 사유 분류를 선택해주세요");
    // 빈 문자열도 같은 안내가 나가야 한다.
    expect(firstError(validInput({ reason_category: "" }))).toBe("퇴원 사유 분류를 선택해주세요");
  });

  it("최종 상담일이 없으면 실패한다", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).final_consult_date;
    expect(firstError(input)).toBe("최종 상담일을 선택해주세요");
  });

  it("상담 요약이 없거나 30자 미만이면 실패한다", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).final_consult_summary;
    expect(firstError(input)).toBe("상담 요약을 30자 이상 입력해주세요");
    expect(firstError(validInput({ final_consult_summary: "가".repeat(29) }))).toBe(
      "상담 요약을 30자 이상 입력해주세요",
    );
    // 딱 30자는 통과한다.
    expect(withdrawalFormSchema.safeParse(validInput()).success).toBe(true);
  });
});

describe("withdrawalFormSchema — 날짜 형식", () => {
  it.each(["2026.01", "2026-01", "01.29", "2026.01.15", "2026/01/15", "26-01-15"])(
    "퇴원일 %s 는 거부한다",
    (bad) => {
      expect(firstError(validInput({ withdrawal_date: bad }))).toBe(
        WITHDRAWAL_REQUIRED_MESSAGES.withdrawal_date,
      );
    },
  );

  it.each(["2026.01", "2026-01", "01.29"])("최종 상담일 %s 는 거부한다", (bad) => {
    expect(firstError(validInput({ final_consult_date: bad }))).toBe(
      WITHDRAWAL_REQUIRED_MESSAGES.final_consult_date,
    );
  });

  it("퇴원 인지일은 선택 항목이라 비어 있으면 통과한다", () => {
    expect(withdrawalFormSchema.safeParse(validInput()).success).toBe(true);
    expect(withdrawalFormSchema.safeParse(validInput({ notice_date: "" })).success).toBe(true);
    expect(withdrawalFormSchema.safeParse(validInput({ notice_date: "2026-01-20" })).success).toBe(true);
  });

  it("퇴원 인지일에 값이 있으면 YYYY-MM-DD 여야 한다", () => {
    expect(firstError(validInput({ notice_date: "2026.01" }))).toBe(
      "퇴원 인지일은 달력에서 선택해주세요",
    );
  });

  it("퇴원 인지일 값은 그대로 보존된다", () => {
    const parsed = withdrawalFormSchema.safeParse(validInput({ notice_date: "2026-01-20" }));
    expect(parsed.success && parsed.data.notice_date).toBe("2026-01-20");
  });

  it("enrollment_end(레거시)는 형식 제약 없이 그대로 통과한다", () => {
    const parsed = withdrawalFormSchema.safeParse(validInput({ enrollment_end: "2026.01" }));
    expect(parsed.success && parsed.data.enrollment_end).toBe("2026.01");
  });
});

describe("normalizeDateInput", () => {
  it("점·슬래시 표기를 하이픈으로 정규화한다", () => {
    expect(normalizeDateInput("2026.01.15")).toBe("2026-01-15");
    expect(normalizeDateInput("2026/01/15")).toBe("2026-01-15");
    expect(normalizeDateInput("2026-01-15")).toBe("2026-01-15");
  });

  it("한 자리 월·일은 0으로 채운다", () => {
    expect(normalizeDateInput("2026/1/5")).toBe("2026-01-05");
    expect(normalizeDateInput("2026.3.7")).toBe("2026-03-07");
  });

  it("공백이 섞여 있어도 처리한다", () => {
    expect(normalizeDateInput(" 2026. 01. 15 ")).toBe("2026-01-15");
  });

  it("월까지만 있으면 null", () => {
    expect(normalizeDateInput("2026.01")).toBeNull();
    expect(normalizeDateInput("2026-01")).toBeNull();
    expect(normalizeDateInput("2026/01")).toBeNull();
  });

  it("연도가 없으면 null", () => {
    expect(normalizeDateInput("01.29")).toBeNull();
    expect(normalizeDateInput("1.29")).toBeNull();
  });

  it("날짜가 아닌 값·빈 값은 null", () => {
    expect(normalizeDateInput("")).toBeNull();
    expect(normalizeDateInput(null)).toBeNull();
    expect(normalizeDateInput(undefined)).toBeNull();
    expect(normalizeDateInput("없음")).toBeNull();
    expect(normalizeDateInput("2026-01-15 (10개월)")).toBeNull();
  });

  it("달력에 없는 날짜는 null", () => {
    expect(normalizeDateInput("2026-02-30")).toBeNull();
    expect(normalizeDateInput("2026-13-01")).toBeNull();
    expect(normalizeDateInput("2026-00-10")).toBeNull();
    // 윤년은 통과한다.
    expect(normalizeDateInput("2024-02-29")).toBe("2024-02-29");
  });
});

describe("calcDurationMonths", () => {
  it("꽉 찬 개월 수를 floor 기준으로 센다", () => {
    expect(calcDurationMonths("2024-07-01", "2026-07-15")).toBe(24);
    expect(calcDurationMonths("2025-01-10", "2025-07-10")).toBe(6);
    expect(calcDurationMonths("2025-01-10", "2025-12-31")).toBe(11);
  });

  it("일자가 덜 찼으면 그 달은 세지 않는다", () => {
    expect(calcDurationMonths("2024-07-31", "2024-08-01")).toBe(0);
    expect(calcDurationMonths("2025-01-20", "2025-07-10")).toBe(5);
  });

  it("같은 날이면 0개월", () => {
    expect(calcDurationMonths("2026-01-15", "2026-01-15")).toBe(0);
  });

  it("점 표기 입력도 정규화해서 계산한다", () => {
    expect(calcDurationMonths("2024.07.01", "2026/7/15")).toBe(24);
  });

  it("날짜가 역전되면 null", () => {
    expect(calcDurationMonths("2026-07-15", "2024-07-01")).toBeNull();
  });

  it("형식이 불완전하거나 비어 있으면 null", () => {
    expect(calcDurationMonths("2026-01", "2026-07-15")).toBeNull();
    expect(calcDurationMonths("2024-07-01", "2026.07")).toBeNull();
    expect(calcDurationMonths(null, "2026-07-15")).toBeNull();
    expect(calcDurationMonths("2024-07-01", undefined)).toBeNull();
    expect(calcDurationMonths("", "")).toBeNull();
  });
});
