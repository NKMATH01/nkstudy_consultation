"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  FileText,
  Sparkles,
  Check,
  Circle,
  ExternalLink,
  Search,
  PenLine,
  Trash2,
  MessageCircle,
  Plus,
  X,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteRegistration } from "@/lib/actions/registration";
import { createReportToken } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";

const NK_PRIMARY = "#0F2B5B";
const NK_GOLD = "#D4A853";

interface OnboardingStep {
  key: string;
  label: string;
  shortLabel: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "parent_consult", label: "학부모 상담 진행", shortLabel: "학부모상담" },
  { key: "textbook_select", label: "교재 선정 및 안내", shortLabel: "교재선정" },
  { key: "mathflat_entered", label: "매쓰플랫 학생 자료 입력", shortLabel: "매쓰플랫" },
  { key: "orientation_prep", label: "오리엔테이션 자료 준비", shortLabel: "OT준비" },
  { key: "analysis_review", label: "성향 분석 결과 점검", shortLabel: "성향점검" },
];

interface CustomCheckItem {
  id: string;
  label: string;
  done: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCustomItems(status: Record<string, any>): CustomCheckItem[] {
  if (Array.isArray(status._custom)) return status._custom;
  return [];
}

type Registration = {
  id: string;
  analysis_id: string | null;
  name: string;
  school: string | null;
  grade: string | null;
  student_phone: string | null;
  parent_phone: string | null;
  registration_date: string | null;
  assigned_class: string | null;
  assigned_class_2: string | null;
  subject: string | null;
  teacher: string | null;
  teacher_2: string | null;
  report_html: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onboarding_status: Record<string, any> | null;
};

type DisplayRow = Registration & {
  _displaySubject: string;
  _displayClass: string | null;
  _displayTeacher: string | null;
  _isFirstRow: boolean;
  _rowKey: string;
};

type Analysis = {
  id: string;
  name: string;
  survey_id: string | null;
  report_html: string | null;
};

interface Props {
  registrations: Registration[];
  analyses: Analysis[];
}

export function OnboardingList({ registrations, analyses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPopup, setReportPopup] = useState<string | null>(null);
  const [analysisPopup, setAnalysisPopup] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use local state for onboarding status (will save to DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [statusMap, setStatusMap] = useState<Record<string, Record<string, any>>>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, Record<string, any>> = {};
    registrations.forEach((r) => {
      map[r.id] = r.onboarding_status || {};
    });
    return map;
  });

  // 커스텀 항목 추가 입력 상태
  const [addingCustomFor, setAddingCustomFor] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");

  const displayRows = useMemo(() => {
    const base = searchQuery.trim()
      ? registrations.filter((r) => {
          const q = searchQuery.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) ||
            (r.school && r.school.toLowerCase().includes(q)) ||
            (r.assigned_class && r.assigned_class.toLowerCase().includes(q))
          );
        })
      : registrations;

    const rows: DisplayRow[] = [];
    for (const reg of base) {
      if (reg.subject === "영어수학") {
        rows.push({
          ...reg,
          _displaySubject: "수학",
          _displayClass: reg.assigned_class,
          _displayTeacher: reg.teacher,
          _isFirstRow: true,
          _rowKey: `${reg.id}_math`,
        });
        rows.push({
          ...reg,
          _displaySubject: "영어",
          _displayClass: reg.assigned_class_2,
          _displayTeacher: reg.teacher_2,
          _isFirstRow: false,
          _rowKey: `${reg.id}_eng`,
        });
      } else {
        rows.push({
          ...reg,
          _displaySubject: reg.subject || "-",
          _displayClass: reg.assigned_class,
          _displayTeacher: reg.teacher,
          _isFirstRow: true,
          _rowKey: reg.id,
        });
      }
    }
    return rows;
  }, [registrations, searchQuery]);

  // DB에 상태 저장
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveStatus = async (regId: string, newStatus: Record<string, any>, rollback: Record<string, any>) => {
    try {
      const res = await fetch("/api/onboarding-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: regId, status: newStatus }),
      });
      if (!res.ok) {
        setStatusMap((prev) => ({ ...prev, [regId]: rollback }));
        toast.error("저장 실패");
      }
    } catch {
      setStatusMap((prev) => ({ ...prev, [regId]: rollback }));
      toast.error("저장 실패");
    }
  };

  // 고정 항목 토글
  const toggleStep = async (regId: string, stepKey: string) => {
    const current = statusMap[regId] || {};
    const newStatus = { ...current, [stepKey]: !current[stepKey] };
    setStatusMap((prev) => ({ ...prev, [regId]: newStatus }));
    saveStatus(regId, newStatus, current);
  };

  // 커스텀 항목 추가
  const addCustomItem = async (regId: string, label: string) => {
    if (!label.trim()) return;
    const current = statusMap[regId] || {};
    const customs = extractCustomItems(current);
    const newItem: CustomCheckItem = { id: `c_${Date.now()}`, label: label.trim(), done: false };
    const newStatus = { ...current, _custom: [...customs, newItem] };
    setStatusMap((prev) => ({ ...prev, [regId]: newStatus }));
    setAddingCustomFor(null);
    setCustomInput("");
    saveStatus(regId, newStatus, current);
  };

  // 커스텀 항목 토글
  const toggleCustomItem = async (regId: string, itemId: string) => {
    const current = statusMap[regId] || {};
    const customs = extractCustomItems(current);
    const updated = customs.map((c) => c.id === itemId ? { ...c, done: !c.done } : c);
    const newStatus = { ...current, _custom: updated };
    setStatusMap((prev) => ({ ...prev, [regId]: newStatus }));
    saveStatus(regId, newStatus, current);
  };

  // 커스텀 항목 삭제
  const deleteCustomItem = async (regId: string, itemId: string) => {
    const current = statusMap[regId] || {};
    const customs = extractCustomItems(current);
    const filtered = customs.filter((c) => c.id !== itemId);
    const newStatus = { ...current, _custom: filtered.length > 0 ? filtered : undefined };
    if (!filtered.length) delete newStatus._custom;
    setStatusMap((prev) => ({ ...prev, [regId]: newStatus }));
    saveStatus(regId, newStatus, current);
  };

  // 진행률 (고정 + 커스텀)
  const getProgress = (regId: string) => {
    const status = statusMap[regId] || {};
    const customs = extractCustomItems(status);
    const fixedDone = ONBOARDING_STEPS.filter((s) => status[s.key]).length;
    const customDone = customs.filter((c) => c.done).length;
    return { done: fixedDone + customDone, total: ONBOARDING_STEPS.length + customs.length };
  };

  // Find analysis for registration
  const getAnalysis = (reg: Registration) => {
    if (reg.analysis_id) {
      return analyses.find((a) => a.id === reg.analysis_id);
    }
    return analyses.find((a) => a.name === reg.name);
  };

  // Delete registration
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteRegistration(deleteTarget);
      if (result.success) {
        toast.success("삭제되었습니다");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Get report for popup
  const getReportHtml = (regId: string) => {
    const reg = registrations.find((r) => r.id === regId);
    return reg?.report_html || null;
  };

  return (
    <>
      <div
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.04)" }}
      >
        {/* Header */}
        <div
          className="border-b px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${NK_PRIMARY} 0%, #1a3d7a 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">등록 관리</h3>
              <p className="text-[11px] text-white/60">
                등록 완료 학생의 온보딩 진행 현황 · {registrations.length}명
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                placeholder="이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg text-xs bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30 w-40"
              />
            </div>
          </div>
        </div>

        {/* Progress Legend */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-4 flex-wrap" style={{ background: "#FAFBFD" }}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">진행 단계:</span>
          {ONBOARDING_STEPS.map((step) => (
            <span key={step.key} className="text-[11px] text-slate-500 flex items-center gap-1">
              <Circle className="h-2.5 w-2.5 text-slate-300" />
              {step.label}
            </span>
          ))}
        </div>

        {/* Table */}
        {registrations.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: `linear-gradient(135deg, ${NK_PRIMARY}10 0%, ${NK_GOLD}20 100%)` }}
            >
              <UserPlus className="h-10 w-10" style={{ color: NK_PRIMARY }} />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">등록된 신입생이 없습니다</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              등록 안내문을 생성하면 자동으로 신입생 목록에 추가됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Column Headers */}
            <div className="px-4 py-2.5 flex items-center gap-0 border-b border-slate-100 bg-slate-50/50 min-w-[1250px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[80px] flex-shrink-0 px-2">등록일</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[70px] flex-shrink-0 px-2">이름</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[70px] flex-shrink-0 px-2">학교</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[52px] flex-shrink-0 px-2">과목</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[72px] flex-shrink-0 px-2">반명</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[60px] flex-shrink-0 px-2">담당</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[105px] flex-shrink-0 px-2">학생연락처</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[105px] flex-shrink-0 px-1">학부모연락처</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-1 px-1 text-center">진행 현황</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[160px] flex-shrink-0 px-2 text-center">문서</span>
            </div>

            {/* Rows */}
            {displayRows.map((row) => {
              const progress = getProgress(row.id);
              const status = statusMap[row.id] || {};
              const analysis = getAnalysis(row);
              const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
              const isSub = !row._isFirstRow; // 영어수학 두 번째 행 (영어)
              const subjectColor = row._displaySubject === "수학" || row._displaySubject.includes("수학")
                ? { bg: "#DBEAFE", text: "#1D4ED8", ring: "#BFDBFE" }
                : row._displaySubject === "영어" || row._displaySubject.includes("영어")
                  ? { bg: "#F3E8FF", text: "#7C3AED", ring: "#DDD6FE" }
                  : { bg: "#F1F5F9", text: "#64748B", ring: "#E2E8F0" };

              return (
                <div
                  key={row._rowKey}
                  className={`px-4 flex items-center gap-0 border-b border-slate-100 hover:bg-slate-50/50 transition-colors min-w-[1250px] ${isSub ? "py-2 bg-slate-50/30" : "py-3"}`}
                >
                  {/* 등록일 - 두 번째 행은 비움 */}
                  <span className="text-xs text-slate-500 w-[80px] flex-shrink-0 px-2 tabular-nums">
                    {isSub ? "" : (row.registration_date || "-")}
                  </span>

                  {/* 이름 - 두 번째 행은 └ 표시 */}
                  <span className="w-[70px] flex-shrink-0 px-2 truncate">
                    {isSub ? (
                      <span className="text-xs text-slate-300 pl-1">└</span>
                    ) : (
                      <Link
                        href={`/registrations/${row.id}`}
                        className="text-sm font-bold truncate hover:underline cursor-pointer"
                        style={{ color: NK_PRIMARY }}
                      >
                        {row.name}
                      </Link>
                    )}
                  </span>

                  {/* 학교 - 두 번째 행은 비움 */}
                  <span className="text-xs text-slate-500 w-[70px] flex-shrink-0 px-2 truncate">
                    {isSub ? "" : (row.school || "-")}
                  </span>

                  {/* 과목 */}
                  <span className="w-[52px] flex-shrink-0 px-2">
                    <span
                      className="inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ring-1 ring-inset"
                      style={{
                        background: subjectColor.bg,
                        color: subjectColor.text,
                        ["--tw-ring-color" as string]: subjectColor.ring,
                      } as React.CSSProperties}
                    >
                      {row._displaySubject}
                    </span>
                  </span>

                  {/* 반명 */}
                  <span className="text-xs text-slate-600 w-[72px] flex-shrink-0 px-2 truncate font-medium">
                    {row._displayClass || "-"}
                  </span>

                  {/* 담당 */}
                  <span className="text-xs text-slate-500 w-[60px] flex-shrink-0 px-2 truncate">
                    {row._displayTeacher || "-"}
                  </span>

                  {/* 학생 연락처 */}
                  <span className="text-xs text-slate-400 w-[105px] flex-shrink-0 px-2 tabular-nums whitespace-nowrap">
                    {row.student_phone || "-"}
                  </span>

                  {/* 학부모 연락처 */}
                  <span className="text-xs text-slate-400 w-[105px] flex-shrink-0 px-1 tabular-nums whitespace-nowrap">
                    {row.parent_phone || "-"}
                  </span>

                  {/* 진행 현황 */}
                  <div className="flex-1 px-1 flex items-center gap-1 justify-center flex-wrap">
                    {/* 고정 항목 */}
                    {ONBOARDING_STEPS.map((step) => {
                      const done = status[step.key] || false;
                      return (
                        <button
                          key={step.key}
                          onClick={() => toggleStep(row.id, step.key)}
                          className="group relative flex flex-col items-center gap-0.5"
                          title={step.label}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              done
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-400"
                            }`}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                          </div>
                          <span className={`text-[9px] leading-tight ${done ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                            {step.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                    {/* 커스텀 항목 */}
                    {extractCustomItems(status).map((item) => (
                      <div key={item.id} className="group relative flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => toggleCustomItem(row.id, item.id)}
                          title={item.label}
                          className="relative"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              item.done
                                ? "bg-blue-500 text-white shadow-sm"
                                : "bg-amber-50 text-amber-400 border border-amber-200 hover:bg-amber-100"
                            }`}
                          >
                            {item.done ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                          </div>
                        </button>
                        <span className={`text-[9px] leading-tight max-w-[48px] truncate ${item.done ? "text-blue-600 font-bold" : "text-amber-600"}`}>
                          {item.label}
                        </span>
                        <button
                          onClick={() => deleteCustomItem(row.id, item.id)}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-400 text-white items-center justify-center text-[8px] hidden group-hover:flex"
                          title="삭제"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    {/* 추가 버튼 / 입력 */}
                    {row._isFirstRow && (
                      addingCustomFor === row.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); addCustomItem(row.id, customInput); }}
                          className="flex items-center gap-1"
                        >
                          <input
                            autoFocus
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onBlur={() => { if (!customInput.trim()) { setAddingCustomFor(null); setCustomInput(""); } }}
                            placeholder="항목 입력"
                            className="h-7 w-24 rounded-md border border-slate-200 px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <button type="submit" className="h-7 px-1.5 rounded-md bg-blue-500 text-white text-[10px] font-bold">
                            <Check className="h-3 w-3" />
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => { setAddingCustomFor(row.id); setCustomInput(""); }}
                          className="flex flex-col items-center gap-0.5"
                          title="항목 추가"
                        >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50 text-slate-300 border border-dashed border-slate-200 hover:bg-blue-50 hover:text-blue-400 hover:border-blue-300 transition-all">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-[9px] text-slate-300">추가</span>
                        </button>
                      )
                    )}
                    {/* 진행률 */}
                    <div className="ml-2 flex flex-col items-center gap-0.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100 ? "#059669" : NK_GOLD,
                          }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold ${progressPct === 100 ? "text-emerald-600" : "text-slate-400"}`}>
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                  </div>

                  {/* 문서 + 수정/삭제 - 첫 번째 행에만 표시 */}
                  <div className="w-[160px] flex-shrink-0 px-2 flex items-center gap-1 justify-center">
                    {row._isFirstRow && (
                      <>
                        {row.report_html && (
                          <button
                            onClick={() => setReportPopup(row.id)}
                            className="h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all hover:shadow-sm whitespace-nowrap"
                            style={{ background: `${NK_PRIMARY}10`, color: NK_PRIMARY }}
                            title="등록안내문 보기"
                          >
                            <FileText className="h-3 w-3" />
                            안내문
                          </button>
                        )}
                        {analysis && (
                          <button
                            onClick={() => {
                              if (analysis.report_html) {
                                setAnalysisPopup(analysis.id);
                              } else {
                                window.open(`/analyses/${analysis.id}`, '_blank');
                              }
                            }}
                            className="h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all hover:shadow-sm whitespace-nowrap"
                            style={{ background: `${NK_GOLD}15`, color: "#92400E" }}
                            title="성향분석 결과 보기"
                          >
                            <Sparkles className="h-3 w-3" />
                            분석
                          </button>
                        )}
                        <Link
                          href={`/registrations/${row.id}`}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="수정"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(row.id)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report HTML Popup */}
      {reportPopup && (() => {
        const html = getReportHtml(reportPopup);
        const reg = registrations.find((r) => r.id === reportPopup);
        if (!html) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReportPopup(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-3 border-b bg-white flex items-center justify-between" style={{ borderColor: "#E8ECF1" }}>
                <div>
                  <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>{reg?.name} 등록안내문</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!html) return;
                      toast.info("공유 링크 생성 중...");
                      const result = await createReportToken({
                        reportType: "registration",
                        reportHtml: html,
                        name: reg?.name,
                      });
                      if (!result.success || !result.token) {
                        toast.error("공유 링크 생성에 실패했습니다");
                        return;
                      }
                      shareViaKakao({
                        title: `${reg?.name || ""} 등록안내문`,
                        description: "NK학원 등록안내문입니다.",
                        pageUrl: `/report/${result.token}`,
                      });
                    }}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                    title="카카오톡 공유"
                  >
                    <MessageCircle className="h-3 w-3" />
                    카카오톡
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const result = await createReportToken({
                          reportType: "registration",
                          reportHtml: html,
                          name: reg?.name,
                        });
                        if (!result.success || !result.token) {
                          toast.error("링크 생성에 실패했습니다");
                          return;
                        }
                        await navigator.clipboard.writeText(`${KAKAO_BASE_URL}/report/${result.token}`);
                        toast.success("링크가 복사되었습니다");
                      } catch {
                        toast.error("링크 복사에 실패했습니다");
                      }
                    }}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-slate-50 text-slate-700 hover:bg-slate-100"
                    title="링크 복사"
                  >
                    <Link2 className="h-3 w-3" />
                    링크복사
                  </button>
                  <a
                    href={`/registrations/${reportPopup}`}
                    target="_blank"
                    className="h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm"
                    style={{ background: NK_PRIMARY, color: "white" }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    전체 보기
                  </a>
                  <button onClick={() => setReportPopup(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-500 text-lg leading-none">&times;</span>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
                <iframe
                  srcDoc={html}
                  className="w-full border-0"
                  style={{ minHeight: "80vh" }}
                  title="등록안내문"
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Analysis Popup - 안내문과 동일하게 팝업으로 표시 */}
      {analysisPopup && (() => {
        const analysis = analyses.find((a) => a.id === analysisPopup);
        const reg = registrations.find((r) => r.analysis_id === analysisPopup || analyses.find(a => a.id === analysisPopup && a.name === r.name));
        if (!analysis?.report_html) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAnalysisPopup(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-3 border-b bg-white flex items-center justify-between" style={{ borderColor: "#E8ECF1" }}>
                <div>
                  <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>{analysis.name} 성향분석 결과</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!analysis?.report_html) return;
                      toast.info("공유 링크 생성 중...");
                      const result = await createReportToken({
                        reportType: "analysis",
                        reportHtml: analysis.report_html,
                        name: analysis.name,
                      });
                      if (!result.success || !result.token) {
                        toast.error("공유 링크 생성에 실패했습니다");
                        return;
                      }
                      shareViaKakao({
                        title: `${analysis?.name || ""} 성향분석 결과`,
                        description: "NK학원 학습 성향 분석 결과입니다.",
                        pageUrl: `/report/${result.token}`,
                      });
                    }}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                    title="카카오톡 공유"
                  >
                    <MessageCircle className="h-3 w-3" />
                    카카오톡
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const result = await createReportToken({
                          reportType: "analysis",
                          reportHtml: analysis.report_html || "",
                          name: analysis.name,
                        });
                        if (!result.success || !result.token) {
                          toast.error("링크 생성에 실패했습니다");
                          return;
                        }
                        await navigator.clipboard.writeText(`${KAKAO_BASE_URL}/report/${result.token}`);
                        toast.success("링크가 복사되었습니다");
                      } catch {
                        toast.error("링크 복사에 실패했습니다");
                      }
                    }}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-slate-50 text-slate-700 hover:bg-slate-100"
                    title="링크 복사"
                  >
                    <Link2 className="h-3 w-3" />
                    링크복사
                  </button>
                  <a
                    href={`/analyses/${analysisPopup}`}
                    target="_blank"
                    className="h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm"
                    style={{ background: NK_PRIMARY, color: "white" }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    전체 보기
                  </a>
                  <button onClick={() => setAnalysisPopup(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-500 text-lg leading-none">&times;</span>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
                <iframe
                  srcDoc={analysis.report_html}
                  className="w-full border-0"
                  style={{ minHeight: "80vh" }}
                  title="성향분석 결과"
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-2">등록 안내 삭제</h3>
            <p className="text-sm text-slate-500 mb-5">
              &quot;{registrations.find((r) => r.id === deleteTarget)?.name}&quot; 등록 안내를 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
