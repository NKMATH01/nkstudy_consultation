"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getMonthFromDate, isCurrentYearMonth } from "@/lib/withdrawal-analytics";
import {
  computeRetrospectiveRate,
  retrospectiveStatus,
  type RetrospectiveStatus,
} from "@/lib/withdrawal-retrospective";
import {
  daysSinceWithdrawal,
  isCountedWithdrawal,
  isPausedOverdue,
  retrospectiveReminder,
  statusOf,
  summarizeStatuses,
  toIsoDay,
} from "@/lib/withdrawal-status";
import { WithdrawalRetrospectiveDialog } from "@/components/withdrawals/withdrawal-retrospective-dialog";
import { EventAxesSummary } from "@/components/withdrawals/withdrawal-insight-blocks";
import {
  Plus,
  Pencil,
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
  NotebookPen,
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
import { WITHDRAWAL_STATUS_LABELS } from "@/types";
import type { Withdrawal, WithdrawalStatusValue } from "@/types";

interface Props {
  withdrawals: Withdrawal[];
}

/* ─── 인사이트 계산용: 퇴원일 파싱 (다양한 텍스트 형식 방어) ─── */
function parseWithdrawalDate(w: Withdrawal): Date | null {
  const raw = w.withdrawal_date?.trim();
  if (raw) {
    const m = raw.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const c = new Date(w.created_at);
  return Number.isNaN(c.getTime()) ? null : c;
}

/* ─── 상단 인사이트 스트립: 학원·강사 문제가 목록 진입 즉시 보이도록 ─── */
function WithdrawalInsightStrip({ withdrawals }: { withdrawals: Withdrawal[] }) {
  // 마운트 시점 기준 시각 (렌더 중 Date.now() 호출 회피 — react-hooks/purity)
  const [now] = useState(() => Date.now());
  const insight = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    let recent90 = 0;
    let prev90 = 0;
    const reasonCounts = new Map<string, number>();
    const teacherCounts = new Map<string, number>();
    let comebackPromising = 0;

    for (const w of withdrawals) {
      const date = parseWithdrawalDate(w);
      if (date) {
        const age = now - date.getTime();
        if (age <= 90 * DAY) recent90 += 1;
        else if (age <= 180 * DAY) prev90 += 1;
      }
      if (w.reason_category) {
        reasonCounts.set(w.reason_category, (reasonCounts.get(w.reason_category) ?? 0) + 1);
      }
      if (w.teacher) {
        teacherCounts.set(w.teacher, (teacherCounts.get(w.teacher) ?? 0) + 1);
      }
      if (w.comeback_possibility === "상" || w.comeback_possibility === "중상") comebackPromising += 1;
    }

    const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const topTeacher = [...teacherCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const trend = prev90 > 0 ? Math.round(((recent90 - prev90) / prev90) * 100) : null;

    return { recent90, prev90, trend, topReason, topTeacher, comebackPromising };
  }, [withdrawals, now]);

  const retroRate = useMemo(() => computeRetrospectiveRate(withdrawals), [withdrawals]);

  if (withdrawals.length === 0) return null;

  const trendUp = insight.trend != null && insight.trend > 0;
  const cards = [
    {
      label: "최근 90일 퇴원",
      value: `${insight.recent90}명`,
      sub:
        insight.trend == null
          ? `직전 90일 ${insight.prev90}명`
          : `직전 90일 대비 ${insight.trend > 0 ? "+" : ""}${insight.trend}%`,
      color: trendUp ? "rgb(var(--wr-status-late))" : "rgb(var(--wr-status-done))",
      alert: trendUp,
    },
    {
      label: "최다 퇴원 사유",
      value: insight.topReason ? insight.topReason[0] : "-",
      sub: insight.topReason ? `${insight.topReason[1]}명 — 학원 개선 1순위` : "사유 데이터 없음",
      color: "var(--primary)",
      alert: false,
    },
    {
      label: "최다 퇴원 강사",
      value: insight.topTeacher ? `${insight.topTeacher[0]} T` : "-",
      sub: insight.topTeacher ? `${insight.topTeacher[1]}명 — 분석 대시보드에서 상세 확인` : "강사 데이터 없음",
      color: "rgb(var(--wr-status-late))",
      alert: Boolean(insight.topTeacher && insight.topTeacher[1] >= 3),
    },
    {
      label: "복귀 유망",
      value: `${insight.comebackPromising}명`,
      sub: "복귀 가능성 상/중상 — 재원 유도 연락 대상",
      color: "rgb(var(--wr-status-done))",
      alert: false,
    },
    {
      label: "회고 작성률",
      value: `${retroRate.rate}%`,
      sub: `${retroRate.completed}건 완료 / 총 ${retroRate.total}건`,
      color: retroRate.completed < retroRate.total ? "rgb(var(--wr-status-warn))" : "rgb(var(--wr-status-done))",
      alert: retroRate.completed < retroRate.total,
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border bg-nk-surface px-4 py-3.5"
          style={{
            borderColor: card.alert ? "rgb(var(--wr-status-late-soft))" : "rgb(var(--wr-line-soft))",
            boxShadow: card.alert
              ? "0 4px 14px rgb(var(--wr-status-late) / 0.10)"
              : "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-nk-ink-hint">{card.label}</p>
          <p className="wr-num mt-1 truncate text-lg font-extrabold leading-tight" style={{ color: card.color }}>
            {card.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-nk-ink-hint" title={card.sub}>
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Comeback Possibility Badge ─── */
function ComebackBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-nk-ink-hint">-</span>;
  const v = value.trim();
  let cls = "bg-nk-late-soft text-nk-late ring-nk-late";
  if (v === "상") cls = "bg-nk-done-soft text-nk-done ring-nk-done";
  else if (v === "중상") cls = "bg-nk-done-soft text-nk-done ring-nk-done";
  else if (v === "중") cls = "bg-nk-warn-soft text-nk-warn ring-nk-warn";
  else if (v === "중하") cls = "bg-nk-warn-soft text-nk-warn ring-nk-warn";
  else if (v === "하") cls = "bg-nk-late-soft text-nk-late ring-nk-late";
  else if (v === "최하") cls = "bg-nk-late-soft text-nk-late ring-nk-late";
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${cls}`}>
      <RotateCcw className="h-3 w-3 mr-1 opacity-70" />
      {v}
    </span>
  );
}

/* ─── Reason Category Badge ─── */
function ReasonBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-nk-ink-hint">-</span>;
  const colors: Record<string, string> = {
    "성적 부진": "bg-nk-late-soft text-nk-late ring-nk-late",
    "학습 의지 및 태도": "bg-nk-warn-soft text-nk-warn ring-nk-warn",
    "학습량 부담": "bg-nk-warn-soft text-nk-warn ring-nk-warn",
    "학습 관리 및 시스템": "bg-nk-cat-3-soft text-nk-cat-3 ring-nk-cat-3",
    "수업 내용 및 방식": "bg-nk-progress-soft text-nk-progress ring-nk-progress",
    "강사 역량 및 소통": "bg-nk-late-soft text-nk-late ring-nk-late",
    "타 학원/과외로 이동": "bg-nk-progress-soft text-nk-progress ring-nk-progress",
    "친구 문제": "bg-nk-late-soft text-nk-late ring-nk-late",
    "스케줄 변동": "bg-nk-cat-1-soft text-nk-cat-1 ring-nk-cat-1",
    "개인 사유": "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft",
    "기타": "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft",
  };
  const cls = colors[value] || "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft";
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${cls}`}>
      {value}
    </span>
  );
}

/* ─── Withdrawal Status Badge ─── */
const STATUS_BADGE: Record<WithdrawalStatusValue, string> = {
  withdrawn: "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft",
  paused: "bg-nk-warn-soft text-nk-warn ring-nk-warn",
  returned: "bg-nk-done-soft text-nk-done ring-nk-done",
};

function StatusBadge({ value, overdue }: { value: WithdrawalStatusValue; overdue: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${
        overdue ? "bg-nk-late-soft text-nk-late ring-nk-late" : STATUS_BADGE[value]
      }`}
      title={overdue ? "예상 복귀 시기가 지났습니다" : undefined}
    >
      {WITHDRAWAL_STATUS_LABELS[value]}
      {overdue ? "!" : ""}
    </span>
  );
}

/* ─── Retrospective Status Badge ─── */
const RETRO_BADGE: Record<RetrospectiveStatus, { label: string; cls: string }> = {
  none: { label: "회고 필요", cls: "bg-nk-warn-soft text-nk-warn ring-nk-warn" },
  draft: { label: "작성 중", cls: "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft" },
  complete: { label: "회고 완료", cls: "bg-nk-done-soft text-nk-done ring-nk-done" },
};

function RetrospectiveBadge({
  status,
  reminder,
  daysSince,
  onClick,
}: {
  status: RetrospectiveStatus;
  reminder: "none" | "waiting" | "overdue";
  daysSince: number | null;
  onClick: (e: React.MouseEvent) => void;
}) {
  // 퇴원 건이면서 회고가 밀린 경우에는 남은/지난 날짜를 앞세워 보여 준다.
  let badge = RETRO_BADGE[status];
  if (reminder === "overdue") {
    badge = {
      label: daysSince === null ? "회고 지연" : `회고 D+${daysSince}`,
      cls: "bg-nk-late-soft text-nk-late ring-nk-late",
    };
  } else if (reminder === "waiting") {
    badge = { label: "회고 대기", cls: "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft" };
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap transition-opacity hover:opacity-80 ${badge.cls}`}
    >
      <NotebookPen className="h-2.5 w-2.5" />
      {badge.label}
    </button>
  );
}

/* ─── Subject Badge ─── */
function SubjectBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-nk-ink-hint">-</span>;
  let cls = "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft";
  if (value.includes("수학")) cls = "bg-nk-progress-soft text-nk-progress ring-nk-progress";
  if (value.includes("영어")) cls = "bg-nk-cat-3-soft text-nk-cat-3 ring-nk-cat-3";
  if (value.includes("영어수학") || value.includes("영수"))
    cls = "bg-nk-progress-soft text-nk-progress ring-nk-progress";
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
      {Icon && <Icon className="h-3.5 w-3.5 mt-0.5 text-nk-ink-hint flex-shrink-0" />}
      <div>
        <p className="text-[11px] text-nk-ink-hint leading-tight">{label}</p>
        <p className="text-sm text-nk-ink font-medium leading-snug">{value || "-"}</p>
      </div>
    </div>
  );
}

export function WithdrawalList({ withdrawals }: Props) {
  const router = useRouter();
  const [currentYear] = useState(() => new Date().getFullYear());
  // 마운트 시점의 오늘 (렌더 중 new Date() 호출 회피 — react-hooks/purity)
  const [today] = useState(() => toIsoDay(new Date()));
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Withdrawal | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Withdrawal | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [onlyMissingRetro, setOnlyMissingRetro] = useState(false);
  const [retroTarget, setRetroTarget] = useState<Withdrawal | undefined>();

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
      if (m && isCurrentYearMonth(w.withdrawal_date, currentYear)) months.add(m);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [withdrawals, currentYear]);

  const filtered = useMemo(() => {
    let result = withdrawals;
    if (activeMonth !== null)
      result = result.filter(
        (w) =>
          getMonthFromDate(w.withdrawal_date) === activeMonth &&
          isCurrentYearMonth(w.withdrawal_date, currentYear)
      );
    if (filterReason) result = result.filter((w) => w.reason_category === filterReason);
    if (filterTeacher) result = result.filter((w) => w.teacher === filterTeacher);
    if (filterSubject) result = result.filter((w) => w.subject === filterSubject);
    if (onlyMissingRetro)
      result = result.filter((w) => retrospectiveStatus(w.retrospective) !== "complete");
    return result;
  }, [withdrawals, activeMonth, filterReason, filterTeacher, filterSubject, currentYear, onlyMissingRetro]);

  const hasFilter =
    filterReason || filterTeacher || filterSubject || activeMonth !== null || onlyMissingRetro;

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

  /* ─── 상태 요약 (목록은 전체를 보여 주고, 챙길 것만 한 줄로 짚어 준다) ─── */
  const statusSummary = useMemo(() => summarizeStatuses(withdrawals, today), [withdrawals, today]);
  /* ─── 인사이트 스트립은 '통계'라 퇴원 건만 센다 (휴원·복귀 제외) ─── */
  const countedWithdrawals = useMemo(() => withdrawals.filter(isCountedWithdrawal), [withdrawals]);

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
    setOnlyMissingRetro(false);
  };

  const filterSelectCls =
    "h-8 rounded-lg border border-nk-line-soft bg-nk-surface px-3 text-xs text-nk-ink focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-colors";

  return (
    <>
      <WithdrawalInsightStrip withdrawals={countedWithdrawals} />
      <div
        className="bg-nk-surface rounded-2xl border border-nk-line-soft overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.04)" }}
      >
        {/* ─── Header ─── */}
        <div className="border-b px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-nk-surface/15 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-nk-navy-ink" />
            </div>
            <div>
              <h3 className="font-bold text-nk-navy-ink text-sm">퇴원생 목록</h3>
              <p className="text-[11px] text-nk-navy-ink/60">총 {withdrawals.length}명 등록</p>
            </div>
          </div>
          <button
            onClick={() => { setEditTarget(undefined); setShowForm(true); }}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-nk-surface px-4 text-xs font-bold text-nk-navy transition-colors hover:bg-nk-sunken"
          >
            <Plus className="h-3.5 w-3.5" />
            퇴원생 등록
          </button>
        </div>

        {/* ─── Status Summary Line ─── */}
        {withdrawals.length > 0 && (
          <div
            className="px-6 py-2.5 border-b border-nk-line-soft flex items-center gap-3 flex-wrap text-xs"
            style={{ background: "rgb(var(--wr-sunken))" }}
          >
            <span className="font-semibold text-nk-ink-sub">상태:</span>
            <span className="text-nk-ink-sub">
              휴원 <span className="font-bold text-nk-warn">{statusSummary.paused}</span>
            </span>
            <span className="text-nk-line">|</span>
            <span className="text-nk-ink-sub">
              복귀 예정 경과{" "}
              <span className={`font-bold ${statusSummary.pausedOverdue > 0 ? "text-nk-late" : "text-nk-ink-hint"}`}>
                {statusSummary.pausedOverdue}
              </span>
            </span>
            <span className="text-nk-line">|</span>
            <span className="text-nk-ink-sub">
              회고 미작성{" "}
              <span className={`font-bold ${statusSummary.retrospectiveMissing > 0 ? "text-nk-warn" : "text-nk-done"}`}>
                {statusSummary.retrospectiveMissing}
              </span>
            </span>
            {statusSummary.returned > 0 && (
              <>
                <span className="text-nk-line">|</span>
                <span className="text-nk-ink-sub">
                  복귀 <span className="font-bold text-nk-done">{statusSummary.returned}</span>
                </span>
              </>
            )}
          </div>
        )}

        {/* ─── Monthly Tabs ─── */}
        {availableMonths.length > 0 && (
          <div className="px-6 py-3 border-b border-nk-line-soft flex items-center gap-2 flex-wrap" style={{ background: "rgb(var(--wr-sunken))" }}>
            <CalendarDays className="h-4 w-4 text-nk-ink-hint mr-1" />
            <button
              onClick={() => setActiveMonth(null)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                activeMonth === null
                  ? "text-nk-navy-ink shadow-sm"
                  : "bg-[rgb(var(--wr-sunken))] text-nk-ink-sub hover:bg-nk-line"
              }`}
              style={activeMonth === null ? { background: "var(--primary)" } : undefined}
            >
              전체
              {activeMonth === null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: "rgb(var(--wr-brass-bright))", color: "rgb(var(--wr-navy-strong))" }}>
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
                      ? "text-nk-navy-ink shadow-sm"
                      : "bg-[rgb(var(--wr-sunken))] text-nk-ink-sub hover:bg-nk-line"
                  }`}
                  style={isActive ? { background: "var(--primary)" } : undefined}
                >
                  {month}월
                  {isActive && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: "rgb(var(--wr-brass-bright))", color: "rgb(var(--wr-navy-strong))" }}>
                      {count}
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] text-nk-ink-hint">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Subject Summary Bar ─── */}
        {withdrawals.length > 0 && (
          <div className="px-6 py-3 border-b border-nk-line-soft flex items-center gap-3 flex-wrap" style={{ background: "rgb(var(--wr-sunken))" }}>
            <Users className="h-4 w-4 text-nk-ink-hint" />
            <span className="text-xs font-semibold text-nk-ink-sub">과목별:</span>
            {Object.entries(subjectStats)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([subject, count]) => {
                let dotColor = "bg-nk-ink-hint";
                if (subject.includes("수학")) dotColor = "bg-nk-progress";
                if (subject.includes("영어")) dotColor = "bg-nk-cat-3";
                if (subject.includes("영어수학") || subject.includes("영수"))
                  dotColor = "bg-nk-progress";
                return (
                  <button
                    key={subject}
                    onClick={() => setFilterSubject(filterSubject === subject ? "" : subject)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all ${
                      filterSubject === subject
                        ? "bg-[var(--primary)] text-nk-navy-ink font-bold shadow-sm"
                        : "bg-nk-surface text-nk-ink-sub hover:bg-nk-sunken border border-nk-line-soft"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${filterSubject === subject ? "bg-nk-surface" : dotColor}`} />
                    {subject} <span className="font-bold">{count}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* ─── Filters ─── */}
        <div className="px-6 py-3 border-b border-nk-line-soft flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-nk-ink-hint" />
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
          <button
            onClick={() => setOnlyMissingRetro((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
              onlyMissingRetro
                ? "text-nk-navy-ink shadow-sm"
                : "bg-[rgb(var(--wr-sunken))] text-nk-ink-sub hover:bg-nk-line"
            }`}
            style={onlyMissingRetro ? { background: "var(--primary)" } : undefined}
          >
            <NotebookPen className="h-3 w-3" />
            회고 미작성만
          </button>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary)]/70 font-semibold transition-colors"
            >
              <X className="h-3 w-3" />
              필터 초기화
            </button>
          )}
          <span className="text-xs text-nk-ink-hint ml-auto font-medium">
            {hasFilter ? `${filtered.length}명 / ${withdrawals.length}명` : `${filtered.length}명`}
          </span>
        </div>

        {/* ─── Content ─── */}
        {withdrawals.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-nk-sunken">
              <UserMinus className="h-10 w-10 text-nk-navy" />
            </div>
            <h3 className="text-base font-bold text-nk-ink mb-1">등록된 퇴원생이 없습니다</h3>
            <p className="text-sm text-nk-ink-hint mb-6 max-w-xs">
              퇴원 기록을 추가하여 퇴원 사유와 패턴을 분석해보세요
            </p>
            <button
              onClick={() => { setEditTarget(undefined); setShowForm(true); }}
              className="h-9 px-5 rounded-xl text-nk-navy-ink text-sm font-bold flex items-center gap-2 transition-all hover:-translate-y-px hover:shadow-lg"
              style={{ background: "var(--primary)" }}
            >
              <Plus className="h-4 w-4" />
              첫 퇴원생 등록하기
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-nk-sunken flex items-center justify-center mb-4">
              <Filter className="h-8 w-8 text-nk-ink-hint" />
            </div>
            <h3 className="text-sm font-bold text-nk-ink-sub mb-1">필터 결과가 없습니다</h3>
            <p className="text-xs text-nk-ink-hint mb-4">조건을 변경하거나 필터를 초기화해보세요</p>
            <button
              onClick={clearFilters}
              className="text-xs text-[var(--primary)] font-semibold hover:underline"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          /* 상태 칸이 늘면서 좁은 화면에서 잘릴 수 있어 가로 스크롤을 연다.
             펼침 상세 패널에는 min-w를 주지 않아 카드 폭에 맞춰 그대로 흐른다. */
          <div className="overflow-x-auto">
            {/* ─── Column Header ─── */}
            <div className="px-6 py-2 flex items-center gap-4 border-b border-nk-line-soft bg-nk-sunken/50 min-w-[1060px]">
              <span className="w-5 flex-shrink-0" />
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[52px] flex-shrink-0">상태</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[80px] flex-shrink-0">퇴원일</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[60px] flex-shrink-0">이름</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[52px] flex-shrink-0">과목</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[80px] flex-shrink-0">반</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[56px] flex-shrink-0">선생님</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[40px] flex-shrink-0">학년</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[140px] flex-shrink-0">퇴원 사유</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[48px] flex-shrink-0">재원</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[60px] flex-shrink-0">복귀 가능</span>
              <span className="text-[10px] font-bold text-nk-ink-hint uppercase tracking-wider w-[84px] flex-shrink-0">회고</span>
              <span className="ml-auto w-[90px] flex-shrink-0" />
            </div>

            {/* ─── List Rows ─── */}
            {filtered.map((w) => {
              const isExpanded = expandedId === w.id;
              const rowStatus = statusOf(w);
              const reminder = retrospectiveReminder(w, today);
              return (
                <div key={w.id} className={`border-b border-nk-line-soft last:border-b-0 transition-colors ${isExpanded ? "bg-[var(--primary)]/[0.015]" : ""}`}>
                  {/* ─ Summary Row ─ */}
                  <div
                    className="px-6 py-3 flex items-center gap-4 hover:bg-nk-sunken/80 transition-colors cursor-pointer group min-w-[1060px]"
                    onClick={() => setExpandedId(isExpanded ? null : w.id)}
                  >
                    <span className="flex-shrink-0 w-5 flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--primary)]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-nk-ink-hint group-hover:text-nk-ink-sub transition-colors" />
                      )}
                    </span>
                    <span className="w-[52px] flex-shrink-0">
                      <StatusBadge value={rowStatus} overdue={isPausedOverdue(w, today)} />
                    </span>
                    <span className="text-xs text-nk-ink-hint w-[80px] flex-shrink-0 tabular-nums">{w.withdrawal_date || "-"}</span>
                    <span className="font-bold text-sm text-nk-ink w-[60px] flex-shrink-0 truncate">{w.name}</span>
                    <span className="w-[52px] flex-shrink-0"><SubjectBadge value={w.subject} /></span>
                    <span className="text-sm text-nk-ink-sub w-[80px] flex-shrink-0 truncate">{w.class_name || "-"}</span>
                    <span className="text-sm text-nk-ink-sub w-[56px] flex-shrink-0 truncate">{w.teacher || "-"}</span>
                    <span className="text-xs text-nk-ink-sub w-[40px] flex-shrink-0 font-medium">{w.grade || "-"}</span>
                    <span className="w-[140px] flex-shrink-0"><ReasonBadge value={w.reason_category} /></span>
                    <span className="text-xs text-nk-ink-hint w-[48px] flex-shrink-0 tabular-nums">{w.duration_months ? `${w.duration_months}개월` : "-"}</span>
                    <span className="w-[60px] flex-shrink-0"><ComebackBadge value={w.comeback_possibility} /></span>
                    <span className="w-[84px] flex-shrink-0">
                      <RetrospectiveBadge
                        status={retrospectiveStatus(w.retrospective)}
                        reminder={reminder}
                        daysSince={daysSinceWithdrawal(w, today)}
                        onClick={(e) => { e.stopPropagation(); setRetroTarget(w); }}
                      />
                    </span>
                    <div className="ml-auto flex-shrink-0 flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-nk-ink-hint hover:text-nk-warn hover:bg-nk-warn-soft opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => { e.stopPropagation(); setRetroTarget(w); }}
                      >
                        <NotebookPen className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-nk-ink-hint hover:text-nk-progress hover:bg-nk-progress-soft opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => { e.stopPropagation(); setEditTarget(w); setShowForm(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-nk-ink-hint hover:text-nk-late hover:bg-nk-late-soft opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(w); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* ─ Expanded Detail Panel ─ */}
                  {isExpanded && (
                    <div className="mx-6 mb-4 rounded-xl border border-nk-line-soft overflow-hidden" style={{ boxShadow: "0 1px 4px rgb(var(--wr-navy-strong) / 0.03)" }}>
                      {/* Detail Header Strip */}
                      <div className="flex items-center justify-between bg-nk-sunken px-5 py-2.5">
                        <div className="flex items-center gap-4 text-xs text-nk-ink-sub">
                          <span><span className="text-nk-ink-hint">학교:</span> <span className="font-semibold text-nk-ink">{w.school || "-"}</span></span>
                          <span className="text-nk-line">|</span>
                          <span><span className="text-nk-ink-hint">등원:</span> <span className="font-semibold text-nk-ink">{w.enrollment_start || "-"}</span></span>
                          <span className="text-nk-line">|</span>
                          {/* 퇴원일 = 마지막 등원일(withdrawal_date). 컬럼 분리 이전 기록만 enrollment_end로 보완한다. */}
                          <span><span className="text-nk-ink-hint">퇴원:</span> <span className="font-semibold text-nk-ink">{w.withdrawal_date || w.enrollment_end || "-"}</span></span>
                          <span className="text-nk-line">|</span>
                          <span><span className="text-nk-ink-hint">재원기간:</span> <span className="font-semibold text-nk-ink">{w.duration_months ? `${w.duration_months}개월` : "-"}</span></span>
                        </div>
                      </div>

                      {/* Detail Body */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Learning Status */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-nk-progress-soft flex items-center justify-center">
                              <BookOpen className="h-3.5 w-3.5 text-nk-progress" />
                            </div>
                            <h4 className="text-xs font-bold text-nk-ink">학습 상태</h4>
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
                            <div className="h-6 w-6 rounded-lg bg-nk-warn-soft flex items-center justify-center">
                              <MessageSquare className="h-3.5 w-3.5 text-nk-warn" />
                            </div>
                            <h4 className="text-xs font-bold text-nk-ink">퇴원 사유</h4>
                          </div>
                          <div className="space-y-3 pl-1">
                            {w.student_opinion && (
                              <div>
                                <p className="text-[11px] text-nk-ink-hint mb-0.5">학생 의견</p>
                                <p className="text-sm text-nk-ink leading-relaxed">{w.student_opinion}</p>
                              </div>
                            )}
                            {w.parent_opinion && (
                              <div>
                                <p className="text-[11px] text-nk-ink-hint mb-0.5">학부모 의견</p>
                                <p className="text-sm text-nk-ink leading-relaxed">{w.parent_opinion}</p>
                              </div>
                            )}
                            {w.teacher_opinion && (
                              <div>
                                <p className="text-[11px] text-nk-ink-hint mb-0.5">선생님 의견</p>
                                <p className="text-sm text-nk-ink leading-relaxed">{w.teacher_opinion}</p>
                              </div>
                            )}
                            {!w.student_opinion && !w.parent_opinion && !w.teacher_opinion && (
                              <p className="text-xs text-nk-ink-hint italic">기록된 의견이 없습니다</p>
                            )}
                            {/* 자유서술에서 파생한 4축(떠난 곳·근본 문제·근거 출처·발생 단계) */}
                            <EventAxesSummary row={w} />
                          </div>
                        </div>

                        {/* Column 3: Consultation & Follow-up */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-nk-done-soft flex items-center justify-center">
                              <ClipboardCheck className="h-3.5 w-3.5 text-nk-done" />
                            </div>
                            <h4 className="text-xs font-bold text-nk-ink">최종 상담 / 향후 관리</h4>
                          </div>
                          <div className="space-y-2.5 pl-1">
                            <DetailItem
                              label="최종 상담일"
                              value={w.final_consult_date ? `${w.final_consult_date}${w.final_counselor ? ` (${w.final_counselor})` : ""}` : null}
                              icon={CalendarDays}
                            />
                            {w.final_consult_summary && (
                              <div>
                                <p className="text-[11px] text-nk-ink-hint mb-0.5">상담 요약</p>
                                <p className="text-sm text-nk-ink leading-relaxed">{w.final_consult_summary}</p>
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
                                <p className="text-[11px] text-nk-ink-hint mb-0.5">특이사항</p>
                                <p className="text-sm text-nk-ink leading-relaxed">{w.special_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Retrospective */}
                      <div className="border-t border-nk-line-soft px-5 py-4" style={{ background: "rgb(var(--wr-sunken))" }}>
                        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-nk-warn-soft flex items-center justify-center">
                              <NotebookPen className="h-3.5 w-3.5 text-nk-warn" />
                            </div>
                            <h4 className="text-xs font-bold text-nk-ink">퇴원 회고</h4>
                            <RetrospectiveBadge
                              status={retrospectiveStatus(w.retrospective)}
                              reminder={reminder}
                              daysSince={daysSinceWithdrawal(w, today)}
                              onClick={(e) => { e.stopPropagation(); setRetroTarget(w); }}
                            />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRetroTarget(w); }}
                            className="text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            회고 작성/수정
                          </button>
                        </div>
                        {w.retrospective && retrospectiveStatus(w.retrospective) !== "none" ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { label: "① 첫 징후", value: w.retrospective.first_sign },
                                { label: "② 시도한 개입", value: w.retrospective.our_attempts },
                                { label: "③ 다르게 할 것", value: w.retrospective.do_differently },
                                { label: "④ 시스템 변경", value: w.retrospective.system_change },
                              ].map((item) => (
                                <div key={item.label}>
                                  <p className="text-[11px] text-nk-ink-hint mb-0.5">{item.label}</p>
                                  <p className="text-sm text-nk-ink leading-relaxed">
                                    {item.value || <span className="text-nk-ink-hint">미작성</span>}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {w.retrospective.lesson && (
                              <div className="rounded-lg px-3 py-2" style={{ background: "rgb(var(--wr-status-warn-soft))", border: "1px solid rgb(var(--wr-status-warn-soft))" }}>
                                <p className="text-[11px] font-bold text-nk-warn mb-0.5">배움 한 줄</p>
                                <p className="text-sm text-nk-warn">{w.retrospective.lesson}</p>
                              </div>
                            )}
                            {w.retrospective.manager_comment && (
                              <div>
                                <p className="text-[11px] text-nk-ink-hint mb-0.5">원장 코멘트</p>
                                <p className="text-sm text-nk-ink leading-relaxed">{w.retrospective.manager_comment}</p>
                              </div>
                            )}
                            <p className="text-[11px] text-nk-ink-hint">
                              작성자: {w.retrospective.author || "-"}
                              {w.retrospective.completed_at && (
                                <span className="ml-2">
                                  완료일: {w.retrospective.completed_at.slice(0, 10)}
                                </span>
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-nk-ink-hint italic">
                            아직 회고가 작성되지 않았습니다 — 첫 징후와 시스템 개선점을 남겨주세요
                          </p>
                        )}
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
      <WithdrawalFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditTarget(undefined);
        }}
        withdrawal={editTarget}
      />

      {/* ─── Retrospective Dialog ─── */}
      {retroTarget && (
        <WithdrawalRetrospectiveDialog
          open={!!retroTarget}
          onOpenChange={(open) => !open && setRetroTarget(undefined)}
          withdrawal={retroTarget}
        />
      )}

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
