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
import { analyzeSurvey, reAnalyzeSurvey, getAnalysis } from "@/lib/actions/analysis";
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
  analyses: { id: string; survey_id: string | null; has_report: boolean }[];
  registrations: { id: string; analysis_id: string | null }[];
  consultations: { id: string; name: string; result_status: string; test_score: string | null; subject: string | null }[];
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
    value >= 4 ? "bg-teal-50 text-teal-700 border-teal-100" : value >= 3 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-rose-50 text-rose-700 border-rose-100";
  return <span className={`inline-flex min-w-8 justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-black ${color}`}>{value.toFixed(1)}</span>;
}

function ResultStatusBadge({ status }: { status: ResultStatus }) {
  if (status === "none") return <span className="text-[10px] text-slate-300">-</span>;
  const styles: Record<string, string> = {
    registered: "bg-teal-600 text-white",
    hold: "bg-accent-warm text-accent-warm-foreground",
    other: "bg-slate-600 text-white line-through",
  };
  return (
    <Badge className={`text-[10px] border-0 ${styles[status] || "bg-slate-100 text-slate-500"}`}>
      {RESULT_STATUS_LABELS[status]}
    </Badge>
  );
}

function getRowTone(status: ResultStatus): string {
  if (status === "registered") return "bg-teal-50/45 hover:bg-teal-50/80";
  if (status === "hold") return "bg-amber-50/45 hover:bg-amber-50/80";
  if (status === "other") return "bg-slate-100/55 hover:bg-slate-100/85";
  return "hover:bg-slate-50/90";
}

function getRowStripe(status: ResultStatus): string {
  if (status === "registered") return "bg-teal-600";
  if (status === "hold") return "bg-accent-warm";
  if (status === "other") return "bg-slate-500";
  return "bg-slate-200";
}

function getSubjectBadgeClass(subject?: string): string {
  const normalized = subject ?? "";
  if (normalized.includes("영어수학") || normalized.includes("영수")) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (normalized.includes("영어")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("수학")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-500";
}

export function SurveyListClient({ initialData, initialPagination, analyses, registrations, consultations, classes, teachers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  // 설문지 미리보기의 결과지 HTML은 목록에서 미리 받지 않고 열 때 개별 조회한다.
  const [previewReportHtml, setPreviewReportHtml] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  // 분석 완료 직후 서버 데이터 갱신 전 재클릭 시 중복 생성을 막기 위한 로컬 기록
  const [localAnalyzedIds, setLocalAnalyzedIds] = useState<Set<string>>(new Set());

  // 등록 다이얼로그 상태
  const [regTarget, setRegTarget] = useState<{ name: string; currentStatus: ResultStatus; consultationId?: string } | null>(null);
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
    } catch (e) {
      if (e instanceof Error) {
        toast.error(e.message);
        return;
      }
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
      }, regTarget.consultationId);
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

  const handleStatusChange = async (name: string, status: ResultStatus, consultationId?: string) => {
    if (status === "registered") {
      setRegTarget({ name, currentStatus: status, consultationId });
      return;
    }
    const result = await updateRegistrationInfo(name, { result_status: status }, consultationId);
    if (result.success) {
      toast.success("상태가 변경되었습니다");
      router.refresh();
    } else {
      toast.error(result.error || "상태 변경 실패");
    }
  };

  // 분석 데이터 맵 생성
  const analysisMap = useMemo(() => {
    const map = new Map<string, { id: string; has_report: boolean }>();
    for (const a of analyses) {
      if (a.survey_id) {
        map.set(a.survey_id, { id: a.id, has_report: a.has_report });
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
  // 이름은 trim()으로 정규화 — 설문/상담 입력 시 공백 유입 케이스(예: "김혜원 ")를 방어
  const consultationStatusMap = useMemo(() => {
    const map = new Map<string, ResultStatus>();
    for (const c of consultations) {
      const key = (c.name ?? "").trim();
      if (key && !map.has(key)) {
        map.set(key, c.result_status as ResultStatus);
      }
    }
    return map;
  }, [consultations]);

  // 상담 테스트 점수 + 과목 맵 (이름 trim 정규화 동일 적용)
  const consultationIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of consultations) {
      const key = (c.name ?? "").trim();
      if (key && !map.has(key)) {
        map.set(key, c.id);
      }
    }
    return map;
  }, [consultations]);

  const testScoreMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of consultations) {
      const key = (c.name ?? "").trim();
      if (key && !map.has(key) && c.test_score) {
        map.set(key, c.test_score);
      }
    }
    return map;
  }, [consultations]);

  const subjectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of consultations) {
      const key = (c.name ?? "").trim();
      if (key && !map.has(key) && c.subject) {
        map.set(key, c.subject);
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
      const hasAnalysis = !!survey.analysis_id || !!existingAnalysis || localAnalyzedIds.has(survey.id);
      const result = hasAnalysis
        ? await reAnalyzeSurvey(survey.id)
        : await analyzeSurvey(survey.id);
      if (result.success) {
        setLocalAnalyzedIds((prev) => new Set(prev).add(survey.id));
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

  const handleViewReport = async (surveyId: string) => {
    const analysis = analysisMap.get(surveyId);
    if (!analysis?.has_report) return;
    // 팝업 차단 방지: 서버 조회(await) 전에 클릭 컨텍스트에서 먼저 새 창을 연다
    const win = window.open("", "_blank");
    try {
      const data = await getAnalysis(analysis.id);
      const html = data?.report_html;
      if (!html) {
        win?.close();
        toast.error("결과지를 불러오지 못했습니다");
        return;
      }
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch {
      win?.close();
      toast.error("결과지를 불러오지 못했습니다");
    }
  };

  // 설문지 미리보기 열기 — 결과지 HTML은 이 시점에 lazy 조회
  const handleOpenPreview = async (survey: Survey) => {
    setPreviewSurvey(survey);
    setPreviewReportHtml(null);
    const analysis = analysisMap.get(survey.id);
    if (!analysis?.has_report) return;
    try {
      const data = await getAnalysis(analysis.id);
      setPreviewReportHtml(data?.report_html ?? null);
    } catch {
      setPreviewReportHtml(null);
    }
  };

  const summary = useMemo(() => {
    const analyzed = initialData.filter((item) => !!item.analysis_id || analysisMap.has(item.id)).length;
    const registered = initialData.filter((item) => consultationStatusMap.get((item.name ?? "").trim()) === "registered").length;
    const waiting = initialData.length - analyzed;
    return { analyzed, registered, waiting };
  }, [initialData, analysisMap, consultationStatusMap]);

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_18px_48px_rgba(94,147,172,0.08)]">
        <div className="flex flex-col gap-4 bg-primary px-6 py-5 text-primary-foreground md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
            Survey Analysis
          </div>
          <h1 className="text-2xl font-black" style={{ letterSpacing: "-0.035em", marginBottom: "4px" }}>
            설문/분석 관리
          </h1>
          <p className="text-[12.5px] font-medium text-primary-foreground/75">
            총 {initialPagination.total}건
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-warm px-3.5 py-2 text-[12.5px] font-black text-accent-warm-foreground shadow-[0_12px_28px_rgba(245,197,126,0.25)] transition-all hover:-translate-y-px"
        >
          <Plus className="h-3.5 w-3.5" />
          설문 입력
        </button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
          {[
            { label: "분석완료", value: summary.analyzed, color: "text-teal-700" },
            { label: "등록", value: summary.registered, color: "text-accent-warm-foreground" },
            { label: "분석대기", value: summary.waiting, color: "text-slate-700" },
          ].map((item) => (
            <div key={item.label} className="px-5 py-3">
              <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
              <p className={`mt-1 text-xl font-black ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md rounded-[14px] border border-slate-200/90 bg-white p-2 shadow-sm">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="이름, 학교 검색..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          className="border-0 bg-muted/50 pl-9 font-medium shadow-none focus-visible:ring-2 focus-visible:ring-ring/30"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-warm px-3.5 py-2 text-[12.5px] font-black text-accent-warm-foreground shadow-[0_12px_28px_rgba(245,197,126,0.25)]"
            >
              <Plus className="h-4 w-4" />
              설문 입력
            </button>
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_18px_48px_rgba(94,147,172,0.08)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="border-y border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
                    <th className="w-1 p-0" />
                    {[
                      { label: "날짜", align: "left" },
                      { label: "이름", align: "left" },
                      { label: "학교", align: "left" },
                      { label: "과목", align: "center" },
                      { label: "학생전화", align: "left" },
                      { label: "학부모전화", align: "left" },
                      { label: "테스트", align: "center" },
                      ...FACTOR_KEYS.map((key) => ({ label: SHORT_LABELS[key], align: "center" as const })),
                      { label: "분석", align: "center" },
                      { label: "등록", align: "center" },
                      { label: "", align: "right" },
                    ].map((col, i, arr) => (
                      <th
                        key={i}
                        className={`px-2 py-3 text-[10.5px] font-black uppercase text-slate-500 whitespace-nowrap ${i < arr.length - 1 ? "border-r border-slate-200/80" : ""} ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {initialData.map((item) => {
                    const analysis = analysisMap.get(item.id);
                    const hasAnalysis = !!item.analysis_id || !!analysis;
                    const analysisId = item.analysis_id || analysis?.id;
                    const isAnalyzing = analyzingId === item.id;
                    const nameHref = hasAnalysis ? `/analyses/${analysisId}` : `/surveys/${item.id}`;
                    const regId = analysisId ? registrationMap.get(analysisId) : undefined;
                    // 맵 조회 키도 trim으로 정규화 (설문 name에 트레일링 공백이 들어간 케이스 대응)
                    const normalizedName = (item.name ?? "").trim();
                    const consultStatus = consultationStatusMap.get(normalizedName) || "none";
                    const subject = subjectMap.get(normalizedName) || "";
                    const vb = "border-r border-slate-100";

                    return (
                      <tr
                        key={item.id}
                        className={`relative border-t border-slate-100 transition-colors ${getRowTone(consultStatus)} ${isPending ? "opacity-50" : ""}`}
                      >
                        <td className="w-1 p-0">
                          <div className={`h-9 w-1 rounded-r-full ${getRowStripe(consultStatus)}`} />
                        </td>
                        <td className={`px-2 py-2.5 text-[10px] font-semibold text-slate-400 whitespace-nowrap ${vb}`}>
                          {format(new Date(item.created_at), "MM-dd")}
                        </td>
                        <td className={`px-2 py-2.5 whitespace-nowrap ${vb}`}>
                          <Link href={nameHref} className="text-[12px] font-black text-slate-800 hover:text-primary hover:underline">{item.name}</Link>
                        </td>
                        <td className={`px-2 py-2.5 text-[10px] font-medium text-slate-500 whitespace-nowrap truncate ${vb}`}>
                          {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className={`px-2 py-2.5 text-center whitespace-nowrap ${vb}`}>
                          {subject ? (
                            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black ${getSubjectBadgeClass(subject)}`}>{subject}</span>
                          ) : <span className="text-[9px] text-slate-200">-</span>}
                        </td>
                        <td className={`px-2 py-2.5 text-[10px] font-medium text-slate-600 whitespace-nowrap ${vb}`}>
                          {formatPhone(item.student_phone) || <span className="text-slate-200">-</span>}
                        </td>
                        <td className={`px-2 py-2.5 text-[10px] font-black text-slate-700 whitespace-nowrap ${vb}`}>
                          {formatPhone(item.parent_phone) || <span className="text-slate-200">-</span>}
                        </td>
                        <td className={`px-2 py-2.5 text-center text-[10px] font-bold text-slate-600 whitespace-nowrap ${vb}`}>
                          {testScoreMap.get(normalizedName) || <span className="text-slate-200">-</span>}
                        </td>
                        {FACTOR_KEYS.map((key) => {
                          const val = item[`factor_${key}` as keyof Survey] as number | null;
                          return <td key={key} className={`px-1 py-2.5 text-center ${vb}`}><FactorScore value={val} /></td>;
                        })}
                        <td className={`px-2 py-2.5 text-center whitespace-nowrap ${vb}`}>
                          {hasAnalysis ? (
                            <span className="rounded-md border border-teal-100 bg-teal-50 px-1.5 py-0.5 text-[9px] font-black text-teal-700">완료</span>
                          ) : (
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">대기</span>
                          )}
                        </td>
                        <td className={`px-2 py-2.5 text-center whitespace-nowrap ${vb}`}>
                          <select
                            value={consultStatus}
                            onChange={(e) => handleStatusChange(item.name, e.target.value as ResultStatus, consultationIdMap.get(normalizedName))}
                            className={`cursor-pointer rounded-md border-0 px-1.5 py-0.5 text-[9px] font-black outline-none ${
                              consultStatus === "registered" ? "bg-teal-600 text-white" :
                              consultStatus === "hold" ? "bg-accent-warm text-accent-warm-foreground" :
                              consultStatus === "other" ? "bg-slate-600 text-white" :
                              "bg-slate-100 text-slate-400"
                            }`}
                          >
                            <option value="none">-</option>
                            <option value="registered">등록</option>
                            <option value="hold">고민중</option>
                            <option value="other">미등록</option>
                          </select>
                        </td>
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-0.5">
                            {hasAnalysis && (
                              <button
                                onClick={async () => {
                                  if (regId) { router.push(`/registrations/${regId}`); }
                                  else {
                                    try {
                                      const consultation = await getConsultationByName(item.name);
                                      setRegFormTarget({ analysisId: analysisId!, grade: item.grade, consultationData: consultation as Record<string, string | null> | null });
                                    } catch (e) {
                                      toast.error(e instanceof Error ? e.message : "상담 정보를 불러오는데 실패했습니다");
                                    }
                                  }
                                }}
                                className={`rounded-md px-2 py-1 text-[9px] font-black transition-colors ${regId ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-teal-50 text-teal-700 hover:bg-teal-100"}`}
                                title={regId ? "안내문 보기" : "안내문 생성"}
                              >안내문</button>
                            )}
                            <button onClick={() => handleOpenRecord(item)} disabled={recordLoading === item.id} className="p-1 rounded text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50" title="상담기록">
                              {recordLoading === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileEdit className="h-3 w-3" />}
                            </button>
                            <button onClick={() => handleOpenPreview(item)} className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors" title="설문지">
                              <ClipboardList className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleViewReport(item.id)} disabled={!analysis?.has_report} className="p-1 rounded text-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="결과지">
                              <Sparkles className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleAnalyze(item)} disabled={isAnalyzing} className="p-1 rounded text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50" title={hasAnalysis ? "재분석" : "분석"}>
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                            </button>
                            {isAnalyzing && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
                                분석 중입니다 (최대 60초 소요)
                              </span>
                            )}
                            <button onClick={() => setDeleteTarget(item)} className="p-1 rounded text-red-400 hover:bg-red-50 transition-colors" title="삭제">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        analysisReportHtml={previewReportHtml}
        open={!!previewSurvey}
        onOpenChange={(open) => { if (!open) { setPreviewSurvey(null); setPreviewReportHtml(null); } }}
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
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isRegistering ? "처리 중..." : "등록 확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
