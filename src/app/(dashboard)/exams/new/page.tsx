import { checkPagePermission } from "@/lib/check-permission";
import {
  getExamConsultationOption,
  getExamUploadContext,
  searchExamConsultations,
} from "@/lib/actions/exam-analysis";
import { ExamKindUploadClient, ExamUploadClient } from "./exam-upload-client";

interface ExamUploadPageProps {
  searchParams: Promise<{
    consultation?: string | string[];
    kind?: string | string[];
    from?: string | string[];
  }>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ExamUploadPage({ searchParams }: ExamUploadPageProps) {
  await checkPagePermission("/exams");
  const params = await searchParams;
  const consultationId = first(params.consultation);
  const kindParam = first(params.kind);
  const kind = kindParam === "paper" || kindParam === "mathflex" ? kindParam : null;
  const from = first(params.from) === "surveys" ? "surveys" : "exams";

  // ?consultation=<id>&kind=paper|mathflex — 설문 목록·입학테스트 목록 아이콘에서 한 종류만 따로 올린다.
  // 작성 중(draft) 시험에 덧붙이고, 분석 요청은 목록의 아이콘으로 따로 한다.
  if (consultationId && kind) {
    const context = await getExamUploadContext(consultationId);
    return <ExamKindUploadClient kind={kind} context={context} from={from} />;
  }

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
