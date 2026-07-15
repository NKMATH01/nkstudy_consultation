import { getSurveys } from "@/lib/actions/survey";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { createClient } from "@/lib/supabase/server";
import { SurveyListClient } from "@/components/surveys/survey-list-client";
import { checkPagePermission } from "@/lib/check-permission";

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
  const [result, classes, teachers, { data: analysesBase }, { data: analysesWithReport }, { data: registrations }, { data: consultations }, { data: surveyNames, count: surveyNameTotal }] = await Promise.all([
    getSurveys({ page, search, limit: 20 }),
    getClasses(),
    getTeachers(),
    supabase
      .from("analyses")
      .select("id, survey_id")
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
      .select("id, name, parent_phone, analysis_id, result_status, test_score, subject")
      .order("consult_date", { ascending: false, nullsFirst: false })
      .order("consult_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    // 현재 페이지 밖의 동명이인도 이름 fallback을 막을 수 있도록 전체 이름을 확인한다.
    supabase.from("surveys").select("name", { count: "exact" }),
  ]);

  const reportIds = new Set(((analysesWithReport ?? []) as { id: string }[]).map((a) => a.id));
  const analyses = ((analysesBase ?? []) as { id: string; survey_id: string | null }[]).map((a) => ({
    id: a.id,
    survey_id: a.survey_id,
    has_report: reportIds.has(a.id),
  }));
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

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
      analyses={analyses}
      registrations={(registrations ?? []) as { id: string; analysis_id: string | null }[]}
      consultations={(consultations ?? []) as { id: string; name: string; parent_phone: string | null; analysis_id: string | null; result_status: string; test_score: string | null; subject: string | null }[]}
      ambiguousSurveyNames={ambiguousSurveyNames}
      classes={classes}
      teachers={teachers}
    />
  );
}
