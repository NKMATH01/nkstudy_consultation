import { checkPagePermission } from "@/lib/check-permission";
import { listExamAnalyses } from "@/lib/actions/exam-analysis";
import { createClient } from "@/lib/supabase/server";
import { arrangeExamList, canDeleteExam, unregisteredExamConsultations } from "@/lib/exam-alimtalk";
import { ExamsListClient, type ExamListRow } from "./exams-list-client";

/** 오늘 날짜(한국 시간, YYYY-MM-DD). */
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export default async function ExamsPage() {
  // checkPagePermission 은 getCurrentTeacher 결과를 돌려준다(상세 화면과 같은 방식으로 역할 확인).
  const currentTeacher = await checkPagePermission("/exams");
  const supabase = await createClient();
  const [analyses, { data: consultations, error }] = await Promise.all([
    listExamAnalyses(),
    // 설문 분석이 있는 상담(최신순). 시험 행이 없으면 "미등록" 파생 행으로 보여 준다(DB 행은 만들지 않는다).
    supabase
      .from("consultations")
      .select("id, name, school, grade, subject, analysis_id, consult_date")
      .not("analysis_id", "is", null)
      .order("consult_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);
  if (error) console.error("[ExamAnalysis]", { action: "list.consultations", error: error.message });

  const examConsultationIds = new Set(
    analyses.map((a) => a.consultation_id).filter((id): id is string => !!id),
  );
  const unregistered = unregisteredExamConsultations(
    (consultations ?? []).map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      school: (c.school as string | null) ?? null,
      grade: (c.grade as string | null) ?? null,
      subject: (c.subject as string | null) ?? null,
      analysis_id: (c.analysis_id as string | null) ?? null,
      consult_date: (c.consult_date as string | null) ?? null,
    })),
    examConsultationIds,
  );

  // 설문일 = 설문 분석(analyses)이 만들어진 날. 미등록 학생 것만 읽는다.
  const analysisIds = [...new Set(unregistered.map((c) => c.analysis_id).filter((id): id is string => !!id))];
  const surveyDateByAnalysis = new Map<string, string>();
  if (analysisIds.length > 0) {
    const { data: analysisRows, error: analysisError } = await supabase
      .from("analyses")
      .select("id, created_at")
      .in("id", analysisIds);
    if (analysisError) {
      console.error("[ExamAnalysis]", { action: "list.surveyDates", error: analysisError.message });
    }
    for (const a of analysisRows ?? []) {
      if (a.created_at) surveyDateByAnalysis.set(String(a.id), String(a.created_at));
    }
  }

  const { active, recent, older, finished } = arrangeExamList(
    analyses,
    unregistered.map((c) => ({
      ...c,
      survey_date: c.analysis_id ? (surveyDateByAnalysis.get(c.analysis_id) ?? null) : null,
    })),
    todayKst(),
  );

  const toExamRow = (analysis: (typeof analyses)[number]): ExamListRow => ({ kind: "exam", analysis });
  const toUnregisteredRow = (c: (typeof recent)[number]): ExamListRow => ({
    kind: "unregistered",
    row: { consultation_id: c.id, student_name: c.name, school: c.school, grade: c.grade, subject: c.subject },
  });

  // 진행 중 → 최근 30일 미등록 → [이전 미등록 N명 보기] → 완료·보냄.
  // 삭제 아이콘은 원장·관리자에게만. 실제 차단은 deleteExamAnalysis 서버 쪽에서 한다.
  return (
    <ExamsListClient
      headRows={[...active.map(toExamRow), ...recent.map(toUnregisteredRow)]}
      olderRows={older.map(toUnregisteredRow)}
      tailRows={finished.map(toExamRow)}
      canDelete={canDeleteExam(currentTeacher?.role)}
    />
  );
}
