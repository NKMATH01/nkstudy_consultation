"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitDripResponse } from "@/lib/actions/drip-survey";

const DIFFICULTY_OPTIONS = [
  "너무 쉬움",
  "적당",
  "약간 어려움",
  "너무 어려움",
] as const;

type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export function FeedbackFormClient({
  token,
  wave,
}: {
  token: string;
  wave: string;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!difficulty) {
      setError("수업 난이도를 선택해 주세요.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await submitDripResponse({
        token,
        answers: {
          wave,
          difficulty,
        },
        freeText,
      });

      if (result.success) {
        setSubmitted(true);
        toast.success("응답이 제출되었습니다");
      } else {
        const message = result.error ?? "제출에 실패했습니다";
        setError(message);
        toast.error(message);
      }
    });
  };

  if (submitted) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          감사합니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          남겨주신 적응 상황을 확인하고 필요한 부분을 챙기겠습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-950 px-5 py-5 text-white">
        <div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
          NK Academy · {wave}
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          이번 주 수업은 어떠셨나요?
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/65">
          한 가지만 선택하고, 필요하면 짧게 남겨주세요.
        </p>
      </div>

      <div className="space-y-6 p-5">
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              이번 주 수업 난이도
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">필수</p>
          </div>

          <div className="grid grid-cols-1 gap-2" role="radiogroup">
            {DIFFICULTY_OPTIONS.map((option) => {
              const selected = difficulty === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setDifficulty(option);
                    setError(null);
                  }}
                  className={`flex min-h-[52px] items-center justify-between rounded-xl border px-4 text-left text-base font-bold transition-all ${
                    selected
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{option}</span>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      selected ? "border-white bg-white" : "border-slate-300"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              지금 가장 힘든 점이 있다면 한 줄로
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">선택</p>
          </div>
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            maxLength={240}
            placeholder="예: 숙제 양이 조금 많아요"
            className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-slate-50 text-base"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-12 w-full rounded-xl bg-slate-950 text-base font-black text-white hover:bg-slate-800"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              제출 중
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              제출하기
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
