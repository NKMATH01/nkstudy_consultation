import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch counts
  const [consultRes, surveyRes, analysisRes, regRes, recentRes] = await Promise.all([
    supabase.from("consultations").select("*", { count: "exact", head: true }),
    supabase.from("surveys").select("*", { count: "exact", head: true }),
    supabase.from("analyses").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    supabase
      .from("consultations")
      .select("id, name, school, grade, consult_date, subject, location, status")
      .order("consult_date", { ascending: false })
      .limit(5),
  ]);

  // Count by status (optimized: 3 count queries instead of fetching all rows)
  const [regCount, conCount, unregCount] = await Promise.all([
    supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "등록"),
    supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "고민"),
    supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "미등록"),
  ]);

  const statusCounts = {
    registered: regCount.count ?? 0,
    considering: conCount.count ?? 0,
    unregistered: unregCount.count ?? 0,
  };

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
      statusCounts={statusCounts}
      recentConsultations={recentRes.data ?? []}
      recentSurveys={recentSurveys ?? []}
    />
  );
}
