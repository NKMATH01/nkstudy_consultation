"use server";

// V2 해석 전용 분석 액션 (§11).
// 흐름: 서버 점수(score_profile_v2)는 이미 계산됨 → AI-safe serialize → Gemini 해석 호출
//       → Zod 검증 → 실패/거부 시 규칙 기반 fallback → result_profile_v2 저장 → surveys 연결.
// AI는 숫자를 만들지 않는다. 순수 함수(직렬화·검증·fallback)는 __tests__에서 단위 검증한다.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callGeminiAPI, extractJSON } from "@/lib/gemini";
import {
  buildAiSafeInput,
  buildV2AnalysisPrompt,
  type IntakeV2,
} from "@/lib/assessment/v2/serializer";
import { validateAiInterpretation } from "@/lib/assessment/v2/ai-contract";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
} from "@/lib/assessment/v2/interpretation";
import { applyStudentNameToInterpretation } from "@/lib/assessment/v2/name-substitution";
import { stampConsultationAnalysis } from "@/lib/actions/consultation-analysis";
import type { AiInterpretation } from "@/lib/assessment/v2/ai-contract";
import type { ScoreProfile } from "@/lib/assessment/v2/types";

interface SurveyV2Row {
  id: string;
  name: string | null;
  school: string | null;
  grade: string | null;
  parent_phone: string | null;
  instrument_version: string | null;
  subject_selection: string | null;
  intake_v2: IntakeV2 | null;
  responses_v2: Record<string, unknown> | null;
  score_profile_v2: ScoreProfile | null;
}

/**
 * AI 해석을 시도하고, 실패/거부 시 규칙 기반 fallback을 반환한다.
 * 이름 등 식별정보는 AI 응답을 받은 뒤 서버에서만 합성하며 AI에는 전송하지 않는다.
 */
async function interpretWithAiOrFallback(
  scoreProfile: ScoreProfile,
  intake: IntakeV2 | null,
  responses: Record<string, unknown> | null,
  surveyId: string
): Promise<{ interpretation: AiInterpretation; source: "ai" | "fallback" }> {
  const aiInput = buildAiSafeInput({ scoreProfile, intake, responses });
  const prompt = buildV2AnalysisPrompt(aiInput);

  try {
    const response = await callGeminiAPI(prompt);
    const raw = extractJSON<unknown>(response);
    const result = validateAiInterpretation(raw, scoreProfile.subjectSelection);
    if (result.ok) {
      return { interpretation: result.data, source: "ai" };
    }
    // 서버 로그에는 사유만 남기고 원문/서술은 남기지 않는다.
    console.error("[V2 분석] AI 출력 거부 → fallback:", {
      surveyId,
      reason: result.reason,
    });
  } catch (e) {
    console.error("[V2 분석] AI 호출 실패 → fallback:", {
      surveyId,
      error: e instanceof Error ? e.message : "unknown",
    });
  }

  return {
    interpretation: buildFallbackInterpretation(scoreProfile),
    source: "fallback",
  };
}

/**
 * 설문 V2 → 해석 분석 실행.
 * score_profile_v2가 이미 있어야 하며(제출 시 서버 계산), 이 액션은 해석만 붙인다.
 */
export async function analyzeSurveyV2(surveyId: string) {
  const supabase = await createClient();

  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select(
      "id, name, school, grade, parent_phone, instrument_version, subject_selection, intake_v2, responses_v2, score_profile_v2"
    )
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    return { success: false, error: "설문 데이터를 찾을 수 없습니다" };
  }

  const row = survey as SurveyV2Row;

  if (row.instrument_version !== "v2") {
    return {
      success: false,
      error: "V2 설문이 아닙니다 (instrument_version이 v2가 아님)",
    };
  }

  const scoreProfile = row.score_profile_v2;
  if (!scoreProfile || typeof scoreProfile !== "object") {
    return {
      success: false,
      error: "score_profile_v2가 없습니다 (제출 시 서버 점수 계산 필요)",
    };
  }

  const { interpretation: rawInterpretation, source } = await interpretWithAiOrFallback(
    scoreProfile,
    row.intake_v2,
    row.responses_v2,
    surveyId
  );

  // 이름은 서버 로컬로만 합성(analyses.name NOT NULL). AI에는 전송하지 않았다.
  const name = row.intake_v2?.name ?? row.name ?? "(이름 미상)";

  // AI/fallback 해석의 "{{학생}}" 토큰을 실제 이름(예: 강현찬 학생)으로 치환하고,
  // AI가 지시를 어겨 쓴 따님/아드님/아이/자녀도 교정한다. 저장 전에 수행해 화면·PDF·공유 모두 일관.
  const interpretation = applyStudentNameToInterpretation(rawInterpretation, name);

  const resultProfile = buildResultProfileV2({
    scoreProfile,
    interpretation,
    source,
  });

  const insertData = {
    survey_id: surveyId,
    name,
    school: row.school,
    grade: row.grade,
    analysis_version: "v2",
    result_profile_v2: resultProfile,
    response_quality_v2: scoreProfile.responseQuality,
    student_type: interpretation.studentType,
    summary: interpretation.detailedSummary,
    // V1→V2 전환(upsert) 시 예전 V1 결과지 HTML 잔존물을 제거해 어떤 경로로도 열리지 않게 한다.
    report_html: null as string | null,
  };

  // 82db691 패턴: survey_id upsert로 설문당 분석 1건 보장(unique 인덱스 전제).
  const { data: analysis, error: insertError } = await supabase
    .from("analyses")
    .upsert(insertData, { onConflict: "survey_id" })
    .select()
    .single();

  if (insertError) {
    console.error("[V2 분석] 저장 실패:", {
      surveyId,
      error: insertError.message,
    });
    return { success: false, error: insertError.message };
  }

  const { error: linkError } = await supabase
    .from("surveys")
    .update({ analysis_id: analysis.id })
    .eq("id", surveyId);

  try {
    await stampConsultationAnalysis(
      supabase,
      { name, parent_phone: row.parent_phone },
      analysis.id,
    );
  } catch (error) {
    console.warn("[V2 분석] 상담 analysis_id 연결 실패:", {
      surveyId,
      error: error instanceof Error ? error.message : error,
    });
  }

  revalidatePath("/analyses");
  revalidatePath("/surveys");

  if (linkError) {
    console.error("[V2 분석] 설문-분석 연결 실패:", linkError.message);
    return {
      success: true,
      data: analysis,
      source,
      warning: "분석은 생성되었으나 설문 연결에 실패했습니다.",
    };
  }

  return { success: true, data: analysis, source };
}
