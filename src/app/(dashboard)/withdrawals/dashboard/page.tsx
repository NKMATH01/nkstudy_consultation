import { getWithdrawals, getStudentCountsByTeacher, getMonthlyBaseStudentCounts } from "@/lib/actions/withdrawal";
import { WithdrawalDashboard } from "@/components/withdrawals/withdrawal-dashboard-client";
import { BarChart3 } from "lucide-react";
import { checkPagePermission } from "@/lib/check-permission";

export default async function WithdrawalDashboardPage() {
  await checkPagePermission("/withdrawals/dashboard");
  const [withdrawals, studentCounts, monthlyBase] = await Promise.all([
    getWithdrawals(),
    getStudentCountsByTeacher(),
    getMonthlyBaseStudentCounts(),
  ]);

  const mathCount = withdrawals.filter((w) => w.subject?.includes("수학")).length;
  const engCount = withdrawals.filter((w) => w.subject?.includes("영어")).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0F2B5B 0%, #1a3d7a 100%)" }}
        >
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1
            className="text-xl font-extrabold"
            style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "2px" }}
          >
            퇴원생 분석
          </h1>
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "#64748B" }}>
            <span>전체 퇴원생 데이터를 종합적으로 분석합니다</span>
            <span className="text-slate-300">|</span>
            <span>
              총 <span className="font-bold" style={{ color: "#0F2B5B" }}>{withdrawals.length}</span>명
            </span>
            {mathCount > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <span>
                  수학 <span className="font-bold text-blue-600">{mathCount}</span>명
                </span>
              </>
            )}
            {engCount > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <span>
                  영어 <span className="font-bold text-violet-600">{engCount}</span>명
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
      />
    </div>
  );
}
