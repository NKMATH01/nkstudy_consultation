"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import type { Withdrawal } from "@/types";
import { WithdrawalInsightBlocks } from "./withdrawal-insight-blocks";
import {
  buildPrescriptions,
  computeDataQuality,
  diagnoseWithdrawals,
  getMonthFromDate,
  isCurrentYearMonth,
  pickHeroDiagnoses,
} from "@/lib/withdrawal-analytics";
import { DiagnosisSection } from "@/components/withdrawals/withdrawal-diagnosis-hero";
import { ImprovementActionsCard } from "@/components/withdrawals/improvement-actions-card";
import { computeRetrospectiveRate } from "@/lib/withdrawal-retrospective";
import { adoptPrescriptionAction } from "@/lib/actions/improvement-action";
import type { ImprovementAction } from "@/lib/improvement-actions";
import type { DiagnosisType } from "@/lib/withdrawal-analytics";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotebookPen } from "lucide-react";
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

const NK_PRIMARY = "var(--primary)";
const NK_GOLD = "var(--accent-warm)";
const NK_PRIMARY_LIGHT = "rgb(var(--wr-navy))";
const NK_BLUE_50 = "rgb(var(--wr-sunken))";

const SUBJECT_TABS = ["전체", "수학", "영어"] as const;
type SubjectTab = (typeof SUBJECT_TABS)[number];

const REASON_COLORS = [
  // 퇴원 사유는 분류다. 상태색(완료 초록·지연 붉음)을 돌려 쓰면 사유마다 좋고 나쁨이
  // 있는 것처럼 읽히므로 분류색 네 가지와 네이비만 돌린다.
  "rgb(var(--wr-cat-1))",
  "rgb(var(--wr-cat-2))",
  "rgb(var(--wr-cat-3))",
  "rgb(var(--wr-cat-4))",
  "rgb(var(--wr-navy))",
];

/** 사유가 비어 있는 건의 표시 라벨 */
const MISSING_REASON = "미입력";
const MISSING_REASON_COLOR = "rgb(var(--wr-ink-hint))";

const COMEBACK_ORDER = ["상", "중상", "중", "중하", "하"] as const;

const COMEBACK_COLORS: Record<string, string> = {
  "상": "rgb(var(--wr-status-done))",
  "중상": "rgb(var(--wr-status-done))",
  "중": "rgb(var(--wr-status-warn))",
  "중하": "rgb(var(--wr-status-warn))",
  "하": "rgb(var(--wr-status-late))",
};

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

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
  if (subject.includes("수학")) return { bg: "rgb(var(--wr-status-progress-soft))", color: "rgb(var(--wr-status-progress))" };
  if (subject.includes("영어")) return { bg: "rgb(var(--wr-sunken))", color: "rgb(var(--wr-cat-3))" };
  return { bg: "rgb(var(--wr-sunken))", color: "rgb(var(--wr-ink-sub))" };
}

function getComebackBadgeStyle(possibility: string): { bg: string; color: string } {
  const color = COMEBACK_COLORS[possibility] || "rgb(var(--wr-ink-hint))";
  return { bg: `${color}15`, color };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Props {
  withdrawals: Withdrawal[];
  totalStudentCount?: number;
  teacherStudentCounts?: Record<string, number>;
  /** 월별 전달 말일 기준 총 재원생 수 (key: month number) */
  monthlyBaseTotal?: Record<number, number>;
  /** 월별 + 강사별 전달 말일 기준 재원생 수 */
  monthlyBaseByTeacher?: Record<number, Record<string, number>>;
  /** 이번 달 채택된 개선 실행 항목 */
  currentActions?: ImprovementAction[];
  /** 전월 실행 항목 (이행률 비교용) */
  prevActions?: ImprovementAction[];
  /** "2026-07" */
  actionsYearMonth?: string;
}

interface TeacherRow {
  name: string;
  totalStudents: number;
  withdrawalCount: number;
  hasEarlyWithdrawal: boolean;
  earlyWithdrawalTeachers: string[];
  avgDuration: number;
  validDurationCount: number;
  reasons: Record<string, number>;
  students: string[];
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
      style={{ background: "white", borderColor: "rgb(var(--wr-line))" }}
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
          <span className="text-nk-ink-sub">
            {p.name}: <span className="font-bold text-nk-ink">{p.value}</span>
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
      className={`bg-nk-surface rounded-2xl p-6 ${className}`}
      style={{
        border: "1px solid rgb(var(--wr-line-soft))",
        boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
      }}
    >
      <div className="mb-5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" style={{ color: NK_PRIMARY }} />}
          <h3 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            {title}
          </h3>
        </div>
        {subtitle && <p className="text-xs text-nk-ink-hint mt-0.5">{subtitle}</p>}
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
  // [봉인] 실명 나열과 "강사 멘토링" 권고를 뺐다. 조기 퇴원은 조직 차원 온보딩 신호로만 읽는다.
  if (insightData.earlyCount > 0) {
    problems.push({
      icon: AlertTriangle,
      title: "조기 퇴원 발생",
      severity: "높음",
      description: `재원 2개월 이하 조기 퇴원 ${insightData.earlyCount}명 발생. 초기 적응 프로그램(첫 8주 온보딩)을 점검해 주세요.`,
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

  // 3. [봉인] 강사별 퇴원율 편차 카드는 제거했다. 분자·분모가 파손된 실명 퇴원율이라
  //    존재하지 않는 편차를 등급과 함께 보여 주고 있었다.

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

  // 6. [봉인] "복합 문제 강사" 실명 카드는 제거했다. 사유가 여러 개라는 사실만으로
  //    개인 운영 문제를 단정할 근거가 없고, 담당 귀속 자체가 아직 신뢰할 수 없다.
  const multiReasonCount = teacherTableData.filter((t) => Object.keys(t.reasons).length >= 3).length;
  if (multiReasonCount > 0) {
    problems.push({
      icon: Users,
      title: "퇴원 사유가 분산된 담당 구간",
      severity: "중간",
      description: `퇴원 사유가 3종 이상으로 나뉜 담당 구간이 ${multiReasonCount}곳입니다. 원인 분류 정비 후 다시 확인해 주세요.`,
    });
  }

  const severityColor = (s: "높음" | "중간" | "낮음") => {
    if (s === "높음") return "rgb(var(--wr-status-late))";
    if (s === "중간") return "rgb(var(--wr-status-warn))";
    return "rgb(var(--wr-status-done))";
  };

  const severityBg = (s: "높음" | "중간" | "낮음") => {
    if (s === "높음") return "rgb(var(--wr-status-late-soft))";
    if (s === "중간") return "rgb(var(--wr-status-warn-soft))";
    return "rgb(var(--wr-status-done-soft))";
  };

  if (problems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-nk-ink-hint">
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
            className="bg-nk-surface rounded-lg p-4"
            style={{
              borderLeft: `4px solid ${borderColor}`,
              border: `1px solid rgb(var(--wr-line-soft))`,
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
                <p className="text-xs text-nk-ink-sub leading-relaxed">
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
      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:bg-nk-sunken transition-colors select-none"
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
  monthlyBaseTotal,
  monthlyBaseByTeacher,
  currentActions,
  prevActions,
  actionsYearMonth,
}: Props) {
  const router = useRouter();
  const [currentYear] = useState(() => new Date().getFullYear());
  // 월 탭은 연도 정보가 없거나 올해인 건만 대상으로 한다.
  const matchesMonth = useCallback(
    (w: Withdrawal, month: number) =>
      getMonthFromDate(w.withdrawal_date) === month &&
      isCurrentYearMonth(w.withdrawal_date, currentYear),
    [currentYear]
  );
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
      if (m && isCurrentYearMonth(w.withdrawal_date, currentYear)) months.add(m);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [withdrawals, currentYear]);

  // ─── Filtered data (month + subject) ───────────────────────────────────

  const filtered = useMemo(() => {
    return withdrawals.filter((w) => {
      if (activeMonth !== null && !matchesMonth(w, activeMonth)) return false;
      if (!matchesSubject(w, activeSubject)) return false;
      return true;
    });
  }, [withdrawals, activeMonth, activeSubject, matchesMonth]);


  // ─── Subject-only filtered data (월별 급증 진단용) ──────────────────────

  const allSubjectFiltered = useMemo(
    () => withdrawals.filter((w) => matchesSubject(w, activeSubject)),
    [withdrawals, activeSubject]
  );

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

    // 퇴원율 = 해당월 퇴원생 / 전달 말일 기준 재원생 수
    // 예: 2월 퇴원율 = 2월 퇴원생 / 1월 31일 기준 재원생 수
    let total: number;
    if (activeMonth !== null && monthlyBaseTotal?.[activeMonth]) {
      // 특정 월 선택: 전달 말일 기준 재원생 수 사용
      total = monthlyBaseTotal[activeMonth];
    } else if (activeMonth !== null) {
      // monthlyBaseTotal 데이터가 없으면 fallback
      total = (totalStudentCount || 0) + withdrawals.length;
    } else {
      // "전체" 선택: 현재 활성 학생 + 전체 퇴원생
      total = (totalStudentCount || 0) + withdrawals.length;
    }
    const withdrawalRate = total > 0 ? (count / total) * 100 : 0;

    // Early withdrawal (duration_months <= 2, 120 이상은 비정상 데이터 제외)
    const earlyWithdrawals = filtered.filter(
      (w) => w.duration_months != null && w.duration_months <= 2 && w.duration_months > 0
    );
    const earlyCount = earlyWithdrawals.length;
    const earlyTeachers = Array.from(
      new Set(earlyWithdrawals.map((w) => w.teacher).filter(Boolean) as string[])
    );

    // Top reason ("미입력"은 최다 사유 산정에서 제외)
    const reasonMap: Record<string, number> = {};
    filtered.forEach((w) => {
      const reason = w.reason_category || MISSING_REASON;
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });
    const sortedReasons = Object.entries(reasonMap)
      .filter(([name]) => name !== MISSING_REASON)
      .sort((a, b) => b[1] - a[1]);
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
    // 특정 월 선택 시 전달 말일 기준 강사별 재원생 수 사용
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
    };
    // 담당별 재원 분모는 더 이상 이 카드에서 쓰지 않는다(강사 퇴원율 봉인).
  }, [filtered, totalStudentCount, activeMonth, withdrawals, monthlyBaseTotal]);

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

      if (w.duration_months != null && w.duration_months <= 120) {
        td.totalDuration += w.duration_months;
        td.validDurationCount++;
        if (w.duration_months <= 2) {
          td.earlyWithdrawals.push(w.name);
        }
      }
    });

    // 퇴원생이 없는 강사도 포함 (teacherStudentCounts 기반)
    if (teacherStudentCounts) {
      Object.keys(teacherStudentCounts).forEach((name) => {
        if (!map[name]) {
          map[name] = {
            count: 0,
            students: [],
            reasons: {},
            totalDuration: 0,
            validDurationCount: 0,
            earlyWithdrawals: [],
          };
        }
      });
    }

    const rows: TeacherRow[] = Object.entries(map).map(([name, data]) => {
      // 특정 월 선택 시 전달 말일 기준 강사별 재원생 수 사용
      let totalStudents: number;
      if (activeMonth !== null && monthlyBaseByTeacher?.[activeMonth]) {
        totalStudents = monthlyBaseByTeacher[activeMonth][name] || 0;
      } else {
        totalStudents = teacherStudentCounts?.[name] || 0;
      }
      // [봉인] 강사 단위 퇴원율은 계산하지 않는다. 분자(이달 퇴원)와 분모(오늘 재원)의
      // 기간이 어긋나 있어 어떤 값을 내놔도 존재하지 않는 비율이 된다.
      // duration_months > 120 (10년) 은 비정상 데이터로 제외
      const validDurations = data.validDurationCount > 0 ? data.totalDuration : 0;
      const avgDuration =
        data.validDurationCount > 0
          ? Math.round((validDurations / data.validDurationCount) * 10) / 10
          : 0;

      // [봉인] n=1 표본으로 개인 문제를 단정하던 자동 진단은 제거했다.
      return {
        name,
        totalStudents,
        withdrawalCount: data.count,
        hasEarlyWithdrawal: data.earlyWithdrawals.length > 0,
        earlyWithdrawalTeachers: data.earlyWithdrawals,
        avgDuration,
        validDurationCount: data.validDurationCount,
        reasons: data.reasons,
        students: data.students,
      };
    });

    // 퇴원 건수 기준. 비율이 아니므로 서열이 아니라 "많이 발생한 순"이다.
    return rows.sort((a, b) => b.withdrawalCount - a.withdrawalCount);
  }, [filtered, teacherStudentCounts, activeMonth, monthlyBaseByTeacher]);

  // ─── Reason Analysis (horizontal bar) ──────────────────────────────────

  const reasonAnalysis = useMemo(() => {
    const map: Record<string, { count: number; students: string[] }> = {};
    filtered.forEach((w) => {
      const reason = w.reason_category || MISSING_REASON;
      if (!map[reason]) map[reason] = { count: 0, students: [] };
      map[reason].count++;
      map[reason].students.push(w.name);
    });
    return Object.entries(map)
      .sort((a, b) => {
        // "미입력"은 건수와 무관하게 항상 맨 뒤로 보낸다.
        if (a[0] === MISSING_REASON) return 1;
        if (b[0] === MISSING_REASON) return -1;
        return b[1].count - a[1].count;
      })
      .map(([name, data], i) => ({
        name,
        value: data.count,
        students: data.students,
        color:
          name === MISSING_REASON
            ? MISSING_REASON_COLOR
            : REASON_COLORS[i % REASON_COLORS.length],
        pct: filtered.length > 0 ? ((data.count / filtered.length) * 100).toFixed(1) : "0",
      }));
  }, [filtered]);

  // ─── 진단 / 처방 ────────────────────────────────────────────────────────

  const diagnoses = useMemo(
    () =>
      diagnoseWithdrawals({
        filtered,
        allSubjectFiltered,
        activeMonth,
        monthlyBaseTotal,
        monthlyBaseByTeacher,
        teacherStudentCounts,
      }),
    [
      filtered,
      allSubjectFiltered,
      activeMonth,
      monthlyBaseTotal,
      monthlyBaseByTeacher,
      teacherStudentCounts,
    ]
  );

  const heroDiagnoses = useMemo(() => pickHeroDiagnoses(diagnoses), [diagnoses]);

  const prescriptions = useMemo(
    () => buildPrescriptions(heroDiagnoses, insightData.topReasonName),
    [heroDiagnoses, insightData.topReasonName]
  );

  const dataQuality = useMemo(() => computeDataQuality(filtered), [filtered]);

  const periodLabel = `${activeMonth !== null ? `${activeMonth}월` : "전체 기간"} · ${activeSubject}`;

  // ─── 실행 항목 채택 / 회고 작성률 ──────────────────────────────────────

  const adoptedActionTexts = useMemo(
    () => new Set((currentActions ?? []).map((a) => a.action_text)),
    [currentActions]
  );

  const handleAdoptAction = (
    actionText: string,
    _diagnosisType: DiagnosisType,
    title: string
  ) => {
    adoptPrescriptionAction({ actionText, source: "diagnosis", sourceTitle: title }).then(
      (result) => {
        if (!result.success) {
          toast.error(result.error || "실행 항목 채택 실패");
          return;
        }
        toast.success(
          (result as { alreadyAdopted?: boolean }).alreadyAdopted
            ? "이미 이번 달에 채택된 항목입니다"
            : "이번 달 실행 항목으로 채택했습니다"
        );
        router.refresh();
      }
    );
  };

  // 회고 작성률은 필터와 무관하게 전체 퇴원 건 기준으로 본다.
  const retrospectiveRate = useMemo(() => computeRetrospectiveRate(withdrawals), [withdrawals]);

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
        color: COMEBACK_COLORS[name] || "rgb(var(--wr-ink-hint))",
        pct: filtered.length > 0 ? ((byCb[name] / filtered.length) * 100).toFixed(1) : "0",
      }));
  }, [filtered]);

  // ─── Monthly Trend (only when "전체" month tab is selected) ────────────

  const monthlyTrendData = useMemo(() => {
    if (activeMonth !== null) return [];
    const byMonth: Record<number, number> = {};
    const subjectFiltered = withdrawals.filter((w) => matchesSubject(w, activeSubject));
    subjectFiltered.forEach((w) => {
      const m = getMonthFromDate(w.withdrawal_date);
      if (m) byMonth[m] = (byMonth[m] || 0) + 1;
    });

    const activeMonthNums = Object.keys(byMonth).map(Number);
    if (activeMonthNums.length === 0) return [];

    const minMonth = Math.min(...activeMonthNums);
    const maxMonth = Math.max(...activeMonthNums);

    return MONTH_LABELS.map((label, i) => {
      const monthNum = i + 1;
      const monthCount = byMonth[monthNum] || 0;
      // 전달 말일 기준 재원생 수 사용
      const monthBase = monthlyBaseTotal?.[monthNum] || ((totalStudentCount || 0) + withdrawals.length);
      const rate = monthBase > 0 ? Math.round((monthCount / monthBase) * 1000) / 10 : 0;
      return {
        month: label,
        count: monthCount,
        rate,
        base: monthBase,
        monthNum,
      };
    }).filter((m) => m.monthNum >= minMonth && m.monthNum <= maxMonth);
  }, [withdrawals, activeMonth, activeSubject, totalStudentCount, monthlyBaseTotal]);

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
              background: activeMonth === null ? NK_PRIMARY : "rgb(var(--wr-sunken))",
              color: activeMonth === null ? "white" : "rgb(var(--wr-ink-sub))",
              boxShadow:
                activeMonth === null ? "0 2px 8px rgb(var(--wr-navy-strong) / 0.25)" : "none",
            }}
          >
            전체
            <span
              className="ml-1.5 text-xs font-bold"
              style={{ color: activeMonth === null ? NK_GOLD : "rgb(var(--wr-ink-hint))" }}
            >
              {withdrawals.filter((w) => matchesSubject(w, activeSubject)).length}
            </span>
          </button>
          {availableMonths.map((m) => {
            const isActive = activeMonth === m;
            const monthCount = withdrawals.filter(
              (w) => matchesMonth(w, m) && matchesSubject(w, activeSubject)
            ).length;
            return (
              <button
                key={m}
                onClick={() => setActiveMonth(isActive ? null : m)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                style={{
                  background: isActive ? NK_PRIMARY : "rgb(var(--wr-sunken))",
                  color: isActive ? "white" : "rgb(var(--wr-ink-sub))",
                  boxShadow: isActive ? "0 2px 8px rgb(var(--wr-navy-strong) / 0.25)" : "none",
                }}
              >
                {m}월
                <span
                  className="ml-1.5 text-xs font-bold"
                  style={{ color: isActive ? NK_GOLD : "rgb(var(--wr-ink-hint))" }}
                >
                  {monthCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── 2. Subject Filter Tabs ─────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-nk-sunken w-fit">
          {SUBJECT_TABS.map((tab) => {
            const isActive = activeSubject === tab;
            const count =
              tab === "전체"
                ? withdrawals.filter(
                    (w) => activeMonth === null || matchesMonth(w, activeMonth)
                  ).length
                : withdrawals.filter((w) => {
                    if (activeMonth !== null && !matchesMonth(w, activeMonth)) return false;
                    return matchesSubject(w, tab);
                  }).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveSubject(tab)}
                className="relative px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: isActive ? NK_PRIMARY : "transparent",
                  color: isActive ? "white" : "rgb(var(--wr-ink-sub))",
                  boxShadow: isActive ? "0 2px 8px rgb(var(--wr-navy-strong) / 0.25)" : "none",
                }}
              >
                {tab}
                <span
                  className="ml-1.5 text-xs font-bold"
                  style={{ color: isActive ? NK_GOLD : "rgb(var(--wr-ink-hint))" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* ── 3. 핵심 진단 & 개선 액션 ─────────────────────────────────── */}
      <DiagnosisSection
        diagnoses={heroDiagnoses}
        prescriptions={prescriptions}
        dataQuality={dataQuality}
        periodLabel={periodLabel}
        adoptedActionTexts={adoptedActionTexts}
        onAdoptAction={handleAdoptAction}
      />

      {/* ── 4. 이번 달 실행 항목 ─────────────────────────────────────── */}
      {actionsYearMonth && (
        <ImprovementActionsCard
          currentActions={currentActions ?? []}
          prevActions={prevActions ?? []}
          yearMonth={actionsYearMonth}
        />
      )}

      {/* ── 5. Key Insights Section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 3-1. 전체 퇴원율 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-nk-surface cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: `1px solid ${insightData.withdrawalRate > 15 ? "rgb(var(--wr-status-late-soft))" : "rgb(var(--wr-line-soft))"}`,
            boxShadow:
              insightData.withdrawalRate > 15
                ? "0 1px 3px rgb(var(--wr-status-late) / 0.08), 0 4px 12px rgb(var(--wr-status-late) / 0.06)"
                : "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
          onClick={() => setInsightPopup('rate')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-nk-ink-hint">
                전체 퇴원율
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight"
                style={{
                  color: insightData.withdrawalRate > 15 ? "rgb(var(--wr-status-late))" : NK_PRIMARY,
                }}
              >
                {insightData.total > 0
                  ? insightData.withdrawalRate.toFixed(1)
                  : "0.0"}
                %
              </div>
              <div className="text-[11px] text-nk-ink-hint mt-1">
                {insightData.count}명 / {insightData.total}명
                {activeMonth !== null && <span className="block text-[10px]">({activeMonth > 1 ? `${activeMonth - 1}` : "12"}월 말 기준)</span>}
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-nk-navy-ink flex-shrink-0"
              style={{
                background:
                  insightData.withdrawalRate > 15
                    ? "linear-gradient(135deg, rgb(var(--wr-status-late)), rgb(var(--wr-status-late)))"
                    : `linear-gradient(135deg, ${NK_PRIMARY}, ${NK_PRIMARY_LIGHT})`,
              }}
            >
              <Users className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-2. 조기 퇴원 경고 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-nk-surface cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: `1px solid ${insightData.earlyCount > 0 ? "rgb(var(--wr-status-late-soft))" : "rgb(var(--wr-line-soft))"}`,
            background: insightData.earlyCount > 0 ? "rgb(var(--wr-status-late-soft))" : "white",
            boxShadow:
              insightData.earlyCount > 0
                ? "0 1px 3px rgb(var(--wr-status-late) / 0.08), 0 4px 12px rgb(var(--wr-status-late) / 0.06)"
                : "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
          onClick={() => setInsightPopup('early')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-nk-ink-hint">
                조기 퇴원 경고
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight"
                style={{ color: insightData.earlyCount > 0 ? "rgb(var(--wr-status-late))" : NK_PRIMARY }}
              >
                {insightData.earlyCount}명
              </div>
              {/* [봉인] 강사 실명 뱃지는 표시하지 않는다. 상세는 클릭 시 학생 목록으로 확인한다. */}
              {insightData.earlyCount > 0 && (
                <div className="text-[11px] text-nk-ink-sub mt-1.5">재원 2개월 이하 퇴원</div>
              )}
              {insightData.earlyCount === 0 && (
                <div className="text-[11px] text-nk-ink-hint mt-1">
                  재원 2개월 이하 퇴원 없음
                </div>
              )}
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-nk-navy-ink flex-shrink-0"
              style={{
                background:
                  insightData.earlyCount > 0
                    ? "linear-gradient(135deg, rgb(var(--wr-status-late)), rgb(var(--wr-status-late)))"
                    : "linear-gradient(135deg, rgb(var(--wr-ink-hint)), rgb(var(--wr-line)))",
              }}
            >
              <AlertTriangle className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-3. 최다 퇴원 사유 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-nk-surface cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: "1px solid rgb(var(--wr-line-soft))",
            boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
          onClick={() => setInsightPopup('reason')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-nk-ink-hint">
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
                <span className="text-nk-ink-hint ml-1">
                  ({insightData.topReasonCount}명)
                </span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-nk-navy-ink flex-shrink-0"
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
          className="relative overflow-hidden rounded-2xl p-5 bg-nk-surface cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: "1px solid rgb(var(--wr-line-soft))",
            boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
          onClick={() => setInsightPopup('comeback')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-nk-ink-hint">
                복귀 유망
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight text-nk-done"
              >
                {insightData.comebackPromising}명
              </div>
              <div className="text-[11px] text-nk-ink-hint mt-1">
                복귀 가능성 상/중상
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-nk-navy-ink flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgb(var(--wr-status-done)), rgb(var(--wr-status-done)))",
              }}
            >
              <RotateCcw className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-5. 퇴원 건수 최다 담당 (건수 사실만) */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-nk-surface cursor-pointer hover:shadow-md transition-shadow"
          style={{
            border: "1px solid rgb(var(--wr-line-soft))",
            boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
          onClick={() => setInsightPopup('teacher')}
        >
          <div className="flex justify-between items-start">
            {/* 등급·퇴원율 없이 건수 사실만 표기한다(강사 결과지표 봉인). */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-nk-ink-hint">
                퇴원 건수 최다 담당
              </div>
              <div
                className="text-lg font-extrabold leading-tight"
                style={{ color: NK_PRIMARY }}
              >
                {insightData.topTeacherName} T
              </div>
              <div className="text-[11px] text-nk-ink-hint mt-1">
                {insightData.topTeacherCount}명 퇴원 (건수 기준)
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-nk-navy-ink flex-shrink-0"
              style={{ background: NK_PRIMARY }}
            >
              <UserCheck className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        {/* 3-6. 회고 작성률 */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-nk-surface"
          style={{
            border: `1px solid ${retrospectiveRate.total > retrospectiveRate.completed ? "rgb(var(--wr-status-warn-soft))" : "rgb(var(--wr-line-soft))"}`,
            boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.04), 0 4px 12px rgb(var(--wr-navy-strong) / 0.03)",
          }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold mb-2 uppercase tracking-wider text-nk-ink-hint">
                회고 작성률
              </div>
              <div
                className="text-3xl font-extrabold leading-tight tracking-tight"
                style={{
                  color: retrospectiveRate.total > retrospectiveRate.completed ? "rgb(var(--wr-status-warn))" : NK_PRIMARY,
                }}
              >
                {retrospectiveRate.rate}%
              </div>
              <div className="text-[11px] text-nk-ink-hint mt-1">
                {retrospectiveRate.completed}건 / {retrospectiveRate.total}건 (전체 기준)
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-nk-navy-ink flex-shrink-0"
              style={{
                background:
                  retrospectiveRate.total > retrospectiveRate.completed
                    ? "linear-gradient(135deg, rgb(var(--wr-status-warn)), rgb(var(--wr-status-warn)))"
                    : `linear-gradient(135deg, ${NK_PRIMARY}, ${NK_PRIMARY_LIGHT})`,
              }}
            >
              <NotebookPen className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. 사건 기반 원인 분석 (지속·초기이탈·최근변화·원문 큐) ── */}
      <WithdrawalInsightBlocks withdrawals={filtered} teacherStudentCounts={teacherStudentCounts} />

      {/* ── 5-b. 기존 진단 근거 (사유·복귀·급증 등 조직 신호) ────── */}
      <DashboardCard
        title="조직 단위 진단 근거"
        icon={AlertTriangle}
        subtitle="사유 집중·복귀 가능성·월별 급증 등 전체 신호"
      >
        <ProblemAnalysisSection filtered={filtered} insightData={insightData} teacherTableData={teacherTableData} />
      </DashboardCard>

      {/* ── 6. 퇴원 사유 / 복귀 가능성 2열 ──────────────────────────── */}
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
                    stroke="rgb(var(--wr-line-soft))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    fontSize={11}
                    stroke="rgb(var(--wr-ink-hint))"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    fontSize={11}
                    stroke="rgb(var(--wr-ink-sub))"
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
                          className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-nk-surface"
                          style={{ borderColor: "rgb(var(--wr-line))" }}
                        >
                          <div className="font-semibold" style={{ color: NK_PRIMARY }}>
                            {data.name}
                          </div>
                          <div className="text-nk-ink-sub mt-0.5">
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
            <div className="h-40 flex items-center justify-center text-sm text-nk-ink-hint">
              데이터가 없습니다
            </div>
          )}
        </DashboardCard>

        {/* ── 복귀 가능성 Horizontal Bar Chart ──────────────────────── */}
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
                    stroke="rgb(var(--wr-line-soft))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    fontSize={11}
                    stroke="rgb(var(--wr-ink-hint))"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    fontSize={12}
                    stroke="rgb(var(--wr-ink-sub))"
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
                          className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-nk-surface"
                          style={{ borderColor: "rgb(var(--wr-line))" }}
                        >
                          <div className="font-semibold" style={{ color: NK_PRIMARY }}>
                            복귀 가능성: {data.name}
                          </div>
                          <div className="text-nk-ink-sub mt-0.5">
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
                      <span className="text-[10px] text-nk-ink-sub ml-1">
                        {c.value}명 ({c.pct}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-nk-ink-hint">
              데이터가 없습니다
            </div>
          )}
        </DashboardCard>
      </div>

      {/* ── 7. Teacher Withdrawal Rate Table ─────────────────────────── */}
      {(teacherTableData.length > 0 || (teacherStudentCounts && Object.keys(teacherStudentCounts).length > 0)) && (
        <DashboardCard
          title="담당별 퇴원 현황"
          icon={BarChart3}
          subtitle="담당별 퇴원 건수와 담당 재원수 (원시 사실만, 비율 없음)"
        >
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr style={{ background: NK_BLUE_50 }}>
                  {["담당", "담당 재원수", "퇴원 수", "평균 재원기간", "조기 퇴원", ""].map(
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
                  return (
                    <Fragment key={teacher.name}>
                      <tr
                        className="border-t transition-colors hover:bg-nk-sunken/50 cursor-pointer"
                        style={{ borderColor: "rgb(var(--wr-sunken))" }}
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
                        <td className="px-4 py-3 text-sm text-nk-ink-sub">
                          {teacher.totalStudents > 0 ? `${teacher.totalStudents}명` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-nk-navy-ink"
                            style={{ background: NK_PRIMARY }}
                          >
                            {teacher.withdrawalCount}명
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-nk-ink-sub">
                          {teacher.avgDuration > 0 ? `${teacher.avgDuration}개월` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {teacher.hasEarlyWithdrawal && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedEarlyTeacher(expandedEarlyTeacher === teacher.name ? null : teacher.name); }}
                                  className="inline-flex items-center gap-1 rounded-md bg-nk-sunken px-2 py-0.5 text-[10px] font-semibold text-nk-ink-sub transition-colors hover:bg-nk-line"
                                >
                                  조기 퇴원 {teacher.earlyWithdrawalTeachers.length}명
                                </button>
                                {expandedEarlyTeacher === teacher.name && (
                                  <div className="absolute z-10 left-0 top-full mt-1 bg-nk-surface rounded-lg shadow-lg border border-nk-line-soft p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[11px] font-bold text-nk-ink-sub mb-2">조기 퇴원 학생 ({teacher.earlyWithdrawalTeachers.length}명)</div>
                                    <div className="space-y-1.5">
                                      {teacher.earlyWithdrawalTeachers.map((studentName, idx) => {
                                        const studentData = filtered.find(w => w.name === studentName && w.teacher === teacher.name);
                                        return (
                                          <div key={idx} className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-nk-ink">{studentName}</span>
                                            <span className="text-nk-ink-hint">{studentData?.duration_months ? `${studentData.duration_months}개월` : '-'}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-nk-ink-hint" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-nk-ink-hint" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4 pt-0">
                            <div
                              className="rounded-xl p-4 mt-1"
                              style={{
                                background: NK_BLUE_50,
                                border: "1px solid rgb(var(--wr-line))",
                              }}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Withdrawal students */}
                                <div
                                  className="bg-nk-surface rounded-xl p-4"
                                  style={{ border: "1px solid rgb(var(--wr-line-soft))" }}
                                >
                                  <div className="text-[11px] font-semibold text-nk-ink-hint uppercase tracking-wider mb-2">
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
                                  className="bg-nk-surface rounded-xl p-4"
                                  style={{ border: "1px solid rgb(var(--wr-line-soft))" }}
                                >
                                  <div className="text-[11px] font-semibold text-nk-ink-hint uppercase tracking-wider mb-2">
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
                                              <span className="text-xs text-nk-ink font-medium">
                                                {reason}
                                              </span>
                                              <span
                                                className="text-[11px] font-bold"
                                                style={{ color: NK_PRIMARY }}
                                              >
                                                {count}명
                                              </span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-nk-sunken overflow-hidden">
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

      {/* ── 8. Monthly Trend (only when "전체" month tab) ─────────────── */}
      {activeMonth === null && monthlyTrendData.length > 0 && (
        <DashboardCard
          title="월별 퇴원율 추이"
          icon={Clock}
          subtitle="월별 퇴원율(%) 변화를 확인합니다"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={monthlyTrendData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgb(var(--wr-line-soft))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                fontSize={12}
                stroke="rgb(var(--wr-ink-hint))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={11}
                stroke="rgb(var(--wr-ink-hint))"
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as { month: string; count: number; rate: number; base: number };
                  return (
                    <div className="rounded-lg px-3 py-2 text-xs shadow-lg border bg-nk-surface" style={{ borderColor: "rgb(var(--wr-line))" }}>
                      <div className="font-semibold mb-1" style={{ color: NK_PRIMARY }}>{label}</div>
                      <div className="text-nk-ink-sub">퇴원율: <span className="font-bold text-nk-ink">{data.rate}%</span></div>
                      <div className="text-nk-ink-sub">퇴원생: <span className="font-bold text-nk-ink">{data.count}명</span></div>
                      <div className="text-nk-ink-hint">전달 말일 기준: {data.base}명</div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                name="퇴원율"
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

      {/* ── 9. 퇴원생 상세 목록 Table ────────────────────────────────── */}
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
                    className="px-4 py-12 text-center text-sm text-nk-ink-hint"
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
                      className="border-t transition-colors hover:bg-nk-sunken/50"
                      style={{ borderColor: "rgb(var(--wr-sunken))" }}
                    >
                      <td className="px-4 py-3 text-xs text-nk-ink-hint font-medium">
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
                          <span className="text-xs text-nk-ink-hint">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-nk-ink-sub">
                        {w.withdrawal_date || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {w.grade ? (
                          <span className="flex items-center gap-1 text-xs text-nk-ink-sub">
                            <GraduationCap className="w-3 h-3" />
                            {w.grade}
                          </span>
                        ) : (
                          <span className="text-xs text-nk-ink-hint">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-nk-ink-sub font-medium">
                        {w.teacher ? `${w.teacher} T` : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-nk-ink-sub">
                        {w.duration_months != null
                          ? `${w.duration_months}개월`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {w.reason_category ? (
                          <span className="text-xs text-nk-ink font-medium">
                            {w.reason_category}
                          </span>
                        ) : (
                          <span className="text-xs text-nk-ink-hint">-</span>
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
                          <span className="text-xs text-nk-ink-hint">-</span>
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
          <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-6 py-4 border-b bg-nk-surface rounded-t-2xl flex items-center justify-between" style={{ borderColor: 'rgb(var(--wr-line-soft))' }}>
              <div>
                <h2 className="text-lg font-extrabold" style={{ color: NK_PRIMARY }}>{selectedStudent.name} 퇴원 보고서</h2>
                <p className="text-xs text-nk-ink-hint mt-0.5">{selectedStudent.subject} · {selectedStudent.grade} · {selectedStudent.teacher} T</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="w-8 h-8 rounded-lg bg-nk-sunken hover:bg-nk-line flex items-center justify-center transition-colors">
                <span className="text-nk-ink-sub text-lg leading-none">&times;</span>
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
                    <div className="text-[10px] font-semibold text-nk-ink-hint uppercase tracking-wider">{item.label}</div>
                    <div className="text-sm font-bold mt-1" style={{ color: NK_PRIMARY }}>{item.value || "-"}</div>
                  </div>
                ))}
              </div>
              {/* Enrollment Info */}
              <div>
                <h3 className="text-xs font-bold text-nk-ink-sub uppercase tracking-wider mb-3">등원 정보</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-nk-ink-hint text-xs">학교:</span> <span className="font-medium text-nk-ink">{selectedStudent.school || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">반:</span> <span className="font-medium text-nk-ink">{selectedStudent.class_name || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">등원 시작:</span> <span className="font-medium text-nk-ink">{selectedStudent.enrollment_start || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">퇴원인지일:</span> <span className="font-medium text-nk-ink">{selectedStudent.enrollment_end || "-"}</span></div>
                </div>
              </div>
              {/* Learning Status */}
              <div>
                <h3 className="text-xs font-bold text-nk-ink-sub uppercase tracking-wider mb-3">학습 상태</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-nk-ink-hint text-xs">수업 태도:</span> <span className="font-medium text-nk-ink">{selectedStudent.class_attitude || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">숙제 제출:</span> <span className="font-medium text-nk-ink">{selectedStudent.homework_submission || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">출결 상태:</span> <span className="font-medium text-nk-ink">{selectedStudent.attendance || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">성적 변화:</span> <span className="font-medium text-nk-ink">{selectedStudent.grade_change || "-"}</span></div>
                </div>
              </div>
              {/* Opinions */}
              <div>
                <h3 className="text-xs font-bold text-nk-ink-sub uppercase tracking-wider mb-3">퇴원 의견</h3>
                <div className="space-y-3">
                  {selectedStudent.student_opinion && (
                    <div className="rounded-lg p-3 bg-nk-progress-soft/50 border border-nk-progress">
                      <div className="text-[10px] font-semibold text-nk-progress mb-1">학생 의견</div>
                      <p className="text-sm text-nk-ink">{selectedStudent.student_opinion}</p>
                    </div>
                  )}
                  {selectedStudent.parent_opinion && (
                    <div className="rounded-lg p-3 bg-nk-warn-soft/50 border border-nk-warn">
                      <div className="text-[10px] font-semibold text-nk-warn mb-1">학부모 의견</div>
                      <p className="text-sm text-nk-ink">{selectedStudent.parent_opinion}</p>
                    </div>
                  )}
                  {selectedStudent.teacher_opinion && (
                    <div className="rounded-lg p-3 bg-nk-done-soft/50 border border-nk-done">
                      <div className="text-[10px] font-semibold text-nk-done mb-1">선생님 의견</div>
                      <p className="text-sm text-nk-ink">{selectedStudent.teacher_opinion}</p>
                    </div>
                  )}
                  {!selectedStudent.student_opinion && !selectedStudent.parent_opinion && !selectedStudent.teacher_opinion && (
                    <p className="text-xs text-nk-ink-hint">기록된 의견 없음</p>
                  )}
                </div>
              </div>
              {/* Consultation */}
              <div>
                <h3 className="text-xs font-bold text-nk-ink-sub uppercase tracking-wider mb-3">최종 상담</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-nk-ink-hint text-xs">상담일:</span> <span className="font-medium text-nk-ink">{selectedStudent.final_consult_date || "-"}</span></div>
                  <div><span className="text-nk-ink-hint text-xs">상담사:</span> <span className="font-medium text-nk-ink">{selectedStudent.final_counselor || "-"}</span></div>
                </div>
                {selectedStudent.final_consult_summary && (
                  <div className="mt-2 rounded-lg p-3 bg-nk-sunken border border-nk-line-soft">
                    <div className="text-[10px] font-semibold text-nk-ink-sub mb-1">상담 요약</div>
                    <p className="text-sm text-nk-ink">{selectedStudent.final_consult_summary}</p>
                  </div>
                )}
              </div>
              {/* Special notes */}
              {selectedStudent.special_notes && selectedStudent.special_notes !== "-" && (
                <div>
                  <h3 className="text-xs font-bold text-nk-ink-sub uppercase tracking-wider mb-3">특이사항</h3>
                  <p className="text-sm text-nk-ink">{selectedStudent.special_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reason Chart Popup ────────────────────────────────────── */}
      {selectedReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedReason(null)}>
          <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 py-3.5 border-b bg-nk-surface rounded-t-2xl flex items-center justify-between" style={{ borderColor: 'rgb(var(--wr-line-soft))' }}>
              <div>
                <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>{selectedReason}</h2>
                <p className="text-xs text-nk-ink-hint mt-0.5">{filtered.filter(w => (w.reason_category || '기타') === selectedReason).length}명</p>
              </div>
              <button onClick={() => setSelectedReason(null)} className="w-7 h-7 rounded-lg bg-nk-sunken hover:bg-nk-line flex items-center justify-center transition-colors">
                <span className="text-nk-ink-sub text-base leading-none">&times;</span>
              </button>
            </div>
            <div className="divide-y divide-nk-line-soft">
              {filtered.filter(w => (w.reason_category || '기타') === selectedReason).map((w, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-nk-sunken transition-colors">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-nk-ink-sub min-w-[40px]">{w.grade || '-'}</span>
                  <span className="text-nk-ink-sub min-w-[48px]">{w.teacher ? `${w.teacher} T` : '-'}</span>
                  <span className="text-nk-ink-hint text-xs ml-auto">{w.duration_months ? `${w.duration_months}개월` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Insight Cards Popup ───────────────────────────────────── */}
      {insightPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setInsightPopup(null)}>
          <div className="bg-nk-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[75vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 py-3.5 border-b bg-nk-surface rounded-t-2xl flex items-center justify-between" style={{ borderColor: 'rgb(var(--wr-line-soft))' }}>
              <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>
                {insightPopup === 'rate' && '전체 퇴원율 상세'}
                {insightPopup === 'early' && '조기 퇴원 학생'}
                {insightPopup === 'reason' && `${insightData.topReasonName} 퇴원 학생`}
                {insightPopup === 'comeback' && '복귀 유망 학생'}
                {insightPopup === 'teacher' && `${insightData.topTeacherName} T 퇴원 학생`}
              </h2>
              <button onClick={() => setInsightPopup(null)} className="w-7 h-7 rounded-lg bg-nk-sunken hover:bg-nk-line flex items-center justify-center">
                <span className="text-nk-ink-sub text-base leading-none">&times;</span>
              </button>
            </div>
            <div className="divide-y divide-nk-line-soft">
              {insightPopup === 'rate' && filtered.map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: NK_BLUE_50, color: NK_PRIMARY }}>{w.subject || '-'}</span>
                  <span className="text-nk-ink-sub text-xs">{w.teacher ? `${w.teacher} T` : '-'}</span>
                  <span className="text-nk-ink-hint text-xs ml-auto">{w.withdrawal_date}</span>
                </div>
              ))}
              {insightPopup === 'early' && filtered.filter(w => w.duration_months != null && w.duration_months <= 2).map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: 'rgb(var(--wr-status-late))' }}>{w.name}</span>
                  <span className="text-nk-ink-sub text-xs">{w.teacher ? `${w.teacher} T` : '-'}</span>
                  <span className="text-nk-late text-xs font-semibold">{w.duration_months}개월</span>
                  <span className="text-nk-ink-hint text-xs ml-auto">{w.reason_category || '-'}</span>
                </div>
              ))}
              {insightPopup === 'reason' && filtered.filter(w => w.reason_category === insightData.topReasonName).map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-nk-ink-sub text-xs">{w.grade || '-'}</span>
                  <span className="text-nk-ink-sub text-xs">{w.teacher ? `${w.teacher} T` : '-'}</span>
                </div>
              ))}
              {insightPopup === 'comeback' && filtered.filter(w => w.comeback_possibility === '상' || w.comeback_possibility === '중상').map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: 'rgb(var(--wr-status-done))' }}>{w.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: NK_BLUE_50, color: NK_PRIMARY }}>{w.subject || '-'}</span>
                  <span className="text-nk-done text-xs font-semibold">{w.comeback_possibility}</span>
                  <span className="text-nk-ink-hint text-xs ml-auto">{w.teacher ? `${w.teacher} T` : '-'}</span>
                </div>
              ))}
              {insightPopup === 'teacher' && filtered.filter(w => w.teacher === insightData.topTeacherName).map((w, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-bold min-w-[52px]" style={{ color: NK_PRIMARY }}>{w.name}</span>
                  <span className="text-nk-ink-sub text-xs">{w.reason_category || '-'}</span>
                  <span className="text-nk-ink-hint text-xs ml-auto">{w.duration_months ? `${w.duration_months}개월` : '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

