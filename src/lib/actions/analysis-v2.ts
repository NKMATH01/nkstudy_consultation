"use server";

// V2 해석 전용 분석 액션 (§11).
// 흐름: 서버 점수(score_profile_v2)는 이미 계산됨 → AI-safe serialize → Gemini 해석 호출
//       → Zod 검증 → 실패/거부 시 규칙 기반 fallback → result_profile_v2 저장 → surveys 연결.
// AI는 숫자를 만들지 않는다. 순수 함수(직렬화·검증·fallback)는 __tests__에서 단위 검증한다.
//
// 학부모 질문지(parent_questionnaires): AI 호출 전에 설문↔상담을 강한 식별자(분석 ID 또는 학부모 번호)로
//   맞춘 상담들(재상담이면 여러 건 — 정상 흐름)의 질문지 중 답했고 회수되지 않은 것 가운데 가장 최근 답 1건을
//   참고 자료로 넣고, 표시용 사본을 result_profile_v2.parentAnswers 에 담는다.
//   이름만 맞거나 못 찾았거나 답이 없으면 넣지 않는다(예전과 똑같다). 답이 나중에 와도 자동 재분석하지 않는다 —
//   직원이 다시 분석을 눌러야 반영된다. v1 분석(analysis.ts)에는 반영하지 않는다.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callGeminiAPI, extractJSON } from "@/lib/gemini";
import {
  buildAiSafeInput,
  buildV2AnalysisPrompt,
  intakeFromStored,
} from "@/lib/assessment/v2/serializer";
import { validateAiInterpretation } from "@/lib/assessment/v2/ai-contract";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
} from "@/lib/assessment/v2/interpretation";
import { applyStudentNameToInterpretation } from "@/lib/assessment/v2/name-substitution";
import { INSTRUMENT_REVISION } from "@/lib/assessment/v2/definition";
import { stampConsultationAnalysis } from "@/lib/actions/consultation-analysis";
import {
  escapeLikePattern,
  selectSurveyConsultations,
  surveyConsultationMatchKind,
  type SurveyConsultationIdentityRecord,
} from "@/lib/student-identity";
import { buildParentAnswersSafe, type ParentAnswersSafe } from "@/lib/assessment/v2/parent-safe";
import type { AiInterpretation } from "@/lib/assessment/v2/ai-contract";
import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { ScoreProfile } from "@/lib/assessment/v2/types";

interface SurveyV2Row {
  id: string;
  name: string | null;
  school: string | null;
  grade: string | null;
  parent_phone: string | null;
  /** 재분석이면 이전 분석 ID. 상담 강한 매칭(analysis_id)에만 쓴다. */
  analysis_id: string | null;
  instrument_version: string | null;
  subject_selection: string | null;
  /** 저장 원본(snake_case JSONB). AI 입력으로 넘기기 전에 intakeFromStored로 옮긴다. */
  intake_v2: Record<string, unknown> | null;
  responses_v2: Record<string, unknown> | null;
  score_profile_v2: ScoreProfile | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 설문과 강하게 맞는 상담들의 학부모 질문지 답(답함·미회수 중 최신 1건). 없거나 조회가 실패하면 null —
 * 질문지는 참고 자료라 분석 자체를 막지 않는다. 답 원문은 로그에 남기지 않는다.
 */
async function loadParentAnswersForSurvey(
  supabase: SupabaseServerClient,
  survey: { id: string; name: string | null; parent_phone: string | null; analysis_id: string | null },
): Promise<ParentAnswersSafe | null> {
  const name = survey.name?.trim() ?? "";
  if (!name || (!survey.parent_phone && !survey.analysis_id)) return null;

  try {
    const { data: candidates, error: findError } = await supabase
      .from("consultations")
      .select("id, name, parent_phone, analysis_id")
      .ilike("name", `${escapeLikePattern(name)}%`)
      .limit(100);
    if (findError) throw new Error(findError.message);

    const records = (candidates ?? []) as SurveyConsultationIdentityRecord[];
    const identity = { name, parentPhone: survey.parent_phone, analysisId: survey.analysis_id };
    // 이름만으로 찾은 상담(동명이인 위험)은 쓰지 않는다.
    if (surveyConsultationMatchKind(records, identity) !== "strong") return null;
    const consultationIds = selectSurveyConsultations(records, identity).map((c) => c.id);
    if (consultationIds.length === 0) return null;

    const { data: row, error: pqError } = await supabase
      .from("parent_questionnaires")
      .select("answers")
      .in("consultation_id", consultationIds)
      .is("revoked_at", null)
      .not("answered_at", "is", null)
      .order("answered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pqError) throw new Error(pqError.message);

    return buildParentAnswersSafe(row?.answers) ?? null;
  } catch (e) {
    console.warn("[V2 분석] 학부모 질문지 조회 실패 → 질문지 없이 진행:", {
      surveyId: survey.id,
      error: e instanceof Error ? e.message : "unknown",
    });
    return null;
  }
}

/**
 * AI 해석을 시도하고, 실패/거부 시 규칙 기반 fallback을 반환한다.
 * 이름 등 식별정보는 AI 응답을 받은 뒤 서버에서만 합성하며 AI에는 전송하지 않는다.
 */
async function interpretWithAiOrFallback(
  scoreProfile: ScoreProfile,
  /** 저장 원본. 여기서 IntakeV2로 옮긴 뒤 AI 입력을 만든다. */
  storedIntake: Record<string, unknown> | null,
  identity: { name: string | null; school: string | null; grade: string | null },
  responses: Record<string, unknown> | null,
  surveyId: string,
  /** studentType 실명 혼입 검사에만 쓴다. AI에는 전송하지 않는다. */
  studentName: string | null,
  /** 학부모 질문지 답(있을 때만). serializer 가 allowlist·redaction 을 다시 거친다. */
  parentAnswers: ParentAnswersSafe | null = null,
): Promise<{ interpretation: AiInterpretation; source: "ai" | "fallback" }> {
  const aiInput = buildAiSafeInput({
    scoreProfile,
    intake: intakeFromStored(storedIntake, identity),
    responses,
    parentAnswers,
  });
  const prompt = buildV2AnalysisPrompt(aiInput);

  try {
    const response = await callGeminiAPI(prompt);
    const raw = extractJSON<unknown>(response);
    const result = validateAiInterpretation(
      raw,
      scoreProfile.subjectSelection,
      studentName,
    );
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
      "id, name, school, grade, parent_phone, analysis_id, instrument_version, subject_selection, intake_v2, responses_v2, score_profile_v2"
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

  const storedRevision =
    typeof row.responses_v2?.instrument_revision === "string"
      ? row.responses_v2.instrument_revision
      : scoreProfile.instrumentRevision;
  if (storedRevision !== INSTRUMENT_REVISION) {
    return {
      success: false,
      error:
        "과거 문항 구성의 응답입니다. 현재 문항 기준(v2.3)으로 다시 분석할 수 없습니다. 기존 결과를 보존해 주세요.",
    };
  }

  // 이름은 서버 로컬로만 합성(analyses.name NOT NULL). AI에는 전송하지 않는다.
  // 아래 검증에서 studentType에 실명이 섞였는지 확인하는 용도로만 넘긴다.
  const name = row.name ?? "(이름 미상)";

  const parentAnswers = await loadParentAnswersForSurvey(supabase, row);

  const { interpretation: rawInterpretation, source } = await interpretWithAiOrFallback(
    scoreProfile,
    row.intake_v2,
    { name: row.name, school: row.school, grade: row.grade },
    row.responses_v2,
    surveyId,
    name,
    parentAnswers,
  );

  // AI/fallback 해석의 "{{학생}}" 토큰을 실제 이름(예: 강현찬 학생)으로 치환하고,
  // AI가 지시를 어겨 쓴 따님/아드님/아이/자녀도 교정한다. 저장 전에 수행해 화면·PDF·공유 모두 일관.
  const interpretation = applyStudentNameToInterpretation(rawInterpretation, name);

  const builtProfile = buildResultProfileV2({
    scoreProfile,
    interpretation,
    source,
  });
  // 결과지 10번 표시용 스냅샷. 답이 없으면 키 자체를 넣지 않는다(예전 저장 모양 그대로).
  const resultProfile: ResultProfileV2 = parentAnswers
    ? { ...builtProfile, parentAnswers }
    : builtProfile;

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
