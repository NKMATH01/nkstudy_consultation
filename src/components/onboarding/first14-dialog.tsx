"use client";

// 첫 14일 확인 다이얼로그. 온보딩 목록 행에서 연다.
//
// 3행은 학생과 무관하게 고정한다 — 매번 다른 문장을 읽으면 강사가 기준을 새로 배워야 하고,
// 쌓인 결과를 학생 간에 비교할 수도 없다. 그 학생의 확인 계획은 보조문구로만 붙는다.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FIRST14_RESULT_LABEL,
  first14ItemText,
  mapPlanToRows,
  type First14Result,
  type First14RowView,
} from "@/lib/assessment/v2/first14";
import {
  getFirst14Checks,
  getFirst14Hints,
  saveFirst14Check,
  type First14Check,
} from "@/lib/actions/first14";

const RESULT_ORDER: First14Result[] = ["matched", "differed", "unobserved"];

const RESULT_STYLE: Record<First14Result, { on: string; off: string }> = {
  matched: {
    on: "border-nk-done bg-nk-done text-nk-navy-ink",
    off: "border-nk-line-soft bg-nk-surface text-nk-ink-sub hover:border-nk-done",
  },
  differed: {
    on: "border-nk-warn bg-nk-warn text-nk-navy-ink",
    off: "border-nk-line-soft bg-nk-surface text-nk-ink-sub hover:border-nk-warn",
  },
  unobserved: {
    on: "border-nk-line bg-nk-ink-hint text-nk-navy-ink",
    off: "border-nk-line-soft bg-nk-surface text-nk-ink-sub hover:border-nk-line",
  },
};

interface Props {
  analysisId: string | null;
  studentName: string;
  onOpenChange: (open: boolean) => void;
}

export function First14Dialog({ analysisId, studentName, onOpenChange }: Props) {
  const [rows, setRows] = useState<First14RowView[]>(() => mapPlanToRows([]));
  const [checks, setChecks] = useState<Record<number, First14Check>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  /** 마지막으로 불러온 분석 id. 로딩 여부를 상태로 따로 두지 않고 여기서 파생시킨다. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loading = !!analysisId && loadedFor !== analysisId;

  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;

    Promise.all([getFirst14Hints(analysisId), getFirst14Checks(analysisId)])
      .then(([hints, saved]) => {
        if (cancelled) return;
        setRows(mapPlanToRows(hints));
        const map: Record<number, First14Check> = {};
        const noteMap: Record<number, string> = {};
        for (const c of saved) {
          map[c.itemIndex] = c;
          if (c.note) noteMap[c.itemIndex] = c.note;
        }
        setChecks(map);
        setNotes(noteMap);
      })
      .finally(() => {
        if (!cancelled) setLoadedFor(analysisId);
      });

    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  const handleSave = useCallback(
    async (row: First14RowView, result: First14Result) => {
      if (!analysisId) return;
      setSavingIndex(row.index);
      const res = await saveFirst14Check({
        analysisId,
        itemIndex: row.index,
        itemText: first14ItemText(row),
        result,
        note: notes[row.index] ?? null,
      });
      setSavingIndex(null);

      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setChecks((prev) => ({ ...prev, [row.index]: res.check }));
      toast.success(`${row.title} — ${FIRST14_RESULT_LABEL[result]}로 기록했습니다`);
    },
    [analysisId, notes],
  );

  return (
    <Dialog open={!!analysisId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{studentName} · 14일 확인</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            이 확인은 강사 평가가 아니라 설문 예측의 채점입니다 — &ldquo;달랐음&rdquo;이 쌓이면
            설문을 고칩니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-nk-ink-sub">
            <Loader2 className="h-4 w-4 animate-spin" />
            불러오는 중...
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const saved = checks[row.index];
              const busy = savingIndex === row.index;
              return (
                <div key={row.index} className="rounded-xl border border-nk-line-soft p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-black text-nk-ink-hint">{row.index}</span>
                    <b className="text-[13px] font-bold text-nk-ink">{row.title}</b>
                  </div>
                  {row.hint && (
                    <p className="mt-1 pl-5 text-[11.5px] leading-snug text-nk-ink-sub">
                      {row.hint}
                    </p>
                  )}

                  <div className="mt-2 flex gap-1.5 pl-5">
                    {RESULT_ORDER.map((result) => {
                      const on = saved?.result === result;
                      return (
                        <button
                          key={result}
                          type="button"
                          disabled={busy}
                          onClick={() => handleSave(row, result)}
                          className={`min-h-[32px] flex-1 rounded-lg border-2 px-2 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                            on ? RESULT_STYLE[result].on : RESULT_STYLE[result].off
                          }`}
                        >
                          {FIRST14_RESULT_LABEL[result]}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    value={notes[row.index] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [row.index]: e.target.value }))
                    }
                    placeholder="메모 (선택) — 저장 버튼을 누를 때 함께 기록됩니다"
                    className="mt-2 ml-5 w-[calc(100%-1.25rem)] rounded-lg border border-nk-line-soft px-2.5 py-1.5 text-[12px] focus:border-nk-line focus:outline-none"
                  />

                  {saved && (
                    <p className="mt-1.5 pl-5 text-[11px] text-nk-ink-hint">
                      {saved.teacher} 기록 · {FIRST14_RESULT_LABEL[saved.result]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
