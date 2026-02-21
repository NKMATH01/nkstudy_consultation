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
    supabase
      .from("consultations")
      .select("name, result_status")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
      analyses={(analyses ?? []) as { id: string; survey_id: string | null; report_html: string | null }[]}
      registrations={(registrations ?? []) as { id: string; analysis_id: string | null }[]}
      consultations={(consultations ?? []) as { name: string; result_status: string }[]}
      classes={classes}
      teachers={teachers}
    />
  );
}
