"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, NotebookPen, PencilLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { saveRetrospective } from "@/lib/actions/withdrawal";
import {
  EMPTY_RETROSPECTIVE,
  isRetrospectiveComplete,
  type WithdrawalRetrospective,
} from "@/lib/withdrawal-retrospective";
import type { Withdrawal } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal: Withdrawal;
}

/** 작성자 이름을 브라우저에 기억시켜 매번 다시 입력하지 않게 한다. */
const AUTHOR_STORAGE_KEY = "nkc-retro-author";

const QUESTIONS: Array<{
  key: keyof Pick<
    WithdrawalRetrospective,
    "first_sign" | "our_attempts" | "do_differently" | "system_change"
  >;
  no: string;
  label: string;
  placeholder: string;
}> = [
  {
    key: "first_sign",
    no: "①",
    label: "첫 징후는 언제, 무엇이었나요?",
    placeholder: "예: 3월 중순부터 숙제 미제출이 잦아짐",
  },
  {
    key: "our_attempts",
    no: "②",
    label: "우리가 시도한 개입은 무엇이었나요?",
    placeholder: "예: 담당 강사 면담 2회, 학부모 통화 1회",
  },
  {
    key: "do_differently",
    no: "③",
    label: "시간을 돌린다면 다르게 할 것은?",
    placeholder: "예: 첫 징후 시점에 바로 학부모와 공유",
  },
  {
    key: "system_change",
    no: "④",
    label: "시스템적으로 바꿀 것 하나를 꼽는다면?",
    placeholder: "예: 숙제 2회 연속 미제출 시 자동 알림",
  },
];

function readStoredAuthor(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(AUTHOR_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberAuthor(author: string) {
  if (typeof window === "undefined" || !author.trim()) return;
  try {
    window.localStorage.setItem(AUTHOR_STORAGE_KEY, author.trim());
  } catch {
    // 저장 실패는 기능에 영향이 없으므로 무시한다.
  }
}

export function WithdrawalRetrospectiveDialog({ open, onOpenChange, withdrawal }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const formKey = `${open ? "open" : "closed"}:${withdrawal.id}`;
  const initial: WithdrawalRetrospective = withdrawal.retrospective
    ? { ...withdrawal.retrospective }
    : { ...EMPTY_RETROSPECTIVE, author: readStoredAuthor() };

  const [draftState, setDraftState] = useState<{ key: string; value: WithdrawalRetrospective }>(
    () => ({ key: formKey, value: initial })
  );
  const draft = draftState.key === formKey ? draftState.value : initial;

  const updateField = (key: keyof WithdrawalRetrospective, value: string) => {
    setDraftState((current) => {
      const base = current.key === formKey ? current.value : initial;
      return { key: formKey, value: { ...base, [key]: value } };
    });
  };

  const complete = isRetrospectiveComplete(draft);

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("first_sign", draft.first_sign);
      formData.set("our_attempts", draft.our_attempts);
      formData.set("do_differently", draft.do_differently);
      formData.set("system_change", draft.system_change);
      formData.set("lesson", draft.lesson);
      formData.set("manager_comment", draft.manager_comment);
      formData.set("author", draft.author);

      const result = await saveRetrospective(withdrawal.id, formData);
      if (result.success) {
        rememberAuthor(draft.author);
        toast.success(complete ? "회고가 저장되었습니다" : "작성 중인 회고를 저장했습니다");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "회고 저장 실패");
      }
    });
  };

  const textareaCls =
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5";

  const infoItems = [
    { label: "퇴원일", value: withdrawal.withdrawal_date || "-" },
    { label: "사유", value: withdrawal.reason_category || "미입력" },
    { label: "담당", value: withdrawal.teacher ? `${withdrawal.teacher} T` : "-" },
    {
      label: "재원",
      value: withdrawal.duration_months != null ? `${withdrawal.duration_months}개월` : "-",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5" />
            퇴원 회고 — {withdrawal.name}
            {withdrawal.class_name && (
              <span className="text-sm font-normal text-slate-400">({withdrawal.class_name})</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 읽기 전용 정보 스트립 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {infoItems.map((item) => (
              <div key={item.label} className="rounded-lg px-3 py-2" style={{ background: "#F1F5F9" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.label}
                </div>
                <div className="text-xs font-bold text-slate-700 mt-0.5 truncate">{item.value}</div>
              </div>
            ))}
          </div>

          {/* 상태 pill */}
          <div className="flex items-center gap-2 flex-wrap">
            {complete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <CircleCheck className="h-3 w-3" />
                회고 완료 조건 충족
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
                <PencilLine className="h-3 w-3" />
                작성 중
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              부분 저장도 가능합니다 — 나중에 이어서 작성할 수 있습니다
            </span>
          </div>

          {/* 4문항 */}
          <div className="space-y-3">
            {QUESTIONS.map((q) => (
              <div key={q.key}>
                <label className={labelCls}>
                  <span
                    className="inline-flex items-center justify-center h-4 w-4 rounded text-[10px] font-extrabold text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    {q.no}
                  </span>
                  {q.label}
                </label>
                <textarea
                  className={textareaCls}
                  rows={2}
                  placeholder={q.placeholder}
                  value={draft[q.key]}
                  onChange={(e) => updateField(q.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* 배움 한 줄 */}
          <div className="rounded-xl p-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <label className="text-xs font-bold text-amber-800 mb-1 block">
              배움 한 줄 <span className="font-normal text-amber-600">(최대 120자)</span>
            </label>
            <input
              className="w-full h-9 rounded-md border border-amber-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              maxLength={120}
              placeholder="이 퇴원에서 학원이 배운 것 한 문장"
              value={draft.lesson}
              onChange={(e) => updateField("lesson", e.target.value)}
            />
            <div className="text-[10px] text-amber-600 mt-1 text-right">{draft.lesson.length}/120</div>
          </div>

          {/* 원장 코멘트 · 작성자 */}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>원장 코멘트 (선택)</label>
              <textarea
                className={textareaCls}
                rows={2}
                placeholder="추가 지시나 판단이 있으면 적어주세요"
                value={draft.manager_comment}
                onChange={(e) => updateField("manager_comment", e.target.value)}
              />
            </div>
            <div className="w-56">
              <label className={labelCls}>작성자</label>
              <input
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="이름"
                value={draft.author}
                onChange={(e) => updateField("author", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={isPending} style={{ background: "var(--primary)" }}>
              {isPending ? "저장 중..." : "회고 저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
