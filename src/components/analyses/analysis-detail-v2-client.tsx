"use client";

// 설문 V2(학습 프로필) 분석 상세. V1 AnalysisDetailClient와 분리되어 V2 result_profile_v2만 렌더한다.
// 상담자/학부모 토글·PDF·공유·하단 메뉴는 AnalysisReportV2Client가 담당한다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, ExternalLink, FileCheck, MessageSquareText, Printer, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAnalysis } from "@/lib/actions/analysis";
import { generateRegistration } from "@/lib/actions/registration";
import { RegistrationForm } from "@/components/registrations/registration-form-client";
import { AnalysisReportV2Client } from "@/components/analysis-report-v2/analysis-report-v2-client";
import { TeacherSheet, type TeacherSheetCheck } from "@/components/analysis-report-v2/teacher-sheet";
import type { CounselorBackground } from "@/components/analysis-report-v2/counselor-report";
import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { Analysis, Class, Teacher } from "@/types";
import type { RegistrationAdminFormData } from "@/lib/validations/registration";

interface Props {
  analysis: Analysis;
  profile: ResultProfileV2;
  classes: Class[];
  teachers: Teacher[];
  background?: CounselorBackground | null;
  /** 또래 문항 응답 원본. "친구와 공부" 카드에만 쓴다. */
  responses?: Record<string, unknown> | null;
  /** 학생이 적어 낸 MBTI(참고용). 확신도 high/medium만 결과지에 표시된다. */
  mbti?: { type?: string | null; confidence?: string | null } | null;
  contacts?: { studentPhone?: string | null; parentPhone?: string | null } | null;
  consultationData?: Record<string, string | null> | null;
  existingRegistrationId?: string | null;
  consultationId?: string | null;
  /** 온보딩 목록에서 ?view=teacher로 들어오면 강사 시트로 시작한다. */
  initialTeacherView?: boolean;
  /** 저장된 14일 확인 결과. 강사 시트 (5)블록에만 쓴다. */
  first14Checks?: TeacherSheetCheck[];
}

export function AnalysisDetailV2Client({
  analysis,
  profile,
  classes,
  teachers,
  background,
  responses,
  mbti,
  contacts,
  consultationData,
  existingRegistrationId,
  consultationId,
  initialTeacherView = false,
  first14Checks,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);
  // 기본은 학부모용. 상담 중 화면을 그대로 보여주다 강사용 메모가 노출되는 사고를 막는다.
  const [teacherView, setTeacherView] = useState(initialTeacherView);

  const schoolGrade = [analysis.school, analysis.grade].filter(Boolean).join(" ");

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAnalysis(analysis.id);
      if (result.success) {
        toast.success("분석 결과가 삭제되었습니다");
        router.push("/surveys");
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const handleRegisterClick = () => {
    if (existingRegistrationId) {
      router.push(`/registrations/${existingRegistrationId}`);
    } else {
      setShowRegForm(true);
    }
  };

  const handleGenerateRegistration = async (data: RegistrationAdminFormData) => {
    const result = await generateRegistration(analysis.id, data);
    if (result.success && result.data) {
      toast.success("등록 안내문이 생성되었습니다");
      if (result.warning) toast.warning(result.warning);
      setShowRegForm(false);
      router.push(`/registrations/${result.data.id}`);
    } else {
      toast.error(result.error || "등록 안내문 생성에 실패했습니다");
    }
  };

  return (
    <div>
      {/* 액션 헤더(인쇄 제외) */}
      <div
        className="rptv2-noprint"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "0 4px 12px",
        }}
      >
        <Button variant="ghost" size="icon" asChild className="rounded-xl h-8 w-8">
          <Link href="/surveys">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-slate-900">{analysis.name}</span>
            <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-black text-violet-700">
              V2 학습 프로필
            </span>
          </div>
          <p className="text-[11px] text-slate-500">{schoolGrade}</p>
        </div>
        {consultationId && (
          <Button variant="outline" size="sm" asChild className="rounded-xl text-xs">
            <Link href={`/consultations/${consultationId}`}>
              <MessageSquareText className="mr-1 h-3.5 w-3.5" /> 상담 보기
            </Link>
          </Button>
        )}
        <Button
          variant={teacherView ? "default" : "outline"}
          size="sm"
          onClick={() => setTeacherView((v) => !v)}
          className="rounded-xl text-xs"
          title="강사용 A4 한 장 (직원 전용)"
        >
          <UserCog className="mr-1 h-3.5 w-3.5" />
          {teacherView ? "학부모용으로" : "강사용"}
        </Button>
        {teacherView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="rounded-xl text-xs"
          >
            <Printer className="mr-1 h-3.5 w-3.5" /> 인쇄
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleRegisterClick}
          className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 text-xs"
        >
          {existingRegistrationId ? (
            <>
              <FileCheck className="h-3.5 w-3.5 mr-1" /> 등록 안내 보기
              <ExternalLink className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              <ClipboardList className="h-3.5 w-3.5 mr-1" /> 등록 안내 생성
            </>
          )}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} className="rounded-xl text-xs">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
        </Button>
      </div>

      {profile.source === "fallback" && (
        <div
          className="rptv2-noprint mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
          role="status"
        >
          AI 분석 실패 — 규칙 기반 요약입니다. 재분석을 권장합니다.
        </div>
      )}

      {teacherView ? (
        <TeacherSheet
          profile={profile}
          header={{ name: analysis.name, schoolGrade, createdAt: analysis.created_at }}
          responses={responses}
          background={background}
          checks={first14Checks}
        />
      ) : (
        <AnalysisReportV2Client
          profile={profile}
          header={{ name: analysis.name, schoolGrade, createdAt: analysis.created_at }}
          background={background}
          responses={responses}
          mbti={mbti}
          contacts={contacts}
          analysis={{ id: analysis.id, school: analysis.school, grade: analysis.grade }}
        />
      )}

      <RegistrationForm
        open={showRegForm}
        onOpenChange={setShowRegForm}
        onSubmit={handleGenerateRegistration}
        grade={analysis.grade}
        classes={classes}
        teachers={teachers}
        consultationData={consultationData}
      />

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분석 결과 삭제</DialogTitle>
            <DialogDescription>
              &quot;{analysis.name}&quot; 분석 결과를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} className="rounded-xl">
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending} className="rounded-xl">
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
