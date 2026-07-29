"use server";

import { createClient } from "@/lib/supabase/server";
import { callGeminiAPI, extractJSON, surveyToText, buildAnalysisPrompt } from "@/lib/gemini";
import { buildAnalysisReportHTML } from "@/lib/claude";
import { analyzeSurveyV2 } from "@/lib/actions/analysis-v2";
import { stampConsultationAnalysis } from "@/lib/actions/consultation-analysis";
import { calculateFactors } from "@/lib/factors";
import type { Analysis, Survey, PaginatedResponse } from "@/types";
import { revalidatePath } from "next/cache";

// ========== Gemini 분석 결과 타입 ==========
// 점수는 서버(factors.ts)가 계산한다. AI 응답의 숫자는 저장하지 않는다.
interface GeminiAnalysisResult {
  studentType: string;
  scoreComments: {
    attitude: string;
    selfDirected: string;
    assignment: string;
    willingness: string;
    social: string;
    management: string;
    emotion: string;
  };
  summary: string;
  strengths: { title: string; description: string }[];
  weaknesses: { title: string; description: string }[];
  paradox: Record<string, unknown>[];
  solutions: { step: number; weeks: string; goal: string; actions: string[] }[];
  finalAssessment: string;
}

// ========== 분석 목록 조회 ==========
export async function getAnalyses(
  filters: { search?: string; page?: number; limit?: number } = {}
): Promise<PaginatedResponse<Analysis>> {
  const supabase = await createClient();
  const { page = 1, limit = 20, search } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("analyses")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("분석 목록 조회 실패:", error.message);
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  const total = count ?? 0;

  return {
    data: (data as Analysis[]) ?? [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ========== 분석 단건 조회 ==========
export async function getAnalysis(id: string): Promise<Analysis | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return data as Analysis;
}

// analyzeSurvey/reAnalyzeSurvey의 공용 반환 타입.
// 기존 V1 추론 유니온과 동일하게 성공 분기에 error?: undefined를 명시한다
// (이게 없으면 호출부 else 분기의 result.error 접근이 타입 에러가 난다).
// analyzeSurveyV2의 추론 반환형은 success가 boolean으로 넓혀져 있어 가드에서 as로 좁혀 반환한다.
type AnalyzeSurveyResult =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { success: true; data: any; source?: "ai" | "fallback"; warning?: string; error?: undefined }
  | { success: false; error: string };

// ========== 설문 → AI 분석 실행 ==========
export async function analyzeSurvey(surveyId: string): Promise<AnalyzeSurveyResult> {
  const supabase = await createClient();

  // 1. 설문 데이터 조회
  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    return { success: false, error: "설문 데이터를 찾을 수 없습니다" };
  }

  const surveyData = survey as Survey;

  // V2 설문은 V1 분석 로직(q1~35 기반)을 절대 실행하지 않는다.
  // 배포 전 열려 있던 stale 클라이언트가 V1 액션을 호출해도 서버에서 V2 해석으로 위임한다
  // (강현찬 사고 재발 방지). instrument_version은 위에서 select("*")로 이미 조회됨.
  if (surveyData.instrument_version === "v2") {
    // analyzeSurveyV2의 추론 반환형은 success가 boolean으로 넓혀져 있어 그대로는 대입되지 않는다.
    // 런타임 형태는 {success, data/error} 계약과 동일하므로 명시적으로 좁혀 반환한다.
    return analyzeSurveyV2(surveyId) as Promise<AnalyzeSurveyResult>;
  }

  // 2. 설문 텍스트 변환 + 프롬프트 생성
  // 점수는 서버가 계산해 프롬프트에 주입하고, 저장도 이 값으로 한다(AI 점수 창작 차단).
  const serverScores = calculateFactors(
    surveyData as unknown as Record<string, number | undefined | null>,
  );
  const surveyText = surveyToText(surveyData);
  const prompt = buildAnalysisPrompt(surveyText, serverScores);

  // 3. Gemini API 호출
  let analysisResult: GeminiAnalysisResult;
  try {
    const response = await callGeminiAPI(prompt);
    analysisResult = extractJSON<GeminiAnalysisResult>(response);
  } catch (e) {
    // TODO: Sentry 등 외부 로깅 서비스로 교체 가능
    console.error("[Gemini API] 설문 분석 실패:", { surveyId, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "AI 분석 실패";
    return { success: false, error: msg };
  }

  // 4. 분석 결과 저장
  const insertData = {
    survey_id: surveyId,
    name: surveyData.name,
    school: surveyData.school,
    grade: surveyData.grade,
    score_attitude: serverScores.factor_attitude,
    score_self_directed: serverScores.factor_self_directed,
    score_assignment: serverScores.factor_assignment,
    score_willingness: serverScores.factor_willingness,
    score_social: serverScores.factor_social,
    score_management: serverScores.factor_management,
    score_emotion: serverScores.factor_emotion,
    comment_attitude: analysisResult.scoreComments.attitude,
    comment_self_directed: analysisResult.scoreComments.selfDirected,
    comment_assignment: analysisResult.scoreComments.assignment,
    comment_willingness: analysisResult.scoreComments.willingness,
    comment_social: analysisResult.scoreComments.social,
    comment_management: analysisResult.scoreComments.management,
    comment_emotion: analysisResult.scoreComments.emotion,
    student_type: analysisResult.studentType,
    summary: analysisResult.summary,
    strengths: analysisResult.strengths,
    weaknesses: analysisResult.weaknesses,
    paradox: analysisResult.paradox,
    solutions: analysisResult.solutions,
    final_assessment: analysisResult.finalAssessment,
    report_html: null as string | null,
  };

  // 4-b. 보고서 HTML 생성
  const tempAnalysis = {
    ...insertData,
    id: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    report_html: null,
  } as Analysis;

  try {
    insertData.report_html = buildAnalysisReportHTML(tempAnalysis);
  } catch (e) {
    console.error("[Report] HTML 생성 실패:", e instanceof Error ? e.message : e);
  }

  // survey_id upsert로 설문당 분석 1건을 원천 보장 (unique 인덱스 전제).
  // 재분석 시 같은 행이 갱신되어 id가 보존됨 → registrations/surveys 링크 유지.
  const { data: analysis, error: insertError } = await supabase
    .from("analyses")
    .upsert(insertData, { onConflict: "survey_id" })
    .select()
    .single();

  if (insertError) {
    console.error("[DB] 분석 결과 저장 실패:", { surveyId, error: insertError.message });
    return { success: false, error: insertError.message };
  }

  // 5. 설문에 analysis_id 연결
  const { error: linkError } = await supabase
    .from("surveys")
    .update({ analysis_id: analysis.id })
    .eq("id", surveyId);

  try {
    await stampConsultationAnalysis(supabase, surveyData, analysis.id);
  } catch (error) {
    console.warn("[분석] 상담 analysis_id 연결 실패:", {
      surveyId,
      error: error instanceof Error ? error.message : error,
    });
  }

  if (linkError) {
    console.error("설문-분석 연결 실패:", linkError.message);
    revalidatePath("/analyses");
    revalidatePath("/surveys");
    return { success: true, data: analysis, warning: "분석은 생성되었으나 설문 연결에 실패했습니다." };
  }

  revalidatePath("/analyses");
  revalidatePath("/surveys");
  return { success: true, data: analysis };
}

// ========== 보고서 HTML 재생성 ==========
export async function regenerateAnalysisReport(id: string) {
  const supabase = await createClient();

  const { data: analysis, error: fetchErr } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !analysis) {
    return { success: false, error: "분석 데이터를 찾을 수 없습니다" };
  }

  try {
    const reportHtml = buildAnalysisReportHTML(analysis as Analysis);
    const { error: updateErr } = await supabase
      .from("analyses")
      .update({ report_html: reportHtml })
      .eq("id", id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath(`/analyses/${id}`);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "보고서 재생성 실패";
    return { success: false, error: msg };
  }
}

// ========== 재분석 ==========
// analyzeSurvey가 survey_id upsert로 중복을 원천 차단하므로, 재분석은 동일 호출로 충분하다.
// (기존 "옛 분석 조회→새 분석→삭제" 로직 불필요) export 시그니처는 클라이언트 호환을 위해 유지.
export async function reAnalyzeSurvey(surveyId: string): Promise<AnalyzeSurveyResult> {
  return analyzeSurvey(surveyId);
}

// ========== 분석 삭제 ==========
export async function deleteAnalysis(id: string) {
  const supabase = await createClient();

  // 연결된 설문의 analysis_id 초기화
  await supabase
    .from("surveys")
    .update({ analysis_id: null })
    .eq("analysis_id", id);

  const { error } = await supabase.from("analyses").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/analyses");
  revalidatePath("/surveys");
  revalidatePath("/registrations");
  revalidatePath("/onboarding");
  return { success: true };
}
