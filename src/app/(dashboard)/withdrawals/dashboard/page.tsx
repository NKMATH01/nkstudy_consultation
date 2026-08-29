import { getWithdrawals, getStudentCountsByTeacher, getMonthlyBaseStudentCounts } from "@/lib/actions/withdrawal";
import { isCountedWithdrawal } from "@/lib/withdrawal-status";
import { getImprovementActions } from "@/lib/actions/improvement-action";
import { currentYearMonth, prevYearMonth } from "@/lib/improvement-actions";
import { WithdrawalDashboard } from "@/components/withdrawals/withdrawal-dashboard-client";
import { BarChart3 } from "lucide-react";
import { checkPagePermission } from "@/lib/check-permission";

export default async function WithdrawalDashboardPage() {
  await checkPagePermission("/withdrawals/dashboard");
  const actionsYearMonth = currentYearMonth();
  const [withdrawals, studentCounts, monthlyBase, currentActions, prevActions] = await Promise.all([
    getWithdrawals(),
    getStudentCountsByTeacher(),
    getMonthlyBaseStudentCounts(),
    getImprovementActions(actionsYearMonth),
    getImprovementActions(prevYearMonth(actionsYearMonth)),
  ]);

  // 헤더 숫자도 통계다 — 퇴원 건만 센다. 클라이언트에는 전체를 그대로 넘긴다.
  const counted = withdrawals.filter(isCountedWithdrawal);
  const mathCount = counted.filter((w) => w.subject?.includes("수학")).length;
  const engCount = counted.filter((w) => w.subject?.includes("영어")).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)" }}
        >
          <BarChart3 className="h-6 w-6 text-nk-navy-ink" />
        </div>
        <div>
          <h1
            className="text-xl font-extrabold"
            style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em", marginBottom: "2px" }}
          >
            퇴원생 분석
          </h1>
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>
            <span>전체 퇴원생 데이터를 종합적으로 분석합니다</span>
            <span className="text-nk-ink-hint">|</span>
            <span>
              퇴원 <span className="font-bold" style={{ color: "var(--primary)" }}>{counted.length}</span>명
            </span>
            {mathCount > 0 && (
              <>
                <span className="text-nk-ink-hint">|</span>
                <span>
                  수학 <span className="font-bold text-nk-progress">{mathCount}</span>명
                </span>
              </>
            )}
            {engCount > 0 && (
              <>
                <span className="text-nk-ink-hint">|</span>
                <span>
                  영어 <span className="font-bold text-nk-cat-3">{engCount}</span>명
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <WithdrawalDashboard
        withdrawals={withdrawals}
        totalStudentCount={studentCounts.total}
        teacherStudentCounts={studentCounts.byTeacher}
        monthlyBaseTotal={monthlyBase.byMonth}
        monthlyBaseByTeacher={monthlyBase.byMonthTeacher}
        currentActions={currentActions}
        prevActions={prevActions}
        actionsYearMonth={actionsYearMonth}
      />
    </div>
  );
}
