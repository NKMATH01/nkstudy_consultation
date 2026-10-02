import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/check-permission";
import { getExamAnalysis, getExamPaperSignedUrls } from "@/lib/actions/exam-analysis";
import { canDeleteExam } from "@/lib/exam-alimtalk";
import { ExamDetailClient } from "./exam-detail-client";

interface ExamDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExamDetailPage({ params }: ExamDetailPageProps) {
  const currentTeacher = await checkPagePermission("/exams");
  const { id } = await params;

  const analysis = await getExamAnalysis(id);
  if (!analysis) notFound();

  const [paperUrls, mathflexUrls] = await Promise.all([
    getExamPaperSignedUrls(analysis.paper_paths),
    getExamPaperSignedUrls(analysis.mathflex_paths),
  ]);

  return (
    <ExamDetailClient
      analysis={analysis}
      paperUrls={paperUrls}
      mathflexUrls={mathflexUrls}
      canDelete={canDeleteExam(currentTeacher?.role)}
    />
  );
}
