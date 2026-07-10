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
  if (difficulty === "너무 어려움") return "bg-red-100 text-red-700";
  if (difficulty === "약간 어려움") return "bg-amber-100 text-amber-700";
  if (difficulty === "적당") return "bg-emerald-100 text-emerald-700";
  if (difficulty === "너무 쉬움") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-500";
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
            "radial-gradient(circle at 8% 0%, rgba(233,196,106,0.16), transparent 34%), linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)",
          boxShadow:
            "0 10px 30px color-mix(in srgb, var(--primary) 20%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "rgba(255,255,255,0.14)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          >
            <MessageSquareHeart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">
              설문 피드백
            </h1>
            <p className="text-[11.5px] font-semibold text-white/55">
              W1 적응 설문 응답과 조치 상태
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-white/12 px-3 py-2 text-right text-white">
          <div className="text-[11px] font-bold text-white/55">미조치 위험</div>
          <div className="text-xl font-black">{tooHardCount}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            icon={MessageSquareHeart}
            title="아직 들어온 피드백이 없습니다"
            description="1주 설문 링크를 보내면 응답이 이곳에 쌓입니다."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
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
                      className={`border-b border-slate-100 last:border-0 ${
                        urgent && !row.handled ? "bg-red-50/80" : "bg-white"
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900">
                          {row.name || "이름 없음"}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-400">
                          {row.maskedPhone || "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
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
                      <td className="max-w-[340px] px-4 py-3 text-slate-600">
                        <span className={urgent ? "font-semibold text-red-700" : ""}>
                          {row.freeText || "-"}
                        </span>
                        {urgent && (
                          <span className="ml-2 inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
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
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
