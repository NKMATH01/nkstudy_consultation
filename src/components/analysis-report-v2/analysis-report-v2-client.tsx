"use client";

// 직원 인증 화면(analyses 상세)용 V2 결과 보고서 래퍼.
// - 상담자/학부모 토글(직원 화면에서만). 학부모 미리보기는 서버 snapshot과 동일한
//   buildParentSafeProfile 결과를 그대로 렌더하므로 공개 화면과 정확히 일치한다.
// - 학부모 공유 링크는 parent-safe snapshot만 저장한다(createReportTokenV2).

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, MessageCircle, Users, UserCog } from "lucide-react";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { createReportTokenV2 } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import { C } from "./report-theme";
import { REPORT_PRINT_CSS, ReportToolbar, BottomDock } from "./report-frame";
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
    () =>
      buildParentSafeProfile(profile, {
        name: header.name,
        schoolGrade: header.schoolGrade,
      }),
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

  const toggle = (
    <div
      className="rptv2-noprint"
      style={{ display: "inline-flex", background: C.panel, borderRadius: 8, padding: 3, border: `1px solid ${C.line}` }}
    >
      <ToggleBtn active={audience === "counselor"} onClick={() => setAudience("counselor")} icon={<UserCog size={14} />} label="상담자용" />
      <ToggleBtn active={audience === "parent"} onClick={() => setAudience("parent")} icon={<Users size={14} />} label="학부모용" />
    </div>
  );

  const shareBtns = (
    <div className="rptv2-noprint" style={{ display: "inline-flex", gap: 6 }}>
      <SmallBtn onClick={handleKakao} disabled={sharing} icon={<MessageCircle size={14} />} label="카카오톡" />
      <SmallBtn onClick={handleCopy} disabled={sharing} icon={<Link2 size={14} />} label="공유 링크" />
    </div>
  );

  return (
    <div className="rptv2-root">
      <style dangerouslySetInnerHTML={{ __html: REPORT_PRINT_CSS }} />
      <ReportToolbar studentName={header.name} left={toggle} right={shareBtns} />
      <div className="rptv2-pages">
        {audience === "counselor" ? (
          <CounselorReport profile={profile} header={header} background={background} contacts={contacts} />
        ) : (
          <ParentReport data={parentSafe} />
        )}
      </div>
      <BottomDock />
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 11px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: 700,
        background: active ? C.navy : "transparent",
        color: active ? "#fff" : C.sub,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function SmallBtn({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "7px 11px",
        borderRadius: 8,
        border: `1px solid ${C.line}`,
        background: "#fff",
        color: C.ink,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
