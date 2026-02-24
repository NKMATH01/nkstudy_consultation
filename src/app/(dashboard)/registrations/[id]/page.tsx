import { getRegistration } from "@/lib/actions/registration";
import { getAnalysis } from "@/lib/actions/analysis";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { RegistrationDetailClient } from "@/components/registrations/registration-detail-client";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/check-permission";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/registrations");
  const { id } = await params;
  const [registration, classes, teachers] = await Promise.all([
    getRegistration(id),
    getClasses(),
    getTeachers(),
  ]);

  if (!registration) {
    notFound();
  }

  // 분석 report_html 가져오기 (팝업용)
  let analysisReportHtml: string | null = null;
  if (registration.analysis_id) {
    const analysis = await getAnalysis(registration.analysis_id);
    analysisReportHtml = analysis?.report_html ?? null;
  }

  return (
    <RegistrationDetailClient
      registration={registration}
      analysisReportHtml={analysisReportHtml}
      classes={classes}
      teachers={teachers}
    />
  );
}
