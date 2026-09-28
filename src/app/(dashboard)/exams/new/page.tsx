import { checkPagePermission } from "@/lib/check-permission";
import { searchExamConsultations } from "@/lib/actions/exam-analysis";
import { ExamUploadClient } from "./exam-upload-client";

export default async function ExamUploadPage() {
  await checkPagePermission("/exams");
  // 입학테스트 대상은 등록 전 신입생이라 students 가 아니라 상담 기록에서 고른다.
  const recentConsultations = await searchExamConsultations("");
  return <ExamUploadClient recentConsultations={recentConsultations} />;
}
