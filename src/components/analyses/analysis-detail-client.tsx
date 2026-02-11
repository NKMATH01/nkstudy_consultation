"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAnalysis } from "@/lib/actions/analysis";
import { generateRegistration } from "@/lib/actions/registration";
import { RegistrationForm } from "@/components/registrations/registration-form";
import type { Analysis, Class, Teacher } from "@/types";
import type { RegistrationAdminFormData } from "@/lib/validations/registration";
import { FACTOR_LABELS } from "@/types";
import Link from "next/link";

interface Props {
  analysis: Analysis;
  classes: Class[];
  teachers: Teacher[];
}

function ScoreBar({ value, label, comment }: { value: number | null; label: string; comment: string | null }) {
  const v = value ?? 0;
  const pct = (v / 5) * 100;
  const barColor =
    v >= 4 ? "from-emerald-400 to-emerald-500" : v >= 3 ? "from-amber-400 to-amber-500" : "from-red-400 to-red-500";
  const textColor =
    v >= 4 ? "text-emerald-600" : v >= 3 ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{v.toFixed(1)}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {comment && (
        <p className="text-xs text-slate-500 leading-relaxed">{comment}</p>
      )}
    </div>
  );
}

export function AnalysisDetailClient({ analysis, classes, teachers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showReport, setShowReport] = useState(false);
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100">
            <Link href="/analyses">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{analysis.name}</h1>
            <p className="text-sm text-slate-500">
              {[analysis.school, analysis.grade].filter(Boolean).join(" ")}
              {analysis.created_at && ` | ${new Date(analysis.created_at).toLocaleDateString("ko-KR")}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setShowRegForm(true)}
            className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 shadow-lg shadow-teal-500/20"
          >
            <ClipboardList className="h-4 w-4 mr-1.5" />
            등록 안내 생성
          </Button>
          {analysis.report_html && (
            <Button variant="outline" size="sm" onClick={() => setShowReport(true)} className="rounded-xl">
              <FileText className="h-4 w-4 mr-1.5" />
              보고서
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} className="rounded-xl">
            <Trash2 className="h-4 w-4 mr-1.5" />
            삭제
          </Button>
        </div>
      </div>

      {/* 학생 유형 */}
      {analysis.student_type && (
        <div className="text-center">
          <span className="inline-block text-base font-bold px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg">
            {analysis.student_type}
          </span>
        </div>
      )}

      {/* 6-Factor 점수 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-indigo-500 rounded-full" />
          6-Factor 학습 성향 점수
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {factorKeys.map((key) => (
            <ScoreBar
              key={key}
              label={FACTOR_LABELS[key]}
              value={analysis[`score_${key}` as keyof Analysis] as number | null}
              comment={analysis[`comment_${key}` as keyof Analysis] as string | null}
            />
          ))}
        </div>
      </div>

      {/* 종합 요약 */}
      {analysis.summary && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            종합 분석
          </h3>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
            <p className="text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
          </div>
        </div>
      )}

      {/* 강점 / 약점 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-emerald-600 mb-3 flex items-center gap-2">
              <div className="w-1 h-5 bg-emerald-500 rounded-full" />
              강점
            </h3>
            <div className="space-y-3">
              {analysis.strengths.map((item, idx) => (
                <div key={idx} className="bg-emerald-50 p-3.5 rounded-xl">
                  <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.weaknesses && analysis.weaknesses.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
              <div className="w-1 h-5 bg-red-500 rounded-full" />
              개선 필요 영역
            </h3>
            <div className="space-y-3">
              {analysis.weaknesses.map((item, idx) => (
                <div key={idx} className="bg-red-50 p-3.5 rounded-xl">
                  <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 심리적 갭 (Paradox) */}
      {analysis.paradox && analysis.paradox.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-amber-600 mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            심리적 갭 분석
          </h3>
          <div className="space-y-3">
            {analysis.paradox.map((item, idx) => (
              <div key={idx} className="bg-amber-50 p-3.5 rounded-xl">
                <p className="font-semibold text-sm text-slate-800">{String(item.title || "")}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {String(item.description || "")}
                </p>
                {"label1" in item && "label2" in item && (
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-emerald-600 font-medium">{String(item.label1)}: {String(item.value1)}</span>
                    <span className="text-red-600 font-medium">{String(item.label2)}: {String(item.value2)}</span>
                  </div>
                )}
                {"studentView" in item && "nkView" in item && (
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-blue-600 font-medium">학생 시각: {String(item.studentView)}</span>
                    <span className="text-purple-600 font-medium">NK 진단: {String(item.nkView)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 맞춤 솔루션 */}
      {analysis.solutions && analysis.solutions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-emerald-600 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-emerald-500 rounded-full" />
            맞춤 솔루션
          </h3>
          <div className="bg-emerald-50 p-5 rounded-xl space-y-5">
            {analysis.solutions.map((sol, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-emerald-500/20">
                  {sol.step}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">
                    {sol.weeks} - {sol.goal}
                  </p>
                  {sol.actions && (
                    <ul className="list-disc list-inside text-xs text-slate-500 mt-1.5 space-y-0.5 leading-relaxed">
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

      {/* 최종 의견 */}
      {analysis.final_assessment && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
          <h3 className="text-base font-bold mb-3">NK EDUCATION 종합 의견</h3>
          <p className="text-sm leading-relaxed opacity-90">{analysis.final_assessment}</p>
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

      {/* 보고서 모달 */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>분석 보고서</DialogTitle>
          </DialogHeader>
          {analysis.report_html && (
            <div dangerouslySetInnerHTML={{ __html: analysis.report_html }} />
          )}
        </DialogContent>
      </Dialog>

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
