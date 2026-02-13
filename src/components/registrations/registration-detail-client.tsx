"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, FileText, Printer, Sparkles, BookOpen, MapPin, Bus, Phone, Calendar, CreditCard, ClipboardList, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteRegistration, regenerateRegistration, updateRegistrationHtml, aiEditRegistrationHtml } from "@/lib/actions/registration";
import { RefreshCw, PenLine, Wand2, Save, X } from "lucide-react";
import type { Registration } from "@/types";
import Link from "next/link";

interface Props {
  registration: Registration;
  analysisReportHtml?: string | null;
}

export function RegistrationDetailClient({ registration, analysisReportHtml }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editHtml, setEditHtml] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [isAiEditing, setIsAiEditing] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await regenerateRegistration(registration.id);
      if (result.success) {
        toast.success("보고서가 재생성되었습니다");
        router.refresh();
      } else {
        toast.error(result.error || "보고서 재생성에 실패했습니다");
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteRegistration(registration.id);
      if (result.success) {
        toast.success("등록 안내가 삭제되었습니다");
        router.push("/onboarding");
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const handlePrint = () => {
    if (!registration.report_html) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(registration.report_html);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 500);
      };
    }
  };

  const formatFee = (fee: number | null) => {
    if (!fee) return "-";
    return `${fee.toLocaleString()}원`;
  };

  const schoolInfo = [registration.school, registration.grade].filter(Boolean).join(" ");
  const createdDate = registration.created_at
    ? new Date(registration.created_at).toLocaleDateString("ko-KR")
    : "";

  const classDisplay = registration.subject === "영어수학"
    ? `수학: ${registration.assigned_class || "-"} / 영어: ${registration.assigned_class_2 || "-"}`
    : registration.assigned_class || "-";

  const teacherDisplay = registration.subject === "영어수학"
    ? `수학: ${registration.teacher || "-"} / 영어: ${registration.teacher_2 || "-"}`
    : registration.teacher || "-";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header - 보고서 스타일 */}
      <div className="flex items-start justify-between border-b-[3px] border-emerald-800 pb-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100 mt-0.5">
            <Link href="/onboarding">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-bold text-emerald-600 tracking-widest uppercase">NK EDUCATION</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">NK 등록 안내서</h1>
            <p className="text-xs text-slate-400 mt-0.5">Student Registration Guide</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-emerald-900">{registration.name}</p>
          <p className="text-sm text-slate-500">{schoolInfo}{createdDate && ` · ${createdDate}`}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        {registration.report_html && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isRegenerating ? "animate-spin" : ""}`} />
              {isRegenerating ? "재생성 중..." : "보고서 재생성"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              PDF 다운로드
            </Button>
          </>
        )}
        {registration.analysis_id && (
          analysisReportHtml ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const win = window.open("", "_blank");
                if (win) {
                  win.document.write(analysisReportHtml);
                  win.document.close();
                }
              }}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              성향분석 보기
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <Link href={`/analyses/${registration.analysis_id}`}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                성향분석 보기
              </Link>
            </Button>
          )
        )}
        {registration.report_html && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing(false);
              setAiInstruction("");
              setIsAiEditing(!isAiEditing);
            }}
            className="rounded-xl"
          >
            <Wand2 className="h-4 w-4 mr-1.5" />
            AI 수정
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} className="rounded-xl">
          <Trash2 className="h-4 w-4 mr-1.5" />
          삭제
        </Button>
      </div>

      {/* AI 수정 입력 */}
      {isAiEditing && (
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-bold text-violet-900">AI로 안내문 수정</span>
          </div>
          <textarea
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            placeholder="수정할 내용을 입력하세요. 예: '수업료를 40만원으로 변경', '학부모 메시지 추가'"
            className="w-full h-20 px-3 py-2 rounded-xl border border-violet-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAiEditing(false)} className="rounded-xl">
              <X className="h-3.5 w-3.5 mr-1" />
              취소
            </Button>
            <Button
              size="sm"
              disabled={!aiInstruction.trim() || isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  const result = await aiEditRegistrationHtml(registration.id, aiInstruction);
                  if (result.success) {
                    toast.success("안내문이 수정되었습니다");
                    setIsAiEditing(false);
                    setAiInstruction("");
                    router.refresh();
                  } else {
                    toast.error(result.error || "수정에 실패했습니다");
                  }
                } finally {
                  setIsSaving(false);
                }
              }}
              className="rounded-xl bg-violet-600 hover:bg-violet-700"
            >
              <Wand2 className={`h-3.5 w-3.5 mr-1 ${isSaving ? "animate-spin" : ""}`} />
              {isSaving ? "수정 중..." : "AI 수정 실행"}
            </Button>
          </div>
        </div>
      )}

      {/* 수업 정보 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-emerald-600 rounded-sm" />
          <h3 className="text-base font-extrabold text-emerald-900">수업 정보</h3>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {[
                { icon: BookOpen, label: "과목", value: registration.subject, color: "text-blue-600" },
                { icon: GraduationCap, label: "배정반", value: classDisplay, color: "text-violet-600" },
                { icon: ClipboardList, label: "담임", value: teacherDisplay, color: "text-violet-600" },
                { icon: Calendar, label: "희망요일", value: registration.preferred_days, color: "text-amber-600" },
                { icon: Calendar, label: "등록 예정일", value: registration.registration_date, color: "text-emerald-600" },
                { icon: CreditCard, label: "월 수업료", value: formatFee(registration.tuition_fee), color: "text-emerald-600", bold: true },
              ].map((item) => (
                <tr key={item.label} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 w-10">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </td>
                  <td className="px-2 py-3 font-bold text-slate-600 w-28">{item.label}</td>
                  <td className={`px-4 py-3 ${item.bold ? "font-extrabold text-emerald-800 text-base" : "font-semibold text-slate-800"}`}>
                    {item.value || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 기타 정보 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-slate-500 rounded-sm" />
          <h3 className="text-base font-extrabold text-slate-800">기타 정보</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: MapPin, label: "수업 장소", value: registration.location },
            { icon: Bus, label: "차량 이용", value: registration.use_vehicle || "미사용" },
            { icon: Phone, label: "학생 연락처", value: registration.student_phone },
            { icon: Phone, label: "학부모 연락처", value: registration.parent_phone },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <item.icon className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                <p className="font-bold text-sm text-slate-800 mt-0.5">{item.value || "-"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 테스트 / 특이사항 */}
      {(registration.test_score || registration.test_note || registration.additional_note || registration.consult_date) && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 bg-amber-500 rounded-sm" />
            <h3 className="text-base font-extrabold text-slate-800">테스트 및 특이사항</h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            {registration.test_score && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-28 shrink-0">테스트 점수</span>
                <span className="font-bold text-blue-800">{registration.test_score}</span>
              </div>
            )}
            {registration.test_note && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-slate-500 w-28 shrink-0 pt-0.5">테스트 특이사항</span>
                <p className="text-sm text-slate-700 leading-relaxed">{registration.test_note}</p>
              </div>
            )}
            {registration.consult_date && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-28 shrink-0">학부모 상담일</span>
                <span className="font-semibold text-slate-800">{registration.consult_date}</span>
              </div>
            )}
            {registration.additional_note && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-slate-500 w-28 shrink-0 pt-0.5">추가 조치사항</span>
                <p className="text-sm text-slate-700 leading-relaxed">{registration.additional_note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 보고서 미리보기 - 전체 높이 표시 */}
      {registration.report_html && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 bg-emerald-600 rounded-sm" />
            <h3 className="text-base font-extrabold text-emerald-900">등록 보고서</h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <iframe
              ref={(el) => {
                if (el) {
                  const resize = () => {
                    try {
                      const h = el.contentDocument?.documentElement?.scrollHeight;
                      if (h && h > 100) el.style.height = h + 40 + "px";
                    } catch { /* cross-origin fallback */ }
                  };
                  el.addEventListener("load", resize);
                  setTimeout(resize, 500);
                  setTimeout(resize, 1500);
                }
              }}
              srcDoc={registration.report_html}
              className="w-full border-0"
              style={{ minHeight: "2400px" }}
              title="등록 보고서"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-center text-white shadow-xl">
        <p className="text-sm font-extrabold text-emerald-300">NK EDUCATION</p>
        <p className="text-xs opacity-60 mt-1">
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
