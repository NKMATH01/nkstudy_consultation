"use client";

// 직원 인증 화면(analyses 상세)용 V2 결과 보고서 래퍼(프리미엄 셸).
// 단일화(방향 변경): 상담자 전용 보고서를 없애고, 직원 화면도 학부모 공유본과 동일한 보고서를 렌더한다.
//   - 상담자/학부모 토글 제거, 항상 ParentReport(동일 parentSafe 변환)만 렌더한다.
//   - CounselorReport 컴포넌트 파일은 삭제하지 않고 렌더 연결만 끊었다(향후 복원 대비).
//   - 학부모 공유 링크·카카오톡·PDF 저장 액션은 그대로 유지한다. 연락처 등 상담 실무 정보는
//     보고서 본문 밖(상위 AnalysisDetailV2Client의 액션 헤더)에 있으며 본문에는 없다.

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, MessageCircle, Send } from "lucide-react";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { createReportTokenV2 } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import { AlimtalkSendDialog } from "@/components/alimtalk/alimtalk-send-dialog";
import {
  buildAnalysisResultVars,
  ANALYSIS_RESULT_TEMPLATE_CODE,
} from "@/lib/analysis-alimtalk";
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
  /** 또래 문항 응답 원본(선택). parent-safe 스냅샷에 문항 요지+보기만 담긴다. */
  responses?: Record<string, unknown> | null;
  /** 학생이 적어 낸 MBTI(참고용). parent-safe에서 type+확신도만 통과시킨다. */
  mbti?: { type?: string | null; confidence?: string | null } | null;
  contacts?: { studentPhone?: string | null; parentPhone?: string | null } | null;
  // 알림톡 발송(결과지 링크)용. 없으면 발송 버튼을 노출하지 않는다.
  analysis?: { id: string; school: string | null; grade: string | null } | null;
}

export function AnalysisReportV2Client({ profile, header, responses, mbti, contacts, analysis }: Props) {
  const [sharing, setSharing] = useState(false);
  const [showAlimtalk, setShowAlimtalk] = useState(false);
  const parentPhone = contacts?.parentPhone || "";

  const parentSafe = useMemo(
    () =>
      buildParentSafeProfile(
        profile,
        { name: header.name, schoolGrade: header.schoolGrade },
        responses,
        mbti,
      ),
    [profile, header.name, header.schoolGrade, responses, mbti]
  );

  const makeToken = useCallback(async (): Promise<string | null> => {
    const res = await createReportTokenV2({ profile: parentSafe, name: header.name });
    if (!res.success || !res.token) {
      toast.error(res.error || "공유 링크 생성에 실패했습니다");
      return null;
    }
    return res.token;
  }, [parentSafe, header.name]);

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

  // 발송 직전에 새 parent-safe 스냅샷 토큰을 만들어 링크 변수로 넘긴다.
  const prepareAlimtalk = useCallback(async () => {
    if (!analysis || !parentPhone) return null;

    const token = await makeToken();
    if (!token) return null;

    return {
      templateCode: ANALYSIS_RESULT_TEMPLATE_CODE,
      phone: parentPhone,
      vars: buildAnalysisResultVars(
        {
          name: header.name,
          school: analysis.school,
          grade: analysis.grade,
          created_at: header.createdAt || new Date().toISOString(),
        },
        token,
      ),
      subjectType: "analysis",
      subjectId: analysis.id,
    };
  }, [analysis, parentPhone, header.name, header.createdAt, makeToken]);

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
      {analysis && (
        <button
          type="button"
          className="report-share"
          onClick={() => setShowAlimtalk(true)}
          disabled={sharing || !parentPhone}
        >
          <Send size={14} />
          알림톡
        </button>
      )}
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
      <AlimtalkSendDialog
        open={showAlimtalk}
        onOpenChange={setShowAlimtalk}
        prepare={prepareAlimtalk}
        targetLabel={header.name}
        title="학습 프로필 알림톡 발송"
      />
    </div>
  );
}
