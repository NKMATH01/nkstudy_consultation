import { checkPagePermission } from "@/lib/check-permission";
import { listExamAnalyses } from "@/lib/actions/exam-analysis";
import { ExamsListClient } from "./exams-list-client";

export default async function ExamsPage() {
  await checkPagePermission("/exams");
  const analyses = await listExamAnalyses();
  return <ExamsListClient analyses={analyses} />;
}
