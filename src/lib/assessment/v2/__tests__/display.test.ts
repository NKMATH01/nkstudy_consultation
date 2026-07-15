import { describe, expect, it } from "vitest";
import { getItemsForSubject } from "../definition";
import {
  buildSurveyV2DisplayData,
  buildV2IntakeSections,
  formatLikertResponseV2,
  getSurveyManagementFactorScores,
  getV2CoreMetrics,
  surveyV2ToText,
} from "../display";

const baseSurvey = {
  name: "테스트학생",
  school: "테스트중",
  grade: "중2",
  student_phone: "010-1111-2222",
  parent_phone: "010-3333-4444",
  subject_selection: "both" as const,
  intake_v2: {
    subject_selection: "both" as const,
    prev_academy: "이전학원",
    prev_academy_duration: "1년",
    prev_leave_reason: "개별 관리 필요",
    nk_expectations: ["철저한 숙제 관리", "주간 테스트·재보완"],
    preferred_days: "주말 집중",
    clinic_condition: "요일·시간이 맞으면 가능",
    math_difficulty: "도형",
    english_difficulty: "독해",
    mbti: "ISTJ",
    mbti_confidence: "high" as const,
    commitment14: "매일 오답 한 문제를 다시 풀기",
  },
  responses_v2: {
    responses: { LT1: 4, N1: "unknown" as const },
    scenarios: { C1: 3 },
    supplements: { phone_weekday: "1~2시간" },
  },
};

describe("설문 V2 표시 어댑터", () => {
  it("현재 typed definition의 과목별 전체 문항을 그대로 사용한다", () => {
    const data = buildSurveyV2DisplayData(baseSurvey);

    expect(data.subjectLabel).toBe("수학+영어");
    expect(data.questionCount).toBe(getItemsForSubject("both").length);
    expect(data.questionGroups.map((group) => group.subject)).toEqual([
      "common",
      "math",
      "english",
    ]);
    expect(data.answeredCount).toBe(3);
  });

  it("척도 문구·상황 선택지·보조 입력을 학생 설문과 같은 문구로 복원한다", () => {
    const data = buildSurveyV2DisplayData(baseSurvey);
    const questions = data.questionGroups.flatMap((group) => group.questions);

    expect(questions.find((question) => question.id === "LT1")?.answer).toBe("4점 · 자주");
    expect(questions.find((question) => question.id === "N1")?.answer).toBe("아직 잘 모르겠음");
    expect(questions.find((question) => question.id === "C1")?.answer).toContain(
      "휴대폰을 치우고 오답 1개의 원인부터 적는다."
    );
    expect(questions.find((question) => question.id === "P4")?.supplements).toContainEqual({
      id: "phone_weekday",
      label: "평일 오락용 사용시간",
      value: "1~2시간",
    });
  });

  it("V2 사전정보의 새 필드를 빠뜨리지 않고 과목에 맞게 표시한다", () => {
    const sections = buildV2IntakeSections(baseSurvey);
    const values = Object.fromEntries(
      sections.flatMap((section) => section.fields.map((item) => [item.key, item.value]))
    );

    expect(values.prev_academy_duration).toBe("1년");
    expect(values.prev_leave_reason).toBe("개별 관리 필요");
    expect(values.nk_expectations).toBe("철저한 숙제 관리, 주간 테스트·재보완");
    expect(values.preferred_days).toBe("주말 집중");
    expect(values.math_difficulty).toBe("도형");
    expect(values.english_difficulty).toBe("독해");
    expect(values.mbti_confidence).toBe("높음");
    expect(values.commitment14).toBe("매일 오답 한 문제를 다시 풀기");
  });

  it("등록안내용 텍스트에 V1 35문항/7-Factor를 섞지 않는다", () => {
    const text = surveyV2ToText(baseSurvey);

    expect(text).toContain("설문 버전: V2 학습 프로필");
    expect(text).toContain("최신 V2 문항 응답");
    expect(text).toContain("첫 14일 실천 약속");
    expect(text).not.toContain("7-Factor");
    expect(text).not.toContain("=== 설문 응답 (1-5점) ===");
  });

  it("V2 핵심 점수는 0~100 서버 점수를 그대로 읽는다", () => {
    const metrics = getV2CoreMetrics({
      common: {
        learningAttitude: 75,
        homeworkReliability: 62.5,
        longTermPersistence: 50,
        shortTermRecovery: 87.5,
        phoneBoundary: 25,
        conscientiousness: 64,
      },
    });

    expect(metrics.map((metric) => [metric.label, metric.score])).toEqual([
      ["학습 태도", 75],
      ["숙제 신뢰도", 62.5],
      ["장기 의지", 50],
      ["단기 회복력", 87.5],
      ["휴대폰 자기조절", 25],
      ["학습 성실성", 64],
    ]);
  });

  it("설문 관리의 태도·자주·과제·의지·사회·관리 열에 V2 서버 원점수를 연결한다", () => {
    const scores = getSurveyManagementFactorScores({
      instrument_version: "v2",
      score_profile_v2: {
        common: {
          learningAttitude: 75,
          conscientiousness: 64,
          homeworkReliability: 62.5,
          longTermPersistence: 50,
          peerLearningResource: 81.25,
          structureNeed: 87.5,
        },
      },
    });

    expect(scores.map(({ label, value, scale }) => [label, value, scale])).toEqual([
      ["태도", 75, 100],
      ["자주", 64, 100],
      ["과제", 62.5, 100],
      ["의지", 50, 100],
      ["사회", 81.25, 100],
      ["관리", 87.5, 100],
    ]);
  });

  it("V1 설문 관리 점수는 기존 1~5 factor 값을 그대로 유지한다", () => {
    const scores = getSurveyManagementFactorScores({
      instrument_version: "v1",
      factor_attitude: 4.2,
      factor_self_directed: 3.8,
      factor_assignment: 4.4,
      factor_willingness: 4,
      factor_social: 3.5,
      factor_management: 4.5,
    });

    expect(scores.map(({ value, scale }) => [value, scale])).toEqual([
      [4.2, 5],
      [3.8, 5],
      [4.4, 5],
      [4, 5],
      [3.5, 5],
      [4.5, 5],
    ]);
  });

  it("잘못된 척도 응답은 점수를 꾸며내지 않고 미응답 처리한다", () => {
    const item = getItemsForSubject("math").find((candidate) => candidate.id === "LT1");
    if (!item || item.kind !== "likert") throw new Error("LT1 fixture missing");

    expect(formatLikertResponseV2(item, 6)).toBeNull();
    expect(formatLikertResponseV2(item, "unknown")).toBeNull();
  });
});
