"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  UserMinus,
  Filter,
  ChevronDown,
  ChevronRight,
  BookOpen,
  GraduationCap,
  CalendarDays,
  MessageSquare,
  ClipboardCheck,
  RotateCcw,
  X,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WithdrawalFormDialog } from "@/components/withdrawals/withdrawal-form-client";
import { deleteWithdrawal } from "@/lib/actions/withdrawal";
import type { Withdrawal } from "@/types";

interface Props {
  withdrawals: Withdrawal[];
}

/* ─── Comeback Possibility Badge ─── */
function ComebackBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-slate-400">-</span>;
  const v = value.trim();
  let cls = "bg-red-100 text-red-700 ring-red-200";
  if (v === "상") cls = "bg-emerald-100 text-emerald-700 ring-emerald-200";
  else if (v === "중상") cls = "bg-green-100 text-green-700 ring-green-200";
  else if (v === "중") cls = "bg-amber-100 text-amber-700 ring-amber-200";
  else if (v === "중하") cls = "bg-orange-100 text-orange-700 ring-orange-200";
  else if (v === "하") cls = "bg-red-100 text-red-700 ring-red-200";
  else if (v === "최하") cls = "bg-red-200 text-red-800 ring-red-300";
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${cls}`}>
      <RotateCcw className="h-3 w-3 mr-1 opacity-70" />
      {v}
    </span>
  );
}

/* ─── Reason Category Badge ─── */
function ReasonBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-slate-400">-</span>;
  const colors: Record<string, string> = {
    "성적 부진": "bg-red-50 text-red-600 ring-red-200",
    "학습 의지 및 태도": "bg-orange-50 text-orange-600 ring-orange-200",
    "학습량 부담": "bg-amber-50 text-amber-600 ring-amber-200",
    "학습 관리 및 시스템": "bg-purple-50 text-purple-600 ring-purple-200",
    "수업 내용 및 방식": "bg-blue-50 text-blue-600 ring-blue-200",
    "강사 역량 및 소통": "bg-pink-50 text-pink-600 ring-pink-200",
    "타 학원/과외로 이동": "bg-indigo-50 text-indigo-600 ring-indigo-200",
    "친구 문제": "bg-rose-50 text-rose-600 ring-rose-200",
    "스케줄 변동": "bg-cyan-50 text-cyan-600 ring-cyan-200",
    "개인 사유": "bg-slate-100 text-slate-600 ring-slate-200",
    "기타": "bg-gray-100 text-gray-600 ring-gray-200",
  };
  const cls = colors[value] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${cls}`}>
      {value}
    </span>
  );
}

/* ─── Subject Badge ─── */
function SubjectBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-slate-400">-</span>;
  let cls = "bg-slate-100 text-slate-600 ring-slate-200";
  if (value.includes("수학")) cls = "bg-blue-50 text-blue-700 ring-blue-200";
  if (value.includes("영어")) cls = "bg-violet-50 text-violet-700 ring-violet-200";
  if (value.includes("영어수학") || value.includes("영수"))
    cls = "bg-indigo-50 text-indigo-700 ring-indigo-200";
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset ${cls}`}>
      {value}
    </span>
  );
}

/* ─── Detail Row Helper ─── */
function DetailItem({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-3.5 w-3.5 mt-0.5 text-slate-400 flex-shrink-0" />}
      <div>
        <p className="text-[11px] text-slate-400 leading-tight">{label}</p>
        <p className="text-sm text-slate-700 font-medium leading-snug">{value || "-"}</p>
      </div>
    </div>
  );
}

/* ─── Month Parser Helper ─── */
function getMonthFromDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const fullMatch = dateStr.match(/\d{4}[.\-/](\d{1,2})/);
  if (fullMatch) return parseInt(fullMatch[1]);
  return null;
}

export function WithdrawalList({ withdrawals }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Withdrawal | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  /* ─── Derived data ─── */
  const uniqueReasons = useMemo(() => {
    const set = new Set(withdrawals.map((w) => w.reason_category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [withdrawals]);

  const uniqueTeachers = useMemo(() => {
    const set = new Set(withdrawals.map((w) => w.teacher).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [withdrawals]);

  const uniqueSubjects = useMemo(() => {
    const set = new Set(withdrawals.map((w) => w.subject).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [withdrawals]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    withdrawals.forEach((w) => {
      const m = getMonthFromDate(w.withdrawal_date);
      if (m && m !== 12) months.add(m);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [withdrawals]);

  const filtered = useMemo(() => {
    let result = withdrawals;
    if (activeMonth !== null) result = result.filter((w) => getMonthFromDate(w.withdrawal_date) === activeMonth);
    if (filterReason) result = result.filter((w) => w.reason_category === filterReason);
    if (filterTeacher) result = result.filter((w) => w.teacher === filterTeacher);
    if (filterSubject) result = result.filter((w) => w.subject === filterSubject);
    return result;
  }, [withdrawals, activeMonth, filterReason, filterTeacher, filterSubject]);

  const hasFilter = filterReason || filterTeacher || filterSubject || activeMonth !== null;

  /* ─── Subject stats ─── */
  const subjectStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of withdrawals) {
      const s = w.subject || "미지정";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [withdrawals]);

  const mathCount = withdrawals.filter((w) => w.subject?.includes("수학")).length;
  const engCount = withdrawals.filter((w) => w.subject?.includes("영어")).length;

  /* ─── Actions ─── */
  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteWithdrawal(deleteTarget.id);
      if (result.success) {
        toast.success("퇴원생이 삭제되었습니다");
        setDeleteTarget(undefined);
        router.refresh();
      } else {
        toast.error(result.error || "삭제 실패");
      }
    });
  };

  const clearFilters = () => {
    setFilterReason("");
    setFilterTeacher("");
    setFilterSubject("");
    setActiveMonth(null);
  };

  const filterSelectCls =
    "h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F2B5B]/30 focus:border-[#0F2B5B]/50 transition-colors";

  return (
    <>
      <div
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.04)" }}
      >
        {/* ─── Header ─── */}
        <div className="border-b px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0F2B5B 0%, #1a3d7a 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">퇴원생 목록</h3>
              <p className="text-[11px] text-white/60">총 {withdrawals.length}명 등록</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="h-8 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all hover:-translate-y-px hover:shadow-lg"
            style={{ background: "#D4A853", color: "#0F2B5B" }}
          >
            <Plus className="h-3.5 w-3.5" />
            퇴원생 등록
          </button>
        </div>

        {/* ─── Monthly Tabs ─── */}
        {availableMonths.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap" style={{ background: "#F8FAFC" }}>
            <CalendarDays className="h-4 w-4 text-slate-400 mr-1" />
            <button
              onClick={() => setActiveMonth(null)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                activeMonth === null
                  ? "text-white shadow-sm"
                  : "bg-[#F1F5F9] text-slate-500 hover:bg-slate-200"
              }`}
              style={activeMonth === null ? { background: "#0F2B5B" } : undefined}
            >
              전체
              {activeMonth === null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: "#D4A853", color: "#0F2B5B" }}>
                  {withdrawals.length}
                </span>
              )}
            </button>
            {availableMonths.map((month) => {
              const count = withdrawals.filter((w) => getMonthFromDate(w.withdrawal_date) === month).length;
              const isActive = activeMonth === month;
              return (
                <button
                  key={month}
                  onClick={() => setActiveMonth(isActive ? null : month)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                    isActive
                      ? "text-white shadow-sm"
                      : "bg-[#F1F5F9] text-slate-500 hover:bg-slate-200"
                  }`}
                  style={isActive ? { background: "#0F2B5B" } : undefined}
                >
                  {month}월
                  {isActive && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: "#D4A853", color: "#0F2B5B" }}>
                      {count}
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] text-slate-400">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Subject Summary Bar ─── */}
        {withdrawals.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap" style={{ background: "#FAFBFD" }}>
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">과목별:</span>
            {Object.entries(subjectStats)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([subject, count]) => {
                let dotColor = "bg-slate-400";
                if (subject.includes("수학")) dotColor = "bg-blue-500";
                if (subject.includes("영어")) dotColor = "bg-violet-500";
                if (subject.includes("영어수학") || subject.includes("영수"))
                  dotColor = "bg-indigo-500";
                return (
                  <button
                    key={subject}
                    onClick={() => setFilterSubject(filterSubject === subject ? "" : subject)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all ${
                      filterSubject === subject
                        ? "bg-[#0F2B5B] text-white font-bold shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${filterSubject === subject ? "bg-white" : dotColor}`} />
                    {subject} <span className="font-bold">{count}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* ─── Filters ─── */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-slate-400" />
          <select className={filterSelectCls} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">전체 과목</option>
            {uniqueSubjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className={filterSelectCls} value={filterReason} onChange={(e) => setFilterReason(e.target.value)}>
            <option value="">전체 사유</option>
            {uniqueReasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className={filterSelectCls} value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
            <option value="">전체 선생님</option>
            {uniqueTeachers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-[#0F2B5B] hover:text-[#0F2B5B]/70 font-semibold transition-colors"
            >
              <X className="h-3 w-3" />
              필터 초기화
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto font-medium">
            {hasFilter ? `${filtered.length}명 / ${withdrawals.length}명` : `${filtered.length}명`}
          </span>
        </div>

        {/* ─── Content ─── */}
        {withdrawals.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg, #0F2B5B10 0%, #D4A85320 100%)" }}
            >
              <UserMinus className="h-10 w-10" style={{ color: "#0F2B5B" }} />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">등록된 퇴원생이 없습니다</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">
              퇴원 기록을 추가하여 퇴원 사유와 패턴을 분석해보세요
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="h-9 px-5 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition-all hover:-translate-y-px hover:shadow-lg"
              style={{ background: "#0F2B5B" }}
            >
              <Plus className="h-4 w-4" />
              첫 퇴원생 등록하기
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Filter className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 mb-1">필터 결과가 없습니다</h3>
            <p className="text-xs text-slate-400 mb-4">조건을 변경하거나 필터를 초기화해보세요</p>
            <button
              onClick={clearFilters}
              className="text-xs text-[#0F2B5B] font-semibold hover:underline"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div>
            {/* ─── Column Header ─── */}
            <div className="px-6 py-2 flex items-center gap-4 border-b border-slate-100 bg-slate-50/50">
              <span className="w-5 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[80px] flex-shrink-0">퇴원일</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[60px] flex-shrink-0">이름</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[52px] flex-shrink-0">과목</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[80px] flex-shrink-0">반</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[56px] flex-shrink-0">선생님</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[40px] flex-shrink-0">학년</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[140px] flex-shrink-0">퇴원 사유</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[48px] flex-shrink-0">재원</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[60px] flex-shrink-0">복귀 가능</span>
              <span className="ml-auto w-7 flex-shrink-0" />
            </div>

            {/* ─── List Rows ─── */}
            {filtered.map((w) => {
              const isExpanded = expandedId === w.id;
              return (
                <div key={w.id} className={`border-b border-slate-100 last:border-b-0 transition-colors ${isExpanded ? "bg-[#0F2B5B]/[0.015]" : ""}`}>
                  {/* ─ Summary Row ─ */}
                  <div
                    className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => setExpandedId(isExpanded ? null : w.id)}
                  >
                    <span className="flex-shrink-0 w-5 flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[#0F2B5B]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </span>
                    <span className="text-xs text-slate-400 w-[80px] flex-shrink-0 tabular-nums">{w.withdrawal_date || "-"}</span>
                    <span className="font-bold text-sm text-slate-800 w-[60px] flex-shrink-0 truncate">{w.name}</span>
                    <span className="w-[52px] flex-shrink-0"><SubjectBadge value={w.subject} /></span>
                    <span className="text-sm text-slate-500 w-[80px] flex-shrink-0 truncate">{w.class_name || "-"}</span>
                    <span className="text-sm text-slate-500 w-[56px] flex-shrink-0 truncate">{w.teacher || "-"}</span>
                    <span className="text-xs text-slate-500 w-[40px] flex-shrink-0 font-medium">{w.grade || "-"}</span>
                    <span className="w-[140px] flex-shrink-0"><ReasonBadge value={w.reason_category} /></span>
                    <span className="text-xs text-slate-400 w-[48px] flex-shrink-0 tabular-nums">{w.duration_months ? `${w.duration_months}개월` : "-"}</span>
                    <span className="w-[60px] flex-shrink-0"><ComebackBadge value={w.comeback_possibility} /></span>
                    <div className="ml-auto flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(w); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* ─ Expanded Detail Panel ─ */}
                  {isExpanded && (
                    <div className="mx-6 mb-4 rounded-xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                      {/* Detail Header Strip */}
                      <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(90deg, #0F2B5B08 0%, #D4A85308 100%)" }}>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span><span className="text-slate-400">학교:</span> <span className="font-semibold text-slate-700">{w.school || "-"}</span></span>
                          <span className="text-slate-200">|</span>
                          <span><span className="text-slate-400">등원:</span> <span className="font-semibold text-slate-700">{w.enrollment_start || "-"}</span></span>
                          <span className="text-slate-200">|</span>
                          <span><span className="text-slate-400">퇴원:</span> <span className="font-semibold text-slate-700">{w.enrollment_end || "-"}</span></span>
                          <span className="text-slate-200">|</span>
                          <span><span className="text-slate-400">재원기간:</span> <span className="font-semibold text-slate-700">{w.duration_months ? `${w.duration_months}개월` : "-"}</span></span>
                        </div>
                      </div>

                      {/* Detail Body */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Learning Status */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center">
                              <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-700">학습 상태</h4>
                          </div>
                          <div className="space-y-2.5 pl-1">
                            <DetailItem label="수업 태도" value={w.class_attitude} />
                            <DetailItem label="숙제 제출" value={w.homework_submission} />
                            <DetailItem label="출결 상태" value={w.attendance} />
                            <DetailItem label="성적 변화" value={w.grade_change} />
                            {w.recent_grade && <DetailItem label="최근 성적" value={w.recent_grade} />}
                          </div>
                        </div>

                        {/* Column 2: Withdrawal Reason */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-orange-50 flex items-center justify-center">
                              <MessageSquare className="h-3.5 w-3.5 text-orange-600" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-700">퇴원 사유</h4>
                          </div>
                          <div className="space-y-3 pl-1">
                            {w.student_opinion && (
                              <div>
                                <p className="text-[11px] text-slate-400 mb-0.5">학생 의견</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{w.student_opinion}</p>
                              </div>
                            )}
                            {w.parent_opinion && (
                              <div>
                                <p className="text-[11px] text-slate-400 mb-0.5">학부모 의견</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{w.parent_opinion}</p>
                              </div>
                            )}
                            {w.teacher_opinion && (
                              <div>
                                <p className="text-[11px] text-slate-400 mb-0.5">선생님 의견</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{w.teacher_opinion}</p>
                              </div>
                            )}
                            {!w.student_opinion && !w.parent_opinion && !w.teacher_opinion && (
                              <p className="text-xs text-slate-400 italic">기록된 의견이 없습니다</p>
                            )}
                          </div>
                        </div>

                        {/* Column 3: Consultation & Follow-up */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-700">최종 상담 / 향후 관리</h4>
                          </div>
                          <div className="space-y-2.5 pl-1">
                            <DetailItem
                              label="최종 상담일"
                              value={w.final_consult_date ? `${w.final_consult_date}${w.final_counselor ? ` (${w.final_counselor})` : ""}` : null}
                              icon={CalendarDays}
                            />
                            {w.final_consult_summary && (
                              <div>
                                <p className="text-[11px] text-slate-400 mb-0.5">상담 요약</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{w.final_consult_summary}</p>
                              </div>
                            )}
                            <DetailItem
                              label="학부모 감사인사"
                              value={w.parent_thanks ? "O (완료)" : "X (미완료)"}
                            />
                            {w.expected_comeback_date && (
                              <DetailItem label="예상 복귀일" value={w.expected_comeback_date} icon={RotateCcw} />
                            )}
                            {w.special_notes && w.special_notes !== "-" && (
                              <div>
                                <p className="text-[11px] text-slate-400 mb-0.5">특이사항</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{w.special_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Form Dialog ─── */}
      <WithdrawalFormDialog open={showForm} onOpenChange={setShowForm} />

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>퇴원생 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; 퇴원 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(undefined)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
