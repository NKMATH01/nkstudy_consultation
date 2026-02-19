import { notFound } from "next/navigation";
import { getReportByToken } from "@/lib/actions/report-token";
import { ReportViewer } from "./report-viewer-client";
import { ExpiredReport } from "./expired";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByToken(token);

  if (!report) {
    notFound();
  }

  if (report.expired) {
    return <ExpiredReport />;
  }

  return (
    <ReportViewer
      reportHtml={report.reportHtml}
      reportType={report.reportType}
      name={report.name}
    />
  );
}
