import { checkPagePermission } from "@/lib/check-permission";
import { listExamAnalyses } from "@/lib/actions/exam-analysis";
import { createClient } from "@/lib/supabase/server";
import {
  EXAM_LIST_START_DATE,
  arrangeExamList,
  mergeUnregisteredCandidates,
  surveyBasedUnregistered,
  unregisteredExamConsultations,
  type UnregisteredExamCandidate,
} from "@/lib/exam-alimtalk";
import { ExamsListClient, type ExamListRow } from "./exams-list-client";

/** 오늘 날짜(한국 시간, YYYY-MM-DD). */
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const str = (v: unknown): string | null => (v == null ? null : String(v));

export default async function ExamsPage() {
  // checkPagePermission 은 getCurrentTeacher 결과를 돌려준다(상세 화면과 같은 방식으로 역할 확인).
  await checkPagePermission("/exams");
  const supabase = await createClient();
  // 설문 기준 미등록: 시작일(한국 시간 0시) 이후 설문만. 짝짓기는 /surveys 와 같은 규칙(student-identity).
  const surveySince = `${EXAM_LIST_START_DATE}T00:00:00+09:00`;
  const [analyses, { data: consultationData, error }, { data: surveyData, error: surveyError }, { data: surveyNames }] =
    await Promise.all([
      listExamAnalyses(),
      // 상담 전체(최신 상담 먼저 — /surveys 와 같은 정렬). 짝짓기에 학부모 번호가 필요하다.
      supabase
        .from("consultations")
        .select("id, name, school, grade, subject, analysis_id, consult_date, parent_phone")
        .order("consult_date", { ascending: false, nullsFirst: false })
        .order("consult_time", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("surveys")
        .select("id, name, school, grade, parent_phone, analysis_id, created_at")
        .gte("created_at", surveySince)
        .order("created_at", { ascending: false }),
      // 동명이인 설문은 이름만으로 짝짓지 않는다(/surveys 와 같음).
      supabase.from("surveys").select("name"),
    ]);
  if (error) console.error("[ExamAnalysis]", { action: "list.consultations", error: error.message });
  if (surveyError) console.error("[ExamAnalysis]", { action: "list.surveys", error: surveyError.message });

  const consultations = (consultationData ?? []).map((c) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
    school: str(c.school),
    grade: str(c.grade),
    subject: str(c.subject),
    analysis_id: str(c.analysis_id),
    consult_date: str(c.consult_date),
    parent_phone: str(c.parent_phone),
  }));

  // 설문의 분석 id: surveys.analysis_id, 없으면 analyses.survey_id 로 찾는다(/surveys 와 같음).
  const surveys = surveyData ?? [];
  const analysisBySurvey = new Map<string, string>();
  if (surveys.length > 0) {
    const { data: analysisRows, error: analysisError } = await supabase
      .from("analyses")
      .select("id, survey_id, created_at")
      .in("survey_id", surveys.map((s) => String(s.id)))
      .order("created_at", { ascending: false });
    if (analysisError) {
      console.error("[ExamAnalysis]", { action: "list.surveyAnalyses", error: analysisError.message });
    }
    for (const a of analysisRows ?? []) {
      const sid = str(a.survey_id);
      if (sid && !analysisBySurvey.has(sid)) analysisBySurvey.set(sid, String(a.id));
    }
  }
  const nameCounts = new Map<string, number>();
  for (const s of surveyNames ?? []) {
    const n = String(s.name ?? "").trim();
    nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  }

  const examConsultationIds = new Set(
    analyses.map((a) => a.consultation_id).filter((id): id is string => !!id),
  );

  const surveyBased = surveyBasedUnregistered(
    surveys.map((s) => ({
      id: String(s.id),
      name: String(s.name ?? ""),
      school: str(s.school),
      grade: str(s.grade),
      parent_phone: str(s.parent_phone),
      analysis_id: str(s.analysis_id) ?? analysisBySurvey.get(String(s.id)) ?? null,
      created_at: String(s.created_at ?? ""),
      ambiguousName: (nameCounts.get(String(s.name ?? "").trim()) ?? 0) > 1,
    })),
    consultations,
    examConsultationIds,
  );

  // 기존 consultations.analysis_id 기반 후보(설문 기반과 같은 상담·같은 학생은 뺀다).
  const analysisBased = unregisteredExamConsultations(
    consultations.filter((c) => c.analysis_id),
    examConsultationIds,
  );
  const analysisIds = [...new Set(analysisBased.map((c) => c.analysis_id).filter((id): id is string => !!id))];
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
  const analysisCandidates: UnregisteredExamCandidate[] = analysisBased.map((c) => ({
    key: c.id,
    consultation_id: c.id,
    analysis_id: c.analysis_id,
    name: c.name,
    school: c.school,
    grade: c.grade,
    subject: c.subject,
    consult_date: c.consult_date,
    survey_date: c.analysis_id ? (surveyDateByAnalysis.get(c.analysis_id) ?? null) : null,
  }));

  const unregistered = mergeUnregisteredCandidates(
    surveyBased.rows,
    analysisCandidates,
    surveyBased.coveredConsultationIds,
    surveyBased.coveredAnalysisIds,
  );

  const { active, recent, older, finished } = arrangeExamList(analyses, unregistered, todayKst());

  const toExamRow = (analysis: (typeof analyses)[number]): ExamListRow => ({ kind: "exam", analysis });
  const toUnregisteredRow = (c: UnregisteredExamCandidate): ExamListRow => ({
    kind: "unregistered",
    row: {
      key: c.key,
      consultation_id: c.consultation_id,
      student_name: c.name,
      school: c.school,
      grade: c.grade,
      subject: c.subject,
    },
  });

  // 진행 중 → 최근 30일 미등록 → [이전 미등록 N명 보기] → 완료·보냄.
  // 줄 끝은 시험지 보기·결과지 보기만. 삭제는 상세 화면에서(원장·관리자).
  return (
    <ExamsListClient
      headRows={[...active.map(toExamRow), ...recent.map(toUnregisteredRow)]}
      olderRows={older.map(toUnregisteredRow)}
      tailRows={finished.map(toExamRow)}
    />
  );
}
