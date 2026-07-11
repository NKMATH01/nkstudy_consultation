"use client";

// 직원 인증 화면(analyses 상세)용 V2 결과 보고서 래퍼(프리미엄 셸).
// - 상담자/학부모 토글(직원 화면에서만). 학부모 미리보기는 서버 snapshot과 동일한 buildParentSafeProfile 결과.
// - 학부모 공유 링크는 parent-safe snapshot만 저장한다(createReportTokenV2).

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, MessageCircle } from "lucide-react";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { createReportTokenV2 } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import { REPORT_PREMIUM_CSS, ReportToolbar, ReportSheet, ReportDock } from "./report-frame";
import { CounselorReport, type CounselorBackground } from "./counselor-report";
import { ParentReport } from "./parent-report";

interface Props {
  profile: ResultProfileV2;
  header: { name: string; schoolGrade: string; createdAt?: string | null };
  background?: CounselorBackground | null;
  contacts?: { studentPhone?: string | null; parentPhone?: string | null } | null;
}

export function AnalysisReportV2Client({ profile, header, background, contacts }: Props) {
  const [audience, setAudience] = useState<"counselor" | "parent">("counselor");
  const [sharing, setSharing] = useState(false);

  const parentSafe = useMemo(
    () => buildParentSafeProfile(profile, { name: header.name, schoolGrade: header.schoolGrade }),
    [profile, header.name, header.schoolGrade]
  );

  const makeToken = async (): Promise<string | null> => {
    const res = await createReportTokenV2({ profile: parentSafe, name: header.name });
    if (!res.success || !res.token) {
      toast.error(res.error || "공유 링크 생성에 실패했습니다");
      return null;
    }
    return res.token;
  };

  const handleCopy = async () => {
    setSharing(true);
    try {
      const token = await makeToken();
      if (!token) return;
      await navigator.clipboard.writeText(`${KAKAO_BASE_URL}/report/${token}`);
      toast.success("학부모 공유 링크가 복사되었습니다 (parent-safe)");
    } catch {
      toast.error("링크 복사에 실패했습니다");
    } finally {
      setSharing(false);
    }
  };

  const handleKakao = async () => {
    setSharing(true);
    try {
      const token = await makeToken();
      if (!token) return;
      await shareViaKakao({
        title: `${header.name} 학습 프로필`,
        description: "NK학원 학습 프로필(학부모용)입니다.",
        pageUrl: `/report/${token}`,
      });
    } catch {
      toast.error("카카오톡 공유에 실패했습니다");
    } finally {
      setSharing(false);
    }
  };

  const audienceSlot = (
    <div className="audience-switch" role="group" aria-label="보고서 보기 방식">
      <button
        type="button"
        className={audience === "counselor" ? "is-active" : undefined}
        aria-pressed={audience === "counselor"}
        onClick={() => setAudience("counselor")}
      >
        상담자용
      </button>
      <button
        type="button"
        className={audience === "parent" ? "is-active" : undefined}
        aria-pressed={audience === "parent"}
        onClick={() => setAudience("parent")}
      >
        학부모 공유본
      </button>
    </div>
  );

  const shareSlot = (
    <>
      <button type="button" className="report-share" onClick={handleKakao} disabled={sharing}>
        <MessageCircle size={14} />
        카카오톡
      </button>
      <button type="button" className="report-share" onClick={handleCopy} disabled={sharing}>
        <Link2 size={14} />
        공유 링크
      </button>
    </>
  );

  return (
    <div className={`rptv2-doc${audience === "parent" ? " parent-mode" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: REPORT_PREMIUM_CSS }} />
      <ReportToolbar studentName={header.name} audienceSlot={audienceSlot} shareSlot={shareSlot} />
      <ReportSheet>
        {audience === "counselor" ? (
          <CounselorReport profile={profile} header={header} background={background} contacts={contacts} />
        ) : (
          <ParentReport data={parentSafe} />
        )}
      </ReportSheet>
      <ReportDock />
    </div>
  );
}
