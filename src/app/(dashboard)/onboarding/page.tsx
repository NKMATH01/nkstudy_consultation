import { createClient } from "@/lib/supabase/server";
import { OnboardingList } from "@/components/onboarding/onboarding-list-client";

export default async function OnboardingPage() {
  const supabase = await createClient();

  // Fetch all registrations (newest first) - with fallback if onboarding_status column doesn't exist
  let registrations: any[] = [];
  const { data: regData, error: regError } = await supabase
    .from("registrations")
    .select("id, analysis_id, name, school, grade, student_phone, parent_phone, registration_date, assigned_class, subject, teacher, report_html, onboarding_status")
    .order("registration_date", { ascending: false });

  if (regError && (regError.message?.includes("onboarding_status") || regError.code === "42703")) {
    // onboarding_status column doesn't exist yet - query without it
    const { data: fallbackData } = await supabase
      .from("registrations")
      .select("id, analysis_id, name, school, grade, student_phone, parent_phone, registration_date, assigned_class, subject, teacher, report_html")
      .order("registration_date", { ascending: false });
    registrations = (fallbackData ?? []).map(r => ({ ...r, onboarding_status: {} }));
  } else {
    registrations = (regData ?? []).map(r => ({ ...r, onboarding_status: r.onboarding_status || {} }));
  }

  // Fetch analyses for linking (report_html 포함 - 팝업 표시용)
  const { data: analyses } = await supabase
    .from("analyses")
    .select("id, name, survey_id, report_html")
    .order("created_at", { ascending: false });

  return (
    <OnboardingList
      registrations={registrations}
      analyses={(analyses ?? []) as any[]}
    />
  );
}
