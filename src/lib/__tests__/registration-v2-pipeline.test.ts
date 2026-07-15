import { describe, expect, it } from "vitest";
import type { Analysis } from "@/types";
import { ALL_ITEMS, isLikert } from "@/lib/assessment/v2/definition";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
} from "@/lib/assessment/v2/interpretation";
import type { ResponseMap } from "@/lib/assessment/v2/types";
import {
  buildRegistrationPrompt,
  buildReportHTML,
  normalizeRegistrationReportData,
  type RegistrationAdminData,
  type ReportTemplateData,
} from "@/lib/claude";

function makeAnalysis(): Analysis {
  const responses: ResponseMap = {};
  ALL_ITEMS.filter(isLikert).forEach((item, index) => {
    responses[item.id] = (index % 5) + 1;
  });
  const scores = computeScoreProfile({
    subjectSelection: "both",
    responses,
    scenarioResponses: { C1: 3, C2: 2, MS1: 4, MS2: 3, ES1: 3, ES2: 4 },
    clinicAvailability: 75,
  });
  const result = buildResultProfileV2({
    scoreProfile: scores,
    interpretation: buildFallbackInterpretation(scores),
    source: "fallback",
  });
  return {
    analysis_version: "v2",
    result_profile_v2: result,
    name: "테스트학생",
    school: "테스트중",
    grade: "중2",
    student_type: result.interpretation.studentType,
    summary: result.interpretation.detailedSummary,
  } as Analysis;
}

const adminData: RegistrationAdminData = {
  registrationDate: "2026-07-20",
  assignedClass: "중2-M1",
  teacher: "김선생",
  assignedClass2: "중2-E1",
  teacher2: "이선생",
  subject: "영어수학",
  preferredDays: "주말 집중",
  useVehicle: "미사용",
  testScore: "80",
  testNote: "",
  location: "1",
  consultDate: "2026-07-18",
  additionalNote: "",
  tuitionFee: 350000,
};

describe("V2 등록안내 연동", () => {
  it("V2 프롬프트는 과거 문항 번호 분석법 대신 0~100 서버 점수 계약을 사용한다", () => {
    const prompt = buildRegistrationPrompt("최신 V2 설문 원문", makeAnalysis(), adminData);

    expect(prompt).toContain("최신 V2 학습 프로필 대상");
    expect(prompt).toContain("서버 계산 0~100 점수");
    expect(prompt).toContain("첫 14일");
    expect(prompt).not.toContain("1~5번(성격)");
    expect(prompt).not.toContain("18~19번(탐구력)");
  });

  it("AI가 조작한 숫자를 버리고 result_profile_v2의 서버 점수로 복원한다", () => {
    const analysis = makeAnalysis();
    const normalized = normalizeRegistrationReportData(
      {
        page1: {
          profileSummary: "요약",
          sixFactorScores: [
            { factor: "학습 태도", score: 999, grade: "천재", insight: "맞춤 인사이트" },
          ],
          managementGuide: [],
        },
        page2: {},
      },
      analysis
    );
    const page1 = normalized.page1 as ReportTemplateData["page1"];
    const serverScore = analysis.result_profile_v2!.scores.common.learningAttitude;
    const attitude = page1.sixFactorScores?.find((row) => row.factor === "학습 태도");

    expect(normalized.instrumentVersion).toBe("v2");
    expect(attitude?.score).toBe(serverScore);
    expect(attitude?.score).not.toBe(999);
    expect(attitude?.grade).not.toBe("천재");
    expect(attitude?.insight).toBe("맞춤 인사이트");
  });

  it("V2 등록 안내 HTML은 0~100 단위와 최신 제목을 표시한다", () => {
    const analysis = makeAnalysis();
    const report = normalizeRegistrationReportData(
      {
        page1: {
          profileSummary: "V2 요약",
          studentBackground: "배경",
          sixFactorScores: [],
          managementGuide: [],
        },
        page2: {
          welcomeTitle: "환영합니다",
          welcomeSubtitle: "함께 시작해요",
          expertDiagnosis: "첫 14일 동안 확인합니다.",
          focusPoints: [],
          academyRules: [],
        },
      },
      analysis
    );
    const html = buildReportHTML({
      profileVersion: "v2",
      name: "테스트학생",
      school: "테스트중",
      grade: "중2",
      studentPhone: "",
      parentPhone: "",
      registrationDate: "2026-07-20",
      assignedClass: "중2-M1",
      teacher: "김선생",
      subject: "수학",
      preferredDays: "주말 집중",
      useVehicle: "미사용",
      location: "1",
      tuitionFee: 350000,
      page1: report.page1 as ReportTemplateData["page1"],
      page2: report.page2 as ReportTemplateData["page2"],
    });

    expect(html).toContain("NK 학습 프로필 2.0 기반");
    expect(html).toContain("NK 학습 프로필 분석");
    expect(html).toContain("V2 핵심 학습 프로필 (0~100)");
    expect(html).not.toContain("7대 핵심 학습 성향</h3>");
  });
});
