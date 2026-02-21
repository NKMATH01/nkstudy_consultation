import { getSurveys } from "@/lib/actions/survey";
import { createClient } from "@/lib/supabase/server";
import { SurveyListClient } from "@/components/surveys/survey-list-client";
import { checkPagePermission } from "@/lib/check-permission";
import type { Class, Teacher } from "@/types";

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

  // 분석 + 등록 + 상담 + 반 + 선생님 데이터 페칭
  const supabase = await createClient();
  const [{ data: analyses }, { data: registrations }, { data: consultations }, { data: classesList }, { data: teachersList }] = await Promise.all([
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
    supabase
      .from("classes")
      .select("*")
      .eq("active", true)
      .order("name"),
    supabase
      .from("teachers")
      .select("*")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
      analyses={(analyses ?? []) as { id: string; survey_id: string | null; report_html: string | null }[]}
      registrations={(registrations ?? []) as { id: string; analysis_id: string | null }[]}
      consultations={(consultations ?? []) as { name: string; result_status: string }[]}
      classes={(classesList ?? []) as Class[]}
      teachers={(teachersList ?? []) as Teacher[]}
    />
  );
}
