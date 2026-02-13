"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, FileText, ClipboardList, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Analysis, Class, Teacher } from "@/types";
import type { RegistrationAdminFormData } from "@/lib/validations/registration";
import { FACTOR_LABELS } from "@/types";
import Link from "next/link";

interface Props {
  analysis: Analysis;
  classes: Class[];
  teachers: Teacher[];
}

function ratingClass(score: number) {
  if (score >= 4) return { bg: "bg-teal-100 text-teal-700", label: "우수" };
  if (score >= 3) return { bg: "bg-sky-100 text-sky-700", label: "양호" };
  if (score >= 2) return { bg: "bg-amber-100 text-amber-700", label: "보통" };
  return { bg: "bg-rose-100 text-rose-700", label: "주의" };
}

function barColor(score: number) {
  if (score >= 4) return "from-emerald-400 to-emerald-500";
  if (score >= 3) return "from-sky-400 to-sky-500";
  if (score >= 2) return "from-amber-400 to-amber-500";
  return "from-rose-400 to-rose-500";
}

const STEP_COLORS = ["bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500"];

export function AnalysisDetailClient({ analysis, classes, teachers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAnalysis(analysis.id);
      if (result.success) {
        toast.success("분석 결과가 삭제되었습니다");
        router.push("/analyses");
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

  const factorKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;
  const schoolInfo = [analysis.school, analysis.grade].filter(Boolean).join(" ");
  const createdDate = analysis.created_at
    ? new Date(analysis.created_at).toLocaleDateString("ko-KR")
    : "";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header - 보고서 스타일 */}
      <div className="flex items-start justify-between border-b-[3px] border-blue-900 pb-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100 mt-0.5">
            <Link href="/analyses">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-bold text-blue-600 tracking-widest uppercase">NK EDUCATION</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">NK 심층 학습 성향 분석서</h1>
            <p className="text-xs text-slate-400 mt-0.5">Deep Learning Tendency Analysis Report</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-blue-900">{analysis.name}</p>
          <p className="text-sm text-slate-500">{schoolInfo}{createdDate && ` · ${createdDate}`}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          onClick={() => setShowRegForm(true)}
          className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 shadow-lg shadow-teal-500/20"
        >
          <ClipboardList className="h-4 w-4 mr-1.5" />
          등록 안내 생성
        </Button>
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
          className="rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isPending ? "animate-spin" : ""}`} />
          보고서 재생성
        </Button>
        {analysis.report_html && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const win = window.open("", "_blank");
              if (win) {
                win.document.write(analysis.report_html!);
                win.document.close();
              }
            }}
            className="rounded-xl"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            보고서
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} className="rounded-xl">
          <Trash2 className="h-4 w-4 mr-1.5" />
          삭제
        </Button>
      </div>

      {/* Executive Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-base font-extrabold text-blue-900">Executive Summary</h3>
          {analysis.student_type && (
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-teal-100 text-teal-700">
              {analysis.student_type}
            </span>
          )}
        </div>
        {analysis.summary && (
          <p className="text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
        )}
      </div>

      {/* 6-Factor 학습 성향 분석 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-blue-600 rounded-sm" />
          <h3 className="text-base font-extrabold text-blue-900">6-Factor 학습 성향 분석</h3>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-bold text-slate-600 w-28">항목</th>
                <th className="text-center px-2 py-3 font-bold text-slate-600 w-14">점수</th>
                <th className="px-4 py-3 font-bold text-slate-600">그래프</th>
                <th className="text-center px-2 py-3 font-bold text-slate-600 w-16">등급</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">전문가 코멘트</th>
              </tr>
            </thead>
            <tbody>
              {factorKeys.map((key) => {
                const score = (analysis[`score_${key}` as keyof Analysis] as number | null) ?? 0;
                const comment = (analysis[`comment_${key}` as keyof Analysis] as string | null) || "";
                const pct = (score / 5) * 100;
                const rating = ratingClass(score);
                return (
                  <tr key={key} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 font-bold text-slate-800">{FACTOR_LABELS[key]}</td>
                    <td className="text-center px-2 py-3 font-extrabold text-blue-800">{score.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${barColor(score)} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-center px-2 py-3">
                      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${rating.bg}`}>
                        {rating.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 leading-relaxed">{comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Core Competency Matrix */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-blue-600 rounded-sm" />
          <h3 className="text-base font-extrabold text-blue-900">Core Competency Matrix</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Strengths */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-sm font-bold text-blue-700 mb-4 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Strengths (강점)
            </h4>
            <div className="space-y-3">
              {(analysis.strengths || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-blue-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
              {(!analysis.strengths || analysis.strengths.length === 0) && (
                <p className="text-xs text-slate-400">데이터 없음</p>
              )}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-sm font-bold text-red-600 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Weaknesses (개선영역)
            </h4>
            <div className="space-y-3">
              {(analysis.weaknesses || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-red-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
              {(!analysis.weaknesses || analysis.weaknesses.length === 0) && (
                <p className="text-xs text-slate-400">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Psychological Gap Analysis */}
      {analysis.paradox && analysis.paradox.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 bg-amber-500 rounded-sm" />
            <h3 className="text-base font-extrabold text-blue-900">Psychological Gap Analysis</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.paradox.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="font-extrabold text-sm text-slate-800 mb-2">
                  GAP {idx + 1}: {String(item.title || "")}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  {String(item.description || "")}
                </p>
                {"label1" in item && "label2" in item && (
                  <div className="flex gap-3 text-xs">
                    <span className="font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      {String(item.label1)}: {String(item.value1)}
                    </span>
                    <span className="font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                      {String(item.label2)}: {String(item.value2)}
                    </span>
                  </div>
                )}
                {"studentView" in item && "nkView" in item && (
                  <div className="flex gap-3 text-xs">
                    <span className="font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      학생 인식: {String(item.studentView)}
                    </span>
                    <span className="font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
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
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 bg-blue-600 rounded-sm" />
            <h3 className="text-base font-extrabold text-blue-900">12-Week Customized Solution</h3>
          </div>
          <div className="space-y-3">
            {analysis.solutions.map((sol, idx) => (
              <div key={idx} className="flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`w-1.5 shrink-0 ${STEP_COLORS[idx % STEP_COLORS.length]}`} />
                <div className="p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-extrabold text-white px-2.5 py-0.5 rounded ${STEP_COLORS[idx % STEP_COLORS.length]}`}>
                      STEP {sol.step}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{sol.weeks}</span>
                  </div>
                  <p className="font-bold text-sm text-slate-800 mb-2">{sol.goal}</p>
                  {sol.actions && (
                    <ul className="list-disc list-inside text-xs text-slate-500 space-y-0.5 leading-relaxed">
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
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-indigo-400" />
            <h3 className="text-base font-extrabold text-indigo-200">Final Assessment</h3>
          </div>
          <p className="text-sm leading-relaxed opacity-95">{analysis.final_assessment}</p>
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
