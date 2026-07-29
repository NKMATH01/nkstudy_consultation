import { describe, expect, it } from "vitest";
import { buildRegistrationGuideVars } from "../registration-alimtalk";
import { buildAnalysisResultVars } from "../analysis-alimtalk";
import type { Registration } from "@/types";

function makeRegistration(overrides: Partial<Registration> = {}): Registration {
  return {
    id: "registration-1",
    name: "홍길동",
    registration_date: "2026-08-03",
    assigned_class: "고1-A",
    teacher: "김선생",
    assigned_class_math2: null,
    teacher_math2: null,
    assigned_class_2: null,
    teacher_2: null,
    subject: "수학",
    ...overrides,
  } as Registration;
}

describe("buildRegistrationGuideVars", () => {
  it("수학 단일 과목이면 수학 반과 담당만 넣는다", () => {
    expect(buildRegistrationGuideVars(makeRegistration(), "tok-1")).toEqual({
      이름: "홍길동",
      등록일: "2026. 8. 3(월)",
      반: "고1-A",
      담당: "김선생",
      토큰: "tok-1",
    });
  });

  it("영어수학이면 과목별로 반과 담당을 묶는다", () => {
    const vars = buildRegistrationGuideVars(
      makeRegistration({
        subject: "영어수학",
        assigned_class_2: "고1-E",
        teacher_2: "박선생",
      }),
      "tok-2",
    );
    expect(vars.반).toBe("수학 고1-A / 영어 고1-E");
    expect(vars.담당).toBe("수학 김선생 / 영어 박선생");
  });

  it("수학2 반이 있으면 수학 쪽에 함께 묶는다", () => {
    const vars = buildRegistrationGuideVars(
      makeRegistration({
        assigned_class_math2: "고2-심화",
        teacher_math2: "이선생",
      }),
      "tok-3",
    );
    expect(vars.반).toBe("고1-A, 고2-심화");
    expect(vars.담당).toBe("김선생, 이선생");
  });

  it("값이 비면 대시로 채운다", () => {
    const vars = buildRegistrationGuideVars(
      makeRegistration({ registration_date: null, assigned_class: null, teacher: null }),
      "tok-4",
    );
    expect(vars.등록일).toBe("-");
    expect(vars.반).toBe("-");
    expect(vars.담당).toBe("-");
  });
});

describe("buildAnalysisResultVars", () => {
  it("학교와 학년을 합쳐 대상으로 넣고 검사일은 로컬 날짜로 표기한다", () => {
    // created_at은 timestamptz라 표기 날짜가 실행 타임존을 따른다. 기대값도 같은 기준으로 만든다.
    const createdAt = "2026-07-29T05:00:00.000Z";
    const d = new Date(createdAt);
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

    expect(
      buildAnalysisResultVars(
        { name: "홍길동", school: "안산고", grade: "고1", created_at: createdAt },
        "tok-5",
      ),
    ).toEqual({
      이름: "홍길동",
      학교: "안산고 고1",
      검사일: `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}(${dayName})`,
      토큰: "tok-5",
    });
  });

  it("학교·학년이 없으면 대시로 채운다", () => {
    const vars = buildAnalysisResultVars(
      { name: "홍길동", school: null, grade: null, created_at: "2026-07-29T05:00:00.000Z" },
      "tok-6",
    );
    expect(vars.학교).toBe("-");
  });
});
