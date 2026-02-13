import { getRegistration } from "@/lib/actions/registration";
import { getAnalysis } from "@/lib/actions/analysis";
import { RegistrationDetailClient } from "@/components/registrations/registration-detail-client";
import { notFound } from "next/navigation";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registration = await getRegistration(id);

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
    />
  );
}
