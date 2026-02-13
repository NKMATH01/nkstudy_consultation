"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Edit, Trash2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, ResultBadge } from "@/components/common/status-badge";
import { ConsultationFormDialog } from "@/components/consultations/consultation-form-client";
import {
  deleteConsultation,
  updateConsultationStatus,
  updateConsultationField,
} from "@/lib/actions/consultation";
import type { Consultation, ConsultationStatus, ResultStatus } from "@/types";
import { STATUS_LABELS, RESULT_STATUS_LABELS } from "@/types";

interface Props {
  consultation: Consultation;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-center py-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
      <span className="text-[12.5px] font-medium" style={{ color: "#94A3B8" }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: value ? "#1E293B" : "#CBD5E1" }}>
        {value || "-"}
      </span>
    </div>
  );
}

export function ConsultationDetailClient({ consultation }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // 상담 내용 state
  const [studentNote, setStudentNote] = useState(consultation.student_consult_note ?? "");
  const [parentNote, setParentNote] = useState(consultation.parent_consult_note ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const studentNoteRef = useRef<HTMLTextAreaElement>(null);
  const parentNoteRef = useRef<HTMLTextAreaElement>(null);

  const notesChanged =
    studentNote !== (consultation.student_consult_note ?? "") ||
    parentNote !== (consultation.parent_consult_note ?? "");

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(80, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoResize(studentNoteRef.current);
    autoResize(parentNoteRef.current);
  }, [studentNote, parentNote, autoResize]);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const results = await Promise.all([
        updateConsultationField(consultation.id, "student_consult_note", studentNote),
        updateConsultationField(consultation.id, "parent_consult_note", parentNote),
      ]);
      if (results.every((r) => r.success)) {
        toast.success("상담 내용이 저장되었습니다");
        router.refresh();
      } else {
        toast.error("상담 내용 저장에 실패했습니다");
      }
    } catch {
      toast.error("상담 내용 저장 중 오류가 발생했습니다");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleStatusChange = (value: string) => {
    startTransition(async () => {
      const result = await updateConsultationStatus(consultation.id, value);
      if (result.success) {
        toast.success("상태가 변경되었습니다");
        router.refresh();
      } else {
        toast.error("상태 변경에 실패했습니다");
      }
    });
  };

  const handleResultChange = (value: string) => {
    startTransition(async () => {
      const result = await updateConsultationField(
        consultation.id,
        "result_status",
        value
      );
      if (result.success) {
        toast.success("결과가 변경되었습니다");
        router.refresh();
      } else {
        toast.error("결과 변경에 실패했습니다");
      }
    });
  };

  const handleToggle = (field: string, current: boolean) => {
    startTransition(async () => {
      const result = await updateConsultationField(
        consultation.id,
        field,
        !current
      );
      if (result.success) {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteConsultation(consultation.id);
      if (result.success) {
        toast.success("상담이 삭제되었습니다");
        router.push("/consultations");
      } else {
        toast.error("삭제에 실패했습니다");
      }
    });
  };

  const toggleItems = [
    { field: "doc_sent", label: "자료전송", value: consultation.doc_sent },
    { field: "call_done", label: "전화완료", value: consultation.call_done },
    { field: "notify_sent", label: "안내문발송", value: consultation.notify_sent },
    { field: "consult_done", label: "상담완료", value: consultation.consult_done },
    { field: "reserve_text_sent", label: "예약문자", value: consultation.reserve_text_sent },
    { field: "reserve_deposit", label: "예약금입금", value: consultation.reserve_deposit },
  ];

  return (
    <div className="space-y-5 max-w-2xl fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100">
            <Link href="/consultations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1
              className="text-xl font-extrabold"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              {consultation.name}
            </h1>
            <p className="text-[12.5px]" style={{ color: "#64748B" }}>
              {[consultation.school, consultation.grade].filter(Boolean).join(" ")}
              {consultation.consult_date &&
                ` | ${format(new Date(consultation.consult_date), "yyyy-MM-dd")}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[12.5px] font-semibold transition-all"
            style={{
              border: "1.5px solid #E2E8F0",
              color: "#475569",
              background: "#FFFFFF",
            }}
          >
            <Edit className="h-3.5 w-3.5" />
            수정
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[12.5px] font-semibold transition-all"
            style={{
              border: "1.5px solid #FEE2E2",
              color: "#E11D48",
              background: "#FFF1F2",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-4 flex items-center gap-2" style={{ color: "#1E293B" }}>
          <div className="w-1 h-5 rounded-full" style={{ background: "#D4A853" }} />
          빠른 상태 변경
        </h3>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-4">
            <span className="text-[12.5px] font-medium w-14" style={{ color: "#94A3B8" }}>상태</span>
            <Select
              value={consultation.status}
              onValueChange={handleStatusChange}
              disabled={isPending}
            >
              <SelectTrigger className="w-[140px] h-9 rounded-lg text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(STATUS_LABELS) as [ConsultationStatus, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <StatusBadge status={consultation.status} />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[12.5px] font-medium w-14" style={{ color: "#94A3B8" }}>결과</span>
            <Select
              value={consultation.result_status}
              onValueChange={handleResultChange}
              disabled={isPending}
            >
              <SelectTrigger className="w-[140px] h-9 rounded-lg text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(RESULT_STATUS_LABELS) as [ResultStatus, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <ResultBadge status={consultation.result_status} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "14px" }}>
          <div className="flex flex-wrap gap-2">
            {toggleItems.map(({ field, label, value }) => (
              <button
                key={field}
                disabled={isPending}
                onClick={() => handleToggle(field, value)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all disabled:opacity-50"
                style={{
                  background: value ? "#ECFDF5" : "#F8FAFC",
                  color: value ? "#059669" : "#94A3B8",
                  border: value ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                }}
              >
                {value ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1E293B" }}>
          <div className="w-1 h-5 bg-blue-500 rounded-full" />
          기본 정보
        </h3>
        <InfoRow label="이름" value={consultation.name} />
        <InfoRow label="학교" value={consultation.school} />
        <InfoRow label="학년" value={consultation.grade} />
        <InfoRow label="학부모 연락처" value={consultation.parent_phone} />
      </div>

      {/* Schedule */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1E293B" }}>
          <div className="w-1 h-5 rounded-full" style={{ background: "#D4A853" }} />
          상담 일정
        </h3>
        <InfoRow
          label="날짜"
          value={
            consultation.consult_date
              ? format(new Date(consultation.consult_date), "yyyy-MM-dd")
              : null
          }
        />
        <InfoRow label="시간" value={consultation.consult_time?.slice(0, 5)} />
        <InfoRow label="상담방식" value={consultation.consult_type} />
        <InfoRow label="과목" value={consultation.subject} />
        <InfoRow label="장소" value={consultation.location} />
      </div>

      {/* 상담 내용 (Consultation Content) */}
      {/* SQL: ALTER TABLE consultations ADD COLUMN IF NOT EXISTS student_consult_note TEXT; */}
      {/* SQL: ALTER TABLE consultations ADD COLUMN IF NOT EXISTS parent_consult_note TEXT; */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1E293B" }}>
          <div className="w-1 h-5 bg-purple-500 rounded-full" />
          상담 내용
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium" style={{ color: "#94A3B8" }}>학생 상담 내용</label>
            <textarea
              ref={studentNoteRef}
              value={studentNote}
              onChange={(e) => setStudentNote(e.target.value)}
              onInput={(e) => autoResize(e.currentTarget)}
              placeholder="학생 상담 내용을 입력하세요..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all resize-none"
              style={{ minHeight: "80px", color: "#1E293B" }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium" style={{ color: "#94A3B8" }}>학부모 상담 내용</label>
            <textarea
              ref={parentNoteRef}
              value={parentNote}
              onChange={(e) => setParentNote(e.target.value)}
              onInput={(e) => autoResize(e.currentTarget)}
              placeholder="학부모 상담 내용을 입력하세요..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all resize-none"
              style={{ minHeight: "80px", color: "#1E293B" }}
            />
          </div>
          {notesChanged && (
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all disabled:opacity-50"
                style={{
                  background: "#8B5CF6",
                  color: "#FFFFFF",
                  boxShadow: "0 1px 3px rgba(139,92,246,0.3)",
                }}
              >
                {isSavingNotes ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1E293B" }}>
          <div className="w-1 h-5 bg-indigo-500 rounded-full" />
          상세 정보
        </h3>
        <InfoRow label="메모" value={consultation.memo} />
        <InfoRow label="학습태도" value={consultation.attitude} />
        <InfoRow label="학습의지" value={consultation.willingness} />
        <InfoRow label="학부모강도" value={consultation.parent_level} />
        <InfoRow label="학생강도" value={consultation.student_level} />
        <InfoRow label="요청사항" value={consultation.requests} />
        <InfoRow label="기존학원" value={consultation.prev_academy} />
        <InfoRow label="기존학원 불만" value={consultation.prev_complaint} />
        <InfoRow label="내신점수" value={consultation.school_score} />
        <InfoRow label="테스트점수" value={consultation.test_score} />
      </div>

      {/* Registration Info */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1E293B" }}>
          <div className="w-1 h-5 bg-emerald-500 rounded-full" />
          등록 관련
        </h3>
        <InfoRow label="예정등록일" value={consultation.plan_date} />
        <InfoRow label="예정반명" value={consultation.plan_class} />
        <InfoRow label="희망요일" value={consultation.prefer_days} />
        <InfoRow label="결제방식" value={consultation.payment_type} />
        <InfoRow label="유입경로" value={consultation.referral} />
        <InfoRow label="학원친구" value={consultation.has_friend} />
        <InfoRow label="선행정도" value={consultation.advance_level} />
        <InfoRow label="학습목표" value={consultation.study_goal} />
      </div>

      {/* Edit Dialog */}
      <ConsultationFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        consultation={consultation}
      />

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상담 삭제</DialogTitle>
            <DialogDescription>
              &quot;{consultation.name}&quot; 학생의 상담 데이터를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
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
