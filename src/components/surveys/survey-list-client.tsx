"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, ClipboardList, Search, Sparkles, Brain, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/empty-state";
import { SurveyFormDialog } from "@/components/surveys/survey-form-client";
import { SurveyPreviewDialog } from "@/components/surveys/survey-preview-dialog";
import { toast } from "sonner";
import { analyzeSurvey, reAnalyzeSurvey } from "@/lib/actions/analysis";
import { deleteSurvey } from "@/lib/actions/survey";
import type { Survey } from "@/types";
import { FACTOR_LABELS } from "@/types";
import Link from "next/link";

interface Props {
  initialData: Survey[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  analyses: { id: string; survey_id: string | null; report_html: string | null }[];
}

function FactorScore({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const color =
    value >= 4 ? "text-emerald-600 bg-emerald-50" : value >= 3 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`} title={label}>
      {value.toFixed(1)}
    </span>
  );
}

export function SurveyListClient({ initialData, initialPagination, analyses }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // 분석 데이터 맵 생성
  const analysisMap = useMemo(() => {
    const map = new Map<string, { id: string; report_html: string | null }>();
    for (const a of analyses) {
      if (a.survey_id) {
        map.set(a.survey_id, { id: a.id, report_html: a.report_html });
      }
    }
    return map;
  }, [analyses]);

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
          if (value) {
            params.set(key, value);
          } else {
            params.delete(key);
          }
        });
        params.delete("page");
        router.push(`/surveys?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  const handleSearchSubmit = () => {
    updateFilters({ search: searchValue || undefined });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/surveys?${params.toString()}`);
    });
  };

  const handleAnalyze = async (survey: Survey) => {
    setAnalyzingId(survey.id);
    try {
      const hasAnalysis = !!survey.analysis_id;
      const result = hasAnalysis
        ? await reAnalyzeSurvey(survey.id)
        : await analyzeSurvey(survey.id);
      if (result.success) {
        toast.success(hasAnalysis ? "재분석이 완료되었습니다" : "성향분석이 완료되었습니다");
        router.refresh();
      } else {
        toast.error(result.error || "분석에 실패했습니다");
      }
    } catch {
      toast.error("분석 중 오류가 발생했습니다");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteSurvey(deleteTarget.id);
      if (result.success) {
        toast.success("설문이 삭제되었습니다");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewReport = (surveyId: string) => {
    const analysis = analysisMap.get(surveyId);
    if (analysis?.report_html) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(analysis.report_html);
        win.document.close();
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-1">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
            설문/분석 관리
          </h1>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>
            총 {initialPagination.total}건
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-white text-[12.5px] font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #D4A853, #C49B3D)",
            boxShadow: "0 2px 8px rgba(212,168,83,0.3)",
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          설문 입력
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="이름, 학교 검색..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          className="pl-9 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Data Table */}
      {initialData.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="등록된 설문이 없습니다"
          description="새로운 설문을 등록해보세요"
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-white text-[12.5px] font-semibold"
              style={{ background: "linear-gradient(135deg, #D4A853, #C49B3D)", boxShadow: "0 2px 8px rgba(212,168,83,0.3)" }}
            >
              <Plus className="h-4 w-4" />
              설문 입력
            </button>
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-[#f1f5f9] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
            {/* Header */}
            <div className="flex items-center px-4 py-2.5 text-[11px] font-semibold text-slate-400 bg-[#f8fafc] border-b border-slate-100">
              <div className="w-[70px]">등록일</div>
              <div className="w-[80px]">이름</div>
              <div className="w-[100px] hidden sm:block">학교/학년</div>
              <div className="flex-1 hidden md:block">6-Factor</div>
              <div className="w-[60px] text-center">분석</div>
              <div className="w-[180px] text-center">액션</div>
            </div>
            {/* Rows */}
            {initialData.map((item) => {
              const analysis = analysisMap.get(item.id);
              const hasAnalysis = !!item.analysis_id;
              const isAnalyzing = analyzingId === item.id;
              const nameHref = hasAnalysis ? `/analyses/${item.analysis_id}` : `/surveys/${item.id}`;

              return (
                <div
                  key={item.id}
                  className={`flex items-center px-4 py-2.5 border-b border-slate-50 hover:bg-[#F8FAFC] transition-colors ${isPending ? "opacity-50" : ""}`}
                >
                  <div className="w-[70px] text-xs text-slate-500">
                    {format(new Date(item.created_at), "MM-dd")}
                  </div>
                  <div className="w-[80px]">
                    <Link href={nameHref} className="text-sm font-semibold text-slate-800 hover:text-blue-600 hover:underline">
                      {item.name}
                    </Link>
                  </div>
                  <div className="w-[100px] hidden sm:block text-xs text-slate-500 truncate">
                    {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div className="flex-1 hidden md:flex gap-1">
                    {(["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const).map((key) => (
                      <FactorScore
                        key={key}
                        value={item[`factor_${key}` as keyof Survey] as number | null}
                        label={FACTOR_LABELS[key]}
                      />
                    ))}
                  </div>
                  <div className="w-[60px] text-center">
                    {hasAnalysis ? (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">완료</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">미분석</Badge>
                    )}
                  </div>
                  <div className="w-[180px] flex items-center justify-end gap-1">
                    {/* 설문지 보기 */}
                    <button
                      onClick={() => setPreviewSurvey(item)}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      title="설문지 보기"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                    </button>
                    {/* 분석 결과지 */}
                    <button
                      onClick={() => handleViewReport(item.id)}
                      disabled={!analysis?.report_html}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="분석 결과지"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    {/* 분석/재분석 */}
                    <button
                      onClick={() => handleAnalyze(item)}
                      disabled={isAnalyzing}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      title={hasAnalysis ? "재분석" : "성향분석"}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Brain className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {/* 삭제 */}
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {initialPagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={initialPagination.page <= 1}
                onClick={() => handlePageChange(initialPagination.page - 1)}
              >
                이전
              </Button>
              <span className="text-sm font-medium text-slate-500">
                {initialPagination.page} / {initialPagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={initialPagination.page >= initialPagination.totalPages}
                onClick={() => handlePageChange(initialPagination.page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}

      {/* Survey Form Dialog */}
      <SurveyFormDialog open={showForm} onOpenChange={setShowForm} />

      {/* Survey Preview Dialog */}
      <SurveyPreviewDialog
        survey={previewSurvey}
        open={!!previewSurvey}
        onOpenChange={(open) => { if (!open) setPreviewSurvey(null); }}
      />

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>설문 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; 설문을 삭제하시겠습니까?
              {deleteTarget?.analysis_id && " 연결된 분석 결과도 함께 삭제됩니다."}
              {" "}이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
