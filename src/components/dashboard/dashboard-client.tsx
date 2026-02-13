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

interface Props {
  stats: {
    consultations: number;
    surveys: number;
    analyses: number;
    registrations: number;
  };
  consultations: Consultation[];
  recentSurveys: Array<{
    id: string;
    name: string;
    grade: string | null;
    analysis_id: string | null;
  }>;
}

const NK_PRIMARY = "#0F2B5B";
const NK_GOLD = "#D4A853";

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

const AVATAR_BGS = ["#C7D2FE", "#FBCFE8", "#A7F3D0", "#FDE68A", "#DDD6FE", "#FED7AA", "#BAE6FD", "#E9D5FF", "#FECACA", "#D1FAE5"];
const AVATAR_TXS = ["#4338CA", "#BE185D", "#047857", "#A16207", "#6D28D9", "#C2410C", "#0369A1", "#7C3AED", "#BE123C", "#059669"];

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const i = name.charCodeAt(0) % 10;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? "16px" : "10px",
        background: AVATAR_BGS[i],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: AVATAR_TXS[i],
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
    blue: { bg: "#F1F5F9", text: "#2563EB" },
    green: { bg: "#ECFDF5", text: "#059669" },
    yellow: { bg: "#FFFBEB", text: "#D97706" },
    red: { bg: "#FFF1F2", text: "#E11D48" },
    gray: { bg: "#F1F5F9", text: "#64748B" },
    purple: { bg: "#F5F3FF", text: "#7C3AED" },
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

export function DashboardClient({ stats, consultations, recentSurveys }: Props) {
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
    { name: "등록", value: filteredStats.registered, color: "#059669" },
    { name: "보류", value: filteredStats.hold, color: "#D4A853" },
    { name: "기타", value: filteredStats.other, color: "#E11D48" },
    { name: "미정", value: filteredStats.none, color: "#94A3B8" },
  ];
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0) || 1;

  // Stat cards with filtered values
  const statCards = [
    { key: "consult", label: "전체 상담", value: activeMonth === null ? stats.consultations : filteredStats.total, icon: Users, bg: "linear-gradient(135deg,#1E40AF,#3B82F6)", shadow: "rgba(30,64,175,0.15)" },
    { key: "registered", label: "등록 완료", value: filteredStats.registered, icon: FileText, bg: "linear-gradient(135deg,#047857,#10B981)", shadow: "rgba(4,120,87,0.15)" },
    { key: "survey", label: "설문 완료", value: stats.surveys, icon: ClipboardList, bg: "linear-gradient(135deg,#6D28D9,#8B5CF6)", shadow: "rgba(109,40,217,0.15)" },
    { key: "analysis", label: "성향분석", value: stats.analyses, icon: Sparkles, bg: "linear-gradient(135deg,#B45309,#D4A853)", shadow: "rgba(180,83,9,0.15)" },
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
      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <CalendarDays className="h-4 w-4 text-slate-400 mr-1" />
        <button
          onClick={() => setActiveMonth(null)}
          className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full font-semibold transition-all ${
            activeMonth === null ? "text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
          }`}
          style={activeMonth === null ? { background: NK_PRIMARY } : undefined}
        >
          전체
          {activeMonth === null && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: NK_GOLD, color: NK_PRIMARY }}>
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
              className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full font-semibold transition-all ${
                isActive ? "text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
              }`}
              style={isActive ? { background: NK_PRIMARY } : undefined}
            >
              {formatYearMonth(ym)}
              {isActive && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: NK_GOLD, color: NK_PRIMARY }}>
                  {count}
                </span>
              )}
              {!isActive && <span className="text-[10px] text-slate-400">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div
            key={s.key}
            className="relative overflow-hidden rounded-[14px] p-6 bg-white transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            style={{ border: "1px solid rgba(0,0,0,0.04)" }}
            onClick={() => {
              if (s.key === "consult" || s.key === "registered") {
                setCardPopup(s.key);
              }
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11.5px] font-semibold mb-2.5 uppercase" style={{ color: "#94A3B8", letterSpacing: "0.04em" }}>
                  {s.label}
                </div>
                <div className="text-[32px] font-extrabold leading-none" style={{ color: "#0F172A", letterSpacing: "-0.03em" }}>
                  {s.value}
                </div>
              </div>
              <div
                className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-white"
                style={{ background: s.bg, boxShadow: `0 4px 14px ${s.shadow}` }}
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
          <div className="bg-white rounded-[14px]" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="flex justify-between items-center px-6 pt-5 pb-4">
              <span className="text-[14.5px] font-bold" style={{ color: "#1E293B", letterSpacing: "-0.01em" }}>
                월별 상담 및 등록 현황
              </span>
              <div className="flex gap-3.5">
                {[{ l: "상담", c: NK_PRIMARY }, { l: "등록", c: NK_GOLD }].map((x) => (
                  <span key={x.l} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#64748B" }}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: x.c }} />
                    {x.l}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-6 pb-5">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="m" fontSize={10} stroke="#94A3B8" tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} stroke="#94A3B8" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  <Bar dataKey="상담" fill={NK_PRIMARY} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="등록" fill={NK_GOLD} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Consultations */}
          <div className="bg-white rounded-[14px]" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="flex justify-between items-center px-6 pt-5 pb-3.5">
              <span className="text-[14.5px] font-bold" style={{ color: "#1E293B" }}>
                {activeMonth ? `${formatYearMonth(activeMonth)} 상담 내역` : "최근 상담"}
              </span>
              <Link href="/consultations" className="flex items-center gap-1 text-xs font-semibold" style={{ color: NK_GOLD }}>
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
                        style={{ padding: "8px 10px", color: "#94A3B8", letterSpacing: "0.06em", borderBottom: "1px solid #E2E8F0" }}
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
                        <td style={{ padding: "10px", fontSize: "12px", color: "#64748B", borderBottom: "1px solid #F1F5F9" }}>
                          <Link href={`/consultations/${c.id}`} className="block">
                            {c.consult_date || "-"}
                          </Link>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #F1F5F9" }}>
                          <Link href={`/consultations/${c.id}`} className="flex items-center gap-2">
                            <Avatar name={c.name} size={28} />
                            <span className="font-semibold text-[13px] group-hover:text-blue-600 transition-colors" style={{ color: "#1E293B" }}>
                              {c.name}
                            </span>
                          </Link>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #F1F5F9" }}>
                          <Badge color="blue">{c.subject || "-"}</Badge>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #F1F5F9" }}>
                          <Badge color={statusColor}>{statusKr}</Badge>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #F1F5F9" }}>
                          <Badge color={resultColor}>{resultKr}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {recentConsultations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm" style={{ color: "#94A3B8" }}>
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
          <div className="bg-white rounded-[14px] p-6" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="text-[14.5px] font-bold mb-4" style={{ color: "#1E293B" }}>
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
                    <span className="text-[12.5px] flex-1" style={{ color: "#475569" }}>{r.name}</span>
                    <span className="text-sm font-bold" style={{ color: "#1E293B" }}>{r.value}</span>
                    <span className="text-[10.5px]" style={{ color: "#94A3B8" }}>
                      {Math.round((r.value / pieTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-[14px] p-6" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="text-[14.5px] font-bold mb-4" style={{ color: "#1E293B" }}>빠른 액션</div>
            {[
              { label: "새 상담 등록", href: "/consultations", icon: Plus, color: "#2563EB" },
              { label: "설문 입력", href: "/surveys", icon: ClipboardList, color: "#059669" },
              { label: "성향분석 보기", href: "/analyses", icon: Sparkles, color: "#7C3AED" },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[7px] mb-1 transition-colors hover:bg-[#F8FAFC]"
              >
                <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{ background: "#F1F5F9", color: a.color }}>
                  <a.icon className="h-[15px] w-[15px]" />
                </div>
                <span className="text-[13px] font-semibold flex-1" style={{ color: "#334155" }}>{a.label}</span>
                <ChevronRight className="h-3.5 w-3.5" style={{ color: "#CBD5E1" }} />
              </Link>
            ))}
          </div>

          {/* Recent Surveys */}
          <div className="bg-white rounded-[14px]" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="px-6 pt-5 pb-3.5">
              <span className="text-[14.5px] font-bold" style={{ color: "#1E293B" }}>설문 분석</span>
            </div>
            <div className="px-6 pb-4">
              {recentSurveys.map((s) => (
                <Link
                  key={s.id}
                  href={`/surveys/${s.id}`}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] mb-0.5 transition-colors hover:bg-[#F8FAFC]"
                >
                  <Avatar name={s.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold" style={{ color: "#1E293B" }}>{s.name}</div>
                    <div className="text-[10.5px]" style={{ color: "#94A3B8" }}>{s.grade || "-"}</div>
                  </div>
                  <Badge color={s.analysis_id ? "green" : "yellow"}>
                    {s.analysis_id ? "완료" : "미분석"}
                  </Badge>
                </Link>
              ))}
              {recentSurveys.length === 0 && (
                <div className="text-center py-6 text-sm" style={{ color: "#94A3B8" }}>설문 데이터가 없습니다</div>
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-4 border-b bg-white rounded-t-2xl flex items-center justify-between" style={{ borderColor: "#E8ECF1" }}>
                <div>
                  <h2 className="text-base font-extrabold" style={{ color: NK_PRIMARY }}>{title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{popupData.length}명</p>
                </div>
                <button onClick={() => setCardPopup(null)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <div className="p-4">
                {popupData.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/consultations/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-xs text-slate-400 w-5 text-right">{i + 1}</span>
                    <span className="font-bold text-sm" style={{ color: NK_PRIMARY }}>{c.name}</span>
                    <Badge color="blue">{c.subject || "-"}</Badge>
                    <span className="text-xs text-slate-400 ml-auto">{c.consult_date || "-"}</span>
                    <Badge color={resultColorMap[c.result_status || ""] || "gray"}>
                      {(RESULT_STATUS_LABELS as Record<string, string>)[c.result_status || ""] || "-"}
                    </Badge>
                  </Link>
                ))}
                {popupData.length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-400">데이터가 없습니다</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
