import { getWithdrawals } from "@/lib/actions/withdrawal";
import { WithdrawalList } from "@/components/withdrawals/withdrawal-list-client";
import { UserMinus } from "lucide-react";

export default async function WithdrawalsPage() {
  const withdrawals = await getWithdrawals();

  const mathCount = withdrawals.filter((w) => w.subject?.includes("수학")).length;
  const engCount = withdrawals.filter((w) => w.subject?.includes("영어")).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0F2B5B 0%, #1a3d7a 100%)" }}
        >
          <UserMinus className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1
            className="text-xl font-extrabold"
            style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "2px" }}
          >
            퇴원생 현황
          </h1>
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "#64748B" }}>
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

      <WithdrawalList withdrawals={withdrawals} />
    </div>
  );
}
