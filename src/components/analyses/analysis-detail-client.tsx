"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, ClipboardList, RefreshCw, CheckCircle, AlertTriangle, FileCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAnalysis, regenerateAnalysisReport } from "@/lib/actions/analysis";
import { generateRegistration } from "@/lib/actions/registration";
import { RegistrationForm } from "@/components/registrations/registration-form-client";
import type { Analysis, Class, Teacher, ResultStatus } from "@/types";
import type { RegistrationAdminFormData } from "@/lib/validations/registration";
import { FACTOR_LABELS, RESULT_STATUS_LABELS } from "@/types";
import Link from "next/link";

interface Props {
  analysis: Analysis;
  classes: Class[];
  teachers: Teacher[];
  surveyId?: string | null;
  consultationResultStatus?: ResultStatus | null;
  existingRegistrationId?: string | null;
}

function ratingClass(score: number) {
  if (score >= 4) return { bg: "bg-teal-100 text-teal-700", bar: "from-emerald-400 to-emerald-500", label: "우수" };
  if (score >= 3) return { bg: "bg-sky-100 text-sky-700", bar: "from-sky-400 to-sky-500", label: "양호" };
  if (score >= 2) return { bg: "bg-amber-100 text-amber-700", bar: "from-amber-400 to-amber-500", label: "보통" };
  return { bg: "bg-rose-100 text-rose-700", bar: "from-rose-400 to-rose-500", label: "주의" };
}

const STEP_COLORS = ["bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500"];

export function AnalysisDetailClient({ analysis, classes, teachers, consultationResultStatus, existingRegistrationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAnalysis(analysis.id);
      if (result.success) {
        toast.success("분석 결과가 삭제되었습니다");
        router.push("/surveys");
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const handleGenerateRegistration = async (data: RegistrationAdminFormData) => {
    const result = await generateRegistration(analysis.id, data);
    if (result.success && result.data) {
      toast.success("등록 안내문이 생성되었습니다");
      setShowRegForm(false);
      router.push(`/registrations/${result.data.id}`);
    } else {
      toast.error(result.error || "등록 안내문 생성에 실패했습니다");
    }
  };

  const handleRegisterClick = () => {
    if (existingRegistrationId) {
      router.push(`/registrations/${existingRegistrationId}`);
    } else {
      setShowRegForm(true);
    }
  };

  const baseFKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;
  const factorKeys = analysis.score_emotion != null ? [...baseFKeys, "emotion" as const] : baseFKeys;
  const schoolInfo = [analysis.school, analysis.grade].filter(Boolean).join(" ");
  const createdDate = analysis.created_at
    ? new Date(analysis.created_at).toLocaleDateString("ko-KR")
    : "";

  // 상담 결과 상태 배지 스타일
  const resultStatusStyle: Record<string, string> = {
    registered: "bg-red-500 text-white",
    hold: "bg-amber-400 text-white",
    other: "bg-neutral-500 text-white",
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto px-4 pb-8">
      {/* Header */}
      <div className="border-b-[3px] border-blue-900 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100 h-8 w-8">
            <Link href="/surveys">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">NK EDUCATION</p>
        </div>
        <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
          NK 심층 학습 성향 분석서
        </h1>
        <p className="text-[10px] text-slate-400 mb-2">Deep Learning Tendency Analysis Report</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-base font-extrabold text-blue-900">{analysis.name}</p>
            {consultationResultStatus && consultationResultStatus !== "none" && (
              <Badge className={`text-[10px] border-0 ${resultStatusStyle[consultationResultStatus] || ""}`}>
                {RESULT_STATUS_LABELS[consultationResultStatus]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">{schoolInfo}{createdDate && ` · ${createdDate}`}</p>
        </div>
      </div>

      {/* Registration Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-slate-800">등록 안내</h3>
            {existingRegistrationId && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600">
                <FileCheck className="h-3 w-3" />
                생성됨
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleRegisterClick}
            className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 shadow-lg shadow-teal-500/20 text-xs"
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            {existingRegistrationId ? "등록 안내 보기" : "등록 안내 생성"}
            {existingRegistrationId && <ExternalLink className="h-3 w-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            startTransition(async () => {
              const result = await regenerateAnalysisReport(analysis.id);
              if (result.success) {
                toast.success("보고서가 재생성되었습니다.");
                router.refresh();
              } else {
                toast.error(result.error || "재생성 실패");
              }
            });
          }}
          disabled={isPending}
          className="rounded-xl text-xs shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
          재생성
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDelete(true)}
          className="rounded-xl text-xs shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          삭제
        </Button>
      </div>

      {/* Executive Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-sm font-extrabold text-blue-900">종합 평가</h3>
          {analysis.student_type && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
              {analysis.student_type}
            </span>
          )}
        </div>
        {analysis.summary && (
          <p className="text-[13px] leading-relaxed text-slate-700">{analysis.summary}</p>
        )}
      </div>

      {/* 6-Factor 학습 성향 분석 - 카드 레이아웃 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-blue-600 rounded-sm" />
          <h3 className="text-sm font-extrabold text-blue-900">{analysis.score_emotion != null ? "7" : "6"}-Factor 학습 성향 분석</h3>
        </div>
        <div className="space-y-2.5">
          {factorKeys.map((key) => {
            const score = (analysis[`score_${key}` as keyof Analysis] as number | null) ?? 0;
            const comment = (analysis[`comment_${key}` as keyof Analysis] as string | null) || "";
            const pct = (score / 5) * 100;
            const rating = ratingClass(score);
            return (
              <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[13px] text-slate-800">{FACTOR_LABELS[key]}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-blue-800">{score.toFixed(1)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rating.bg}`}>
                      {rating.label}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full bg-gradient-to-r ${rating.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {comment && (
                  <p className="text-[11px] text-slate-500 leading-relaxed">{comment}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Core Competency Matrix */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-blue-600 rounded-sm" />
          <h3 className="text-sm font-extrabold text-blue-900">핵심 역량 분석</h3>
        </div>
        <div className="space-y-3">
          {/* Strengths */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h4 className="text-[13px] font-bold text-emerald-700 mb-3 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              강점
            </h4>
            <div className="space-y-2.5">
              {(analysis.strengths || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-slate-800">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
              {(!analysis.strengths || analysis.strengths.length === 0) && (
                <p className="text-[11px] text-slate-400">데이터 없음</p>
              )}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h4 className="text-[13px] font-bold text-rose-600 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              개선 영역
            </h4>
            <div className="space-y-2.5">
              {(analysis.weaknesses || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-slate-800">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
              {(!analysis.weaknesses || analysis.weaknesses.length === 0) && (
                <p className="text-[11px] text-slate-400">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Psychological Gap Analysis */}
      {analysis.paradox && analysis.paradox.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-amber-500 rounded-sm" />
            <h3 className="text-sm font-extrabold text-blue-900">심리적 갭 분석</h3>
          </div>
          <div className="space-y-2.5">
            {analysis.paradox.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="font-extrabold text-[13px] text-slate-800 mb-1.5">
                  GAP {idx + 1}: {String(item.title || "")}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-2.5">
                  {String(item.description || "")}
                </p>
                {"label1" in item && "label2" in item && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {String(item.label1)}: {String(item.value1)}
                    </span>
                    <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                      {String(item.label2)}: {String(item.value2)}
                    </span>
                  </div>
                )}
                {"studentView" in item && "nkView" in item && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      학생 인식: {String(item.studentView)}
                    </span>
                    <span className="font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                      NK 평가: {String(item.nkView)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12-Week Customized Solution */}
      {analysis.solutions && analysis.solutions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-blue-600 rounded-sm" />
            <h3 className="text-sm font-extrabold text-blue-900">12주 맞춤 솔루션</h3>
          </div>
          <div className="space-y-2.5">
            {analysis.solutions.map((sol, idx) => (
              <div key={idx} className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`w-1 shrink-0 ${STEP_COLORS[idx % STEP_COLORS.length]}`} />
                <div className="p-3.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-extrabold text-white px-2 py-0.5 rounded ${STEP_COLORS[idx % STEP_COLORS.length]}`}>
                      STEP {sol.step}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{sol.weeks}</span>
                  </div>
                  <p className="font-bold text-[13px] text-slate-800 mb-1.5">{sol.goal}</p>
                  {sol.actions && (
                    <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-0.5 leading-relaxed">
                      {sol.actions.map((action, aIdx) => (
                        <li key={aIdx}>{action}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Assessment */}
      {analysis.final_assessment && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-extrabold text-indigo-200">최종 평가</h3>
          </div>
          <p className="text-[13px] leading-relaxed opacity-95">{analysis.final_assessment}</p>
        </div>
      )}

      {/* 등록 안내 생성 폼 */}
      <RegistrationForm
        open={showRegForm}
        onOpenChange={setShowRegForm}
        onSubmit={handleGenerateRegistration}
        grade={analysis.grade}
        classes={classes}
        teachers={teachers}
      />

      {/* 삭제 확인 */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분석 결과 삭제</DialogTitle>
            <DialogDescription>
              &quot;{analysis.name}&quot; 분석 결과를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
