import { describe, it, expect } from "vitest";
import {
  STUDENT_TOKEN,
  studentLabel,
  applyStudentName,
  applyStudentNameToInterpretation,
} from "../name-substitution";
import type { AiInterpretation } from "../ai-contract";

describe("studentLabel", () => {
  it("이름이 있으면 'OO 학생', 없으면 '학생'", () => {
    expect(studentLabel("강현찬")).toBe("강현찬 학생");
    expect(studentLabel("  강현찬  ")).toBe("강현찬 학생");
    expect(studentLabel("")).toBe("학생");
    expect(studentLabel(null)).toBe("학생");
    expect(studentLabel(undefined)).toBe("학생");
  });
});

describe("applyStudentName — 토큰 치환", () => {
  it("{{학생}} 토큰을 실제 이름으로 바꾼다", () => {
    expect(applyStudentName(`${STUDENT_TOKEN}이 잘합니다.`, "강현찬")).toBe("강현찬 학생이 잘합니다.");
    expect(applyStudentName(`${STUDENT_TOKEN}은 성실해요.`, "이서준")).toBe("이서준 학생은 성실해요.");
  });
  it("이름이 없으면 토큰을 '학생'으로 바꾼다", () => {
    expect(applyStudentName(`${STUDENT_TOKEN}이 잘합니다.`, "")).toBe("학생이 잘합니다.");
  });
  it("여러 번 나와도 모두 치환한다", () => {
    expect(applyStudentName(`${STUDENT_TOKEN}과 ${STUDENT_TOKEN}의 목표`, "김민")).toBe(
      "김민 학생과 김민 학생의 목표"
    );
  });
});

describe("applyStudentName — 따님/아드님/자녀 교정", () => {
  it("따님/아드님은 조사 그대로 명사만 교체", () => {
    expect(applyStudentName("따님은 침착해요.", "박지우")).toBe("박지우 학생은 침착해요.");
    expect(applyStudentName("아드님이 노력해요.", "박지우")).toBe("박지우 학생이 노력해요.");
  });
  it("자녀분·자제분도 교체", () => {
    expect(applyStudentName("자녀분은 밝아요.", "최유")).toBe("최유 학생은 밝아요.");
    expect(applyStudentName("자제분이 성실해요.", "최유")).toBe("최유 학생이 성실해요.");
  });
});

describe("applyStudentName — '아이/자녀' + 조사 교정(모음→자음 조사)", () => {
  it("주격/주제/목적/공동 조사를 학생에 맞게 바꾼다", () => {
    expect(applyStudentName("아이가 집중해요.", "한결")).toBe("한결 학생이 집중해요.");
    expect(applyStudentName("아이는 밝아요.", "한결")).toBe("한결 학생은 밝아요.");
    expect(applyStudentName("아이를 도와요.", "한결")).toBe("한결 학생을 도와요.");
    expect(applyStudentName("아이와 함께", "한결")).toBe("한결 학생과 함께");
    expect(applyStudentName("자녀가 잘해요.", "한결")).toBe("한결 학생이 잘해요.");
  });
  it("형태가 같은 조사(의·도·에게)는 유지", () => {
    expect(applyStudentName("아이의 강점", "한결")).toBe("한결 학생의 강점");
    expect(applyStudentName("아이도 노력해요.", "한결")).toBe("한결 학생도 노력해요.");
    expect(applyStudentName("아이에게 필요해요.", "한결")).toBe("한결 학생에게 필요해요.");
  });
  it("조사 없이 단독으로 쓰인 경우도 교정", () => {
    expect(applyStudentName("우리 아이.", "한결")).toBe("우리 한결 학생.");
  });
});

describe("applyStudentName — 오탐 방지", () => {
  it("'아이'로 시작하는 합성어는 건드리지 않는다", () => {
    for (const w of ["아이디어", "아이돌", "아이콘", "아이템", "아이패드", "아이폰", "아이스크림"]) {
      expect(applyStudentName(`좋은 ${w} 입니다.`, "한결")).toBe(`좋은 ${w} 입니다.`);
    }
  });
  it("앞에 한글이 붙은 합성어(어린아이)는 건드리지 않는다", () => {
    expect(applyStudentName("어린아이처럼", "한결")).toBe("어린아이처럼");
  });
  it("이름에 '아이'가 들어가도 재치환하지 않는다(멱등)", () => {
    const once = applyStudentName(`${STUDENT_TOKEN}이 잘해요.`, "아이유");
    expect(once).toBe("아이유 학생이 잘해요.");
    // 이미 치환된 문자열을 다시 넣어도 그대로여야 한다.
    expect(applyStudentName(once, "아이유")).toBe("아이유 학생이 잘해요.");
  });
  it("일반 '학생' 표현은 건드리지 않는다", () => {
    expect(applyStudentName("학생이 직접 쓴 응답", "한결")).toBe("학생이 직접 쓴 응답");
  });
});

function fakeInterpretation(): AiInterpretation {
  return {
    studentType: `${STUDENT_TOKEN} 유형`,
    detailedSummary: "아이가 집중해요.",
    coreObservation: "따님은 침착해요.",
    operatingCause: "원인",
    recommendedCoaching: "지도",
    verificationPlan14Days: ["아이의 시작 시각 확인"],
    teacherBrief: ["브리핑"],
    strengths: ["아이는 성실해요."],
    growthAreas: ["아이를 도와요."],
    crossEvidence: [],
    nkFitInterpretation: "적합",
    mathStrategy: "아이와 함께 오답 정리",
    englishStrategy: null,
    roadmap12Weeks: [{ weeks: "1~4주", focus: "아이가 시작", actions: ["따님이 확인"] }],
    parentSummary: `${STUDENT_TOKEN}이 잘해요.`,
    cautions: [],
  };
}

describe("applyStudentNameToInterpretation", () => {
  it("모든 텍스트 필드에 치환을 적용하고 null 전략은 유지한다", () => {
    const out = applyStudentNameToInterpretation(fakeInterpretation(), "강현찬");
    expect(out.studentType).toBe("강현찬 학생 유형");
    expect(out.detailedSummary).toBe("강현찬 학생이 집중해요.");
    expect(out.coreObservation).toBe("강현찬 학생은 침착해요.");
    expect(out.verificationPlan14Days[0]).toBe("강현찬 학생의 시작 시각 확인");
    expect(out.strengths[0]).toBe("강현찬 학생은 성실해요.");
    expect(out.growthAreas[0]).toBe("강현찬 학생을 도와요.");
    expect(out.mathStrategy).toBe("강현찬 학생과 함께 오답 정리");
    expect(out.englishStrategy).toBeNull();
    expect(out.roadmap12Weeks[0].focus).toBe("강현찬 학생이 시작");
    expect(out.roadmap12Weeks[0].actions[0]).toBe("강현찬 학생이 확인");
    expect(out.parentSummary).toBe("강현찬 학생이 잘해요.");
  });

  it("치환은 멱등이다(두 번 적용해도 동일)", () => {
    const once = applyStudentNameToInterpretation(fakeInterpretation(), "강현찬");
    const twice = applyStudentNameToInterpretation(once, "강현찬");
    expect(twice).toEqual(once);
  });

  it("어떤 필드에도 원본 호칭·토큰이 남지 않는다", () => {
    const out = applyStudentNameToInterpretation(fakeInterpretation(), "강현찬");
    const json = JSON.stringify(out);
    expect(json).not.toContain(STUDENT_TOKEN);
    expect(json).not.toContain("따님");
    expect(json).not.toContain("아드님");
    // '아이가/아이는/아이를/아이와' 같은 학생 지칭 표현이 남지 않는다.
    expect(json).not.toMatch(/(?<![가-힣])아이(가|는|를|와)(?![가-힣])/);
  });
});
