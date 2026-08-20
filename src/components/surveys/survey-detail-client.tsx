"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Brain, Loader2, Sparkles, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteSurvey } from "@/lib/actions/survey";
import { analyzeSurvey } from "@/lib/actions/analysis";
import { analyzeSurveyV2 } from "@/lib/actions/analysis-v2";
import { SurveyV2ResponseView } from "@/components/surveys/survey-v2-response-view";

import type { Survey } from "@/types";
import { SURVEY_QUESTIONS, FACTOR_LABELS } from "@/types";
import { useState } from "react";
import Link from "next/link";

interface Props {
  survey: Survey;
  analysisReportHtml?: string | null;
  analysisId?: string | null;
  consultationId?: string | null;
}

const FACTOR_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  attitude: { bar: "from-nk-progress to-nk-progress", bg: "bg-nk-progress-soft", text: "text-nk-progress" },
  self_directed: { bar: "from-nk-cat-3 to-nk-cat-3", bg: "bg-nk-cat-3-soft", text: "text-nk-cat-3" },
  assignment: { bar: "from-nk-done to-nk-done", bg: "bg-nk-done-soft", text: "text-nk-done" },
  willingness: { bar: "from-nk-warn to-nk-warn", bg: "bg-nk-warn-soft", text: "text-nk-warn" },
  social: { bar: "from-nk-late to-nk-late", bg: "bg-nk-late-soft", text: "text-nk-late" },
  management: { bar: "from-nk-late to-nk-late", bg: "bg-nk-late-soft", text: "text-nk-late" },
  emotion: { bar: "from-nk-cat-1 to-nk-cat-1", bg: "bg-nk-cat-1-soft", text: "text-nk-cat-1" },
};

function ScoreBar({ value, label, factorKey }: { value: number | null; label: string; factorKey: string }) {
  const v = value ?? 0;
  const pct = (v / 5) * 100;
  const colors = FACTOR_COLORS[factorKey] || FACTOR_COLORS.attitude;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold" style={{ color: "rgb(var(--wr-ink))" }}>{label}</span>
        <span className={`text-sm font-bold ${colors.text}`}>{v.toFixed(1)}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgb(var(--wr-sunken))" }}>
        <div
          className={`h-full bg-gradient-to-r ${colors.bar} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SurveyDetailClient({ survey, analysisReportHtml, analysisId, consultationId }: Props) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteSurvey(survey.id);
      if (result.success) {
        toast.success("설문이 삭제되었습니다");
        router.push("/surveys");
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result =
        survey.instrument_version === "v2"
          ? await analyzeSurveyV2(survey.id)
          : await analyzeSurvey(survey.id);
      if (result.success && result.data) {
        toast.success("성향분석이 완료되었습니다");
        router.push(`/analyses/${result.data.id}`);
      } else {
        toast.error(result.error || "분석에 실패했습니다");
      }
    } catch {
      toast.error("분석 중 오류가 발생했습니다");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const baseFKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;
  const factorKeys = survey.factor_emotion != null ? [...baseFKeys, "emotion" as const] : baseFKeys;
  const isV2 = survey.instrument_version === "v2";

  return (
    <div className="space-y-5 max-w-4xl fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-nk-sunken">
            <Link href="/surveys">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1
              className="text-xl font-extrabold flex items-center gap-2"
              style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em" }}
            >
              {survey.name}
              {isV2 && (
                <span className="rounded border border-nk-cat-3 bg-nk-cat-3-soft px-1.5 py-0.5 text-[10px] font-black text-nk-cat-3">
                  V2 학습 프로필
                </span>
              )}
            </h1>
            <p className="text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>
              {[survey.school, survey.grade].filter(Boolean).join(" ")}
              {survey.created_at && ` | ${new Date(survey.created_at).toLocaleDateString("ko-KR")}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {consultationId && (
            <Button variant="outline" size="sm" asChild className="rounded-[7px]">
              <Link href={`/consultations/${consultationId}`}>
                <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
                상담 보기
              </Link>
            </Button>
          )}
          {(survey.analysis_id || analysisId) ? (
            <Button variant="outline" size="sm" asChild className="rounded-[7px]">
              <Link href={`/analyses/${survey.analysis_id || analysisId}`}>분석 보기</Link>
            </Button>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-nk-navy-ink text-[12.5px] font-semibold transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, rgb(var(--wr-cat-3)), rgb(var(--wr-cat-3)))",
                boxShadow: "0 2px 8px rgb(var(--wr-cat-3) / 0.3)",
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  분석 중입니다 (최대 60초 소요)
                </>
              ) : (
                <>
                  <Brain className="h-3.5 w-3.5" />
                  성향분석
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[12.5px] font-semibold transition-all"
            style={{
              border: "1.5px solid rgb(var(--wr-status-late-soft))",
              color: "rgb(var(--wr-status-late))",
              background: "rgb(var(--wr-status-late-soft))",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      </div>

      <div ref={contentRef} className="space-y-5">
      {isV2 && <SurveyV2ResponseView survey={survey} />}

      {/* Basic Info */}
      {!isV2 && (
      <div
        className="bg-nk-surface rounded-2xl p-6"
        style={{ border: "1px solid rgb(var(--wr-navy-strong) / 0.04)", boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-4 flex items-center gap-2" style={{ color: "rgb(var(--wr-ink))" }}>
          <div className="w-1 h-5 bg-nk-progress rounded-full" />
          기본 정보
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { label: "학생 연락처", value: survey.student_phone },
            { label: "학부모 연락처", value: survey.parent_phone },
            { label: "유입경로", value: survey.referral },
            { label: "기존 학원", value: survey.prev_academy },
            { label: "내신점수", value: survey.school_score },
            { label: "모의고사/전국단위 성적", value: survey.mock_exam_score },
            { label: "현재 진도/선행 정도", value: survey.advance_level },
            { label: "통학 수단", value: survey.commute_method },
            { label: "통원 소요 시간/거리", value: survey.commute_distance },
            { label: "형제·자매", value: survey.sibling_enrolled },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="text-[10.5px] font-medium uppercase" style={{ color: "rgb(var(--wr-ink-hint))", letterSpacing: "0.04em" }}>
                {label}
              </span>
              <p className="text-[13px] font-semibold mt-0.5" style={{ color: value ? "rgb(var(--wr-ink))" : "rgb(var(--wr-line))" }}>
                {value || "-"}
              </p>
            </div>
          ))}
        </div>
        {survey.prev_complaint && (
          <div
            className="mt-4 p-3 rounded-xl"
            style={{ background: "rgb(var(--wr-status-warn-soft))", borderLeft: "3px solid rgb(var(--wr-status-warn))" }}
          >
            <span className="text-[10.5px] font-semibold" style={{ color: "rgb(var(--wr-status-warn))" }}>기존 학원 아쉬운점</span>
            <p className="text-[12.5px] mt-0.5" style={{ color: "rgb(var(--wr-status-warn))" }}>{survey.prev_complaint}</p>
          </div>
        )}
      </div>
      )}

      {/* 6-Factor Scores + 35문항 (V1 전용) */}
      {!isV2 && (
      <>
      <div
        className="bg-nk-surface rounded-2xl p-6"
        style={{ border: "1px solid rgb(var(--wr-navy-strong) / 0.04)", boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-5 flex items-center gap-2" style={{ color: "rgb(var(--wr-ink))" }}>
          <div className="w-1 h-5 bg-nk-progress rounded-full" />
          7-Factor 학습 성향
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {factorKeys.map((key) => (
            <ScoreBar
              key={key}
              factorKey={key}
              label={FACTOR_LABELS[key]}
              value={survey[`factor_${key}` as keyof Survey] as number | null}
            />
          ))}
        </div>

        {/* Summary mini cards */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-5 pt-4" style={{ borderTop: "1px solid rgb(var(--wr-sunken))" }}>
          {factorKeys.map((key) => {
            const v = (survey[`factor_${key}` as keyof Survey] as number | null) ?? 0;
            const colors = FACTOR_COLORS[key];
            return (
              <div
                key={key}
                className={`${colors.bg} rounded-xl p-2.5 text-center`}
              >
                <div className={`text-lg font-bold ${colors.text}`}>{v.toFixed(1)}</div>
                <div className="text-[9px] font-semibold mt-0.5" style={{ color: "rgb(var(--wr-ink-sub))" }}>
                  {FACTOR_LABELS[key].slice(0, 4)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 30 Questions */}
      <div
        className="bg-nk-surface rounded-2xl p-6"
        style={{ border: "1px solid rgb(var(--wr-navy-strong) / 0.04)", boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-4 flex items-center gap-2" style={{ color: "rgb(var(--wr-ink))" }}>
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--accent-warm)" }} />
          설문 응답 ({SURVEY_QUESTIONS.length}문항)
        </h3>
        <div className="space-y-1">
          {SURVEY_QUESTIONS.map((q, idx) => {
            const qNum = idx + 1;
            const score = survey[`q${qNum}` as keyof Survey] as number | null;
            return (
              <div
                key={qNum}
                className="flex items-center gap-2.5 py-1.5 rounded-lg px-2 transition-colors hover:bg-[rgb(var(--wr-sunken))]"
              >
                <span
                  className="text-[11px] font-bold w-6 text-right shrink-0"
                  style={{ color: "rgb(var(--wr-line))" }}
                >
                  {qNum}
                </span>
                <span className="flex-1 text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>{q}</span>
                <div className="flex gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const isSelected = score === s;
                    return (
                      <div
                        key={s}
                        className="h-6 w-6 rounded-md text-[10px] font-bold flex items-center justify-center transition-all"
                        style={{
                          background: isSelected
                            ? s >= 4
                              ? "linear-gradient(135deg, rgb(var(--wr-status-done)), rgb(var(--wr-status-done)))"
                              : s >= 3
                                ? "linear-gradient(135deg, rgb(var(--wr-status-warn)), rgb(var(--wr-status-warn)))"
                                : "linear-gradient(135deg, rgb(var(--wr-status-late)), rgb(var(--wr-status-late)))"
                            : "rgb(var(--wr-sunken))",
                          color: isSelected ? "rgb(var(--wr-surface))" : "rgb(var(--wr-line))",
                          boxShadow: isSelected ? "0 2px 4px rgb(var(--wr-navy-strong) / 0.1)" : "none",
                        }}
                      >
                        {s}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* Open-ended Answers */}
      {!isV2 && (
      <div
        className="bg-nk-surface rounded-2xl p-6"
        style={{ border: "1px solid rgb(var(--wr-navy-strong) / 0.04)", boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}
      >
        <h3 className="text-[14.5px] font-bold mb-4 flex items-center gap-2" style={{ color: "rgb(var(--wr-ink))" }}>
          <div className="w-1 h-5 bg-nk-done rounded-full" />
          주관식 답변
        </h3>
        <div className="space-y-3">
          {[
            { label: "공부의 핵심", value: survey.study_core },
            { label: "본인의 학습 문제점", value: survey.problem_self },
            { label: "목표 대학/계열", value: survey.target_university },
            { label: "희망 직업", value: survey.dream },
            { label: "주중 자습 가능 시간", value: survey.weekly_study_hours },
            { label: "등원 가능 시간대", value: survey.available_time },
            { label: "선호 요일", value: survey.prefer_days },
            { label: "학부모 기대치/요청", value: survey.parent_expectation },
            { label: "NK학원에 바라는 점", value: survey.requests },
            { label: "수학 어려운 영역", value: survey.math_difficulty },
            { label: "영어 어려운 영역", value: survey.english_difficulty },
            { label: "MBTI", value: survey.mbti },
            { label: "건강·특이사항", value: survey.health_note },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="p-3.5 rounded-xl"
              style={{ background: value ? "rgb(var(--wr-sunken))" : "transparent" }}
            >
              <span
                className="text-[10.5px] font-semibold uppercase"
                style={{ color: "rgb(var(--wr-ink-hint))", letterSpacing: "0.04em" }}
              >
                {label}
              </span>
              <p
                className="text-[13px] font-medium mt-0.5"
                style={{ color: value ? "rgb(var(--wr-ink))" : "rgb(var(--wr-line))" }}
              >
                {value || "-"}
              </p>
            </div>
          ))}
        </div>
      </div>
      )}

      </div>

      {/* 성향분석 결과 보고서 (V1 전용). V2는 report_html 잔존물 대신 상단 "분석 보기"로 /analyses/[id] 안내. */}
      {!isV2 && analysisReportHtml && (
        <div
          className="bg-nk-surface rounded-2xl p-6"
          style={{ border: "1px solid rgb(var(--wr-navy-strong) / 0.04)", boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}
        >
          <h3 className="text-[14.5px] font-bold mb-4 flex items-center gap-2" style={{ color: "rgb(var(--wr-ink))" }}>
            <div className="w-1 h-5 bg-nk-cat-3 rounded-full" />
            성향분석 결과
            {(survey.analysis_id || analysisId) && (
              <Link href={`/analyses/${survey.analysis_id || analysisId}`} className="ml-auto text-xs text-nk-cat-3 hover:text-nk-cat-3 font-semibold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                상세보기
              </Link>
            )}
          </h3>
          <div className="rounded-xl border border-nk-line-soft overflow-hidden">
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
              srcDoc={analysisReportHtml}
              className="w-full border-0"
              style={{ minHeight: "2400px" }}
              title="성향분석 결과"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>설문 삭제</DialogTitle>
            <DialogDescription>
              &quot;{survey.name}&quot; 설문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
