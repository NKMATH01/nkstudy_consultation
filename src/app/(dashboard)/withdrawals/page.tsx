import { getWithdrawals } from "@/lib/actions/withdrawal";
import { WithdrawalList } from "@/components/withdrawals/withdrawal-list-client";
import { isCountedWithdrawal } from "@/lib/withdrawal-status";
import { UserMinus } from "lucide-react";
import { checkPagePermission } from "@/lib/check-permission";

export default async function WithdrawalsPage() {
  await checkPagePermission("/withdrawals");
  const withdrawals = await getWithdrawals();

  // 헤더 숫자는 통계라 퇴원 건만 센다. 목록에는 휴원·복귀까지 전체를 넘긴다.
  const counted = withdrawals.filter(isCountedWithdrawal);
  const mathCount = counted.filter((w) => w.subject?.includes("수학")).length;
  const engCount = counted.filter((w) => w.subject?.includes("영어")).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)" }}
        >
          <UserMinus className="h-6 w-6 text-nk-navy-ink" />
        </div>
        <div>
          <h1
            className="text-xl font-extrabold"
            style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em", marginBottom: "2px" }}
          >
            퇴원생 현황
          </h1>
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>
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

      <WithdrawalList withdrawals={withdrawals} />
    </div>
  );
}
