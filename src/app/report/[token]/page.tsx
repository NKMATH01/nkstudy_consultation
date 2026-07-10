import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getReportByToken } from "@/lib/actions/report-token";
import { ReportViewer } from "./report-viewer-client";
import { ExpiredReport } from "./expired";
import { ParentReportPublicClient } from "@/components/analysis-report-v2/parent-report-public-client";

// 공개 token 보고서: 검색엔진 노출 금지·캐시 금지(§14).
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "NK EDUCATION 보고서",
  robots: { index: false, follow: false, nocache: true },
};

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

  if (report.revoked) {
    return <ExpiredReport reason="revoked" />;
  }
  if (report.expired) {
    return <ExpiredReport reason="expired" />;
  }

  if (report.kind === "v2") {
    // 공개 화면은 parent-safe snapshot만 렌더한다. 상담자 전환 경로 없음.
    return <ParentReportPublicClient profile={report.profile} createdAt={report.createdAt} />;
  }

  return (
    <ReportViewer
      reportHtml={report.reportHtml}
      reportType={report.reportType}
      name={report.name}
    />
  );
}
