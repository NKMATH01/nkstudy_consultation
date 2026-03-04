"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, ClipboardList, Search, Sparkles, Brain, Trash2, Loader2, FileCheck, FileEdit } from "lucide-react";
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
import { updateRegistrationInfo, getConsultationByName } from "@/lib/actions/consultation";
import { generateRegistration } from "@/lib/actions/registration";
import { RegistrationForm } from "@/components/registrations/registration-form-client";
import { ConsultationRecordDialog } from "@/components/surveys/consultation-record-dialog";
import type { Survey, Class, Teacher, Consultation } from "@/types";
import { RESULT_STATUS_LABELS } from "@/types";
import type { ResultStatus } from "@/types";
import type { RegistrationAdminFormData } from "@/lib/validations/registration";
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
  registrations: { id: string; analysis_id: string | null }[];
  consultations: { name: string; result_status: string; test_score: string | null; subject: string | null }[];
  classes: Class[];
  teachers: Teacher[];
}

const FACTOR_KEYS = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;
const SHORT_LABELS: Record<string, string> = {
  attitude: "태도",
  self_directed: "자주",
  assignment: "과제",
  willingness: "의지",
  social: "사회",
  management: "관리",
};

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

function FactorScore({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[10px] text-slate-200">-</span>;
  const color =
    value >= 4 ? "text-emerald-600" : value >= 3 ? "text-amber-600" : "text-red-500";
  return <span className={`text-[10px] font-bold ${color}`}>{value.toFixed(1)}</span>;
}

function ResultStatusBadge({ status }: { status: ResultStatus }) {
  if (status === "none") return <span className="text-[10px] text-slate-300">-</span>;
  const styles: Record<string, string> = {
    registered: "bg-red-500 text-white",
    hold: "bg-amber-400 text-white",
    other: "bg-neutral-500 text-white line-through",
  };
  return (
    <Badge className={`text-[10px] border-0 ${styles[status] || "bg-slate-100 text-slate-500"}`}>
      {RESULT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function SurveyListClient({ initialData, initialPagination, analyses, registrations, consultations, classes, teachers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // 등록 다이얼로그 상태
  const [regTarget, setRegTarget] = useState<{ name: string; currentStatus: ResultStatus } | null>(null);
  const [regForm, setRegForm] = useState({ plan_date: "", plan_class: "", deposit: false });
  const [isRegistering, setIsRegistering] = useState(false);

  // 상담기록 다이얼로그 상태
  const [recordTarget, setRecordTarget] = useState<{ survey: Survey; consultation: Consultation } | null>(null);
  const [recordLoading, setRecordLoading] = useState<string | null>(null);

  // 등록 안내문 생성 다이얼로그 상태
  const [regFormTarget, setRegFormTarget] = useState<{ analysisId: string; grade: string | null; consultationData?: Record<string, string | null> | null } | null>(null);

  const handleOpenRecord = async (survey: Survey) => {
    setRecordLoading(survey.id);
    try {
      const consultation = await getConsultationByName(survey.name);
      if (!consultation) {
        toast.error("해당 학생의 상담 기록이 없습니다");
        return;
      }
      setRecordTarget({ survey, consultation });
    } catch {
      toast.error("상담 정보를 불러오는데 실패했습니다");
    } finally {
      setRecordLoading(null);
    }
  };

  const handleGenerateRegistration = async (data: RegistrationAdminFormData) => {
    if (!regFormTarget) return;
    const result = await generateRegistration(regFormTarget.analysisId, data);
    if (result.success && result.data) {
      toast.success("등록 안내문이 생성되었습니다");
      setRegFormTarget(null);
      router.push(`/registrations/${result.data.id}`);
    } else {
      toast.error(result.error || "등록 안내문 생성에 실패했습니다");
    }
  };

  const handleRegister = async () => {
    if (!regTarget) return;
    setIsRegistering(true);
    try {
      const result = await updateRegistrationInfo(regTarget.name, {
        result_status: "registered",
        plan_date: regForm.plan_date || undefined,
        plan_class: regForm.plan_class || undefined,
        reserve_deposit: regForm.deposit,
      });
      if (result.success) {
        toast.success(`${regTarget.name} 학생이 등록 처리되었습니다`);
        setRegTarget(null);
        setRegForm({ plan_date: "", plan_class: "", deposit: false });
        router.refresh();
      } else {
        toast.error(result.error || "등록 처리 실패");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStatusChange = async (name: string, status: ResultStatus) => {
    if (status === "registered") {
      setRegTarget({ name, currentStatus: status });
      return;
    }
    const result = await updateRegistrationInfo(name, { result_status: status });
    if (result.success) {
      toast.success("상태가 변경되었습니다");
      router.refresh();
    } else {
      toast.error(result.error || "상태 변경 실패");
    }
  };

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

  // 등록 데이터 맵 (analysis_id → registration_id)
  const registrationMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of registrations) {
      if (r.analysis_id) {
        map.set(r.analysis_id, r.id);
      }
    }
    return map;
  }, [registrations]);

  // 상담 result_status 맵 (이름 → result_status) - 가장 최근 상담 기준
  const consultationStatusMap = useMemo(() => {
    const map = new Map<string, ResultStatus>();
    for (const c of consultations) {
      if (!map.has(c.name)) {
        map.set(c.name, c.result_status as ResultStatus);
      }
    }
    return map;
  }, [consultations]);

  // 상담 테스트 점수 + 과목 맵
  const testScoreMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of consultations) {
      if (!map.has(c.name) && c.test_score) {
        map.set(c.name, c.test_score);
      }
    }
    return map;
  }, [consultations]);

  const subjectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of consultations) {
      if (!map.has(c.name) && c.subject) {
        map.set(c.name, c.subject);
      }
    }
    return map;
  }, [consultations]);

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
      const existingAnalysis = analysisMap.get(survey.id);
      const hasAnalysis = !!survey.analysis_id || !!existingAnalysis;
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
      const blob = new Blob([analysis.report_html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
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
            <div className="flex items-center px-3 py-2 text-[10px] font-semibold text-slate-400 bg-[#f8fafc] border-b border-slate-100">
              <div className="w-[52px]">등록일</div>
              <div className="w-[60px]">이름</div>
              <div className="w-[80px] hidden sm:block">학교</div>
              <div className="w-[42px] hidden lg:block text-center">과목</div>
              <div className="w-[100px] hidden lg:block">학생연락처</div>
              <div className="w-[100px] hidden lg:block">학부모연락처</div>
              <div className="w-[38px] hidden lg:block text-center">테스트</div>
              {FACTOR_KEYS.map((key) => (
                <div key={key} className="w-[32px] hidden md:block text-center">{SHORT_LABELS[key]}</div>
              ))}
              <div className="w-[40px] text-center">분석</div>
              <div className="w-[60px] text-center">등록</div>
              <div className="w-[170px] text-center">액션</div>
            </div>
            {/* Rows */}
            {initialData.map((item) => {
              const analysis = analysisMap.get(item.id);
              const hasAnalysis = !!item.analysis_id || !!analysis;
              const analysisId = item.analysis_id || analysis?.id;
              const isAnalyzing = analyzingId === item.id;
              const nameHref = hasAnalysis ? `/analyses/${analysisId}` : `/surveys/${item.id}`;
              const regId = analysisId ? registrationMap.get(analysisId) : undefined;
              const consultStatus = consultationStatusMap.get(item.name) || "none";

              return (
                <div
                  key={item.id}
                  className={`flex items-center px-3 py-2 border-b border-slate-50 hover:bg-[#F8FAFC] transition-colors ${isPending ? "opacity-50" : ""}`}
                >
                  <div className="w-[52px] text-[10px] text-slate-500">
                    {format(new Date(item.created_at), "MM-dd")}
                  </div>
                  <div className="w-[60px]">
                    <Link href={nameHref} className="text-[12px] font-semibold text-slate-800 hover:text-blue-600 hover:underline">
                      {item.name}
                    </Link>
                  </div>
                  <div className="w-[80px] hidden sm:block text-[10px] text-slate-500 truncate">
                    {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div className="w-[42px] hidden lg:block text-center">
                    {subjectMap.get(item.name) ? (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-blue-50 text-blue-600">{subjectMap.get(item.name)}</span>
                    ) : <span className="text-[10px] text-slate-200">-</span>}
                  </div>
                  <div className="w-[100px] hidden lg:block text-[10px] text-slate-600 truncate">
                    {formatPhone(item.student_phone) || <span className="text-slate-200">-</span>}
                  </div>
                  <div className="w-[100px] hidden lg:block text-[10px] text-slate-400 truncate">
                    {formatPhone(item.parent_phone) || <span className="text-slate-200">-</span>}
                  </div>
                  <div className="w-[38px] hidden lg:block text-center text-[10px] text-slate-600 font-medium">
                    {testScoreMap.get(item.name) || <span className="text-slate-200">-</span>}
                  </div>
                  {FACTOR_KEYS.map((key) => (
                    <div key={key} className="w-[32px] hidden md:block text-center">
                      <FactorScore value={item[`factor_${key}` as keyof Survey] as number | null} />
                    </div>
                  ))}
                  <div className="w-[40px] text-center">
                    {hasAnalysis ? (
                      <Badge className="text-[9px] px-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">완료</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] px-1">대기</Badge>
                    )}
                  </div>
                  <div className="w-[60px] text-center">
                    <select
                      value={consultStatus}
                      onChange={(e) => handleStatusChange(item.name, e.target.value as ResultStatus)}
                      className={`text-[9px] font-semibold rounded-md border-0 py-0.5 px-1 cursor-pointer outline-none ${
                        consultStatus === "registered" ? "bg-red-500 text-white" :
                        consultStatus === "hold" ? "bg-amber-400 text-white" :
                        consultStatus === "other" ? "bg-neutral-500 text-white" :
                        "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <option value="none">-</option>
                      <option value="registered">등록</option>
                      <option value="hold">고민중</option>
                      <option value="other">미등록</option>
                    </select>
                  </div>
                  <div className="w-[170px] flex items-center justify-end gap-1">
                    {/* 등록 안내문 생성/보기 */}
                    {hasAnalysis && (
                      <button
                        onClick={async () => {
                          if (regId) {
                            router.push(`/registrations/${regId}`);
                          } else {
                            const consultation = await getConsultationByName(item.name);
                            setRegFormTarget({ analysisId: analysisId!, grade: item.grade, consultationData: consultation as Record<string, string | null> | null });
                          }
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                          regId ? "bg-teal-500 text-white hover:bg-teal-600" : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                        }`}
                        title={regId ? "등록 안내문 보기" : "등록 안내문 생성"}
                      >
                        {regId ? "안내문" : "안내문"}
                      </button>
                    )}
                    {/* 상담기록 */}
                    <button
                      onClick={() => handleOpenRecord(item)}
                      disabled={recordLoading === item.id}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      title="상담기록"
                    >
                      {recordLoading === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileEdit className="h-3.5 w-3.5" />
                      )}
                    </button>
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
        analysisReportHtml={previewSurvey ? (analysisMap.get(previewSurvey.id)?.report_html ?? null) : null}
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
              {(deleteTarget?.analysis_id || (deleteTarget && analysisMap.has(deleteTarget.id))) && " 연결된 분석 결과도 함께 삭제됩니다."}
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

      {/* 상담기록 다이얼로그 */}
      {recordTarget && (
        <ConsultationRecordDialog
          survey={recordTarget.survey}
          consultation={recordTarget.consultation}
          open={!!recordTarget}
          onOpenChange={(open) => { if (!open) setRecordTarget(null); }}
          classes={classes}
        />
      )}

      {/* 등록 안내문 생성 다이얼로그 */}
      {regFormTarget && (
        <RegistrationForm
          open={!!regFormTarget}
          onOpenChange={(open) => { if (!open) setRegFormTarget(null); }}
          onSubmit={handleGenerateRegistration}
          grade={regFormTarget.grade}
          classes={classes}
          teachers={teachers}
          consultationData={regFormTarget.consultationData}
        />
      )}

      {/* 등록 정보 입력 다이얼로그 */}
      <Dialog open={!!regTarget} onOpenChange={(open) => { if (!open) { setRegTarget(null); setRegForm({ plan_date: "", plan_class: "", deposit: false }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>등록 처리 - {regTarget?.name}</DialogTitle>
            <DialogDescription>
              등록 관련 추가 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">등록 예정일</label>
              <Input
                type="date"
                value={regForm.plan_date}
                onChange={(e) => setRegForm((p) => ({ ...p, plan_date: e.target.value }))}
                className="rounded-lg border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">등록 예정반</label>
              <Input
                placeholder="예: 초5-A반"
                value={regForm.plan_class}
                onChange={(e) => setRegForm((p) => ({ ...p, plan_class: e.target.value }))}
                className="rounded-lg border-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reg-deposit"
                checked={regForm.deposit}
                onChange={(e) => setRegForm((p) => ({ ...p, deposit: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <label htmlFor="reg-deposit" className="text-sm text-slate-700">결제 완료</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRegTarget(null); setRegForm({ plan_date: "", plan_class: "", deposit: false }); }} className="rounded-xl">
              취소
            </Button>
            <Button
              onClick={handleRegister}
              disabled={isRegistering}
              className="rounded-xl text-white"
              style={{ background: "#0F2B5B" }}
            >
              {isRegistering ? "처리 중..." : "등록 확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
