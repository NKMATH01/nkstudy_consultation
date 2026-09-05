import { describe, expect, it } from "vitest";
import { INSTRUMENT_REVISION, MANAGEMENT_DIRECT_ID, getItemsForSubject } from "../definition";
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
    math_difficulty_tags: ["서술형·증명", "시간이 모자람"],
    mbti: "ISTJ",
    mbti_confidence: "high" as const,
    commitment14: "매일 오답 한 문제를 다시 풀기",
  },
  responses_v2: {
    instrument_revision: INSTRUMENT_REVISION,
    responses: { LA1: 4, HW4: "unknown" as const },
    scenarios: { [MANAGEMENT_DIRECT_ID]: 3 },
    supplements: {},
  },
};

describe("설문 V2 표시 어댑터", () => {
  it("현재 typed definition의 과목별 전체 문항을 그대로 사용한다", () => {
    const data = buildSurveyV2DisplayData(baseSurvey);
    expect(data.subjectLabel).toBe("수학+영어");
    expect(data.questionCount).toBe(getItemsForSubject("both").length);
    expect(data.questionGroups.map((group) => group.subject)).toEqual(["common", "math", "english"]);
    expect(data.answeredCount).toBe(3);
  });

  it("과거 리비전 응답을 최신 문항의 질문으로 바꾸어 표시하지 않는다", () => {
    const data = buildSurveyV2DisplayData({
      ...baseSurvey,
      responses_v2: { instrument_revision: "v2.2-learning-disposition-60", responses: { LT1: 4, N1: 5 }, scenarios: { C1: 3 } },
    });
    expect(data.isCurrentRevision).toBe(false);
    expect(data.questionGroups).toEqual([]);
    expect(data.answeredCount).toBe(3);
  });

  it("척도 문구·직접 질문 선택지를 학생 설문과 같은 문구로 복원한다", () => {
    const data = buildSurveyV2DisplayData(baseSurvey);
    const questions = data.questionGroups.flatMap((group) => group.questions);
    expect(questions.find((q) => q.id === "LA1")?.answer).toBe("4점 · 대부분 했다");
    expect(questions.find((q) => q.id === "HW4")?.answer).toBe("잘 모르겠음");
    expect(questions.find((q) => q.id === MANAGEMENT_DIRECT_ID)?.answer).toContain("잘 모르겠다");
  });

  it("V2 사전정보의 새 필드를 빠뜨리지 않고 과목에 맞게 표시한다", () => {
    const sections = buildV2IntakeSections(baseSurvey);
    const values = Object.fromEntries(
      sections.flatMap((section) => section.fields.map((item) => [item.key, item.value])),
    );
    expect(values.prev_academy_duration).toBe("1년");
    expect(values.nk_expectations).toBe("철저한 숙제 관리, 주간 테스트·재보완");
    expect(values.math_difficulty).toBe("도형");
    expect(values.math_difficulty_tags).toBe("서술형·증명, 시간이 모자람");
    expect(values.english_difficulty).toBe("독해");
    expect(values.mbti_confidence).toBe("높음");
    expect(values.commitment14).toBe("매일 오답 한 문제를 다시 풀기");
  });

  it("등록안내용 텍스트에 V1 35문항/7-Factor를 섞지 않는다", () => {
    const text = surveyV2ToText(baseSurvey);
    expect(text).toContain("설문 버전: V2 학습 프로필");
    expect(text).toContain("최신 V2 문항 응답");
    expect(text).toContain("입학 상담 우선 도움");
    expect(text).not.toContain("7-Factor");
  });

  it("V2 핵심 점수는 아홉 척도의 0~100 서버 점수를 그대로 읽는다", () => {
    const metrics = getV2CoreMetrics({
      common: {
        learningAttitude: 75,
        homeworkReliability: 62.5,
        goalClarity: 50,
        shortTermRecovery: 87.5,
        managementAcceptance: 70,
        coachingResponse: 68.75,
        questionInitiative: 50,
        phoneBoundary: 25,
        peerFocusBoundary: 58.3,
      },
    });
    expect(metrics.map((metric) => [metric.label, metric.score])).toEqual([
      ["학습 태도", 75],
      ["숙제 태도", 62.5],
      ["목표 의식", 50],
      ["단기 회복력", 87.5],
      ["관리 수용", 70],
      ["지도 방식 반응", 68.75],
      ["질문 성향", 50],
      ["공부 중 휴대폰 조절", 25],
      ["친구와 있을 때 조절", 58.3],
    ]);
  });

  it("설문 관리의 태도·자주·과제·의지·사회·관리 열에 V2 서버 원점수를 연결한다", () => {
    const scores = getSurveyManagementFactorScores({
      instrument_version: "v2",
      score_profile_v2: {
        common: {
          learningAttitude: 75,
          goalClarity: 64,
          homeworkReliability: 62.5,
          shortTermRecovery: 50,
          peerFocusBoundary: 81.25,
          managementAcceptance: 87.5,
        },
      },
    });
    expect(scores.map(({ label, value, scale, highIsRisk }) => [label, value, scale, highIsRisk])).toEqual([
      ["태도", 75, 100, false],
      ["자주", 64, 100, false],
      ["과제", 62.5, 100, false],
      ["의지", 50, 100, false],
      ["사회", 81.25, 100, false],
      ["관리", 87.5, 100, false],
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
      [4.2, 5], [3.8, 5], [4.4, 5], [4, 5], [3.5, 5], [4.5, 5],
    ]);
  });

  it("잘못된 척도 응답은 점수를 꾸며내지 않고 미응답 처리한다", () => {
    const item = getItemsForSubject("math").find((candidate) => candidate.id === "LA1");
    if (!item || item.kind !== "likert") throw new Error("LA1 fixture missing");
    expect(formatLikertResponseV2(item, 6)).toBeNull();
    expect(formatLikertResponseV2(item, "unknown")).toBeNull();

    const optionalItem = getItemsForSubject("math").find((candidate) => candidate.id === "HW4");
    if (!optionalItem || optionalItem.kind !== "likert") throw new Error("HW4 fixture missing");
    expect(formatLikertResponseV2(optionalItem, "not_applicable")).toBe("최근에는 해당 경험 없음");
  });
});
