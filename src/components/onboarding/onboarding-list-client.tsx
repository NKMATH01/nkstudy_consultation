"use client";

import { Fragment, useState, useTransition, useMemo } from "react";
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
  UserCog,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { deleteRegistration } from "@/lib/actions/registration";
import { createReportToken } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import { isFirst14Due } from "@/lib/assessment/v2/first14";
import { First14Dialog } from "./first14-dialog";

const NK_PRIMARY = "var(--primary)";
const NK_GOLD = "var(--accent-warm)";

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

type OnboardingStatus = Record<string, unknown>;

function isCustomCheckItem(value: unknown): value is CustomCheckItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.label === "string" && typeof item.done === "boolean";
}

function extractCustomItems(status: OnboardingStatus): CustomCheckItem[] {
  if (!Array.isArray(status._custom)) return [];
  return status._custom.filter(isCustomCheckItem);
}

function getProgressFromStatus(status: OnboardingStatus) {
  const customs = extractCustomItems(status);
  const fixedDone = ONBOARDING_STEPS.filter((s) => Boolean(status[s.key])).length;
  const customDone = customs.filter((c) => c.done).length;
  return { done: fixedDone + customDone, total: ONBOARDING_STEPS.length + customs.length };
}

function isOnboardingComplete(status: OnboardingStatus) {
  const progress = getProgressFromStatus(status);
  return progress.total > 0 && progress.done === progress.total;
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
  onboarding_status: OnboardingStatus | null;
};

type DisplayRow = Registration & {
  _displaySubject: string;
  _displayClass: string | null;
  _displayTeacher: string | null;
  _isFirstRow: boolean;
  _rowKey: string;
  _isOnboardingComplete: boolean;
  _showCompletionHeader: boolean;
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
  const [first14Target, setFirst14Target] = useState<{ analysisId: string; name: string } | null>(null);

  // Use local state for onboarding status (will save to DB)
  const [statusMap, setStatusMap] = useState<Record<string, OnboardingStatus>>(() => {
    const map: Record<string, OnboardingStatus> = {};
    registrations.forEach((r) => {
      map[r.id] = r.onboarding_status || {};
    });
    return map;
  });

  const initialCompletionMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    registrations.forEach((r) => {
      map[r.id] = isOnboardingComplete(r.onboarding_status || {});
    });
    return map;
  }, [registrations]);

  // 커스텀 항목 추가 입력 상태
  const [addingCustomFor, setAddingCustomFor] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");

  const displayRows = useMemo(() => {
    const filtered = searchQuery.trim()
      ? registrations.filter((r) => {
          const q = searchQuery.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) ||
            (r.school && r.school.toLowerCase().includes(q)) ||
            (r.assigned_class && r.assigned_class.toLowerCase().includes(q))
          );
        })
      : registrations;

    const base = filtered
      .map((reg, index) => ({ reg, index, complete: initialCompletionMap[reg.id] === true }))
      .sort((a, b) => {
        if (a.complete !== b.complete) return a.complete ? 1 : -1;
        return a.index - b.index;
      });

    const rows: DisplayRow[] = [];
    let completionHeaderShown = false;
    for (const { reg, complete } of base) {
      const showCompletionHeader = complete && !completionHeaderShown;
      if (showCompletionHeader) completionHeaderShown = true;

      if (reg.subject === "영어수학") {
        rows.push({
          ...reg,
          _displaySubject: "수학",
          _displayClass: reg.assigned_class,
          _displayTeacher: reg.teacher,
          _isFirstRow: true,
          _rowKey: `${reg.id}_math`,
          _isOnboardingComplete: complete,
          _showCompletionHeader: showCompletionHeader,
        });
        rows.push({
          ...reg,
          _displaySubject: "영어",
          _displayClass: reg.assigned_class_2,
          _displayTeacher: reg.teacher_2,
          _isFirstRow: false,
          _rowKey: `${reg.id}_eng`,
          _isOnboardingComplete: complete,
          _showCompletionHeader: false,
        });
      } else {
        rows.push({
          ...reg,
          _displaySubject: reg.subject || "-",
          _displayClass: reg.assigned_class,
          _displayTeacher: reg.teacher,
          _isFirstRow: true,
          _rowKey: reg.id,
          _isOnboardingComplete: complete,
          _showCompletionHeader: showCompletionHeader,
        });
      }
    }
    return rows;
  }, [initialCompletionMap, registrations, searchQuery]);

  // DB에 상태 저장
  const saveStatus = async (regId: string, newStatus: OnboardingStatus, rollback: OnboardingStatus) => {
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
    return getProgressFromStatus(status);
  };

  // Find analysis for registration
  const getAnalysis = (reg: Registration) => {
    if (!reg.analysis_id) return undefined;
    return analyses.find((a) => a.id === reg.analysis_id);
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
        className="bg-nk-surface rounded-2xl border border-nk-line-soft overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.04)" }}
      >
        {/* Header */}
        <div
          className="border-b px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${NK_PRIMARY} 0%, var(--primary-soft) 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-nk-surface/15 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-nk-navy-ink" />
            </div>
            <div>
              <h3 className="font-bold text-nk-navy-ink text-sm">등록 관리</h3>
              <p className="text-[11px] text-nk-navy-ink/60">
                등록 완료 학생의 온보딩 진행 현황 · {registrations.length}명
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-nk-navy-ink/40" />
              <input
                type="text"
                placeholder="이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg text-xs bg-nk-surface/10 text-nk-navy-ink placeholder-nk-navy-ink/45 border border-nk-surface/10 focus:outline-none focus:border-nk-surface/30 w-40"
              />
            </div>
          </div>
        </div>

        {/* Progress Legend */}
        <div className="px-6 py-3 border-b border-nk-line-soft flex items-center gap-4 flex-wrap" style={{ background: "rgb(var(--wr-sunken))" }}>
          <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider">진행 단계:</span>
          {ONBOARDING_STEPS.map((step) => (
            <span key={step.key} className="text-[11px] text-nk-ink-sub flex items-center gap-1">
              <Circle className="h-2.5 w-2.5 text-nk-ink-hint" />
              {step.label}
            </span>
          ))}
        </div>

        {/* Table */}
        {registrations.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "rgb(var(--wr-navy-soft))" }}
            >
              <UserPlus className="h-10 w-10" style={{ color: NK_PRIMARY }} />
            </div>
            <h3 className="text-base font-bold text-nk-ink mb-1">등록된 신입생이 없습니다</h3>
            <p className="text-sm text-nk-ink-hint max-w-xs">
              등록 안내문을 생성하면 자동으로 신입생 목록에 추가됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Column Headers */}
            <div className="px-4 py-2.5 flex items-center gap-0 border-b border-nk-line-soft bg-nk-sunken/50 min-w-[1500px]">
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[80px] flex-shrink-0 px-2">등록일</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[70px] flex-shrink-0 px-2">이름</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[70px] flex-shrink-0 px-2">학교</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[52px] flex-shrink-0 px-2">과목</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[72px] flex-shrink-0 px-2">반명</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[60px] flex-shrink-0 px-2">담당</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[105px] flex-shrink-0 px-2">학생연락처</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[105px] flex-shrink-0 px-1">학부모연락처</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider flex-1 min-w-[510px] px-1 text-center">진행 현황</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[160px] flex-shrink-0 px-2 text-center">문서</span>
            </div>

            {/* Rows */}
            {displayRows.map((row) => {
              const progress = getProgress(row.id);
              const status = statusMap[row.id] || {};
              const analysis = getAnalysis(row);
              const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
              const isSub = !row._isFirstRow; // 영어수학 두 번째 행 (영어)
              const subjectColor = row._displaySubject === "수학" || row._displaySubject.includes("수학")
                ? { bg: "rgb(var(--wr-status-progress-soft))", text: "rgb(var(--wr-status-progress))", ring: "rgb(var(--wr-status-progress-soft))" }
                : row._displaySubject === "영어" || row._displaySubject.includes("영어")
                  ? { bg: "rgb(var(--wr-sunken))", text: "rgb(var(--wr-cat-3))", ring: "rgb(var(--wr-sunken))" }
                  : { bg: "rgb(var(--wr-sunken))", text: "rgb(var(--wr-ink-sub))", ring: "rgb(var(--wr-line))" };

              return (
                <Fragment key={row._rowKey}>
                  {row._showCompletionHeader && (
                    <div className="min-w-[1500px] border-y border-nk-done bg-nk-done-soft/70 px-6 py-2 text-xs font-extrabold text-nk-done">
                      온보딩 완료
                    </div>
                  )}
                  <div
                    className={`px-4 flex items-center gap-0 border-b border-nk-line-soft hover:bg-nk-sunken/50 transition-colors min-w-[1500px] ${isSub ? "py-2 bg-nk-sunken/30" : "py-3"}`}
                  >
                  {/* 등록일 - 두 번째 행은 비움 */}
                  <span className="text-xs text-nk-ink-sub w-[80px] flex-shrink-0 px-2 tabular-nums">
                    {isSub ? "" : (row.registration_date || "-")}
                  </span>

                  {/* 이름 - 두 번째 행은 └ 표시 */}
                  <span className="w-[70px] flex-shrink-0 px-2 truncate">
                    {isSub ? (
                      <span className="text-xs text-nk-ink-hint pl-1">└</span>
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
                  <span className="text-xs text-nk-ink-sub w-[70px] flex-shrink-0 px-2 truncate">
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
                  <span className="text-xs text-nk-ink-sub w-[72px] flex-shrink-0 px-2 truncate font-medium">
                    {row._displayClass || "-"}
                  </span>

                  {/* 담당 */}
                  <span className="text-xs text-nk-ink-sub w-[60px] flex-shrink-0 px-2 truncate">
                    {row._displayTeacher || "-"}
                  </span>

                  {/* 학생 연락처 */}
                  <span className="text-xs text-nk-ink-hint w-[105px] flex-shrink-0 px-2 tabular-nums whitespace-nowrap">
                    {row.student_phone || "-"}
                  </span>

                  {/* 학부모 연락처 */}
                  <span className="text-xs text-nk-ink-hint w-[105px] flex-shrink-0 px-1 tabular-nums whitespace-nowrap">
                    {row.parent_phone || "-"}
                  </span>

                  {/* 진행 현황 */}
                  <div className="flex-1 min-w-[510px] px-2">
                    <div className="flex items-start gap-3">
                      <div className="flex w-[54px] flex-shrink-0 flex-col items-center gap-1 pt-0.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                            progressPct === 100 ? "bg-nk-done-soft text-nk-done" : "bg-nk-sunken text-nk-ink-sub"
                          }`}
                        >
                          {progress.done}/{progress.total}
                        </span>
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-nk-sunken">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progressPct}%`,
                              background: progressPct === 100 ? "rgb(var(--wr-status-done))" : NK_GOLD,
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 xl:grid-cols-2">
                        {ONBOARDING_STEPS.map((step) => {
                          const done = Boolean(status[step.key]);
                          return (
                            <button
                              key={step.key}
                              onClick={() => toggleStep(row.id, step.key)}
                              className={`flex min-h-[34px] w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                                done
                                  ? "border-nk-done bg-nk-done-soft text-nk-done"
                                  : "border-nk-line-soft bg-nk-surface text-nk-ink hover:border-nk-line hover:bg-nk-sunken"
                              }`}
                              title={step.label}
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                  done ? "border-nk-done bg-nk-done text-nk-navy-ink" : "border-nk-line bg-nk-surface text-transparent"
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                              <span className={`text-[12px] font-bold leading-snug whitespace-normal ${done ? "text-nk-done line-through decoration-nk-done/70" : "text-nk-ink"}`}>
                                {step.label}
                              </span>
                            </button>
                          );
                        })}

                        {extractCustomItems(status).map((item) => (
                          <div
                            key={item.id}
                            className={`group flex min-h-[34px] items-start gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                              item.done
                                ? "border-nk-progress bg-nk-progress-soft text-nk-progress"
                                : "border-nk-warn bg-nk-warn-soft text-nk-warn"
                            }`}
                          >
                            <button
                              onClick={() => toggleCustomItem(row.id, item.id)}
                              title={item.label}
                              className="flex min-w-0 flex-1 items-start gap-2 text-left"
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                  item.done ? "border-nk-progress bg-nk-progress text-nk-navy-ink" : "border-nk-warn bg-nk-surface text-transparent"
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                              <span className={`text-[12px] font-bold leading-snug whitespace-normal ${item.done ? "text-nk-progress line-through decoration-nk-progress/70" : "text-nk-warn"}`}>
                                {item.label}
                              </span>
                            </button>
                            <button
                              onClick={() => deleteCustomItem(row.id, item.id)}
                              className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-nk-ink-hint transition hover:bg-nk-late-soft hover:text-nk-late"
                              title="삭제"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}

                        {row._isFirstRow && (
                          addingCustomFor === row.id ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); addCustomItem(row.id, customInput); }}
                              className="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-nk-progress bg-nk-progress-soft px-2.5 py-1.5"
                            >
                              <input
                                autoFocus
                                type="text"
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                onBlur={() => { if (!customInput.trim()) { setAddingCustomFor(null); setCustomInput(""); } }}
                                placeholder="항목 입력"
                                className="h-7 min-w-0 flex-1 rounded-md border border-nk-line-soft px-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-nk-progress"
                              />
                              <button type="submit" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-nk-progress text-nk-navy-ink">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          ) : (
                            <button
                              onClick={() => { setAddingCustomFor(row.id); setCustomInput(""); }}
                              className="flex min-h-[34px] items-center gap-2 rounded-lg border border-dashed border-nk-line-soft bg-nk-sunken px-2.5 py-1.5 text-left text-[12px] font-bold text-nk-ink-hint transition hover:border-nk-progress hover:bg-nk-progress-soft hover:text-nk-progress"
                              title="항목 추가"
                            >
                              <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                              항목 추가
                            </button>
                          )
                        )}
                      </div>
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
                            style={{ background: "rgb(var(--wr-navy-soft))", color: NK_PRIMARY }}
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
                            style={{ background: "rgb(var(--wr-status-warn-soft))", color: "rgb(var(--wr-status-warn))" }}
                            title="성향분석 결과 보기"
                          >
                            <Sparkles className="h-3 w-3" />
                            분석
                          </button>
                        )}
                        {row.analysis_id && (
                          <button
                            onClick={() => window.open(`/analyses/${row.analysis_id}?view=teacher`, '_blank')}
                            className="h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all hover:shadow-sm whitespace-nowrap bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
                            title="강사용 A4 한 장 (직원 전용)"
                          >
                            <UserCog className="h-3 w-3" />
                            강사용
                          </button>
                        )}
                        {row.analysis_id && (
                          <button
                            onClick={() =>
                              setFirst14Target({ analysisId: row.analysis_id as string, name: row.name })
                            }
                            className={`h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all hover:shadow-sm whitespace-nowrap ${
                              isFirst14Due(row.registration_date)
                                ? "bg-nk-warn-soft text-nk-warn hover:bg-nk-warn-soft"
                                : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
                            }`}
                            title={
                              isFirst14Due(row.registration_date)
                                ? "등록 후 14일이 지났습니다 — 설문 예측을 채점해 주세요"
                                : "14일 확인"
                            }
                          >
                            <CalendarCheck className="h-3 w-3" />
                            14일 확인
                            {isFirst14Due(row.registration_date) && (
                              <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-nk-warn" />
                            )}
                          </button>
                        )}
                        <Link
                          href={`/registrations/${row.id}`}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-nk-ink-hint hover:bg-nk-progress-soft hover:text-nk-progress transition-colors"
                          title="수정"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(row.id)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-nk-ink-hint hover:bg-nk-late-soft hover:text-nk-late transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  </div>
                </Fragment>
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
            <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-3 border-b bg-nk-surface flex items-center justify-between" style={{ borderColor: "rgb(var(--wr-line-soft))" }}>
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
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-nk-warn-soft text-nk-warn hover:bg-nk-warn-soft"
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
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-nk-sunken text-nk-ink hover:bg-nk-sunken"
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
                  <button onClick={() => setReportPopup(null)} className="w-7 h-7 rounded-lg bg-nk-sunken hover:bg-nk-line flex items-center justify-center">
                    <span className="text-nk-ink-sub text-lg leading-none">&times;</span>
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
        if (!analysis?.report_html) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAnalysisPopup(null)}>
            <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-3 border-b bg-nk-surface flex items-center justify-between" style={{ borderColor: "rgb(var(--wr-line-soft))" }}>
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
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-nk-warn-soft text-nk-warn hover:bg-nk-warn-soft"
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
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm bg-nk-sunken text-nk-ink hover:bg-nk-sunken"
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
                  <button onClick={() => setAnalysisPopup(null)} className="w-7 h-7 rounded-lg bg-nk-sunken hover:bg-nk-line flex items-center justify-center">
                    <span className="text-nk-ink-sub text-lg leading-none">&times;</span>
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
          <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-nk-ink mb-2">등록 안내 삭제</h3>
            <p className="text-sm text-nk-ink-sub mb-5">
              &quot;{registrations.find((r) => r.id === deleteTarget)?.name}&quot; 등록 안내를 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-nk-sunken text-nk-ink-sub hover:bg-nk-line transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-nk-late text-nk-navy-ink hover:bg-nk-late transition-colors disabled:opacity-50"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      <First14Dialog
        analysisId={first14Target?.analysisId ?? null}
        studentName={first14Target?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setFirst14Target(null);
        }}
      />
    </>
  );
}
