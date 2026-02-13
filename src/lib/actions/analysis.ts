"use server";

import { createClient } from "@/lib/supabase/server";
import { callGeminiAPI, extractJSON, surveyToText, buildAnalysisPrompt } from "@/lib/gemini";
import { buildAnalysisReportHTML } from "@/lib/claude";
import type { Analysis, Survey, PaginatedResponse } from "@/types";
import { revalidatePath } from "next/cache";

// ========== Gemini 분석 결과 타입 ==========
interface GeminiAnalysisResult {
  studentType: string;
  scores: {
    attitude: number;
    selfDirected: number;
    assignment: number;
    willingness: number;
    social: number;
    management: number;
  };
  scoreComments: {
    attitude: string;
    selfDirected: string;
    assignment: string;
    willingness: string;
    social: string;
    management: string;
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

// ========== 설문 → AI 분석 실행 ==========
export async function analyzeSurvey(surveyId: string) {
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

  // 2. 설문 텍스트 변환 + 프롬프트 생성
  const surveyText = surveyToText(surveyData);
  const prompt = buildAnalysisPrompt(surveyText);

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
    score_attitude: analysisResult.scores.attitude,
    score_self_directed: analysisResult.scores.selfDirected,
    score_assignment: analysisResult.scores.assignment,
    score_willingness: analysisResult.scores.willingness,
    score_social: analysisResult.scores.social,
    score_management: analysisResult.scores.management,
    comment_attitude: analysisResult.scoreComments.attitude,
    comment_self_directed: analysisResult.scoreComments.selfDirected,
    comment_assignment: analysisResult.scoreComments.assignment,
    comment_willingness: analysisResult.scoreComments.willingness,
    comment_social: analysisResult.scoreComments.social,
    comment_management: analysisResult.scoreComments.management,
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

  const { data: analysis, error: insertError } = await supabase
    .from("analyses")
    .insert(insertData)
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

  if (linkError) {
    // 분석은 성공했지만 설문 연결 실패 - 로깅 후 경고 반환
    console.error("설문-분석 연결 실패:", linkError.message);
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
  return { success: true };
}
