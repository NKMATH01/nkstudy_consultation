import { getSurveys } from "@/lib/actions/survey";
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

  const result = await getSurveys({
    page,
    search,
    limit: 20,
  });

  // 분석 데이터 페칭 (설문 목록과 연동 표시용)
  const supabase = await createClient();
  const { data: analyses } = await supabase
    .from("analyses")
    .select("id, survey_id, report_html")
    .order("created_at", { ascending: false });

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
      analyses={(analyses ?? []) as { id: string; survey_id: string | null; report_html: string | null }[]}
    />
  );
}
