"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Circle, MessageSquareHeart } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import {
  markResponseHandled,
  type DripResponseRow,
} from "@/lib/actions/drip-survey";

type Props = {
  data: DripResponseRow[];
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function difficultyClass(difficulty: string): string {
  if (difficulty === "너무 어려움") return "bg-nk-late-soft text-nk-late";
  if (difficulty === "약간 어려움") return "bg-nk-warn-soft text-nk-warn";
  if (difficulty === "적당") return "bg-nk-done-soft text-nk-done";
  if (difficulty === "너무 쉬움") return "bg-nk-progress-soft text-nk-progress";
  return "bg-nk-sunken text-nk-ink-sub";
}

export function DripResponsesClient({ data }: Props) {
  const [rows, setRows] = useState(data);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tooHardCount = useMemo(
    () => rows.filter((row) => row.flag === "too_hard" && !row.handled).length,
    [rows],
  );

  const handleToggle = (id: string, handled: boolean) => {
    setPendingId(id);
    startTransition(async () => {
      const result = await markResponseHandled(id, !handled);
      if (!result.success) {
        toast.error(result.error ?? "상태 변경 실패");
        setPendingId(null);
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, handled: !handled } : row,
        ),
      );
      toast.success(!handled ? "조치완료로 표시했습니다" : "조치완료를 해제했습니다");
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)",
          boxShadow:
            "0 10px 30px color-mix(in srgb, var(--primary) 20%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "rgb(var(--wr-navy-ink) / 0.14)",
              boxShadow: "inset 0 0 0 1px rgb(var(--wr-navy-ink) / 0.18)",
            }}
          >
            <MessageSquareHeart className="h-5 w-5 text-nk-navy-ink" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-nk-navy-ink">
              설문 피드백
            </h1>
            <p className="text-[11.5px] font-semibold text-nk-navy-ink/55">
              W1 적응 설문 응답과 조치 상태
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-nk-surface/12 px-3 py-2 text-right text-nk-navy-ink">
          <div className="text-[11px] font-bold text-nk-navy-ink/55">미조치 위험</div>
          <div className="text-xl font-black">{tooHardCount}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-nk-line-soft bg-nk-surface">
          <EmptyState
            icon={MessageSquareHeart}
            title="아직 들어온 피드백이 없습니다"
            description="1주 설문 링크를 보내면 응답이 이곳에 쌓입니다."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-nk-line-soft bg-nk-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-nk-sunken">
                <tr className="border-b border-nk-line-soft text-left text-[11px] font-black uppercase tracking-wide text-nk-ink-hint">
                  <th className="px-4 py-3">작성일</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">차수</th>
                  <th className="px-4 py-3">난이도</th>
                  <th className="px-4 py-3">힘든 점</th>
                  <th className="px-4 py-3 text-right">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const urgent = row.flag === "too_hard";
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-nk-line-soft last:border-0 ${
                        urgent && !row.handled ? "bg-nk-late-soft/80" : "bg-nk-surface"
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-nk-ink-sub">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-nk-ink">
                          {row.name || "이름 없음"}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-nk-ink-hint">
                          {row.maskedPhone || "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-md bg-nk-sunken px-2 py-1 text-xs font-bold text-nk-ink-sub">
                          {row.wave || "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${difficultyClass(
                            row.difficulty,
                          )}`}
                        >
                          {row.difficulty || "-"}
                        </span>
                      </td>
                      <td className="max-w-[340px] px-4 py-3 text-nk-ink-sub">
                        <span className={urgent ? "font-semibold text-nk-late" : ""}>
                          {row.freeText || "-"}
                        </span>
                        {urgent && (
                          <span className="ml-2 inline-flex rounded-full bg-nk-late px-2 py-0.5 text-[10px] font-black text-nk-navy-ink">
                            too hard
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggle(row.id, row.handled)}
                          disabled={isPending && pendingId === row.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors disabled:opacity-50 ${
                            row.handled
                              ? "bg-nk-done-soft text-nk-done hover:bg-nk-done-soft"
                              : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
                          }`}
                        >
                          {row.handled ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Circle className="h-3.5 w-3.5" />
                          )}
                          조치완료
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
