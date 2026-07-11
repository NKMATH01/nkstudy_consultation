"use client";

// 공개 token 화면용 학부모 보고서 래퍼(프리미엄 셸).
// 상담자 전환 토글·query parameter를 제공하지 않는다(§12.3). PDF 저장·하단 메뉴만 제공한다.

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { REPORT_PREMIUM_CSS, ReportToolbar, ReportSheet, ReportDock } from "./report-frame";
import { ParentReport } from "./parent-report";

export function ParentReportPublicClient({
  profile,
}: {
  profile: ParentSafeProfile;
  createdAt: string | null;
}) {
  return (
    <div className="rptv2-doc parent-mode">
      <style dangerouslySetInnerHTML={{ __html: REPORT_PREMIUM_CSS }} />
      <ReportToolbar studentName={profile.display.name} />
      <ReportSheet>
        <ParentReport data={profile} />
      </ReportSheet>
      <ReportDock />
    </div>
  );
}
