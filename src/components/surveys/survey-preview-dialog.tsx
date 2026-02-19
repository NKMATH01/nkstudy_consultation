"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, MessageCircle } from "lucide-react";
import type { Survey } from "@/types";
import { SURVEY_QUESTIONS, FACTOR_LABELS } from "@/types";
import { downloadElementAsPdf } from "@/lib/pdf";
import { shareViaKakao } from "@/lib/kakao";
import { createReportToken } from "@/lib/actions/report-token";
import { toast } from "sonner";

const FACTOR_COLORS: Record<string, { bar: string; text: string }> = {
  attitude: { bar: "bg-blue-500", text: "text-blue-600" },
  self_directed: { bar: "bg-violet-500", text: "text-violet-600" },
  assignment: { bar: "bg-emerald-500", text: "text-emerald-600" },
  willingness: { bar: "bg-amber-500", text: "text-amber-600" },
  social: { bar: "bg-pink-500", text: "text-pink-600" },
  management: { bar: "bg-red-500", text: "text-red-600" },
  emotion: { bar: "bg-cyan-500", text: "text-cyan-600" },
};

const BASE_FACTOR_KEYS = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;

interface Props {
  survey: Survey | null;
  analysisReportHtml?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurveyPreviewDialog({ survey, analysisReportHtml, open, onOpenChange }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  if (!survey) return null;

  const handlePdfDownload = async () => {
    if (!contentRef.current) return;
    setPdfLoading(true);
    try {
      await downloadElementAsPdf(contentRef.current, `${survey.name}_설문지.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleKakaoShare = async () => {
    if (!analysisReportHtml) {
      alert("분석 결과가 없습니다. 먼저 성향분석을 실행해주세요.");
      return;
    }
    setShareLoading(true);
    toast.info("공유 링크 생성 중...");
    try {
      const result = await createReportToken({
        reportType: "analysis",
        reportHtml: analysisReportHtml,
        name: survey.name,
      });
      if (!result.success || !result.token) {
        toast.error("공유 링크 생성에 실패했습니다");
        return;
      }
      const desc = [survey.school, survey.grade].filter(Boolean).join(" ");
      shareViaKakao({
        title: `${survey.name} 성향분석 결과`,
        description: desc ? `${desc} | NK학원 학습 성향 분석 결과` : "NK학원 학습 성향 분석 결과",
        pageUrl: `/report/${result.token}`,
      });
    } catch {
      toast.error("카카오톡 공유에 실패했습니다");
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-extrabold" style={{ color: "#0F172A" }}>
                {survey.name} 설문지
              </DialogTitle>
              <p className="text-xs text-slate-500">
                {[survey.school, survey.grade].filter(Boolean).join(" ")}
                {survey.created_at && ` | ${new Date(survey.created_at).toLocaleDateString("ko-KR")}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mr-6">
              <button
                onClick={handlePdfDownload}
                disabled={pdfLoading}
                className="h-8 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all hover:shadow-sm bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                title="PDF 다운로드"
              >
                <Download className="h-3.5 w-3.5" />
                {pdfLoading ? "생성 중..." : "PDF"}
              </button>
              <button
                onClick={handleKakaoShare}
                disabled={shareLoading}
                className="h-8 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all hover:shadow-sm bg-yellow-50 text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
                title="카카오톡 공유"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {shareLoading ? "공유 중..." : "카카오톡"}
              </button>
            </div>
          </div>
        </DialogHeader>

        <div ref={contentRef}>
        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            { label: "학생 연락처", value: survey.student_phone },
            { label: "학부모 연락처", value: survey.parent_phone },
            { label: "유입경로", value: survey.referral },
            { label: "기존 학원", value: survey.prev_academy },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
              <p className="text-xs font-semibold mt-0.5" style={{ color: value ? "#1E293B" : "#CBD5E1" }}>
                {value || "-"}
              </p>
            </div>
          ))}
        </div>

        {survey.prev_complaint && (
          <div className="p-2.5 rounded-lg mt-1" style={{ background: "#FFF7ED", borderLeft: "3px solid #F59E0B" }}>
            <span className="text-[10px] font-semibold text-amber-600">기존 학원 아쉬운점</span>
            <p className="text-xs mt-0.5 text-amber-900">{survey.prev_complaint}</p>
          </div>
        )}

        {/* 7-Factor 점수 */}
        <div className="mt-3 p-3 rounded-xl bg-slate-50">
          <h4 className="text-xs font-bold text-slate-700 mb-2.5">7-Factor 학습 성향</h4>
          <div className="space-y-2">
            {(survey.factor_emotion != null ? [...BASE_FACTOR_KEYS, "emotion" as const] : BASE_FACTOR_KEYS).map((key) => {
              const v = (survey[`factor_${key}` as keyof Survey] as number | null) ?? 0;
              const pct = (v / 5) * 100;
              const colors = FACTOR_COLORS[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-slate-600">{FACTOR_LABELS[key]}</span>
                    <span className={`text-[11px] font-bold ${colors.text}`}>{v.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 30문항 응답 */}
        <div className="mt-3">
          <h4 className="text-xs font-bold text-slate-700 mb-2">설문 응답 ({SURVEY_QUESTIONS.length}문항)</h4>
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-1">
            {SURVEY_QUESTIONS.map((q, idx) => {
              const qNum = idx + 1;
              const score = survey[`q${qNum}` as keyof Survey] as number | null;
              return (
                <div key={qNum} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-50">
                  <span className="text-[10px] font-bold w-5 text-right shrink-0 text-slate-300">{qNum}</span>
                  <span className="flex-1 text-[11px] text-slate-600">{q}</span>
                  <div className="flex gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const isSelected = score === s;
                      return (
                        <div
                          key={s}
                          className="h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center"
                          style={{
                            background: isSelected
                              ? s >= 4 ? "#10B981" : s >= 3 ? "#F59E0B" : "#EF4444"
                              : "#F1F5F9",
                            color: isSelected ? "#FFF" : "#CBD5E1",
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

        {/* 주관식 답변 */}
        <div className="mt-3">
          <h4 className="text-xs font-bold text-slate-700 mb-2">주관식 답변</h4>
          <div className="space-y-2">
            {[
              { label: "공부의 핵심", value: survey.study_core },
              { label: "본인의 학습 문제점", value: survey.problem_self },
              { label: "희망 직업", value: survey.dream },
              { label: "선호 요일", value: survey.prefer_days },
              { label: "NK학원에 바라는 점", value: survey.requests },
              { label: "수학 어려운 영역", value: survey.math_difficulty },
              { label: "영어 어려운 영역", value: survey.english_difficulty },
            ].map(({ label, value }) => (
              <div key={label} className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
                <p className="text-[11px] font-medium mt-0.5" style={{ color: value ? "#1E293B" : "#CBD5E1" }}>
                  {value || "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
