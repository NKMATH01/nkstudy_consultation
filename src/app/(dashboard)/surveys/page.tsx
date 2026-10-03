import { getSurveys } from "@/lib/actions/survey";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { createClient } from "@/lib/supabase/server";
import { SurveyListClient } from "@/components/surveys/survey-list-client";
import { checkPagePermission } from "@/lib/check-permission";
import { latestExamByConsultation, type ExamFlowStatus } from "@/lib/exam-alimtalk";
import { getQuestionnaireStatusByConsultationIds } from "@/lib/actions/parent-questionnaire";
import {
  selectSurveyConsultations,
  surveyConsultationMatchKind,
  type SurveyConsultationIdentityRecord,
} from "@/lib/student-identity";

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await checkPagePermission("/surveys");
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search;

  const supabase = await createClient();
  // report_html 본문(~3MB)은 목록에서 로드하지 않고 존재 여부만 파악한다.
  // 쿼리 A: 전체 분석의 id/survey_id, 쿼리 B: report_html이 있는 분석 id 집합
  const [result, classes, teachers, { data: analysesBase }, { data: analysesWithReport }, { data: registrations }, { data: consultations }, { data: surveyNames, count: surveyNameTotal }, { data: examRows }] = await Promise.all([
    getSurveys({ page, search, limit: 20 }),
    getClasses(),
    getTeachers(),
    supabase
      .from("analyses")
      // generated_at: V2 분석 생성 시각(학부모 질문지 답이 분석 뒤에 왔는지 표시용). V1 은 null.
      .select("id, survey_id, generated_at:result_profile_v2->>generatedAt")
      .order("created_at", { ascending: false }),
    supabase
      .from("analyses")
      .select("id")
      .not("report_html", "is", null),
    supabase
      .from("registrations")
      .select("id, analysis_id")
      .order("created_at", { ascending: false }),
    // 상담관리 페이지와 동일한 정렬 기준 적용 (consult_date → consult_time → created_at).
      // 그렇지 않으면 한 학생의 여러 상담 중 "고민중"으로 마크된 건을 놓쳐 설문분석에서 상태 미표시됨.
    supabase
      .from("consultations")
      .select("id, name, parent_phone, analysis_id, result_status, test_score, subject, consult_date")
      .order("consult_date", { ascending: false, nullsFirst: false })
      .order("consult_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    // 현재 페이지 밖의 동명이인도 이름 fallback을 막을 수 있도록 전체 이름을 확인한다.
    supabase.from("surveys").select("name", { count: "exact" }),
    // 입학테스트(시험지·매쓰플랫·분석 요청 아이콘). 상담마다 가장 최근 시험 하나를 쓴다.
    supabase
      .from("exam_analyses")
      .select("id, consultation_id, status, paper_paths, mathflex_paths, created_at")
      .not("consultation_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const reportIds = new Set(((analysesWithReport ?? []) as { id: string }[]).map((a) => a.id));
  const analyses = ((analysesBase ?? []) as { id: string; survey_id: string | null; generated_at: string | null }[]).map((a) => ({
    id: a.id,
    survey_id: a.survey_id,
    has_report: reportIds.has(a.id),
    generated_at: a.generated_at ?? null,
  }));

  // 학부모 질문지 상태: 이 페이지 설문들과 강하게(분석 ID·학부모 번호) 맞는 상담만 조회한다.
  // 목록 화면의 매칭 규칙(selectSurveyConsultations)과 같다 — 재상담 여러 건도 모두 포함.
  const consultationRecords = (consultations ?? []) as SurveyConsultationIdentityRecord[];
  const analysisIdBySurvey = new Map(analyses.filter((a) => a.survey_id).map((a) => [a.survey_id as string, a.id]));
  const questionnaireIds = new Set<string>();
  for (const survey of result.data) {
    const identity = {
      name: survey.name,
      parentPhone: survey.parent_phone,
      analysisId: survey.analysis_id || analysisIdBySurvey.get(survey.id) || null,
    };
    if (surveyConsultationMatchKind(consultationRecords, identity) !== "strong") continue;
    for (const c of selectSurveyConsultations(consultationRecords, identity)) questionnaireIds.add(c.id);
  }
  const questionnaireResult = await getQuestionnaireStatusByConsultationIds([...questionnaireIds]);
  if (!questionnaireResult.success) {
    // 표가 아직 없거나 조회가 실패해도 목록은 그대로 보인다(칩만 빠진다).
    console.error("[SurveysPage]", { step: "parentQuestionnaireStatus", error: questionnaireResult.error });
  }
  const questionnaireByConsultation = Object.fromEntries(
    (questionnaireResult.data ?? []).map((q) => [q.consultationId, { issued: q.issued, answeredAt: q.answeredAt }]),
  );
  const surveyNameCounts = new Map<string, number>();
  for (const survey of (surveyNames ?? []) as { name: string }[]) {
    const name = survey.name.trim();
    surveyNameCounts.set(name, (surveyNameCounts.get(name) ?? 0) + 1);
  }
  const hasCompleteSurveyNameIndex =
    surveyNameTotal !== null &&
    surveyNameTotal !== undefined &&
    (surveyNames?.length ?? 0) >= surveyNameTotal;
  const ambiguousSurveyNames = hasCompleteSurveyNameIndex
    ? [...surveyNameCounts]
        .filter(([, count]) => count > 1)
        .map(([name]) => name)
    : [...new Set(result.data.map((survey) => survey.name.trim()))];

  const exams = latestExamByConsultation(
    ((examRows ?? []) as {
      id: string;
      consultation_id: string | null;
      status: string;
      paper_paths: string[] | null;
      mathflex_paths: string[] | null;
      created_at: string;
    }[]).map((e) => ({
      id: e.id,
      consultation_id: e.consultation_id,
      created_at: e.created_at,
      status: e.status as ExamFlowStatus,
      paperCount: e.paper_paths?.length ?? 0,
      mathflexCount: e.mathflex_paths?.length ?? 0,
    })),
  );
  const examByConsultation = Object.fromEntries(
    [...exams].map(([consultationId, e]) => [
      consultationId,
      { id: e.id, status: e.status, paperCount: e.paperCount, mathflexCount: e.mathflexCount, created_at: e.created_at },
    ]),
  );

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
      analyses={analyses}
      registrations={(registrations ?? []) as { id: string; analysis_id: string | null }[]}
      consultations={(consultations ?? []) as { id: string; name: string; parent_phone: string | null; analysis_id: string | null; result_status: string; test_score: string | null; subject: string | null; consult_date: string | null }[]}
      ambiguousSurveyNames={ambiguousSurveyNames}
      examByConsultation={examByConsultation}
      questionnaireByConsultation={questionnaireByConsultation}
      classes={classes}
      teachers={teachers}
    />
  );
}
