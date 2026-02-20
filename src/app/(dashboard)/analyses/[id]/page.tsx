import { getAnalysis } from "@/lib/actions/analysis";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { AnalysisDetailClient } from "@/components/analyses/analysis-detail-client";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/check-permission";
import { createClient } from "@/lib/supabase/server";
import type { ResultStatus } from "@/types";

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/analyses");
  const { id } = await params;
  const [analysis, classes, teachers] = await Promise.all([
    getAnalysis(id),
    getClasses(),
    getTeachers(),
  ]);

  if (!analysis) {
    notFound();
  }

  const supabase = await createClient();

  // 상담의 result_status 조회 (학생 이름으로 매칭)
  let consultationResultStatus: ResultStatus | null = null;
  const { data: consultation } = await supabase
    .from("consultations")
    .select("result_status")
    .eq("name", analysis.name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (consultation) {
    consultationResultStatus = consultation.result_status as ResultStatus;
  }

  // 등록 안내문 존재 여부
  const { data: existingReg } = await supabase
    .from("registrations")
    .select("id")
    .eq("analysis_id", id)
    .limit(1)
    .maybeSingle();

  return (
    <AnalysisDetailClient
      analysis={analysis}
      classes={classes}
      teachers={teachers}
      consultationResultStatus={consultationResultStatus}
      existingRegistrationId={existingReg?.id || null}
    />
  );
}
