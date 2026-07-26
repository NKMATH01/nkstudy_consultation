"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GraduationCap, Info, Quote, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Withdrawal } from "@/types";
import {
  buildTeacherLearning,
  listTeachersFromWithdrawals,
} from "@/lib/teacher-learning";
import { retrospectiveStatus, type RetrospectiveStatus } from "@/lib/withdrawal-retrospective";

const NK_PRIMARY = "var(--primary)";
const CARD_BORDER = "#E8ECF1";
const CORAL = "#F0653A";
const MISSING_COLOR = "#94A3B8";

const REASON_COLORS = [
  "var(--primary)",
  "var(--accent-warm)",
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#8B5CF6",
  "#F97316",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
  "#F43F5E",
];

const RETRO_BADGE: Record<RetrospectiveStatus, { label: string; cls: string }> = {
  none: { label: "회고 필요", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  draft: { label: "작성 중", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  complete: { label: "회고 완료", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

function LearningCard({
  title,
  icon: Icon,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
      }}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: NK_PRIMARY }} />
          <h2 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            {title}
          </h2>
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function TeacherLearningClient({
  withdrawals,
  teacherStudentCounts,
}: {
  withdrawals: Withdrawal[];
  teacherStudentCounts?: Record<string, number>;
}) {
  const [currentYear] = useState(() => new Date().getFullYear());
  const [currentMonth] = useState(() => new Date().getMonth() + 1);

  const teachers = useMemo(() => listTeachersFromWithdrawals(withdrawals), [withdrawals]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const teacher = selectedTeacher ?? teachers[0] ?? null;

  const learning = useMemo(
    () =>
      teacher === null
        ? null
        : buildTeacherLearning(withdrawals, teacher, currentYear, currentMonth),
    [withdrawals, teacher, currentYear, currentMonth]
  );

  const enrolled = teacher ? teacherStudentCounts?.[teacher] : undefined;

  const trendTone =
    learning?.improvement.trend === "improving"
      ? { bg: "#ECFDF5", border: "#A7F3D0", color: "#047857", Icon: TrendingDown }
      : learning?.improvement.trend === "worsening"
        ? { bg: "#FFFBEB", border: "#FDE68A", color: "#B45309", Icon: TrendingUp }
        : { bg: "#F8FAFC", border: CARD_BORDER, color: "#475569", Icon: Minus };

  const monthlyChartData = (learning?.monthlyTrend ?? []).map((m) => ({
    month: `${m.month}월`,
    count: m.count,
  }));

  return (
    <div className="space-y-5">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)" }}
          >
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl font-extrabold"
              style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "2px" }}
            >
              강사 러닝 뷰
            </h1>
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "#64748B" }}>
              <span>강사별 퇴원 이력에서 배움을 모읍니다</span>
              {teacher && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>
                    담당 퇴원{" "}
                    <span className="font-bold" style={{ color: NK_PRIMARY }}>
                      {learning?.history.length ?? 0}
                    </span>
                    건
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <select
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          value={teacher ?? ""}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          disabled={teachers.length === 0}
        >
          {teachers.length === 0 && <option value="">강사 데이터 없음</option>}
          {teachers.map((t) => (
            <option key={t} value={t}>
              {t} T
            </option>
          ))}
        </select>
      </div>

      {/* ── 고정 안내 문구 ───────────────────────────────────────────── */}
      <div
        className="flex items-start gap-2.5 rounded-xl px-4 py-3"
        style={{ background: "#F8FAFC", border: `1px solid ${CARD_BORDER}` }}
      >
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#64748B" }} />
        <p className="text-[13px] text-slate-600 leading-relaxed">
          이 화면은 비난이 아닌 학습을 위한 화면입니다 — 퇴원에서 배우고, 다음 학생을 지키는 데
          씁니다.
        </p>
      </div>

      {!learning || teacher === null ? (
        <div
          className="bg-white rounded-2xl p-10 text-center"
          style={{ border: `1px solid ${CARD_BORDER}` }}
        >
          <p className="text-sm text-slate-500 font-medium">담당 강사가 기록된 퇴원이 없습니다</p>
          <p className="text-xs text-slate-400 mt-1">
            퇴원 등록 시 담당 강사를 입력하면 이 화면에서 함께 볼 수 있습니다
          </p>
        </div>
      ) : (
        <>
          {/* ── 1. 개선 추이 히어로 ──────────────────────────────────── */}
          <div
            className="rounded-2xl p-6"
            style={{ background: trendTone.bg, border: `1px solid ${trendTone.border}` }}
          >
            <div className="flex items-start gap-4">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white"
                style={{ border: `1px solid ${trendTone.border}` }}
              >
                <trendTone.Icon className="h-5 w-5" style={{ color: trendTone.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
                    {teacher} T 개선 추이
                  </span>
                  {enrolled != null && (
                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                      현재 재원 {enrolled}명
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: trendTone.color }}>
                  {learning.improvement.message}
                </p>
                {learning.improvement.trend === "worsening" && (
                  <p className="text-xs text-slate-500 mt-2">
                    반 편성·수업 난이도·초기 케어 중 어디에서 어긋났는지 원장과 함께 짚어보면
                    좋겠습니다.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── 2. 월별 퇴원 추이 ─────────────────────────────────── */}
            <LearningCard title="월별 퇴원 추이" icon={TrendingDown} subtitle="담당 학생의 월별 퇴원 건수">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="#E5EAF1" vertical={false} />
                  <XAxis dataKey="month" fontSize={11} stroke="#94A3B8" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="#94A3B8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload as { count: number };
                      return (
                        <div
                          className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-white"
                          style={{ borderColor: "#E2E8F0" }}
                        >
                          <div className="font-semibold" style={{ color: NK_PRIMARY }}>
                            {label}
                          </div>
                          <div className="text-slate-600 mt-0.5">퇴원 {data.count}건</div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="퇴원"
                    stroke={CORAL}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: CORAL, stroke: "white", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "white", stroke: CORAL, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </LearningCard>

            {/* ── 3. 사유 분포 ──────────────────────────────────────── */}
            <LearningCard title="퇴원 사유 분포" icon={TrendingDown} subtitle="담당 학생이 떠난 이유">
              {learning.reasonDist.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                  데이터가 없습니다
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(200, learning.reasonDist.length * 40)}
                >
                  <BarChart data={learning.reasonDist} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke="#E5EAF1" horizontal={false} />
                    <XAxis
                      type="number"
                      fontSize={11}
                      stroke="#94A3B8"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      fontSize={11}
                      stroke="#64748B"
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload as { name: string; count: number };
                        return (
                          <div
                            className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-white"
                            style={{ borderColor: "#E2E8F0" }}
                          >
                            <div className="font-semibold" style={{ color: NK_PRIMARY }}>
                              {data.name}
                            </div>
                            <div className="text-slate-600 mt-0.5">{data.count}명</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" name="퇴원생" radius={[0, 6, 6, 0]} maxBarSize={26}>
                      {learning.reasonDist.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.name === "미입력"
                              ? MISSING_COLOR
                              : REASON_COLORS[i % REASON_COLORS.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </LearningCard>
          </div>

          {/* ── 4. 배움 모음 ──────────────────────────────────────────── */}
          <LearningCard title="이 강사가 남긴 배움" icon={Quote} subtitle="담당 퇴원 회고에서 모은 한 줄">
            {learning.lessons.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500 font-medium">아직 기록된 배움이 없습니다</p>
                <p className="text-xs text-slate-400 mt-1">
                  퇴원생 현황에서 회고를 작성하면 여기에 모입니다
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {learning.lessons.map((l, i) => (
                  <blockquote
                    key={`${l.name}-${i}`}
                    className="rounded-xl p-4"
                    style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
                  >
                    <p className="text-sm text-amber-900 leading-relaxed">&ldquo;{l.lesson}&rdquo;</p>
                    <footer className="text-[11px] text-amber-700 mt-2">
                      — {l.author} · {l.name}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </LearningCard>

          {/* ── 5. 담당 퇴원 이력 ─────────────────────────────────────── */}
          <LearningCard title="담당 퇴원 이력" icon={GraduationCap} subtitle="최신순">
            {learning.history.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">기록된 퇴원이 없습니다</p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr style={{ background: "#EFF4FB" }}>
                      {["퇴원일", "이름", "반", "사유", "재원기간", "회고"].map((h) => (
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
                    {learning.history.map((w) => {
                      const badge = RETRO_BADGE[retrospectiveStatus(w.retrospective)];
                      return (
                        <tr key={w.id} className="border-t" style={{ borderColor: "#F1F5F9" }}>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {w.withdrawal_date || "-"}
                          </td>
                          <td className="px-4 py-2.5 text-sm font-bold" style={{ color: NK_PRIMARY }}>
                            {w.name}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{w.class_name || "-"}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-700">
                            {w.reason_category || <span className="text-slate-300">미입력</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {w.duration_months != null ? `${w.duration_months}개월` : "-"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </LearningCard>
        </>
      )}
    </div>
  );
}
