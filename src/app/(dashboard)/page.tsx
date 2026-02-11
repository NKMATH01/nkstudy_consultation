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

  // Count by status
  const { data: allConsultations } = await supabase
    .from("consultations")
    .select("status");

  const statusCounts = { registered: 0, considering: 0, unregistered: 0 };
  if (allConsultations) {
    for (const c of allConsultations) {
      if (c.status === "등록") statusCounts.registered++;
      else if (c.status === "고민") statusCounts.considering++;
      else if (c.status === "미등록") statusCounts.unregistered++;
    }
  }

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
