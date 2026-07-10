"use client";

// 공개 token 화면용 학부모 보고서 래퍼.
// 상담자 전환 토글·query parameter를 제공하지 않는다(§12.3). PDF 저장·하단 메뉴만 제공한다.

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { REPORT_PRINT_CSS, ReportToolbar, BottomDock } from "./report-frame";
import { ParentReport } from "./parent-report";
import { C, formatDate } from "./report-theme";

export function ParentReportPublicClient({
  profile,
  createdAt,
}: {
  profile: ParentSafeProfile;
  createdAt: string | null;
}) {
  return (
    <div className="rptv2-root">
      <style dangerouslySetInnerHTML={{ __html: REPORT_PRINT_CSS }} />
      <ReportToolbar
        studentName={profile.display.name}
        left={
          <span style={{ fontSize: 12.5, color: C.sub }}>
            NK EDUCATION · 학습 프로필
            {createdAt && (
              <span style={{ color: C.faint }}> · 생성일 {formatDate(createdAt)}</span>
            )}
          </span>
        }
      />
      <div className="rptv2-pages">
        <ParentReport data={profile} />
      </div>
      <BottomDock />
    </div>
  );
}
