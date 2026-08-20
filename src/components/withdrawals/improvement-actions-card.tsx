"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ListChecks, MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addManualAction,
  deleteAction,
  updateActionOwner,
  updateActionStatus,
} from "@/lib/actions/improvement-action";
import {
  computeCompletionRate,
  formatYearMonthLabel,
  type ImprovementAction,
} from "@/lib/improvement-actions";

const NK_PRIMARY = "var(--primary)";
const CARD_BORDER = "rgb(var(--wr-line-soft))";

function formatDoneAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} 완료`;
}

function OwnerInput({
  action,
  onSaved,
}: {
  action: ImprovementAction;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(action.owner || "");

  const commit = () => {
    const next = value.trim();
    if (next === (action.owner || "")) return;
    updateActionOwner(action.id, next).then((result) => {
      if (result.success) onSaved();
      else toast.error(result.error || "담당자 저장 실패");
    });
  };

  return (
    <input
      className="h-7 w-24 rounded-md border border-nk-line-soft bg-nk-surface px-2 text-[11px] text-nk-ink-sub focus:outline-none focus:ring-2 focus:ring-nk-progress"
      placeholder="담당자"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
    />
  );
}

export function ImprovementActionsCard({
  currentActions,
  prevActions,
  yearMonth,
}: {
  currentActions: ImprovementAction[];
  prevActions: ImprovementAction[];
  yearMonth: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newText, setNewText] = useState("");
  const [newOwner, setNewOwner] = useState("");

  const stats = computeCompletionRate(currentActions);
  const prevStats = computeCompletionRate(prevActions);
  const monthLabel = formatYearMonthLabel(yearMonth).replace(/^\d+년\s*/, "");

  const refresh = () => router.refresh();

  const toggleStatus = (action: ImprovementAction) => {
    const next = action.status === "done" ? "pending" : "done";
    startTransition(async () => {
      const result = await updateActionStatus(action.id, next);
      if (result.success) refresh();
      else toast.error(result.error || "상태 변경 실패");
    });
  };

  const setDropped = (action: ImprovementAction) => {
    startTransition(async () => {
      const result = await updateActionStatus(
        action.id,
        action.status === "dropped" ? "pending" : "dropped"
      );
      if (result.success) refresh();
      else toast.error(result.error || "상태 변경 실패");
    });
  };

  const removeAction = (action: ImprovementAction) => {
    startTransition(async () => {
      const result = await deleteAction(action.id);
      if (result.success) {
        toast.success("실행 항목을 삭제했습니다");
        refresh();
      } else {
        toast.error(result.error || "삭제 실패");
      }
    });
  };

  const handleAdd = () => {
    if (!newText.trim()) {
      toast.error("실행 항목 내용을 입력해주세요");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("action_text", newText.trim());
      if (newOwner.trim()) formData.set("owner", newOwner.trim());

      const result = await addManualAction(formData);
      if (result.success) {
        toast.success("실행 항목을 추가했습니다");
        setNewText("");
        setNewOwner("");
        refresh();
      } else {
        toast.error(result.error || "추가 실패");
      }
    });
  };

  return (
    <div
      className="bg-nk-surface rounded-2xl p-6"
      style={{
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" style={{ color: NK_PRIMARY }} />
            <h3 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
              이번 달 실행 항목 ({monthLabel})
            </h3>
          </div>
          <p className="text-xs text-nk-ink-hint mt-0.5">
            진단에서 채택한 개선 액션의 이행 상황을 추적합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-nk-ink-hint">
              이행률
            </div>
            <div className="text-2xl font-extrabold leading-none" style={{ color: "rgb(var(--wr-ink))" }}>
              {stats.rate}
              <span className="text-sm font-bold text-nk-ink-hint">%</span>
            </div>
            <div className="text-[10px] text-nk-ink-hint mt-0.5">
              {stats.done}/{stats.done + stats.pending}건
            </div>
          </div>
          {prevStats.total > 0 && (
            <span className="inline-flex items-center rounded-full bg-nk-sunken px-2.5 py-1 text-[11px] font-semibold text-nk-ink-sub">
              전월 {prevStats.rate}%
            </span>
          )}
        </div>
      </div>

      {currentActions.length === 0 ? (
        <div
          className="rounded-xl px-4 py-6 text-center"
          style={{ background: "rgb(var(--wr-sunken))", border: `1px dashed ${CARD_BORDER}` }}
        >
          <p className="text-sm text-nk-ink-sub font-medium">아직 채택된 실행 항목이 없습니다</p>
          <p className="text-xs text-nk-ink-hint mt-1">
            위 진단 카드에서 [+ 이달 실행]으로 채택하세요
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {currentActions.map((action) => {
            const isDone = action.status === "done";
            const isDropped = action.status === "dropped";
            return (
              <li
                key={action.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: isDropped ? "rgb(var(--wr-sunken))" : "rgb(var(--wr-sunken))",
                  border: `1px solid ${CARD_BORDER}`,
                  opacity: isDropped ? 0.65 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleStatus(action)}
                  disabled={isPending || isDropped}
                  aria-label={isDone ? "완료 취소" : "완료 처리"}
                  className="h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors disabled:cursor-not-allowed"
                  style={{
                    background: isDone ? "rgb(var(--wr-status-done))" : "white",
                    border: `1px solid ${isDone ? "rgb(var(--wr-status-done))" : "rgb(var(--wr-line))"}`,
                  }}
                >
                  {isDone && <Check className="h-3 w-3 text-nk-navy-ink" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13px] leading-snug ${
                      isDone ? "line-through text-nk-ink-hint" : "text-nk-ink"
                    }`}
                  >
                    {action.action_text}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={
                        action.source === "manual"
                          ? { background: "rgb(var(--wr-sunken))", color: "rgb(var(--wr-ink-sub))" }
                          : { background: NK_PRIMARY, color: "white" }
                      }
                    >
                      {action.source === "manual" ? "직접 추가" : "진단"}
                    </span>
                    {action.source_title && (
                      <span className="text-[10px] text-nk-ink-hint truncate">
                        {action.source_title}
                      </span>
                    )}
                    {isDone && action.done_at && (
                      <span className="text-[10px] text-nk-done font-semibold">
                        {formatDoneAt(action.done_at)}
                      </span>
                    )}
                    {isDropped && (
                      <span className="text-[10px] text-nk-ink-hint font-semibold">보류됨</span>
                    )}
                  </div>
                </div>

                <OwnerInput action={action} onSaved={refresh} />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-7 w-7 rounded-md flex items-center justify-center text-nk-ink-hint hover:bg-nk-sunken transition-colors"
                      aria-label="실행 항목 메뉴"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDropped(action)}>
                      {isDropped ? "보류 해제" : "보류로 표시"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeAction(action)}
                      className="text-nk-late focus:text-nk-late"
                    >
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      {/* 수동 추가 */}
      <div className="mt-4 pt-4 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: CARD_BORDER }}>
        <input
          className="flex-1 min-w-[200px] h-9 rounded-md border border-nk-line-soft bg-nk-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nk-progress"
          placeholder="직접 추가할 실행 항목"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <input
          className="h-9 w-28 rounded-md border border-nk-line-soft bg-nk-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-nk-progress"
          placeholder="담당자"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="h-9 px-4 rounded-lg text-nk-navy-ink text-xs font-bold flex items-center gap-1.5 transition-all hover:-translate-y-px disabled:opacity-60"
          style={{ background: NK_PRIMARY }}
        >
          <Plus className="h-3.5 w-3.5" />
          추가
        </button>
      </div>
    </div>
  );
}
