import { getWithdrawals, getStudentCountsByTeacher } from "@/lib/actions/withdrawal";
import { TeacherLearningClient } from "@/components/withdrawals/teacher-learning-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function WithdrawalTeachersPage() {
  await checkPagePermission("/withdrawals/teachers");
  const [withdrawals, studentCounts] = await Promise.all([
    getWithdrawals(),
    getStudentCountsByTeacher(),
  ]);

  return (
    <TeacherLearningClient
      withdrawals={withdrawals}
      teacherStudentCounts={studentCounts.byTeacher}
    />
  );
}
