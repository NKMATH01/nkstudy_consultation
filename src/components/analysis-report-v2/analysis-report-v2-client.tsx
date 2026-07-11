"use client";

// 직원 인증 화면(analyses 상세)용 V2 결과 보고서 래퍼(프리미엄 셸).
// 단일화(방향 변경): 상담자 전용 보고서를 없애고, 직원 화면도 학부모 공유본과 동일한 보고서를 렌더한다.
//   - 상담자/학부모 토글 제거, 항상 ParentReport(동일 parentSafe 변환)만 렌더한다.
//   - CounselorReport 컴포넌트 파일은 삭제하지 않고 렌더 연결만 끊었다(향후 복원 대비).
//   - 학부모 공유 링크·카카오톡·PDF 저장 액션은 그대로 유지한다. 연락처 등 상담 실무 정보는
//     보고서 본문 밖(상위 AnalysisDetailV2Client의 액션 헤더)에 있으며 본문에는 없다.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, MessageCircle } from "lucide-react";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { createReportTokenV2 } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import { REPORT_PREMIUM_CSS, ReportToolbar, ReportSheet, ReportDock } from "./report-frame";
import type { CounselorBackground } from "./counselor-report";
// NOTE(단일화): CounselorReport 렌더는 중단됨. 복원하려면 audience 토글과 <CounselorReport/>를 되살린다.
import { ParentReport } from "./parent-report";

interface Props {
  profile: ResultProfileV2;
  header: { name: string; schoolGrade: string; createdAt?: string | null };
  // 아래 두 필드는 상담자 전용 보고서에서 쓰던 값. 단일화 후 렌더에는 사용하지 않지만
  // 호출부 호환·향후 복원 대비를 위해 시그니처는 유지한다.
  background?: CounselorBackground | null;
  contacts?: { studentPhone?: string | null; parentPhone?: string | null } | null;
}

export function AnalysisReportV2Client({ profile, header }: Props) {
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
    <div className="rptv2-doc parent-mode">
      <style dangerouslySetInnerHTML={{ __html: REPORT_PREMIUM_CSS }} />
      <ReportToolbar studentName={header.name} shareSlot={shareSlot} />
      <ReportSheet>
        <ParentReport data={parentSafe} />
      </ReportSheet>
      <ReportDock />
    </div>
  );
}
