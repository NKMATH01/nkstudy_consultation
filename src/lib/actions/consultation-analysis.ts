import type { createClient } from "@/lib/supabase/server";
import {
  escapeLikePattern,
  selectUniqueSurveyConsultation,
  type SurveyConsultationIdentityRecord,
} from "@/lib/student-identity";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SurveyAnalysisStampSource = {
  name: string | null;
  parent_phone: string | null;
};

export function selectConsultationAnalysisStampTarget<
  T extends SurveyConsultationIdentityRecord,
>(candidates: T[], survey: SurveyAnalysisStampSource): T | null {
  const name = survey.name?.trim() ?? "";
  if (!name) return null;

  const match = selectUniqueSurveyConsultation(candidates, {
    name,
    parentPhone: survey.parent_phone,
  });
  return match && !match.analysis_id ? match : null;
}

export async function stampConsultationAnalysis(
  supabase: SupabaseServerClient,
  survey: SurveyAnalysisStampSource,
  analysisId: string,
): Promise<boolean> {
  const name = survey.name?.trim() ?? "";
  if (!name || !analysisId) return false;

  const { data: candidates, error: findError } = await supabase
    .from("consultations")
    .select("id, name, parent_phone, analysis_id")
    .ilike("name", `${escapeLikePattern(name)}%`)
    .limit(100);

  if (findError) throw new Error(findError.message);

  const target = selectConsultationAnalysisStampTarget(
    (candidates ?? []) as SurveyConsultationIdentityRecord[],
    survey,
  );
  if (!target) return false;

  const { error: updateError } = await supabase
    .from("consultations")
    .update({ analysis_id: analysisId })
    .eq("id", target.id)
    .is("analysis_id", null);

  if (updateError) throw new Error(updateError.message);
  return true;
}
