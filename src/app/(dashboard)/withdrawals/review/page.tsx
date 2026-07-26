import { getWithdrawals } from "@/lib/actions/withdrawal";
import { getImprovementActions } from "@/lib/actions/improvement-action";
import { currentYearMonth, prevYearMonth } from "@/lib/improvement-actions";
import { MonthlyReviewClient } from "@/components/withdrawals/monthly-review-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function WithdrawalReviewPage() {
  await checkPagePermission("/withdrawals/review");
  const actionsYearMonth = currentYearMonth();
  const [withdrawals, currentActions, prevActions] = await Promise.all([
    getWithdrawals(),
    getImprovementActions(actionsYearMonth),
    getImprovementActions(prevYearMonth(actionsYearMonth)),
  ]);

  return (
    <MonthlyReviewClient
      withdrawals={withdrawals}
      currentActions={currentActions}
      prevActions={prevActions}
      actionsYearMonth={actionsYearMonth}
    />
  );
}
