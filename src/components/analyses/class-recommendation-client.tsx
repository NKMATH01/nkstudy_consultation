"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Sparkles, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  recommendClasses,
  type ClassRecommendation,
} from "@/lib/actions/class-recommendation";

interface Props {
  analysisId: string;
  studentName: string;
  studentGrade: string | null;
  /** 상담 기록의 테스트 점수 — 있으면 초기값으로 사용 */
  initialTestScore?: string | null;
}

function parseInitialScore(value: string | null | undefined): string {
  if (!value) return "";
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? String(n) : "";
}

const TRAITS: Array<{ key: keyof ClassRecommendation; label: string }> = [
  { key: "ability_level", label: "능력" },
  { key: "study_intensity", label: "강도" },
  { key: "homework_volume", label: "숙제량" },
  { key: "class_pace", label: "속도" },
];

export function ClassRecommendationSection({ analysisId, studentName, studentGrade, initialTestScore }: Props) {
  const [testScore, setTestScore] = useState(() => parseInitialScore(initialTestScore));
  const [testDate, setTestDate] = useState("");
  const [currentProgress, setCurrentProgress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    test_level: string;
    recommendations: ClassRecommendation[];
  } | null>(null);

  const handleRecommend = async () => {
    const score = Number(testScore);
    if (!testScore || !Number.isFinite(score) || score < 0 || score > 100) {
      toast.error("테스트 점수를 0~100 사이로 입력해주세요");
      return;
    }

    setIsLoading(true);
    const res = await recommendClasses(analysisId, {
      test_score: score,
      test_date: testDate || undefined,
      current_progress: currentProgress || undefined,
    });
    setIsLoading(false);

    if (res.success && res.recommendations) {
      setResult({ test_level: res.test_level ?? "-", recommendations: res.recommendations });
      if (res.recommendations.length === 0) {
        toast.info("추천할 반이 없습니다");
      }
    } else {
      setResult(null);
      toast.error(res.error || "반 추천에 실패했습니다");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-soft))" }}
        >
          <GraduationCap className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">반 배정 추천</h2>
          <p className="text-[11px] font-semibold text-slate-400">
            {studentName} ({studentGrade || "학년 미상"}) — 설문 성향 + 테스트 점수 + 반 특성 기반
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500">테스트 점수 (0~100)</span>
          <Input
            value={testScore}
            onChange={(e) => setTestScore(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="예: 78"
            className="h-9 w-28 text-center font-bold"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500">테스트 날짜</span>
          <Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="h-9" />
        </label>
        <label className="min-w-[200px] flex-1 space-y-1">
          <span className="text-[11px] font-bold text-slate-500">현재 진도 (선행 정도)</span>
          <Input
            value={currentProgress}
            onChange={(e) => setCurrentProgress(e.target.value)}
            placeholder="예: 수학(상) 일차함수까지"
            className="h-9"
          />
        </label>
        <Button onClick={handleRecommend} disabled={isLoading} className="h-9 gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {isLoading ? "분석 중..." : "추천 받기"}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500">
            테스트 등급 <span className="font-black text-slate-700">{result.test_level}</span>
            {currentProgress && (
              <>
                {" · "}학생 진도 <span className="font-black text-slate-700">{currentProgress}</span>
              </>
            )}
            {" — 추천 순"}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {result.recommendations.map((rec, idx) => (
              <div
                key={rec.class_id}
                className="rounded-xl border bg-white p-4"
                style={{
                  borderColor: idx === 0 ? "var(--accent-warm)" : "var(--border, #E2E8F0)",
                  boxShadow: idx === 0 ? "0 4px 16px color-mix(in srgb, var(--accent-warm) 22%, transparent)" : undefined,
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {idx === 0 && "⭐ "}
                      {rec.class_name}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {rec.teacher_name || "담당 미정"} ·{" "}
                      <Users className="inline h-3 w-3" /> {rec.student_count}명
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-black"
                    style={{ background: "color-mix(in srgb, var(--primary) 9%, white)", color: "var(--primary)" }}
                  >
                    적합도 {rec.score}점
                  </span>
                </div>

                <div className="mb-2 flex flex-wrap gap-1">
                  {TRAITS.map(({ key, label }) =>
                    rec[key] ? (
                      <span
                        key={key}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                      >
                        {label} {String(rec[key])}
                      </span>
                    ) : null
                  )}
                </div>

                {rec.main_textbook && (
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <BookOpen className="h-3 w-3" />
                    {rec.main_textbook}
                    {rec.current_page != null && rec.main_total_pages != null && (
                      <> ({rec.current_page}p/{rec.main_total_pages}p)</>
                    )}
                  </p>
                )}

                <ul className="space-y-0.5">
                  {rec.match_reasons.map((reason, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-slate-500">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
