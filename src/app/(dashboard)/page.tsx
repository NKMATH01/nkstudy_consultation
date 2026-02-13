import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [consultRes, surveyRes, analysisRes, regRes] = await Promise.all([
    supabase.from("consultations").select("*", { count: "exact", head: true }),
    supabase.from("surveys").select("*", { count: "exact", head: true }),
    supabase.from("analyses").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
  ]);

  // All consultations for chart + table + stats
  const { data: allConsultations } = await supabase
    .from("consultations")
    .select("id, name, school, grade, consult_date, subject, location, status, result_status")
    .order("consult_date", { ascending: false });

  // Recent surveys with analysis status
  const { data: recentSurveys } = await supabase
    .from("surveys")
    .select("id, name, grade, analysis_id")
    .order("created_at", { ascending: false })
    .limit(4);

  return (
    <DashboardClient
      stats={{
        consultations: consultRes.count ?? 0,
        surveys: surveyRes.count ?? 0,
        analyses: analysisRes.count ?? 0,
        registrations: regRes.count ?? 0,
      }}
      consultations={allConsultations ?? []}
      recentSurveys={recentSurveys ?? []}
    />
  );
}
