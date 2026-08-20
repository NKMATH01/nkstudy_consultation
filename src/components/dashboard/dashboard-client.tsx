"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  ClipboardList,
  Sparkles,
  FileText,
  ChevronRight,
  Plus,
  CalendarDays,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { STATUS_LABELS, RESULT_STATUS_LABELS } from "@/types";

type Consultation = {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  consult_date: string | null;
  subject: string | null;
  location: string | null;
  status: string | null;
  result_status: string | null;
};

type SurveyItem = {
  id: string;
  name: string;
  grade: string | null;
  analysis_id: string | null;
  instrument_version: string | null;
  subject_selection: "math" | "english" | "both" | null;
  created_at: string;
};

type AnalysisItem = {
  id: string;
  name: string;
  created_at: string;
};

interface Props {
  stats: {
    consultations: number;
    registrations: number;
  };
  consultations: Consultation[];
  surveys: SurveyItem[];
  analyses: AnalysisItem[];
}

// 차트 색. 상담(들어온 수)은 네이비, 등록(성사된 수)은 완료 초록으로 갈라 둔다 —
// 두 막대가 같은 계열이면 어느 쪽이 결과인지 매번 범례를 다시 봐야 한다.
const CHART_CONSULT = "rgb(var(--wr-navy))";
const CHART_REGISTER = "rgb(var(--wr-status-done))";
const GRID = "rgb(var(--wr-line-soft))";
const NK_NAVY = "rgb(var(--wr-navy))";
// 이 화면에서 브라스를 쓰는 유일한 자리 — 지금 보고 있는 달의 건수.
// 어두운 네이비 버튼 위라 bright 쪽을 쓴다(라이트 배경용 브라스는 여기서 흐리다).
const NK_COUNT_BG = "rgb(var(--wr-brass-bright))";
const NK_COUNT_INK = "rgb(var(--wr-navy-strong))";

// ── Helper ──
/** "YYYY-MM" 형식 반환 (년+월 기반 정렬용) */
function getYearMonthFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return null;
}

/** "YYYY-MM" → "25년 12월" 형식 표시 */
function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return `${year.slice(2)}년 ${parseInt(month)}월`;
}

// 이름 머리글자 칩. 사람을 구분하는 자리라 분류색만 돌려 쓴다 —
// 여기에 상태색(초록·붉음)을 섞으면 이름이 상태처럼 읽힌다.
const AVATAR_TOKENS = ["cat-1", "cat-2", "cat-3", "cat-4", "navy"] as const;

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const token = AVATAR_TOKENS[name.charCodeAt(0) % AVATAR_TOKENS.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? "16px" : "10px",
        background: `color-mix(in srgb, rgb(var(--wr-${token})) 14%, rgb(var(--wr-surface)))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: `rgb(var(--wr-${token}))`,
        flexShrink: 0,
        letterSpacing: "-0.02em",
      }}
    >
      {name[0]}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    blue: { bg: "rgb(var(--wr-sunken))", text: "rgb(var(--wr-status-progress))" },
    green: { bg: "rgb(var(--wr-status-done-soft))", text: "rgb(var(--wr-status-done))" },
    yellow: { bg: "rgb(var(--wr-status-warn-soft))", text: "rgb(var(--wr-status-warn))" },
    red: { bg: "rgb(var(--wr-status-late-soft))", text: "rgb(var(--wr-status-late))" },
    gray: { bg: "rgb(var(--wr-sunken))", text: "rgb(var(--wr-ink-sub))" },
    purple: { bg: "rgb(var(--wr-sunken))", text: "rgb(var(--wr-cat-3))" },
  };
  const c = colors[color] || colors.blue;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "6px",
        fontSize: "11.5px",
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        lineHeight: "18px",
      }}
    >
      {children}
    </span>
  );
}

// result_status → color mapping
const resultColorMap: Record<string, string> = {
  registered: "green",
  hold: "yellow",
  other: "red",
  none: "gray",
};

export function DashboardClient({ stats, consultations, surveys, analyses }: Props) {
  // 현재 년-월을 기본값으로
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [activeMonth, setActiveMonth] = useState<string | null>(currentYM);
  const [cardPopup, setCardPopup] = useState<string | null>(null);

  // 데이터에서 사용 가능한 년-월 추출 (최신순 정렬)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    consultations.forEach((c) => {
      const ym = getYearMonthFromDate(c.consult_date);
      if (ym) months.add(ym);
    });
    return Array.from(months).sort((a, b) => a.localeCompare(b)); // 시간순 (오래된 월 → 최신 월)
  }, [consultations]);

  // 년-월 기반 필터링
  const filtered = useMemo(() => {
    if (activeMonth === null) return consultations;
    return consultations.filter((c) => getYearMonthFromDate(c.consult_date) === activeMonth);
  }, [consultations, activeMonth]);

  // Stats for filtered
  const filteredStats = useMemo(() => {
    const registered = filtered.filter(c => c.result_status === "registered").length;
    const hold = filtered.filter(c => c.result_status === "hold").length;
    const other = filtered.filter(c => c.result_status === "other").length;
    const none = filtered.filter(c => !c.result_status || c.result_status === "none").length;
    return { total: filtered.length, registered, hold, other, none };
  }, [filtered]);

  // 설문/분석 월별 필터링
  const filteredSurveys = useMemo(() => {
    if (activeMonth === null) return surveys;
    return surveys.filter((s) => getYearMonthFromDate(s.created_at) === activeMonth);
  }, [surveys, activeMonth]);

  const filteredAnalyses = useMemo(() => {
    if (activeMonth === null) return analyses;
    return analyses.filter((a) => getYearMonthFromDate(a.created_at) === activeMonth);
  }, [analyses, activeMonth]);

  // recentSurveys (최신 4개, 필터된 데이터에서)
  const recentSurveys = useMemo(() => filteredSurveys.slice(0, 4), [filteredSurveys]);

  // 년-월 기반 차트 데이터 (시간순 정렬)
  const monthlyData = useMemo(() => {
    const ymMap = new Map<string, { key: string; m: string; 상담: number; 등록: number }>();
    for (const c of consultations) {
      if (!c.consult_date) continue;
      const ym = getYearMonthFromDate(c.consult_date);
      if (!ym) continue;
      if (!ymMap.has(ym)) {
        ymMap.set(ym, { key: ym, m: formatYearMonth(ym), 상담: 0, 등록: 0 });
      }
      const entry = ymMap.get(ym)!;
      entry.상담 += 1;
      if (c.result_status === "registered") entry.등록 += 1;
    }
    const sorted = Array.from(ymMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    return sorted.length > 0 ? sorted : [{ key: currentYM, m: formatYearMonth(currentYM), 상담: 0, 등록: 0 }];
  }, [consultations, currentYM]);

  // Recent consultations (top 7 from filtered, by date descending)
  const recentConsultations = useMemo(() => filtered.slice(0, 7), [filtered]);

  // Pie data (from filtered)
  const pieData = [
    { name: "등록", value: filteredStats.registered, color: CHART_REGISTER },
    { name: "고민중", value: filteredStats.hold, color: "rgb(var(--wr-status-warn))" },
    { name: "미등록", value: filteredStats.other, color: "rgb(var(--wr-status-late))" },
    { name: "미정", value: filteredStats.none, color: "rgb(var(--wr-ink-hint))" },
  ];
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0) || 1;

  // Stat cards with filtered values.
  // 아이콘 칩 색은 '무엇을 세는 칸인가'를 가르는 분류색이다. 등록 완료만 결과 지표라
  // 완료 초록을 쓰고 나머지는 분류색으로 둔다 — 넷 다 상태색이면 넷 다 상태로 읽힌다.
  const statCards = [
    { key: "consult", label: "전체 상담", value: activeMonth === null ? stats.consultations : filteredStats.total, icon: Users, bg: "rgb(var(--wr-navy))" },
    { key: "registered", label: "등록 완료", value: filteredStats.registered, icon: FileText, bg: "rgb(var(--wr-status-done))" },
    { key: "survey", label: "설문 완료", value: filteredSurveys.length, icon: ClipboardList, bg: "rgb(var(--wr-cat-1))" },
    { key: "analysis", label: "성향분석", value: filteredAnalyses.length, icon: Sparkles, bg: "rgb(var(--wr-cat-3))" },
  ];

  // Get students for card popup
  const getCardPopupData = (key: string) => {
    switch (key) {
      case "consult":
        return filtered;
      case "registered":
        return filtered.filter(c => c.result_status === "registered");
      case "survey":
        return null; // surveys are separate
      case "analysis":
        return null;
      default:
        return null;
    }
  };

  const monthLabel = activeMonth ? formatYearMonth(activeMonth) : "전체";

  return (
    <div className="fade-in">
      {/* ── Monthly Tabs ── */}
      <div className="mb-5 flex items-center gap-2 flex-wrap rounded-xl border border-nk-line-soft/80 bg-nk-surface/70 p-2 shadow-sm">
        <span className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg bg-nk-navy-strong text-nk-navy-ink">
          <CalendarDays className="h-4 w-4" />
        </span>
        <button
          onClick={() => setActiveMonth(null)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all ${
            activeMonth === null ? "border-[var(--primary)] text-nk-navy-ink shadow-sm" : "border-nk-line-soft bg-nk-surface text-nk-ink-sub hover:border-nk-line hover:bg-nk-sunken"
          }`}
          style={activeMonth === null ? { background: NK_NAVY } : undefined}
        >
          전체
          {activeMonth === null && (
            <span className="wr-num text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: NK_COUNT_BG, color: NK_COUNT_INK }}>
              {consultations.length}
            </span>
          )}
        </button>
        {availableMonths.map((ym) => {
          const count = consultations.filter(c => getYearMonthFromDate(c.consult_date) === ym).length;
          const isActive = activeMonth === ym;
          return (
            <button
              key={ym}
              onClick={() => setActiveMonth(isActive ? null : ym)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all ${
                isActive ? "border-[var(--primary)] text-nk-navy-ink shadow-sm" : "border-nk-line-soft bg-nk-surface text-nk-ink-sub hover:border-nk-line hover:bg-nk-sunken"
              }`}
              style={isActive ? { background: NK_NAVY } : undefined}
            >
              {formatYearMonth(ym)}
              {isActive && (
                <span className="wr-num text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: NK_COUNT_BG, color: NK_COUNT_INK }}>
                  {count}
                </span>
              )}
              {!isActive && <span className="wr-num text-[10px] text-nk-ink-hint">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div
            key={s.key}
            className="relative overflow-hidden rounded-2xl p-6 bg-nk-surface card-elevated cursor-pointer fade-in"
            onClick={() => {
              if (s.key === "consult" || s.key === "registered") {
                setCardPopup(s.key);
              }
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11.5px] font-semibold mb-2.5 uppercase" style={{ color: "rgb(var(--wr-ink-hint))", letterSpacing: "0.04em" }}>
                  {s.label}
                </div>
                <div className="wr-num text-[32px] font-extrabold leading-none" style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.03em" }}>
                  {s.value}
                </div>
              </div>
              <div
                className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-nk-navy-ink"
                style={{ background: s.bg }}
              >
                <s.icon className="h-[18px] w-[18px]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[18px]">
        {/* Left Column */}
        <div className="flex flex-col gap-[18px]">
          {/* Bar Chart */}
          <div className="overflow-hidden rounded-[14px] border border-nk-line-soft/90 bg-nk-surface shadow-[0_1px_0_rgb(var(--wr-navy-ink)_/_0.8)_inset,0_18px_48px_rgb(var(--wr-navy-strong)_/_0.075)]">
            <div className="flex justify-between items-center border-b border-nk-line-soft bg-gradient-to-r from-nk-sunken via-nk-surface to-nk-sunken px-6 pt-5 pb-4">
              <div>
                <span className="text-[15px] font-black" style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em" }}>
                  월별 상담 및 등록 현황
                </span>
                <p className="mt-1 text-[11px] font-semibold text-nk-ink-hint">상담 대비 등록 흐름</p>
              </div>
              <div className="flex gap-2.5">
                {[{ l: "상담", c: CHART_CONSULT }, { l: "등록", c: CHART_REGISTER }].map((x) => (
                  <span key={x.l} className="flex items-center gap-1.5 rounded-lg border border-nk-line-soft bg-nk-surface px-2.5 py-1 text-[11px] font-bold" style={{ color: "rgb(var(--wr-ink-sub))" }}>
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: x.c }} />
                    {x.l}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-6 pb-5 pt-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} barCategoryGap="32%" margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke={GRID} vertical={false} />
                  <XAxis dataKey="m" fontSize={11} fontWeight={700} stroke="rgb(var(--wr-ink-hint))" tickLine={false} axisLine={false} dy={8} />
                  <YAxis fontSize={11} fontWeight={700} stroke="rgb(var(--wr-ink-hint))" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgb(var(--wr-navy) / 0.045)", radius: 8 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgb(var(--wr-line))",
                      fontSize: 12,
                      boxShadow: "0 18px 42px rgb(var(--wr-navy-strong) / 0.14)",
                      fontWeight: 700,
                    }}
                  />
                  <Bar dataKey="상담" fill={CHART_CONSULT} radius={[7, 7, 2, 2]} maxBarSize={34} />
                  <Bar dataKey="등록" fill={CHART_REGISTER} radius={[7, 7, 2, 2]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Consultations */}
          <div className="bg-nk-surface rounded-2xl card-shadow">
            <div className="flex justify-between items-center px-6 pt-5 pb-3.5">
              <span className="text-[14.5px] font-bold" style={{ color: "rgb(var(--wr-ink))" }}>
                {activeMonth ? `${formatYearMonth(activeMonth)} 상담 내역` : "최근 상담"}
              </span>
              <Link href="/consultations" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "rgb(var(--wr-status-warn))" }}>
                전체 보기
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-6 pb-4">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["날짜", "이름", "과목", "상태", "결과"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10.5px] font-bold uppercase"
                        style={{ padding: "8px 10px", color: "rgb(var(--wr-ink-hint))", letterSpacing: "0.06em", borderBottom: "1px solid rgb(var(--wr-line))" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentConsultations.map((c) => {
                    const statusKr = (STATUS_LABELS as Record<string, string>)[c.status || ""] || c.status || "-";
                    const resultKr = (RESULT_STATUS_LABELS as Record<string, string>)[c.result_status || ""] || c.result_status || "-";
                    const resultColor = resultColorMap[c.result_status || ""] || "gray";
                    // Status color: completed=green, active=blue, cancelled=red, pending=yellow
                    const statusColor = c.status === "completed" ? "green" : c.status === "active" ? "blue" : c.status === "cancelled" ? "red" : "yellow";
                    return (
                      <tr key={c.id} className="group">
                        <td style={{ padding: "10px", fontSize: "12px", color: "rgb(var(--wr-ink-sub))", borderBottom: "1px solid rgb(var(--wr-sunken))" }}>
                          <Link href={`/consultations/${c.id}`} className="block">
                            {c.consult_date || "-"}
                          </Link>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgb(var(--wr-sunken))" }}>
                          <Link href={`/consultations/${c.id}`} className="flex items-center gap-2">
                            <Avatar name={c.name} size={28} />
                            <span className="font-semibold text-[13px] group-hover:text-nk-progress transition-colors" style={{ color: "rgb(var(--wr-ink))" }}>
                              {c.name}
                            </span>
                          </Link>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgb(var(--wr-sunken))" }}>
                          <Badge color="blue">{c.subject || "-"}</Badge>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgb(var(--wr-sunken))" }}>
                          <Badge color={statusColor}>{statusKr}</Badge>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgb(var(--wr-sunken))" }}>
                          <Badge color={resultColor}>{resultKr}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {recentConsultations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm" style={{ color: "rgb(var(--wr-ink-hint))" }}>
                        {activeMonth ? `${formatYearMonth(activeMonth)} 상담 기록이 없습니다` : "상담 기록이 없습니다"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-[18px]">
          {/* Pie Chart - Result Status */}
          <div className="bg-nk-surface rounded-2xl p-6 card-shadow">
            <div className="text-[14.5px] font-bold mb-4" style={{ color: "rgb(var(--wr-ink))" }}>
              {monthLabel} 상담 결과
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[110px] h-[110px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData.filter(d => d.value > 0)} innerRadius={32} outerRadius={50} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {pieData.filter(d => d.value > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                {pieData.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 mb-2.5">
                    <div className="w-2 h-2 rounded-[3px]" style={{ background: r.color }} />
                    <span className="text-[12.5px] flex-1" style={{ color: "rgb(var(--wr-ink-sub))" }}>{r.name}</span>
                    <span className="text-sm font-bold" style={{ color: "rgb(var(--wr-ink))" }}>{r.value}</span>
                    <span className="text-[10.5px]" style={{ color: "rgb(var(--wr-ink-hint))" }}>
                      {Math.round((r.value / pieTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-nk-surface rounded-2xl p-6 card-shadow">
            <div className="text-[14.5px] font-bold mb-4" style={{ color: "rgb(var(--wr-ink))" }}>빠른 액션</div>
            {[
              { label: "새 상담 등록", href: "/consultations", icon: Plus, color: "rgb(var(--wr-status-progress))" },
              { label: "V2 설문 열기", href: "/survey", icon: ClipboardList, color: "rgb(var(--wr-status-done))" },
              { label: "성향분석 보기", href: "/analyses", icon: Sparkles, color: "rgb(var(--wr-cat-3))" },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[7px] mb-1 transition-colors hover:bg-[rgb(var(--wr-sunken))]"
              >
                <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{ background: "rgb(var(--wr-sunken))", color: a.color }}>
                  <a.icon className="h-[15px] w-[15px]" />
                </div>
                <span className="text-[13px] font-semibold flex-1" style={{ color: "rgb(var(--wr-ink))" }}>{a.label}</span>
                <ChevronRight className="h-3.5 w-3.5" style={{ color: "rgb(var(--wr-line))" }} />
              </Link>
            ))}
          </div>

          {/* Recent Surveys */}
          <div className="bg-nk-surface rounded-2xl card-shadow">
            <div className="px-6 pt-5 pb-3.5">
              <span className="text-[14.5px] font-bold" style={{ color: "rgb(var(--wr-ink))" }}>설문 분석</span>
            </div>
            <div className="px-6 pb-4">
              {recentSurveys.map((s) => (
                <Link
                  key={s.id}
                  href={`/surveys/${s.id}`}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] mb-0.5 transition-colors hover:bg-[rgb(var(--wr-sunken))]"
                >
                  <Avatar name={s.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "rgb(var(--wr-ink))" }}>
                      {s.name}
                      {s.instrument_version === "v2" && (
                        <span className="rounded border border-nk-cat-3 bg-nk-cat-3-soft px-1 py-0.5 text-[8px] font-black text-nk-cat-3">V2</span>
                      )}
                    </div>
                    <div className="text-[10.5px]" style={{ color: "rgb(var(--wr-ink-hint))" }}>
                      {s.grade || "-"}
                      {s.instrument_version === "v2" && s.subject_selection &&
                        ` · ${{ math: "수학", english: "영어", both: "수학+영어" }[s.subject_selection]}`}
                    </div>
                  </div>
                  <Badge color={s.analysis_id ? "green" : "yellow"}>
                    {s.analysis_id ? "완료" : "미분석"}
                  </Badge>
                </Link>
              ))}
              {recentSurveys.length === 0 && (
                <div className="text-center py-6 text-sm" style={{ color: "rgb(var(--wr-ink-hint))" }}>설문 데이터가 없습니다</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Popup Modal ── */}
      {cardPopup && (() => {
        const popupData = getCardPopupData(cardPopup);
        if (!popupData) return null;
        const title = cardPopup === "consult" ? `${monthLabel} 전체 상담` : `${monthLabel} 등록 완료`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCardPopup(null)}>
            <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-4 border-b bg-nk-surface rounded-t-2xl flex items-center justify-between" style={{ borderColor: "rgb(var(--wr-line-soft))" }}>
                <div>
                  <h2 className="text-base font-extrabold" style={{ color: NK_NAVY }}>{title}</h2>
                  <p className="text-xs text-nk-ink-hint mt-0.5">{popupData.length}명</p>
                </div>
                <button onClick={() => setCardPopup(null)} className="w-8 h-8 rounded-lg bg-nk-sunken hover:bg-nk-line flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-nk-ink-sub" />
                </button>
              </div>
              <div className="p-4">
                {popupData.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/consultations/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-nk-sunken transition-colors"
                  >
                    <span className="text-xs text-nk-ink-hint w-5 text-right">{i + 1}</span>
                    <span className="font-bold text-sm" style={{ color: NK_NAVY }}>{c.name}</span>
                    <Badge color="blue">{c.subject || "-"}</Badge>
                    <span className="text-xs text-nk-ink-hint ml-auto">{c.consult_date || "-"}</span>
                    <Badge color={resultColorMap[c.result_status || ""] || "gray"}>
                      {(RESULT_STATUS_LABELS as Record<string, string>)[c.result_status || ""] || "-"}
                    </Badge>
                  </Link>
                ))}
                {popupData.length === 0 && (
                  <div className="text-center py-8 text-sm text-nk-ink-hint">데이터가 없습니다</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
