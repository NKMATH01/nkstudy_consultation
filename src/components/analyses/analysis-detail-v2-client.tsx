"use client";

// 설문 V2(학습 프로필) 분석 상세. V1 AnalysisDetailClient와 분리되어 V2 result_profile_v2만 렌더한다.
// 상담자/학부모 토글·PDF·공유·하단 메뉴는 AnalysisReportV2Client가 담당한다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, ExternalLink, FileCheck, MessageSquareText, Trash2 } from "lucide-react";
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
  contacts?: { studentPhone?: string | null; parentPhone?: string | null } | null;
  consultationData?: Record<string, string | null> | null;
  existingRegistrationId?: string | null;
  consultationId?: string | null;
}

export function AnalysisDetailV2Client({
  analysis,
  profile,
  classes,
  teachers,
  background,
  contacts,
  consultationData,
  existingRegistrationId,
  consultationId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);

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

      <AnalysisReportV2Client
        profile={profile}
        header={{ name: analysis.name, schoolGrade, createdAt: analysis.created_at }}
        background={background}
        contacts={contacts}
        analysis={{ id: analysis.id, school: analysis.school, grade: analysis.grade }}
      />

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
