import { checkPagePermission } from "@/lib/check-permission";
import { getExamConsultationOption, searchExamConsultations } from "@/lib/actions/exam-analysis";
import { ExamUploadClient } from "./exam-upload-client";

interface ExamUploadPageProps {
  searchParams: Promise<{ consultation?: string | string[] }>;
}

export default async function ExamUploadPage({ searchParams }: ExamUploadPageProps) {
  await checkPagePermission("/exams");
  const { consultation } = await searchParams;
  const consultationId = Array.isArray(consultation) ? consultation[0] : consultation;

  // 입학테스트 대상은 등록 전 신입생이라 students 가 아니라 상담 기록에서 고른다.
  // 상담 화면에서 ?consultation=<id> 로 들어오면 그 학생을 미리 골라 둔다.
  const [recentConsultations, preselected] = await Promise.all([
    searchExamConsultations(""),
    consultationId ? getExamConsultationOption(consultationId) : Promise.resolve(null),
  ]);
  return (
    <ExamUploadClient recentConsultations={recentConsultations} initialStudent={preselected} />
  );
}
