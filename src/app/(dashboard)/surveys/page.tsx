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
  const [result, classes, teachers, { data: analyses }, { data: registrations }, { data: consultations }] = await Promise.all([
    getSurveys({ page, search, limit: 20 }),
    getClasses(),
    getTeachers(),
    supabase
      .from("analyses")
      .select("id, survey_id, report_html")
      .order("created_at", { ascending: false }),
    supabase
      .from("registrations")
      .select("id, analysis_id")
      .order("created_at", { ascending: false }),
    // 상담관리 페이지와 동일한 정렬 기준 적용 (consult_date → consult_time → created_at).
      // 그렇지 않으면 한 학생의 여러 상담 중 "고민중"으로 마크된 건을 놓쳐 설문분석에서 상태 미표시됨.
    supabase
      .from("consultations")
      .select("id, name, result_status, test_score, subject")
      .order("consult_date", { ascending: false, nullsFirst: false })
      .order("consult_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
      analyses={(analyses ?? []) as { id: string; survey_id: string | null; report_html: string | null }[]}
      registrations={(registrations ?? []) as { id: string; analysis_id: string | null }[]}
      consultations={(consultations ?? []) as { id: string; name: string; result_status: string; test_score: string | null; subject: string | null }[]}
      classes={classes}
      teachers={teachers}
    />
  );
}
