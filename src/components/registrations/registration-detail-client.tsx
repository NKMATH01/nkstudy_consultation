"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteRegistration } from "@/lib/actions/registration";
import type { Registration } from "@/types";
import Link from "next/link";

interface Props {
  registration: Registration;
}

interface TendencyItem {
  title: string;
  score: number;
  color: string;
  comment: string;
}

interface GuideItem {
  title: string;
  description: string;
}

interface FocusPoint {
  number: string;
  title: string;
  description: string;
}

interface ReportData {
  page1?: {
    profileSummary?: string;
    tendencyAnalysis?: TendencyItem[];
    managementGuide?: GuideItem[];
    actionChecklist?: string[];
  };
  page2?: {
    welcomeMessage?: string;
    expertDiagnosis?: string;
    focusPoints?: FocusPoint[];
  };
}

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-50",
  red: "bg-red-50",
  orange: "bg-orange-50",
  emerald: "bg-emerald-50",
};

const SCORE_COLOR_MAP: Record<string, string> = {
  indigo: "text-indigo-600",
  red: "text-red-600",
  orange: "text-orange-600",
  emerald: "text-emerald-600",
};

export function RegistrationDetailClient({ registration }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteRegistration(registration.id);
      if (result.success) {
        toast.success("등록 안내가 삭제되었습니다");
        router.push("/registrations");
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const report = (registration.report_data || {}) as ReportData;
  const page1 = report.page1 || {};
  const page2 = report.page2 || {};

  const formatFee = (fee: number | null) => {
    if (!fee) return "-";
    return `${fee.toLocaleString()}원`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100">
            <Link href="/registrations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{registration.name}</h1>
            <p className="text-sm text-slate-500">
              {[registration.school, registration.grade].filter(Boolean).join(" ")}
              {registration.created_at &&
                ` | ${new Date(registration.created_at).toLocaleDateString("ko-KR")}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {registration.analysis_id && (
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <Link href={`/analyses/${registration.analysis_id}`}>분석 보기</Link>
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
            className="rounded-xl"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            삭제
          </Button>
        </div>
      </div>

      {/* 학생 + 행정 정보 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-indigo-500 rounded-full" />
          등록 정보
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
          {[
            { label: "배정반", value: registration.assigned_class },
            { label: "담임", value: registration.teacher },
            { label: "등록 예정일", value: registration.registration_date },
            { label: "수업료", value: formatFee(registration.tuition_fee) },
            { label: "수업 장소", value: registration.location },
            { label: "차량 이용", value: registration.use_vehicle || "미사용" },
            { label: "학생 연락처", value: registration.student_phone },
            { label: "학부모 연락처", value: registration.parent_phone },
            { label: "테스트 점수", value: registration.test_score },
          ].map((item) => (
            <div key={item.label}>
              <span className="text-xs text-slate-400 font-medium">{item.label}</span>
              <p className="font-semibold text-slate-700 mt-0.5">{item.value || "-"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Page 1: 진단 요약 */}
      {page1.profileSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            진단 결과 요약
          </h3>
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
            <p className="text-sm leading-relaxed text-slate-700">{page1.profileSummary}</p>
          </div>
        </div>
      )}

      {/* Page 1: 성향 분석 */}
      {page1.tendencyAnalysis && page1.tendencyAnalysis.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-violet-500 rounded-full" />
            학습 성향 분석
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {page1.tendencyAnalysis.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl ${COLOR_MAP[item.color] || "bg-slate-50"}`}
              >
                <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                <p
                  className={`text-2xl font-bold mt-1 ${SCORE_COLOR_MAP[item.color] || "text-slate-700"}`}
                >
                  {item.score}/5
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page 1: 관리 가이드 */}
      {page1.managementGuide && page1.managementGuide.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            맞춤 관리 가이드
          </h3>
          <div className="space-y-3">
            {page1.managementGuide.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl">
                <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page 1: 체크리스트 */}
      {page1.actionChecklist && page1.actionChecklist.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-emerald-500 rounded-full" />
            실천 체크리스트
          </h3>
          <div className="bg-emerald-50 p-5 rounded-xl space-y-2.5">
            {page1.actionChecklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-sm">
                <div className="w-5 h-5 border-2 border-emerald-500 rounded-md shrink-0" />
                <span className="text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page 2: 환영 메시지 */}
      {page2.welcomeMessage && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
          <p className="text-sm leading-relaxed text-blue-800">
            {page2.welcomeMessage}
          </p>
        </div>
      )}

      {/* Page 2: 전문가 진단 */}
      {page2.expertDiagnosis && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            전문가 진단
          </h3>
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
            <p className="text-sm leading-relaxed text-slate-700">{page2.expertDiagnosis}</p>
          </div>
        </div>
      )}

      {/* Page 2: 집중 관리 포인트 */}
      {page2.focusPoints && page2.focusPoints.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-purple-500 rounded-full" />
            집중 관리 포인트
          </h3>
          <div className="space-y-3">
            {page2.focusPoints.map((item, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-indigo-500/20">
                  {item.number}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 푸터 정보 */}
      <div className="bg-slate-100 rounded-2xl p-5 text-center text-xs text-slate-500">
        <p className="font-medium">NK EDUCATION | 계좌: 신한은행 110-383-883419 (노윤희)</p>
        <p className="mt-1">
          생성일: {new Date(registration.created_at).toLocaleDateString("ko-KR")}
        </p>
      </div>

      {/* 삭제 확인 */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>등록 안내 삭제</DialogTitle>
            <DialogDescription>
              &quot;{registration.name}&quot; 등록 안내를 삭제하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} className="rounded-xl">
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-xl"
            >
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
