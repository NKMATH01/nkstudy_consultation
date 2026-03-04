import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [consultRes, regRes] = await Promise.all([
    supabase.from("consultations").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
  ]);

  // All consultations for chart + table + stats
  const { data: allConsultations } = await supabase
    .from("consultations")
    .select("id, name, school, grade, consult_date, subject, location, status, result_status")
    .order("consult_date", { ascending: false });

  // All surveys with date info for monthly filtering
  const { data: allSurveys } = await supabase
    .from("surveys")
    .select("id, name, grade, analysis_id, created_at")
    .order("created_at", { ascending: false });

  // All analyses with date info for monthly filtering
  const { data: allAnalyses } = await supabase
    .from("analyses")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <DashboardClient
      stats={{
        consultations: consultRes.count ?? 0,
        registrations: regRes.count ?? 0,
      }}
      consultations={allConsultations ?? []}
      surveys={allSurveys ?? []}
      analyses={allAnalyses ?? []}
    />
  );
}
