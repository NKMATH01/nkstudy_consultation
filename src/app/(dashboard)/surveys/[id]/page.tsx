import { getSurvey } from "@/lib/actions/survey";
import { getAnalysis } from "@/lib/actions/analysis";
import { createClient } from "@/lib/supabase/server";
import { SurveyDetailClient } from "@/components/surveys/survey-detail-client";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/check-permission";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/surveys");
  const { id } = await params;
  const survey = await getSurvey(id);

  if (!survey) {
    notFound();
  }

  // 분석 결과 가져오기: analysis_id 우선, 없으면 survey_id로 직접 조회
  let analysisReportHtml: string | null = null;
  let analysisId: string | null = survey.analysis_id;

  if (survey.analysis_id) {
    const analysis = await getAnalysis(survey.analysis_id);
    analysisReportHtml = analysis?.report_html ?? null;
  }

  if (!analysisReportHtml) {
    // fallback: survey_id로 분석 조회
    const supabase = await createClient();
    const { data } = await supabase
      .from("analyses")
      .select("id, report_html")
      .eq("survey_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      analysisReportHtml = data.report_html;
      analysisId = data.id;
    }
  }

  return (
    <SurveyDetailClient
      survey={survey}
      analysisReportHtml={analysisReportHtml}
      analysisId={analysisId}
    />
  );
}
