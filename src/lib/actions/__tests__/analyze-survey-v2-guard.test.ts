import { describe, it, expect, vi, beforeEach } from "vitest";

// analyzeSurvey의 V2 서버 가드 검증.
// 목적: stale 클라이언트가 V2 설문에 대해 V1 analyzeSurvey를 호출해도
//       서버에서 V1 로직을 실행하지 않고 analyzeSurveyV2로 위임하는지 확인한다.
// 순수 단위 테스트를 위해 supabase/gemini/claude/analysis-v2/next-cache를 모두 mock한다.

// vi.mock 팩토리는 파일 최상단으로 hoist되므로 mock 함수도 vi.hoisted로 함께 끌어올린다.
const {
  analyzeSurveyV2Mock,
  callGeminiAPIMock,
  extractJSONMock,
  surveyToTextMock,
  buildAnalysisPromptMock,
  buildAnalysisReportHTMLMock,
} = vi.hoisted(() => ({
  analyzeSurveyV2Mock: vi.fn(),
  callGeminiAPIMock: vi.fn(),
  extractJSONMock: vi.fn(),
  surveyToTextMock: vi.fn(() => "text"),
  buildAnalysisPromptMock: vi.fn(() => "prompt"),
  buildAnalysisReportHTMLMock: vi.fn(() => "<html></html>"),
}));

// from(table)이 반환할 결과를 테스트별로 주입한다.
let surveyRow: Record<string, unknown> | null = null;

function makeBuilder(singleResult: unknown, awaitResult: unknown) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.upsert = chain;
  builder.update = chain;
  builder.single = () => Promise.resolve(singleResult);
  // .update(...).eq(...) 처럼 single 없이 await되는 경로 지원
  builder.then = (resolve: (v: unknown) => unknown) => resolve(awaitResult);
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table === "analyses") {
        return makeBuilder({ data: { id: "analysis-1" }, error: null }, { error: null });
      }
      // surveys: select→single은 surveyRow, update→eq await는 {error:null}
      return makeBuilder({ data: surveyRow, error: null }, { error: null });
    },
  })),
}));

vi.mock("@/lib/actions/analysis-v2", () => ({
  analyzeSurveyV2: analyzeSurveyV2Mock,
}));

vi.mock("@/lib/gemini", () => ({
  callGeminiAPI: callGeminiAPIMock,
  extractJSON: extractJSONMock,
  surveyToText: surveyToTextMock,
  buildAnalysisPrompt: buildAnalysisPromptMock,
}));

vi.mock("@/lib/claude", () => ({
  buildAnalysisReportHTML: buildAnalysisReportHTMLMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { analyzeSurvey, reAnalyzeSurvey } from "@/lib/actions/analysis";

function fullGeminiResult() {
  const scores = {
    attitude: 3,
    selfDirected: 3,
    assignment: 3,
    willingness: 3,
    social: 3,
    management: 3,
    emotion: 3,
  };
  const scoreComments = {
    attitude: "",
    selfDirected: "",
    assignment: "",
    willingness: "",
    social: "",
    management: "",
    emotion: "",
  };
  return {
    studentType: "T",
    scores,
    scoreComments,
    summary: "s",
    strengths: [],
    weaknesses: [],
    paradox: [],
    solutions: [],
    finalAssessment: "f",
  };
}

describe("analyzeSurvey V2 서버 가드", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    surveyToTextMock.mockReturnValue("text");
    buildAnalysisPromptMock.mockReturnValue("prompt");
    buildAnalysisReportHTMLMock.mockReturnValue("<html></html>");
  });

  it("instrument_version='v2'이면 V1 로직을 실행하지 않고 analyzeSurveyV2로 위임한다", async () => {
    surveyRow = { id: "s1", name: "강현찬", instrument_version: "v2" };
    analyzeSurveyV2Mock.mockResolvedValue({ success: true, data: { id: "v2-analysis" }, source: "ai" });

    const result = await analyzeSurvey("s1");

    expect(analyzeSurveyV2Mock).toHaveBeenCalledWith("s1");
    expect(result).toEqual({ success: true, data: { id: "v2-analysis" }, source: "ai" });
    // V1 분석 경로는 절대 실행되지 않아야 한다.
    expect(callGeminiAPIMock).not.toHaveBeenCalled();
  });

  it("reAnalyzeSurvey도 동일 가드를 상속한다(V2 위임)", async () => {
    surveyRow = { id: "s2", name: "강현찬", instrument_version: "v2" };
    analyzeSurveyV2Mock.mockResolvedValue({ success: true, data: { id: "v2-re" }, source: "fallback" });

    const result = await reAnalyzeSurvey("s2");

    expect(analyzeSurveyV2Mock).toHaveBeenCalledWith("s2");
    expect(result).toEqual({ success: true, data: { id: "v2-re" }, source: "fallback" });
    expect(callGeminiAPIMock).not.toHaveBeenCalled();
  });

  it("instrument_version이 null이면 V1 경로가 정상 실행되고 V2로 위임하지 않는다", async () => {
    surveyRow = { id: "s3", name: "홍길동", school: "OO중", grade: "1", instrument_version: null };
    callGeminiAPIMock.mockResolvedValue("raw");
    extractJSONMock.mockReturnValue(fullGeminiResult());

    const result = await analyzeSurvey("s3");

    expect(analyzeSurveyV2Mock).not.toHaveBeenCalled();
    expect(callGeminiAPIMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });
});
