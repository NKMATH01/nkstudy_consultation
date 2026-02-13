"use client";

import { Fragment, useMemo, useState } from "react";
import type { Withdrawal } from "@/types";
import {
  Users,
  Clock,
  RotateCcw,
  TrendingDown,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const NK_PRIMARY = "#0F2B5B";
const NK_GOLD = "#D4A853";
const NK_PRIMARY_LIGHT = "#1A3F7A";
const NK_BLUE_50 = "#EFF4FB";

const SUBJECT_TABS = ["전체", "수학", "영어"] as const;
type SubjectTab = (typeof SUBJECT_TABS)[number];

const REASON_COLORS = [
  "#0F2B5B",
  "#D4A853",
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

const COMEBACK_ORDER = ["상", "중상", "중", "중하", "하"] as const;

const COMEBACK_COLORS: Record<string, string> = {
  "상": "#059669",
  "중상": "#10B981",
  "중": "#F59E0B",
  "중하": "#F97316",
  "하": "#EF4444",
};

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getMonthFromDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const fullMatch = dateStr.match(/\d{4}[.\-/](\d{1,2})/);
  if (fullMatch) return parseInt(fullMatch[1]);
  const shortMatch = dateStr.match(/^(\d{1,2})[.\-/]/);
  if (shortMatch) {
    const m = parseInt(shortMatch[1]);
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

function matchesSubject(w: Withdrawal, tab: SubjectTab): boolean {
  if (tab === "전체") return true;
  if (!w.subject) return false;
  const subjectLower = w.subject.toLowerCase();
  if (tab === "수학") return subjectLower.includes("수학") || subjectLower === "math";
  if (tab === "영어")
    return subjectLower.includes("영어") || subjectLower === "english" || subjectLower === "eng";
  return false;
}

function getSubjectBadgeStyle(subject: string): { bg: string; color: string } {
  if (subject.includes("수학")) return { bg: "#DBEAFE", color: "#1D4ED8" };
  if (subject.includes("영어")) return { bg: "#F3E8FF", color: "#7C3AED" };
  return { bg: "#F1F5F9", color: "#64748B" };
}

function getComebackBadgeStyle(possibility: string): { bg: string; color: string } {
  const color = COMEBACK_COLORS[possibility] || "#94A3B8";
  return { bg: `${color}15`, color };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Props {
  withdrawals: Withdrawal[];
  totalStudentCount?: number;
  teacherStudentCounts?: Record<string, number>;
}

interface TeacherRow {
  name: string;
  totalStudents: number;
  withdrawalCount: number;
  withdrawalRate: number;
  hasEarlyWithdrawal: boolean;
  earlyWithdrawalTeachers: string[];
  avgDuration: number;
  validDurationCount: number;
  reasons: Record<string, number>;
  students: string[];
  problemAnalysis: string[];
}

// ─── Custom Tooltip Component ────────────────────────────────────────────────

function CustomTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg border"
      style={{ background: "white", borderColor: "#E2E8F0" }}
    >
      {label && (
        <div className="font-semibold mb-1" style={{ color: NK_PRIMARY }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: p.color }}
          />
          <span className="text-slate-600">
            {p.name}: <span className="font-bold text-slate-800">{p.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section Card Wrapper ─────────────────────────────────────────────────────

function DashboardCard({
  title,
  icon: Icon,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{
        border: "1px solid #E8ECF1",
        boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
      }}
    >
      <div className="mb-5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" style={{ color: NK_PRIMARY }} />}
          <h3 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            {title}
          </h3>
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Problem Analysis Section Component ──────────────────────────────────────

function ProblemAnalysisSection({
  filtered,
  insightData,
  teacherTableData,
}: {
  filtered: Withdrawal[];
  insightData: {
    count: number;
    total: number;
    withdrawalRate: number;
    earlyCount: number;
    earlyTeachers: string[];
    topReasonName: string;
    topReasonPct: string;
    topReasonCount: number;
    comebackPromising: number;
    topTeacherName: string;
    topTeacherCount: number;
    topTeacherRate: string;
  };
  teacherTableData: TeacherRow[];
}) {
  interface ProblemCard {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    title: string;
    severity: "높음" | "중간" | "낮음";
    description: string;
  }

  const problems: ProblemCard[] = [];

  // 1. Early withdrawal problem
  if (insightData.earlyCount > 0) {
    const teacherList = insightData.earlyTeachers.join(", ");
    problems.push({
      icon: AlertTriangle,
      title: "조기 퇴원 문제",
      severity: "높음",
      description: `재원 2개월 이하 조기 퇴원 ${insightData.earlyCount}명 발생. 해당 강사: ${teacherList || "미지정"}. 초기 학생 적응 프로그램 및 강사 멘토링 강화가 필요합니다.`,
    });
  }

  // 2. Dominant reason
  if (parseFloat(insightData.topReasonPct) > 25) {
    problems.push({
      icon: TrendingDown,
      title: "주요 퇴원 사유 집중",
      severity: parseFloat(insightData.topReasonPct) > 40 ? "높음" : "중간",
      description: `"${insightData.topReasonName}" 사유가 전체 퇴원의 ${insightData.topReasonPct}% (${insightData.topReasonCount}명)를 차지합니다. 해당 사유에 대한 집중적인 개선 전략이 필요합니다.`,
    });
  }

  // 3. Teacher withdrawal rate variance
  const highRateTeachers = teacherTableData.filter(t => t.withdrawalRate > 15 && t.totalStudents > 0);
  if (highRateTeachers.length > 0) {
    const names = highRateTeachers.map(t => `${t.name} T (${t.withdrawalRate.toFixed(1)}%)`).join(", ");
    problems.push({
      icon: UserCheck,
      title: "강사별 퇴원율 편차",
      severity: highRateTeachers.some(t => t.withdrawalRate > 25) ? "높음" : "중간",
      description: `퇴원율 15% 초과 강사: ${names}. 강사별 수업 만족도 조사 및 개별 코칭이 권장됩니다.`,
    });
  }

  // 4. Low comeback possibility
  const comebackLowCount = filtered.filter(w => w.comeback_possibility === "하").length;
  const comebackLowPct = filtered.length > 0 ? (comebackLowCount / filtered.length) * 100 : 0;
  if (comebackLowPct > 40) {
    problems.push({
      icon: RotateCcw,
      title: "복귀 가능성 낮음",
      severity: comebackLowPct > 60 ? "높음" : "중간",
      description: `복귀 가능성 "하" 학생이 ${comebackLowCount}명 (${comebackLowPct.toFixed(1)}%)으로, 퇴원 후 복귀를 기대하기 어려운 비율이 높습니다. 퇴원 전 상담 강화가 필요합니다.`,
    });
  }

  // 5. Monthly withdrawal pattern (spike detection)
  if (filtered.length > 0) {
    const byMonth: Record<number, number> = {};
    filtered.forEach(w => {
      const m = getMonthFromDate(w.withdrawal_date);
      if (m) byMonth[m] = (byMonth[m] || 0) + 1;
    });
    const monthEntries = Object.entries(byMonth).map(([m, c]) => ({ month: Number(m), count: c }));
    if (monthEntries.length > 1) {
      const avg = monthEntries.reduce((s, e) => s + e.count, 0) / monthEntries.length;
      const spike = monthEntries.find(e => e.count > avg * 1.5);
      if (spike) {
        problems.push({
          icon: Clock,
          title: "월별 퇴원 패턴",
          severity: "중간",
          description: `${spike.month}월에 퇴원이 ${spike.count}명으로 집중되었습니다 (평균 ${avg.toFixed(1)}명). 해당 시기 학생 관리에 특별한 주의가 필요합니다.`,
        });
      }
    }
  }

  // 6. Multiple reasons for a single teacher
  const multiReasonTeachers = teacherTableData.filter(t => Object.keys(t.reasons).length >= 3);
  if (multiReasonTeachers.length > 0) {
    const names = multiReasonTeachers.map(t => `${t.name} T (${Object.keys(t.reasons).length}개 사유)`).join(", ");
    problems.push({
      icon: Users,
      title: "복합 문제 강사",
      severity: "중간",
      description: `다양한 퇴원 사유가 복합적으로 발생하는 강사: ${names}. 전반적인 수업 운영 점검이 필요합니다.`,
    });
  }

  const severityColor = (s: "높음" | "중간" | "낮음") => {
    if (s === "높음") return "#DC2626";
    if (s === "중간") return "#F59E0B";
    return "#10B981";
  };

  const severityBg = (s: "높음" | "중간" | "낮음") => {
    if (s === "높음") return "#FEF2F2";
    if (s === "중간") return "#FFFBEB";
    return "#ECFDF5";
  };

  if (problems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-400">
        현재 필터 조건에서 특이 문제점이 감지되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {problems.map((problem, idx) => {
        const Icon = problem.icon;
        const borderColor = severityColor(problem.severity);
        return (
          <div
            key={idx}
            className="bg-white rounded-lg p-4"
            style={{
              borderLeft: `4px solid ${borderColor}`,
              border: `1px solid #E8ECF1`,
              borderLeftWidth: "4px",
              borderLeftColor: borderColor,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: severityBg(problem.severity) }}
              >
                <Icon className="w-4 h-4" style={{ color: borderColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: NK_PRIMARY }}>
                    {problem.title}
                  </span>
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: severityBg(problem.severity), color: borderColor }}
                  >
                    {problem.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sortable Header Component ───────────────────────────────────────────────

function SortableHeader({ label, sortField, currentSort, currentDir, onSort }: {
  label: string; sortField: string; currentSort: string; currentDir: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const isActive = currentSort === sortField;
  return (
    <th
      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
      style={{ color: isActive ? NK_GOLD : NK_PRIMARY }}
      onClick={() => onSort(sortField)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && (currentDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WithdrawalDashboard({
  withdrawals,
  totalStudentCount,
  teacherStudentCounts,
}: Props) {
  const [activeMonth, setActiveMonth] = useState<number | null>(() => {
    const currentMonth = new Date().getMonth() + 1;
    const hasData = withdrawals.some((w) => {
      const m = getMonthFromDate(w.withdrawal_date);
      return m === currentMonth;
    });
    return hasData ? currentMonth : null;
  });
  const [activeSubject, setActiveSubject] = useState<SubjectTab>("전체");
  const [expandedTeacherRow, setExpandedTeacherRow] = useState<string | null>(null);
  const [expandedEarlyTeacher, setExpandedEarlyTeacher] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("withdrawal_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedStudent, setSelectedStudent] = useState<Withdrawal | null>(null);
  const [insightPopup, setInsightPopup] = useState<string | null>(null);

  // ─── Available months (parsed from data) ────────────────────────────────

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    withdrawals.forEach((w) => {
      const m = getMonthFromDate(w.withdrawal_date);
      if (m) months.add(m);
    });
    return Array.from(months).sort((a, b) => a - b).filter(m => m !== 12);
  }, [withdrawals]);

  // ─── Filtered data (month + subject) ───────────────────────────────────

  const filtered = useMemo(() => {
    return withdrawals.filter((w) => {
      if (activeMonth !== null) {
        const m = getMonthFromDate(w.withdrawal_date);
        if (m !== activeMonth) return false;
      }
      if (!matchesSubject(w, activeSubject)) return false;
      return true;
    });
  }, [withdrawals, activeMonth, activeSubject]);

  // ─── Sorted filtered for table ─────────────────────────────────────────

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "withdrawal_date":
          cmp = (a.withdrawal_date || "").localeCompare(b.withdrawal_date || "");
          break;
        case "grade":
          cmp = (a.grade || "").localeCompare(b.grade || "");
          break;
        case "teacher": {
          const aTeacher = a.teacher || "미지정";
          const bTeacher = b.teacher || "미지정";
          const aTotal = teacherStudentCounts?.[aTeacher] || 0;
          const bTotal = teacherStudentCounts?.[bTeacher] || 0;
          // Count withdrawals for each teacher in filtered data
          const aWithdrawals = filtered.filter(w => w.teacher === a.teacher).length;
          const bWithdrawals = filtered.filter(w => w.teacher === b.teacher).length;
          const aRate = aTotal > 0 ? aWithdrawals / aTotal : 0;
          const bRate = bTotal > 0 ? bWithdrawals / bTotal : 0;
          cmp = aRate - bRate;
          break;
        }
        case "duration_months":
          cmp = (a.duration_months || 0) - (b.duration_months || 0);
          break;
        case "comeback_possibility": {
          const order = ["상", "중상", "중", "중하", "하"];
          const aIdx = order.indexOf(a.comeback_possibility || "");
          const bIdx = order.indexOf(b.comeback_possibility || "");
          cmp = aIdx - bIdx;
          break;
        }
        default:
          cmp = 0;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDirection, teacherStudentCounts]);

  const handleSort = (field: string) => {
    if (sortKey === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortDirection("desc");
    }
  };

  // ─── Insight Data ──────────────────────────────────────────────────────

  const insightData = useMemo(() => {
    const count = filtered.length;
    // Calculate month-adjusted total
    let total = totalStudentCount || 0;
    if (activeMonth !== null && total > 0) {
      // Students who withdrew after the selected month were still enrolled at that month's end
      const withdrawnAfter = withdrawals.filter((w) => {
        const m = getMonthFromDate(w.withdrawal_date);
        return m !== null && m > activeMonth;
      }).length;
      total = total + withdrawnAfter;
    }
    const withdrawalRate = total > 0 ? (count / total) * 100 : 0;

    // Early withdrawal (duration_months <= 2)
    const earlyWithdrawals = filtered.filter(
      (w) => w.duration_months != null && w.duration_months <= 2
    );
    const earlyCount = earlyWithdrawals.length;
    const earlyTeachers = Array.from(
      new Set(earlyWithdrawals.map((w) => w.teacher).filter(Boolean) as string[])
    );

    // Top reason
    const reasonMap: Record<string, number> = {};
    filtered.forEach((w) => {
      const reason = w.reason_category || "기타";
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });
    const sortedReasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
    const topReasonName = sortedReasons[0]?.[0] || "-";
    const topReasonCount = sortedReasons[0]?.[1] || 0;
    const topReasonPct = count > 0 ? ((topReasonCount / count) * 100).toFixed(1) : "0";

    // Comeback promising
    const comebackPromising = filtered.filter(
      (w) => w.comeback_possibility === "상" || w.comeback_possibility === "중상"
    ).length;

    // Teacher with most withdrawals
    const teacherWithdrawalMap: Record<string, number> = {};
    filtered.forEach((w) => {
      const t = w.teacher || "미지정";
      teacherWithdrawalMap[t] = (teacherWithdrawalMap[t] || 0) + 1;
    });
    const sortedTeachers = Object.entries(teacherWithdrawalMap).sort((a, b) => b[1] - a[1]);
    const topTeacherName = sortedTeachers[0]?.[0] || "-";
    const topTeacherCount = sortedTeachers[0]?.[1] || 0;
    const topTeacherTotal = teacherStudentCounts?.[topTeacherName] || 0;
    const topTeacherRate =
      topTeacherTotal > 0 ? ((topTeacherCount / topTeacherTotal) * 100).toFixed(1) : "-";

    return {
      count,
      total,
      withdrawalRate,
      earlyCount,
      earlyTeachers,
      topReasonName,
      topReasonPct,
      topReasonCount,
      comebackPromising,
      topTeacherName,
      topTeacherCount,
      topTeacherRate,
    };
  }, [filtered, totalStudentCount, teacherStudentCounts, activeMonth, withdrawals]);

  // ─── Teacher Withdrawal Rate Table ─────────────────────────────────────

  const teacherTableData = useMemo(() => {
    const map: Record<
      string,
      {
        count: number;
        students: string[];
        reasons: Record<string, number>;
        totalDuration: number;
        validDurationCount: number;
        earlyWithdrawals: string[];
      }
    > = {};

    filtered.forEach((w) => {
      const teacher = w.teacher || "미지정";
      if (!map[teacher]) {
        map[teacher] = {
          count: 0,
          students: [],
          reasons: {},
          totalDuration: 0,
          validDurationCount: 0,
          earlyWithdrawals: [],
        };
      }
      const td = map[teacher];
      td.count++;
      td.students.push(w.name);

      const reason = w.reason_category || "기타";
      td.reasons[reason] = (td.reasons[reason] || 0) + 1;

      if (w.duration_months != null) {
        td.totalDuration += w.duration_months;
        td.validDurationCount++;
        if (w.duration_months <= 2) {
          td.earlyWithdrawals.push(w.name);
        }
      }
    });

    const rows: TeacherRow[] = Object.entries(map).map(([name, data]) => {
      const totalStudents = teacherStudentCounts?.[name] || 0;
      const withdrawalRate = totalStudents > 0 ? (data.count / totalStudents) * 100 : 0;
      const avgDuration =
        data.validDurationCount > 0
          ? Math.round((data.totalDuration / data.validDurationCount) * 10) / 10
          : 0;

      const problems: string[] = [];
      if (data.earlyWithdrawals.length > 0) {
        problems.push("초기 학생 관리 및 적응 지원 부족");
      }
      if (data.reasons["학습 의지 및 태도"]) {
        problems.push("학습 동기 부여 전략 필요");
      }
      if (data.reasons["강사 역량 및 소통"]) {
        problems.push("수업 방식 개선 및 소통 강화 필요");
      }
      if (data.reasons["학습 관리 및 시스템"]) {
        problems.push("커리큘럼 설명 및 학부모 소통 개선");
      }
      if (avgDuration > 0 && avgDuration < 6) {
        problems.push("장기 유지율 낮음 - 학생 만족도 점검 필요");
      }

      return {
        name,
        totalStudents,
        withdrawalCount: data.count,
        withdrawalRate,
        hasEarlyWithdrawal: data.earlyWithdrawals.length > 0,
        earlyWithdrawalTeachers: data.earlyWithdrawals,
        avgDuration,
        validDurationCount: data.validDurationCount,
        reasons: data.reasons,
        students: data.students,
        problemAnalysis: problems,
      };
    });

    return rows.sort((a, b) => b.withdrawalRate - a.withdrawalRate);
  }, [filtered, teacherStudentCounts]);

  // ─── Reason Analysis (horizontal bar) ──────────────────────────────────

  const reasonAnalysis = useMemo(() => {
    const map: Record<string, { count: number; students: string[] }> = {};
    filtered.forEach((w) => {
      const reason = w.reason_category || "기타";
      if (!map[reason]) map[reason] = { count: 0, students: [] };
      map[reason].count++;
      map[reason].students.push(w.name);
    });
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data], i) => ({
        name,
        value: data.count,
        students: data.students,
        color: REASON_COLORS[i % REASON_COLORS.length],
        pct: filtered.length > 0 ? ((data.count / filtered.length) * 100).toFixed(1) : "0",
      }));
  }, [filtered]);

  // ─── Comeback Possibility (horizontal bar) ─────────────────────────────

  const comebackData = useMemo(() => {
    const byCb: Record<string, number> = {};
    filtered.forEach((w) => {
      const cb = w.comeback_possibility || "미분류";
      byCb[cb] = (byCb[cb] || 0) + 1;
    });
    return COMEBACK_ORDER.filter((k) => byCb[k])
      .map((name) => ({
        name,
        value: byCb[name],
        color: COMEBACK_COLORS[name] || "#94A3B8",
        pct: filtered.length > 0 ? ((byCb[name] / filtered.length) * 100).toFixed(1) : "0",
      }));
  }, [filtered]);

  // ─── Monthly Trend (only when "전체" month tab is selected) ────────────

  const monthlyTrendData = useMemo(() => {
    if (activeMonth !== null) return [];
    const byMonth: Record<number, number> = {};
    // Apply subject filter only, not month
    const subjectFiltered = withdrawals.filter((w) => matchesSubject(w, activeSubject));
    subjectFiltered.forEach((w) => {
      const m = getMonthFromDate(w.withdrawal_date);
      if (m) byMonth[m] = (byMonth[m] || 0) + 1;
    });

    const activeMonthNums = Object.keys(byMonth).map(Number);
    if (activeMonthNums.length === 0) return [];

    const minMonth = Math.min(...activeMonthNums);
    const maxMonth = Math.max(...activeMonthNums);

    return MONTH_LABELS.map((label, i) => ({
      month: label,
      count: byMonth[i + 1] || 0,
      monthNum: i + 1,
    })).filter((m) => m.monthNum >= minMonth && m.monthNum <= maxMonth);
  }, [withdrawals, activeMonth, activeSubject]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── 1. Monthly Filter Tabs ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveMonth(null)}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
            style={{
              background: activeMonth === null ? NK_PRIMARY : "#F1F5F9",
              color: activeMonth === null ? "white" : "#64748B",
              boxShadow:
                activeMonth === null ? "0 2px 8px rgba(15,43,91,0.25)" : "none",
            }}
          >
            전체
            <span
              className="ml-1.5 text-xs font-bold"
              style={{ color: activeMonth === null ? NK_GOLD : "#94A3B8" }}
            >
              {withdrawals.filter((w) => matchesSubject(w, activeSubject)).length}
            </span>
          </button>
          {availableMonths.map((m) => {
            const isActive = activeMonth === m;
            const monthCount = withdrawals.filter((w) => {
              const wm = getMonthFromDate(w.withdrawal_date);
              return wm === m && matchesSubject(w, activeSubject);
            }).length;
            return (
              <button
                key={m}
                onClick={() => setActiveMonth(isActive ? null : m)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                style={{
                  background: isActive ? NK_PRIMARY : "#F1F5F9",
                  color: isActive ? "white" : "#64748B",
                  boxShadow: isActive ? "0 2px 8px rgba(15,43,91,0.25)" : "none",
                }}
              >
                {m}월
                <span
                  className="ml-1.5 text-xs font-bold"
                  style={{ color: isActive ? NK_GOLD : "#94A3B8" }}
                >
                  {monthCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── 2. Subject Filter Tabs ─────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          {SUBJECT_TABS.map((tab) => {
            const isActive = activeSubject === tab;
            const count =
              tab === "전체"
                ? withdrawals.filter((w) => {
                    if (activeMonth !== null) {
                      const m = getMonthFromDate(w.withdrawal_date);
                      if (m !== activeMonth) return false;
                    }
                    return true;
                  }).length
                : withdrawals.filter((w) => {
                    if (activeMonth !== null) {
                      const m = getMonthFromDate(w.withdrawal_date);
                      if (m !== activeMonth) return false;
                    }
                    return matchesSubject(w, tab);
                  }).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveSubject(tab)}
                className="relative px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: isActive ? NK_PRIMARY : "transparent",
                  color: isActive ? "white" : "#64748B",
                  boxShadow: isActive ? "0 2px 8px rgba(15,43,91,0.25)" : "none",
                }}
              >
                {tab}
                <span
                  className="ml-1.5 text-xs font-bold"
                  style={{ color: isActive ? NK_GOLD : "#94A3B8" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Key Insights Section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 3-1. 전체 퇴원율 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-white cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: `1px solid ${insightData.withdrawalRate > 15 ? "#FCA5A5" : "#E8ECF1"}`,
            boxShadow:
              insightData.withdrawalRate > 15
                ? "0 1px 3px rgba(239,68,68,0.08), 0 4px 12px rgba(239,68,68,0.06)"
                : "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
          }}
          onClick={() => setInsightPopup('rate')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-slate-400">
                전체 퇴원율
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight"
                style={{
                  color: insightData.withdrawalRate > 15 ? "#EF4444" : NK_PRIMARY,
                }}
              >
                {insightData.total > 0
                  ? insightData.withdrawalRate.toFixed(1)
                  : "0.0"}
                %
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {insightData.count}명 / {insightData.total}명
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background:
                  insightData.withdrawalRate > 15
                    ? "linear-gradient(135deg, #DC2626, #EF4444)"
                    : `linear-gradient(135deg, ${NK_PRIMARY}, ${NK_PRIMARY_LIGHT})`,
              }}
            >
              <Users className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-2. 조기 퇴원 경고 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-white cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: `1px solid ${insightData.earlyCount > 0 ? "#FCA5A5" : "#E8ECF1"}`,
            background: insightData.earlyCount > 0 ? "#FEF2F2" : "white",
            boxShadow:
              insightData.earlyCount > 0
                ? "0 1px 3px rgba(239,68,68,0.08), 0 4px 12px rgba(239,68,68,0.06)"
                : "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
          }}
          onClick={() => setInsightPopup('early')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-slate-400">
                조기 퇴원 경고
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight"
                style={{ color: insightData.earlyCount > 0 ? "#DC2626" : NK_PRIMARY }}
              >
                {insightData.earlyCount}명
              </div>
              {insightData.earlyCount > 0 && (
                <>
                  <div className="text-[10px] text-red-500 font-semibold mt-1">
                    강사 역량 부족 가능성
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {insightData.earlyTeachers.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {insightData.earlyCount === 0 && (
                <div className="text-[11px] text-slate-400 mt-1">
                  재원 2개월 이하 퇴원 없음
                </div>
              )}
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background:
                  insightData.earlyCount > 0
                    ? "linear-gradient(135deg, #DC2626, #EF4444)"
                    : "linear-gradient(135deg, #94A3B8, #CBD5E1)",
              }}
            >
              <AlertTriangle className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-3. 최다 퇴원 사유 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-white cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: "1px solid #E8ECF1",
            boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
          }}
          onClick={() => setInsightPopup('reason')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-slate-400">
                최다 퇴원 사유
              </div>
              <div
                className="text-lg font-extrabold leading-tight"
                style={{ color: NK_PRIMARY }}
              >
                {insightData.topReasonName}
              </div>
              <div className="text-[11px] mt-1">
                <span className="font-bold" style={{ color: NK_GOLD }}>
                  {insightData.topReasonPct}%
                </span>
                <span className="text-slate-400 ml-1">
                  ({insightData.topReasonCount}명)
                </span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${NK_PRIMARY}, ${NK_PRIMARY_LIGHT})`,
              }}
            >
              <TrendingDown className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-4. 복귀 유망 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-white cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: "1px solid #E8ECF1",
            boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
          }}
          onClick={() => setInsightPopup('comeback')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-slate-400">
                복귀 유망
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight text-emerald-600"
              >
                {insightData.comebackPromising}명
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                복귀 가능성 상/중상
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #047857, #10B981)",
              }}
            >
              <RotateCcw className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-5. 주의 필요 강사 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-white cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: "1px solid #E8ECF1",
            boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
          }}
          onClick={() => setInsightPopup('teacher')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-slate-400">
                주의 필요 강사
              </div>
              <div
                className="text-lg font-extrabold leading-tight"
                style={{ color: "#DC2626" }}
              >
                {insightData.topTeacherName} T
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {insightData.topTeacherCount}명 퇴원
                {insightData.topTeacherRate !== "-" && (
                  <span className="ml-1 font-bold text-red-500">
                    (퇴원율 {insightData.topTeacherRate}%)
                  </span>
                )}
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #DC2626, #EF4444)",
              }}
            >
              <UserCheck className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3.5. 학원 주요 문제점 분석 ────────────────────────────── */}
      <DashboardCard
        title="학원 주요 문제점 분석"
        icon={AlertTriangle}
        subtitle="퇴원 데이터 기반 학원 운영 개선 포인트"
      >
        <ProblemAnalysisSection filtered={filtered} insightData={insightData} teacherTableData={teacherTableData} />
      </DashboardCard>

      {/* ── 4. Teacher Withdrawal Rate Table ─────────────────────────── */}
      {teacherTableData.length > 0 && (
        <DashboardCard
          title="강사별 퇴원율 분석"
          icon={BarChart3}
          subtitle="강사별 재원생 대비 퇴원 비율 및 문제 분석"
        >
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr style={{ background: NK_BLUE_50 }}>
                  {["강사명", "재원생 수", "퇴원 수", "퇴원율", "평균 재원기간", "상태", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: NK_PRIMARY }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {teacherTableData.map((teacher) => {
                  const isExpanded = expandedTeacherRow === teacher.name;
                  const isHighRate = teacher.withdrawalRate > 20;
                  return (
                    <Fragment key={teacher.name}>
                      <tr
                        className="border-t transition-colors hover:bg-slate-50/50 cursor-pointer"
                        style={{
                          borderColor: "#F1F5F9",
                          background: isHighRate ? "#FEF2F2" : undefined,
                        }}
                        onClick={() =>
                          setExpandedTeacherRow(isExpanded ? null : teacher.name)
                        }
                      >
                        <td className="px-4 py-3">
                          <span
                            className="text-sm font-bold"
                            style={{ color: NK_PRIMARY }}
                          >
                            {teacher.name} T
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {teacher.totalStudents > 0 ? `${teacher.totalStudents}명` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                            style={{ background: NK_PRIMARY }}
                          >
                            {teacher.withdrawalCount}명
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-sm font-extrabold"
                            style={{
                              color: isHighRate ? "#DC2626" : NK_PRIMARY,
                            }}
                          >
                            {teacher.totalStudents > 0
                              ? `${teacher.withdrawalRate.toFixed(1)}%`
                              : "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {teacher.avgDuration > 0 ? `${teacher.avgDuration}개월` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {teacher.hasEarlyWithdrawal && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedEarlyTeacher(expandedEarlyTeacher === teacher.name ? null : teacher.name); }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  조기 퇴원 {teacher.earlyWithdrawalTeachers.length}명 - 강사 역량 점검 필요
                                </button>
                                {expandedEarlyTeacher === teacher.name && (
                                  <div className="absolute z-10 left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[11px] font-bold text-slate-500 mb-2">조기 퇴원 학생 ({teacher.earlyWithdrawalTeachers.length}명)</div>
                                    <div className="space-y-1.5">
                                      {teacher.earlyWithdrawalTeachers.map((studentName, idx) => {
                                        const studentData = filtered.find(w => w.name === studentName && w.teacher === teacher.name);
                                        return (
                                          <div key={idx} className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-700">{studentName}</span>
                                            <span className="text-slate-400">{studentData?.duration_months ? `${studentData.duration_months}개월` : '-'}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            {isHighRate && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700">
                                퇴원율 경고
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-4 pb-4 pt-0">
                            <div
                              className="rounded-xl p-4 mt-1"
                              style={{
                                background: NK_BLUE_50,
                                border: `1px solid ${NK_PRIMARY}15`,
                              }}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Withdrawal students */}
                                <div
                                  className="bg-white rounded-xl p-4"
                                  style={{ border: "1px solid #E8ECF1" }}
                                >
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    퇴원 학생
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {teacher.students.map((name, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                                        style={{
                                          background: NK_BLUE_50,
                                          color: NK_PRIMARY,
                                        }}
                                      >
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Reasons breakdown */}
                                <div
                                  className="bg-white rounded-xl p-4"
                                  style={{ border: "1px solid #E8ECF1" }}
                                >
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    퇴원 사유
                                  </div>
                                  <div className="space-y-2">
                                    {Object.entries(teacher.reasons)
                                      .sort((a, b) => b[1] - a[1])
                                      .slice(0, 4)
                                      .map(([reason, count]) => (
                                        <div key={reason} className="flex items-center gap-2">
                                          <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-xs text-slate-700 font-medium">
                                                {reason}
                                              </span>
                                              <span
                                                className="text-[11px] font-bold"
                                                style={{ color: NK_PRIMARY }}
                                              >
                                                {count}명
                                              </span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                              <div
                                                className="h-full rounded-full"
                                                style={{
                                                  width: `${
                                                    teacher.withdrawalCount > 0
                                                      ? (count / teacher.withdrawalCount) * 100
                                                      : 0
                                                  }%`,
                                                  background: NK_GOLD,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>

                                {/* Problem analysis */}
                                <div
                                  className="bg-white rounded-xl p-4"
                                  style={{ border: "1px solid #E8ECF1" }}
                                >
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    문제 분석
                                  </div>
                                  {teacher.problemAnalysis.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {teacher.problemAnalysis.map((problem, i) => (
                                        <div
                                          key={i}
                                          className="flex items-start gap-2 text-xs"
                                        >
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                          <span className="text-slate-700 font-medium">
                                            {problem}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-400">
                                      특이사항 없음
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      )}

      {/* ── 5. 퇴원 사유 Horizontal Bar Chart ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard
          title="퇴원 사유 분석"
          icon={TrendingDown}
          subtitle="학생들이 떠나는 주요 이유를 파악합니다"
        >
          {reasonAnalysis.length > 0 ? (
            <>
              <ResponsiveContainer
                width="100%"
                height={Math.max(200, reasonAnalysis.length * 44)}
              >
                <BarChart
                  data={reasonAnalysis}
                  layout="vertical"
                  margin={{ left: 10, right: 30 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E8ECF1"
                    horizontal={false}
                  />
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
                    width={120}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload as (typeof reasonAnalysis)[number];
                      return (
                        <div
                          className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-white"
                          style={{ borderColor: "#E2E8F0" }}
                        >
                          <div className="font-semibold" style={{ color: NK_PRIMARY }}>
                            {data.name}
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            {data.value}명 ({data.pct}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="퇴원생"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={28}
                    cursor="pointer"
                    onClick={(data) => { const name = (data as { name?: string }).name; if (name) setSelectedReason(selectedReason === name ? null : name); }}
                  >
                    {reasonAnalysis.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400">
              데이터가 없습니다
            </div>
          )}
        </DashboardCard>

        {/* ── 6. 복귀 가능성 Horizontal Bar Chart ──────────────────────── */}
        <DashboardCard
          title="복귀 가능성 분석"
          icon={RotateCcw}
          subtitle="다시 돌아올 가능성이 있는 학생 비율"
        >
          {comebackData.length > 0 ? (
            <>
              <ResponsiveContainer
                width="100%"
                height={Math.max(180, comebackData.length * 50)}
              >
                <BarChart
                  data={comebackData}
                  layout="vertical"
                  margin={{ left: 10, right: 30 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E8ECF1"
                    horizontal={false}
                  />
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
                    fontSize={12}
                    stroke="#64748B"
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload as (typeof comebackData)[number];
                      return (
                        <div
                          className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-white"
                          style={{ borderColor: "#E2E8F0" }}
                        >
                          <div className="font-semibold" style={{ color: NK_PRIMARY }}>
                            복귀 가능성: {data.name}
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            {data.value}명 ({data.pct}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="학생수"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={32}
                  >
                    {comebackData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {comebackData.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: `${c.color}10` }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: c.color }}
                    />
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold" style={{ color: c.color }}>
                        {c.name}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">
                        {c.value}명 ({c.pct}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400">
              데이터가 없습니다
            </div>
          )}
        </DashboardCard>
      </div>

      {/* ── 7. Monthly Trend (only when "전체" month tab) ─────────────── */}
      {activeMonth === null && monthlyTrendData.length > 0 && (
        <DashboardCard
          title="월별 퇴원 추이"
          icon={Clock}
          subtitle="월별 퇴원 인원수 변화를 확인합니다"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={monthlyTrendData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E8ECF1"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                fontSize={12}
                stroke="#94A3B8"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={11}
                stroke="#94A3B8"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltipContent />} />
              <Line
                type="monotone"
                dataKey="count"
                name="퇴원생 수"
                stroke={NK_PRIMARY}
                strokeWidth={2.5}
                dot={{
                  r: 5,
                  fill: NK_PRIMARY,
                  stroke: "white",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 7,
                  fill: NK_GOLD,
                  stroke: NK_PRIMARY,
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}

      {/* ── 8. 퇴원생 상세 목록 Table ────────────────────────────────── */}
      <DashboardCard
        title="퇴원생 상세 목록"
        icon={GraduationCap}
        subtitle="전체 퇴원 학생의 상세 정보"
      >
        <div className="overflow-x-auto -mx-6">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr style={{ background: NK_BLUE_50 }}>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: NK_PRIMARY }}>No.</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: NK_PRIMARY }}>학생명</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: NK_PRIMARY }}>과목</th>
                <SortableHeader label="퇴원일" sortField="withdrawal_date" currentSort={sortKey} currentDir={sortDirection} onSort={handleSort} />
                <SortableHeader label="학년" sortField="grade" currentSort={sortKey} currentDir={sortDirection} onSort={handleSort} />
                <SortableHeader label="담당" sortField="teacher" currentSort={sortKey} currentDir={sortDirection} onSort={handleSort} />
                <SortableHeader label="재원기간" sortField="duration_months" currentSort={sortKey} currentDir={sortDirection} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: NK_PRIMARY }}>퇴원사유</th>
                <SortableHeader label="복귀가능" sortField="comeback_possibility" currentSort={sortKey} currentDir={sortDirection} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    해당 조건의 퇴원 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                sortedFiltered.map((w, i) => {
                  const subjectStyle = w.subject
                    ? getSubjectBadgeStyle(w.subject)
                    : null;
                  const comebackStyle = w.comeback_possibility
                    ? getComebackBadgeStyle(w.comeback_possibility)
                    : null;

                  return (
                    <tr
                      key={w.id}
                      className="border-t transition-colors hover:bg-slate-50/50"
                      style={{ borderColor: "#F1F5F9" }}
                    >
                      <td className="px-4 py-3 text-xs text-slate-400 font-medium">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-sm font-bold hover:underline transition-colors"
                          style={{ color: NK_PRIMARY }}
                          onClick={() => setSelectedStudent(w)}
                        >
                          {w.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {w.subject && subjectStyle ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                            style={{
                              background: subjectStyle.bg,
                              color: subjectStyle.color,
                            }}
                          >
                            {w.subject}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {w.withdrawal_date || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {w.grade ? (
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <GraduationCap className="w-3 h-3" />
                            {w.grade}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                        {w.teacher ? `${w.teacher} T` : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {w.duration_months != null
                          ? `${w.duration_months}개월`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {w.reason_category ? (
                          <span className="text-xs text-slate-700 font-medium">
                            {w.reason_category}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {w.comeback_possibility && comebackStyle ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={{
                              background: comebackStyle.bg,
                              color: comebackStyle.color,
                            }}
                          >
                            {w.comeback_possibility}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {/* ── Student Detail Popup ──────────────────────────────────── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-6 py-4 border-b bg-white rounded-t-2xl flex items-center justify-between" style={{ borderColor: '#E8ECF1' }}>
              <div>
                <h2 className="text-lg font-extrabold" style={{ color: NK_PRIMARY }}>{selectedStudent.name} 퇴원 보고서</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedStudent.subject} · {selectedStudent.grade} · {selectedStudent.teacher} T</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <span className="text-slate-500 text-lg leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "퇴원일", value: selectedStudent.withdrawal_date },
                  { label: "재원기간", value: selectedStudent.duration_months ? `${selectedStudent.duration_months}개월` : "-" },
                  { label: "퇴원사유", value: selectedStudent.reason_category },
                  { label: "복귀가능성", value: selectedStudent.comeback_possibility },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3" style={{ background: NK_BLUE_50 }}>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</div>
                    <div className="text-sm font-bold mt-1" style={{ color: NK_PRIMARY }}>{item.value || "-"}</div>
                  </div>
                ))}
              </div>
              {/* Enrollment Info */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">등원 정보</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400 text-xs">학교:</span> <span className="font-medium text-slate-700">{selectedStudent.school || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">반:</span> <span className="font-medium text-slate-700">{selectedStudent.class_name || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">등원 시작:</span> <span className="font-medium text-slate-700">{selectedStudent.enrollment_start || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">퇴원인지일:</span> <span className="font-medium text-slate-700">{selectedStudent.enrollment_end || "-"}</span></div>
                </div>
              </div>
              {/* Learning Status */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">학습 상태</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400 text-xs">수업 태도:</span> <span className="font-medium text-slate-700">{selectedStudent.class_attitude || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">숙제 제출:</span> <span className="font-medium text-slate-700">{selectedStudent.homework_submission || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">출결 상태:</span> <span className="font-medium text-slate-700">{selectedStudent.attendance || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">성적 변화:</span> <span className="font-medium text-slate-700">{selectedStudent.grade_change || "-"}</span></div>
                </div>
              </div>
              {/* Opinions */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">퇴원 의견</h3>
                <div className="space-y-3">
                  {selectedStudent.student_opinion && (
                    <div className="rounded-lg p-3 bg-blue-50/50 border border-blue-100">
                      <div className="text-[10px] font-semibold text-blue-600 mb-1">학생 의견</div>
                      <p className="text-sm text-slate-700">{selectedStudent.student_opinion}</p>
                    </div>
                  )}
                  {selectedStudent.parent_opinion && (
                    <div className="rounded-lg p-3 bg-amber-50/50 border border-amber-100">
                      <div className="text-[10px] font-semibold text-amber-600 mb-1">학부모 의견</div>
                      <p className="text-sm text-slate-700">{selectedStudent.parent_opinion}</p>
                    </div>
                  )}
                  {selectedStudent.teacher_opinion && (
                    <div className="rounded-lg p-3 bg-emerald-50/50 border border-emerald-100">
                      <div className="text-[10px] font-semibold text-emerald-600 mb-1">선생님 의견</div>
                      <p className="text-sm text-slate-700">{selectedStudent.teacher_opinion}</p>
                    </div>
                  )}
                  {!selectedStudent.student_opinion && !selectedStudent.parent_opinion && !selectedStudent.teacher_opinion && (
                    <p className="text-xs text-slate-400">기록된 의견 없음</p>
                  )}
                </div>
              </div>
              {/* Consultation */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">최종 상담</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400 text-xs">상담일:</span> <span className="font-medium text-slate-700">{selectedStudent.final_consult_date || "-"}</span></div>
                  <div><span className="text-slate-400 text-xs">상담사:</span> <span className="font-medium text-slate-700">{selectedStudent.final_counselor || "-"}</span></div>
                </div>
                {selectedStudent.final_consult_summary && (
                  <div className="mt-2 rounded-lg p-3 bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-semibold text-slate-500 mb-1">상담 요약</div>
                    <p className="text-sm text-slate-700">{selectedStudent.final_consult_summary}</p>
                  </div>
                )}
              </div>
              {/* Special notes */}
              {selectedStudent.special_notes && selectedStudent.special_notes !== "-" && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">특이사항</h3>
                  <p className="text-sm text-slate-700">{selectedStudent.special_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reason Chart Popup ────────────────────────────────────── */}
      {selectedReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedReason(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 py-3.5 border-b bg-white rounded-t-2xl flex items-center justify-between" style={{ borderColor: '#E8ECF1' }}>
              <div>
                <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>{selectedReason}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(w => (w.reason_category || '기타') === selectedReason).length}명</p>
              </div>
              <button onClick={() => setSelectedReason(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <span className="text-slate-500 text-base leading-none">&times;</span>
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.filter(w => (w.reason_category || '기타') === selectedReason).map((w, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-slate-50 transition-colors">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-slate-500 min-w-[40px]">{w.grade || '-'}</span>
                  <span className="text-slate-500 min-w-[48px]">{w.teacher ? `${w.teacher} T` : '-'}</span>
                  <span className="text-slate-400 text-xs ml-auto">{w.duration_months ? `${w.duration_months}개월` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Insight Cards Popup ───────────────────────────────────── */}
      {insightPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setInsightPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[75vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 py-3.5 border-b bg-white rounded-t-2xl flex items-center justify-between" style={{ borderColor: '#E8ECF1' }}>
              <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>
                {insightPopup === 'rate' && '전체 퇴원율 상세'}
                {insightPopup === 'early' && '조기 퇴원 학생'}
                {insightPopup === 'reason' && `${insightData.topReasonName} 퇴원 학생`}
                {insightPopup === 'comeback' && '복귀 유망 학생'}
                {insightPopup === 'teacher' && `${insightData.topTeacherName} T 퇴원 학생`}
              </h2>
              <button onClick={() => setInsightPopup(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <span className="text-slate-500 text-base leading-none">&times;</span>
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {insightPopup === 'rate' && filtered.map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: NK_BLUE_50, color: NK_PRIMARY }}>{w.subject || '-'}</span>
                  <span className="text-slate-500 text-xs">{w.teacher ? `${w.teacher} T` : '-'}</span>
                  <span className="text-slate-400 text-xs ml-auto">{w.withdrawal_date}</span>
                </div>
              ))}
              {insightPopup === 'early' && filtered.filter(w => w.duration_months != null && w.duration_months <= 2).map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: '#DC2626' }}>{w.name}</span>
                  <span className="text-slate-500 text-xs">{w.teacher ? `${w.teacher} T` : '-'}</span>
                  <span className="text-red-500 text-xs font-semibold">{w.duration_months}개월</span>
                  <span className="text-slate-400 text-xs ml-auto">{w.reason_category || '-'}</span>
                </div>
              ))}
              {insightPopup === 'reason' && filtered.filter(w => w.reason_category === insightData.topReasonName).map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-slate-500 text-xs">{w.grade || '-'}</span>
                  <span className="text-slate-500 text-xs">{w.teacher ? `${w.teacher} T` : '-'}</span>
                </div>
              ))}
              {insightPopup === 'comeback' && filtered.filter(w => w.comeback_possibility === '상' || w.comeback_possibility === '중상').map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: '#059669' }}>{w.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: NK_BLUE_50, color: NK_PRIMARY }}>{w.subject || '-'}</span>
                  <span className="text-emerald-600 text-xs font-semibold">{w.comeback_possibility}</span>
                  <span className="text-slate-400 text-xs ml-auto">{w.teacher ? `${w.teacher} T` : '-'}</span>
                </div>
              ))}
              {insightPopup === 'teacher' && filtered.filter(w => w.teacher === insightData.topTeacherName).map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-slate-500 text-xs">{w.reason_category || '-'}</span>
                  <span className="text-slate-400 text-xs ml-auto">{w.duration_months ? `${w.duration_months}개월` : '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

