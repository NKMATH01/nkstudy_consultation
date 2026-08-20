"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
import type { Proposal } from "@/lib/chat-tools";

interface ConfirmationCardProps {
  proposal: Proposal;
  entityLabel: string;
  operationLabel: string;
  summary: string;
  onConfirm: (proposal: Proposal) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
}

const OPERATION_STYLES = {
  create: { bg: "bg-nk-progress-soft", border: "border-nk-progress", icon: Plus, iconColor: "text-nk-progress", badge: "bg-nk-progress-soft text-nk-progress" },
  update: { bg: "bg-nk-warn-soft", border: "border-nk-warn", icon: Pencil, iconColor: "text-nk-warn", badge: "bg-nk-warn-soft text-nk-warn" },
  delete: { bg: "bg-nk-late-soft", border: "border-nk-late", icon: Trash2, iconColor: "text-nk-late", badge: "bg-nk-late-soft text-nk-late" },
};

const FIELD_LABELS: Record<string, string> = {
  name: "이름", school: "학교", grade: "학년", parent_phone: "학부모 연락처",
  consult_date: "상담일", consult_time: "상담시간", subject: "과목",
  location: "지점", consult_type: "상담유형", memo: "메모",
  status: "상태", result_status: "결과", phone: "전화번호",
  class_name: "반", teacher_name: "담임", teacher: "담임",
  student_name: "학생명", booking_date: "예약일", booking_hour: "예약시간",
  branch: "지점", paid: "결제", pay_method: "결제방식",
  reason_category: "퇴원사유", withdrawal_date: "퇴원일",
  enrollment_start: "등록일", enrollment_end: "종료일",
  prev_academy: "이전학원", prev_complaint: "이전불만",
  school_score: "학교성적", test_score: "테스트점수",
  advance_level: "선행수준", study_goal: "학습목표",
  prefer_days: "희망요일", plan_date: "배정일", plan_class: "배정반",
  requests: "요청사항", student_consult_note: "학생 상담 메모",
  parent_consult_note: "학부모 상담 메모",
  test_fee_paid: "테스트비 납부", test_fee_method: "테스트비 결제방식",
  is_active: "활성여부",
  comeback_possibility: "복귀가능성", special_notes: "특이사항",
  role: "역할", target_grade: "대상학년",
  class_time: "수업시간", clinic_time: "클리닉시간",
  weekly_test_time: "주간테스트", class_days: "수업요일",
  duration_months: "재원기간(월)",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(없음)";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  return String(value);
}

export function ConfirmationCard({
  proposal,
  entityLabel,
  operationLabel,
  summary,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "loading" | "confirmed" | "cancelled" | "error">("pending");
  const [resultMessage, setResultMessage] = useState("");

  const style = OPERATION_STYLES[proposal.operation] || OPERATION_STYLES.update;
  const Icon = style.icon;

  const handleConfirm = async () => {
    setStatus("loading");
    try {
      const result = await onConfirm(proposal);
      if (result.success) {
        setStatus("confirmed");
        setResultMessage(result.message);
        router.refresh();
      } else {
        setStatus("error");
        setResultMessage(result.message);
      }
    } catch {
      setStatus("error");
      setResultMessage("실행 중 오류가 발생했습니다.");
    }
  };

  const handleCancel = () => {
    setStatus("cancelled");
    onCancel();
  };

  return (
    <div className={`rounded-lg border-l-4 ${style.border} ${style.bg} p-3 my-1 text-xs`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${style.iconColor}`} />
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${style.badge}`}>
          {operationLabel}
        </span>
        <span className="font-medium text-nk-ink">{entityLabel}</span>
        <span className="text-nk-ink-sub">—</span>
        <span className="font-semibold text-nk-ink">{proposal.targetName}</span>
      </div>

      {/* 설명 */}
      <p className="text-nk-ink-sub mb-2">{proposal.description}</p>
      {summary && <p className="text-[11px] text-nk-ink-sub mb-2">{summary}</p>}

      {/* 변경 내용 */}
      {proposal.operation === "update" && proposal.currentData && (
        <div className="bg-nk-surface/60 rounded p-2 mb-2 space-y-1">
          {Object.entries(proposal.changes).map(([key, newVal]) => (
            <div key={key} className="flex items-start gap-1">
              <span className="text-nk-ink-sub min-w-[70px]">{FIELD_LABELS[key] || key}:</span>
              <span className="text-nk-late line-through">{formatValue(proposal.currentData?.[key])}</span>
              <span className="text-nk-ink-hint mx-0.5">&rarr;</span>
              <span className="text-nk-done font-medium">{formatValue(newVal)}</span>
            </div>
          ))}
        </div>
      )}

      {proposal.operation === "create" && Object.keys(proposal.changes).length > 0 && (
        <div className="bg-nk-surface/60 rounded p-2 mb-2 space-y-1">
          {Object.entries(proposal.changes).map(([key, val]) => (
            <div key={key} className="flex items-start gap-1">
              <span className="text-nk-ink-sub min-w-[70px]">{FIELD_LABELS[key] || key}:</span>
              <span className="text-nk-ink">{formatValue(val)}</span>
            </div>
          ))}
        </div>
      )}

      {proposal.operation === "delete" && proposal.currentData && (
        <div className="bg-nk-surface/60 rounded p-2 mb-2 space-y-1">
          <div className="flex items-center gap-1 text-nk-late mb-1">
            <AlertTriangle className="w-3 h-3" />
            <span className="font-medium">이 데이터가 삭제됩니다</span>
          </div>
          {Object.entries(proposal.currentData).map(([key, val]) => (
            <div key={key} className="flex items-start gap-1">
              <span className="text-nk-ink-sub min-w-[70px]">{FIELD_LABELS[key] || key}:</span>
              <span className="text-nk-ink">{formatValue(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 상태별 하단 */}
      {status === "pending" && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-nk-navy-ink text-xs font-medium transition hover:opacity-90"
            style={{ background: "rgb(var(--wr-cat-3))" }}
          >
            <Check className="w-3 h-3" />
            확인 (실행)
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-nk-line text-nk-ink-sub text-xs font-medium transition hover:bg-nk-line"
          >
            <X className="w-3 h-3" />
            취소
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="flex items-center gap-2 mt-2 text-nk-cat-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>실행 중...</span>
        </div>
      )}

      {status === "confirmed" && (
        <div className="flex items-center gap-2 mt-2 text-nk-done">
          <Check className="w-3.5 h-3.5" />
          <span className="font-medium">{resultMessage}</span>
        </div>
      )}

      {status === "cancelled" && (
        <div className="flex items-center gap-2 mt-2 text-nk-ink-hint">
          <X className="w-3.5 h-3.5" />
          <span>취소되었습니다</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 mt-2 text-nk-late">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{resultMessage}</span>
        </div>
      )}
    </div>
  );
}
