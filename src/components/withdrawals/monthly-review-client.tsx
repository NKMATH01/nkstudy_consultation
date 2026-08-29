"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CircleCheck,
  ListChecks,
  Printer,
  Quote,
  TriangleAlert,
} from "lucide-react";
import type { Withdrawal } from "@/types";
import { getMonthFromDate, isCurrentYearMonth } from "@/lib/withdrawal-analytics";
import { isCountedWithdrawal } from "@/lib/withdrawal-status";
import {
  buildMonthlyLessons,
  collectMonthWithdrawals,
  detectRepeatPatterns,
} from "@/lib/monthly-review";
import {
  computeRetrospectiveRate,
  retrospectiveStatus,
  type RetrospectiveStatus,
} from "@/lib/withdrawal-retrospective";
import {
  computeCompletionRate,
  formatYearMonthLabel,
  prevYearMonth,
  type ImprovementAction,
} from "@/lib/improvement-actions";

const NK_PRIMARY = "var(--primary)";
const CARD_BORDER = "rgb(var(--wr-line-soft))";

const RETRO_BADGE: Record<RetrospectiveStatus, { label: string; cls: string }> = {
  none: { label: "회고 필요", cls: "bg-nk-warn-soft text-nk-warn ring-nk-warn" },
  draft: { label: "작성 중", cls: "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft" },
  complete: { label: "회고 완료", cls: "bg-nk-done-soft text-nk-done ring-nk-done" },
};

const ACTION_BADGE: Record<ImprovementAction["status"], { label: string; cls: string }> = {
  done: { label: "완료", cls: "bg-nk-done-soft text-nk-done ring-nk-done" },
  pending: { label: "미완료", cls: "bg-nk-warn-soft text-nk-warn ring-nk-warn" },
  dropped: { label: "보류", cls: "bg-nk-sunken text-nk-ink-sub ring-nk-line-soft" },
};

function StatusBadge({ status }: { status: RetrospectiveStatus }) {
  const badge = RETRO_BADGE[status];
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${badge.cls}`}
    >
      {badge.label}
    </span>
  );
}

function ReviewCard({
  title,
  icon: Icon,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-nk-surface rounded-2xl p-6 break-inside-avoid print:shadow-none print:break-inside-avoid"
      style={{
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
      }}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: NK_PRIMARY }} />
          <h2 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            {title}
          </h2>
        </div>
        {subtitle && <p className="text-xs text-nk-ink-hint mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function MonthlyReviewClient({
  withdrawals: allWithdrawals,
  currentActions,
  prevActions,
  actionsYearMonth,
}: {
  withdrawals: Withdrawal[];
  currentActions: ImprovementAction[];
  prevActions: ImprovementAction[];
  actionsYearMonth: string;
}) {
  // 월간 반성은 퇴원 통계다 — 휴원·복귀는 세지 않는다.
  const withdrawals = useMemo(
    () => allWithdrawals.filter(isCountedWithdrawal),
    [allWithdrawals]
  );
  const [currentYear] = useState(() => new Date().getFullYear());

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    withdrawals.forEach((w) => {
      const m = getMonthFromDate(w.withdrawal_date);
      if (m && isCurrentYearMonth(w.withdrawal_date, currentYear)) months.add(m);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [withdrawals, currentYear]);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(
    () => availableMonths[availableMonths.length - 1] ?? null
  );
  const month = selectedMonth ?? availableMonths[availableMonths.length - 1] ?? null;

  const monthRows = useMemo(
    () => (month === null ? [] : collectMonthWithdrawals(withdrawals, month, currentYear)),
    [withdrawals, month, currentYear]
  );
  const lessons = useMemo(
    () => (month === null ? [] : buildMonthlyLessons(withdrawals, month, currentYear)),
    [withdrawals, month, currentYear]
  );
  const patterns = useMemo(
    () => (month === null ? [] : detectRepeatPatterns(withdrawals, month, currentYear)),
    [withdrawals, month, currentYear]
  );

  const retroRate = computeRetrospectiveRate(monthRows);
  const actionStats = computeCompletionRate(currentActions);
  const prevStats = computeCompletionRate(prevActions);
  const prevLabel = formatYearMonthLabel(prevYearMonth(actionsYearMonth));

  return (
    <div className="space-y-5">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 print:hidden"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)" }}
          >
            <BookOpenCheck className="h-6 w-6 text-nk-navy-ink" />
          </div>
          <div>
            <h1
              className="text-xl font-extrabold"
              style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em", marginBottom: "2px" }}
            >
              월간 반성 리포트
            </h1>
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>
              <span>{month !== null ? `${currentYear}년 ${month}월` : "표시할 달이 없습니다"}</span>
              <span className="text-nk-ink-hint">|</span>
              <span>
                퇴원 <span className="font-bold" style={{ color: NK_PRIMARY }}>{monthRows.length}</span>건
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <select
            className="h-9 rounded-lg border border-nk-line-soft bg-nk-surface px-3 text-sm text-nk-ink focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            value={month ?? ""}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            disabled={availableMonths.length === 0}
          >
            {availableMonths.length === 0 && <option value="">데이터 없음</option>}
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-4 rounded-lg text-nk-navy-ink text-xs font-bold flex items-center gap-1.5 transition-all hover:-translate-y-px"
            style={{ background: NK_PRIMARY }}
          >
            <Printer className="h-3.5 w-3.5" />
            인쇄
          </button>
        </div>
      </div>

      {/* ── 1. 요약 스트립 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 break-inside-avoid">
        {[
          {
            label: "이 달 퇴원",
            value: `${monthRows.length}건`,
            sub: month !== null ? `${month}월 기준` : "-",
          },
          {
            label: "회고 작성률",
            value: `${retroRate.rate}%`,
            sub: `${retroRate.completed}건 완료 / ${retroRate.total}건`,
          },
          {
            label: "이번 달 액션 이행률",
            value: `${actionStats.rate}%`,
            sub: `${actionStats.done}건 완료 / ${actionStats.done + actionStats.pending}건`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-nk-surface rounded-2xl p-5 print:shadow-none"
            style={{
              border: `1px solid ${CARD_BORDER}`,
              boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
            }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-nk-ink-hint mb-2">
              {item.label}
            </div>
            <div className="text-3xl font-extrabold leading-tight tracking-tight" style={{ color: "rgb(var(--wr-ink))" }}>
              {item.value}
            </div>
            <div className="text-[11px] text-nk-ink-hint mt-1">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 2. 퇴원 전건 ─────────────────────────────────────────────── */}
      <ReviewCard title="이 달의 퇴원" icon={ListChecks} subtitle="해당 월 퇴원 전건">
        {monthRows.length === 0 ? (
          <p className="text-sm text-nk-ink-hint py-6 text-center">이 달에 기록된 퇴원이 없습니다</p>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr style={{ background: "rgb(var(--wr-sunken))" }}>
                  {["이름", "반", "강사", "재원기간", "사유", "회고"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: NK_PRIMARY }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthRows.map((w) => (
                  <tr key={w.id} className="border-t" style={{ borderColor: "rgb(var(--wr-sunken))" }}>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: NK_PRIMARY }}>
                      {w.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-nk-ink-sub">{w.class_name || "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-nk-ink-sub">
                      {w.teacher ? `${w.teacher} T` : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-nk-ink-sub">
                      {w.duration_months != null ? `${w.duration_months}개월` : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-nk-ink">
                      {w.reason_category || <span className="text-nk-ink-hint">미입력</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={retrospectiveStatus(w.retrospective)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReviewCard>

      {/* ── 3. 배움 모음 ─────────────────────────────────────────────── */}
      <ReviewCard title="이 달의 배움" icon={Quote} subtitle="회고에서 남긴 한 줄">
        {lessons.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-nk-ink-sub font-medium">
              이 달의 배움이 아직 기록되지 않았습니다
            </p>
            <p className="text-xs text-nk-ink-hint mt-1">
              퇴원생 현황에서 회고를 작성하면 여기에 모입니다
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lessons.map((l, i) => (
              <blockquote
                key={`${l.name}-${i}`}
                className="rounded-xl p-4 break-inside-avoid"
                style={{ background: "rgb(var(--wr-status-warn-soft))", border: "1px solid rgb(var(--wr-status-warn-soft))" }}
              >
                <p className="text-sm text-nk-warn leading-relaxed">&ldquo;{l.lesson}&rdquo;</p>
                <footer className="text-[11px] text-nk-warn mt-2">
                  — {l.author} · {l.name} ({l.teacher} T)
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </ReviewCard>

      {/* ── 4. 반복 패턴 ─────────────────────────────────────────────── */}
      <ReviewCard title="반복 패턴 경고" icon={TriangleAlert} subtitle="여러 달에 걸쳐 되풀이되는 신호">
        {patterns.length === 0 ? (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3"
            style={{ background: "rgb(var(--wr-status-done-soft))", border: "1px solid rgb(var(--wr-status-done-soft))" }}
          >
            <CircleCheck className="w-4 h-4 flex-shrink-0" style={{ color: "rgb(var(--wr-status-done))" }} />
            <span className="text-[13px] font-semibold text-nk-done">
              반복 패턴이 감지되지 않았습니다
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((p) => {
              const accent = p.severity === "심각" ? "rgb(var(--wr-status-late))" : "rgb(var(--wr-status-warn))";
              return (
                <div
                  key={p.id}
                  className="rounded-xl p-4 break-inside-avoid"
                  style={{
                    background: "rgb(var(--wr-sunken))",
                    border: `1px solid ${CARD_BORDER}`,
                    borderLeftWidth: "4px",
                    borderLeftColor: accent,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-nk-navy-ink"
                      style={{ background: accent }}
                    >
                      {p.severity}
                    </span>
                    <span className="text-sm font-bold" style={{ color: NK_PRIMARY }}>
                      {p.title}
                    </span>
                  </div>
                  <p className="text-xs text-nk-ink-sub leading-relaxed">{p.evidence}</p>
                </div>
              );
            })}
          </div>
        )}
      </ReviewCard>

      {/* ── 5. 전월 실행 항목 리뷰 ───────────────────────────────────── */}
      <ReviewCard
        title="전월 실행 항목 리뷰"
        icon={ListChecks}
        subtitle={`${prevLabel}에 채택한 개선 액션의 결과`}
      >
        {prevActions.length === 0 ? (
          <p className="text-sm text-nk-ink-hint py-6 text-center">
            {prevLabel}에 채택된 실행 항목이 없습니다
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-extrabold" style={{ color: "rgb(var(--wr-ink))" }}>
                {prevStats.rate}%
              </span>
              <span className="text-xs text-nk-ink-hint">
                {prevStats.done}건 완료 / {prevStats.done + prevStats.pending}건
              </span>
            </div>
            <ul className="space-y-2">
              {prevActions.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: "rgb(var(--wr-sunken))", border: `1px solid ${CARD_BORDER}` }}
                >
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${ACTION_BADGE[a.status].cls}`}
                  >
                    {ACTION_BADGE[a.status].label}
                  </span>
                  <span className="text-[13px] text-nk-ink flex-1 min-w-0">{a.action_text}</span>
                  {a.owner && <span className="text-[11px] text-nk-ink-hint">{a.owner}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </ReviewCard>
    </div>
  );
}
