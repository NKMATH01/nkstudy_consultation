"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revokeReportToken } from "@/lib/actions/report-token";
import { escapeLikePattern } from "@/lib/student-identity";
import {
  EXAM_REPORT_TEMPLATE_CODE,
  buildExamReportVars,
  extendReportExpiry,
  isExamTemplatePending,
  isValidExamUploadPath,
  reportTokenSendBlock,
} from "@/lib/exam-alimtalk";

/** 시험지·매쓰플랫 사진이 올라가는 비공개 Storage 버킷. */
const EXAM_PAPERS_BUCKET = "exam-papers";

export type ExamAnalysisStatus = "pending" | "analyzing" | "done" | "sent";

export interface ExamAnalysis {
  id: string;
  student_id: string | null;
  consultation_id: string | null;
  student_name: string;
  school: string | null;
  grade: string | null;
  exam_title: string;
  exam_date: string | null;
  subject: string | null;
  status: ExamAnalysisStatus;
  paper_paths: string[];
  mathflex_paths: string[];
  report_token: string | null;
  note: string | null;
  created_at: string;
  analyzed_at: string | null;
  sent_at: string | null;
  retain_until: string | null;
}

const STATUSES: ExamAnalysisStatus[] = ["pending", "analyzing", "done", "sent"];

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function mapRow(row: Record<string, unknown>): ExamAnalysis {
  const status = String(row.status ?? "pending") as ExamAnalysisStatus;
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(row.id ?? ""),
    student_id: str(row.student_id),
    consultation_id: str(row.consultation_id),
    student_name: String(row.student_name ?? ""),
    school: str(row.school),
    grade: str(row.grade),
    exam_title: String(row.exam_title ?? ""),
    exam_date: str(row.exam_date),
    subject: str(row.subject),
    status: STATUSES.includes(status) ? status : "pending",
    paper_paths: toStringArray(row.paper_paths),
    mathflex_paths: toStringArray(row.mathflex_paths),
    report_token: str(row.report_token),
    note: str(row.note),
    created_at: String(row.created_at ?? ""),
    analyzed_at: str(row.analyzed_at),
    sent_at: str(row.sent_at),
    retain_until: str(row.retain_until),
  };
}

/** 로그인 사용자 확인. RLS와 별개로 서버 게이트를 둔다(withdrawal.ts 관례). */
async function requireAuthenticated(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "인증이 필요합니다" };
  return { ok: true };
}

export async function listExamAnalyses(): Promise<ExamAnalysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_analyses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ExamAnalysis]", { action: "list", error: error.message });
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getExamAnalysis(id: string): Promise<ExamAnalysis | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[ExamAnalysis]", { action: "get", id, error: error.message });
    return null;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** 입학테스트 대상 고르기용 상담 요약. 연락처는 싣지 않는다. */
export interface ExamConsultationOption {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  consult_date: string | null;
}

/**
 * 상담 기록에서 입학테스트 대상 학생을 찾는다(신입생은 등록 전이라 students 에 없다).
 * 최근 상담부터, 이름·학교 부분 일치, 최대 20건. 검색어가 비면 최근 상담 20건.
 */
export async function searchExamConsultations(query: string): Promise<ExamConsultationOption[]> {
  const auth = await requireAuthenticated();
  if (!auth.ok) return [];

  // PostgREST or() 문법을 깨는 문자(, ( ) " \)와 like 에서 % 로 취급되는 * 는 버리고,
  // LIKE 와일드카드(% _)는 이스케이프한다.
  const q = escapeLikePattern(String(query ?? "").replace(/[,()"\\*]/g, " ").trim().slice(0, 50));

  const supabase = await createClient();
  let request = supabase
    .from("consultations")
    .select("id, name, school, grade, consult_date")
    .order("consult_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (q) request = request.or(`name.ilike.%${q}%,school.ilike.%${q}%`);

  const { data, error } = await request;
  if (error) {
    console.error("[ExamAnalysis]", { action: "searchConsultations", error: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    school: row.school ?? null,
    grade: row.grade ?? null,
    consult_date: row.consult_date ?? null,
  }));
}

/**
 * `/exams/new?consultation=<id>` 로 들어왔을 때 미리 고를 상담 1건. searchExamConsultations 와 같은 형식.
 * 없거나 잘못된 id 면 null(화면은 검색 칸을 그대로 보여 준다).
 */
export async function getExamConsultationOption(id: string): Promise<ExamConsultationOption | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const auth = await requireAuthenticated();
  if (!auth.ok) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultations")
    .select("id, name, school, grade, consult_date")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[ExamAnalysis]", { action: "getConsultationOption", id, error: error.message });
    return null;
  }
  return {
    id: String(data.id),
    name: String(data.name ?? ""),
    school: data.school ?? null,
    grade: data.grade ?? null,
    consult_date: data.consult_date ?? null,
  };
}

const createExamAnalysisSchema = z
  .object({
    /** 클라이언트가 미리 만든 id. Storage 경로(<id>/<uuid>.<ext>)의 폴더명과 같아야 한다. */
    id: z.uuid("잘못된 요청입니다"),
    consultationId: z.uuid("상담 학생을 선택하세요"),
    exam_title: z.string().trim().min(1, "시험명을 입력하세요").max(200),
    exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시험일을 입력하세요"),
    subject: z.string().trim().min(1, "과목을 입력하세요").max(50),
    note: z.string().trim().max(2000).optional(),
    paper_paths: z.array(z.string()).min(1, "시험지 사진을 1장 이상 올려주세요").max(40),
    mathflex_paths: z.array(z.string()).max(2, "매쓰플랫 결과지는 최대 2개까지 올릴 수 있습니다"),
  })
  .superRefine((value, ctx) => {
    // PDF 는 매쓰플랫 결과지에만 허용한다(exam-alimtalk.ts 규칙).
    const ok =
      value.paper_paths.every((p) => isValidExamUploadPath(value.id, p, "paper")) &&
      value.mathflex_paths.every((p) => isValidExamUploadPath(value.id, p, "mathflex"));
    if (!ok) ctx.addIssue({ code: "custom", message: "업로드 경로가 올바르지 않습니다" });
  });

export type CreateExamAnalysisInput = z.input<typeof createExamAnalysisSchema>;

export async function createExamAnalysis(
  input: CreateExamAnalysisInput,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const auth = await requireAuthenticated();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = createExamAnalysisSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const value = parsed.data;

    const supabase = await createClient();

    // 신입생은 등록 전이라 students 에 없다. 이름·학교·학년은 클라이언트 값을 믿지 않고
    // consultations 에서 다시 읽는다. student_id 는 등록 후 연결할 자리라 비워 둔다.
    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id, name, school, grade")
      .eq("id", value.consultationId)
      .maybeSingle();
    if (consultationError || !consultation) {
      console.error("[ExamAnalysis]", {
        action: "create.consultation",
        consultation_id: value.consultationId,
        error: consultationError?.message,
      });
      return { success: false, error: "상담 학생 정보를 찾을 수 없습니다" };
    }

    const { data, error } = await supabase
      .from("exam_analyses")
      .insert({
        id: value.id,
        student_id: null,
        consultation_id: consultation.id,
        student_name: consultation.name,
        school: consultation.school ?? null,
        grade: consultation.grade ?? null,
        exam_title: value.exam_title,
        exam_date: value.exam_date,
        subject: value.subject,
        status: "pending",
        paper_paths: value.paper_paths,
        mathflex_paths: value.mathflex_paths,
        note: value.note || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[ExamAnalysis]", { action: "create", id: value.id, error: error?.message });
      return { success: false, error: "시험지 등록에 실패했습니다" };
    }

    revalidatePath("/exams");
    return { success: true, id: String(data.id) };
  } catch (e) {
    console.error("[ExamAnalysis]", {
      action: "create",
      error: e instanceof Error ? e.message : String(e),
    });
    return { success: false, error: "시험지 등록 중 오류가 발생했습니다" };
  }
}

/** 원본 사진 보기용 서명 URL(1시간). 경로 순서대로 돌려주고, 실패한 항목은 null. */
export async function getExamPaperSignedUrls(paths: string[]): Promise<(string | null)[]> {
  if (paths.length === 0) return [];
  const auth = await requireAuthenticated();
  if (!auth.ok) return paths.map(() => null);

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(EXAM_PAPERS_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) {
    console.error("[ExamAnalysis]", { action: "signedUrls", error: error?.message });
    return paths.map(() => null);
  }
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => byPath.get(p) ?? null);
}

export async function deleteExamAnalysis(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const auth = await requireAuthenticated();
    if (!auth.ok) return { success: false, error: auth.error };
    if (!z.uuid().safeParse(id).success) return { success: false, error: "잘못된 요청입니다" };

    const supabase = await createClient();
    const { data: row, error: readError } = await supabase
      .from("exam_analyses")
      .select("id, paper_paths, mathflex_paths, report_token")
      .eq("id", id)
      .maybeSingle();
    if (readError || !row) {
      console.error("[ExamAnalysis]", { action: "delete.read", id, error: readError?.message });
      return { success: false, error: "시험지를 찾을 수 없습니다" };
    }

    // 학부모 링크부터 끊는다. 행만 지우면 분석지 링크는 만료일까지 계속 열린다.
    // 끊지 못하면 사진도 행도 지우지 않는다 — 기록 없이 살아 있는 링크를 남기지 않기 위해서다.
    if (typeof row.report_token === "string" && row.report_token) {
      const revoked = await revokeReportToken(row.report_token);
      if (!revoked.success) {
        console.error("[ExamAnalysis]", { action: "delete.revoke", id, error: revoked.error });
        return { success: false, error: "학부모 링크를 끊지 못해 삭제를 멈췄습니다" };
      }
    }

    // 행에 기록된 경로 + 폴더에 남은 객체(업로드 도중 실패로 남은 것)까지 모아 지운다.
    const paths = new Set<string>([
      ...toStringArray(row.paper_paths),
      ...toStringArray(row.mathflex_paths),
    ]);
    const { data: listed } = await supabase.storage
      .from(EXAM_PAPERS_BUCKET)
      .list(id, { limit: 1000 });
    for (const obj of listed ?? []) paths.add(`${id}/${obj.name}`);

    if (paths.size > 0) {
      const { error: removeError } = await supabase.storage
        .from(EXAM_PAPERS_BUCKET)
        .remove([...paths]);
      if (removeError) {
        console.error("[ExamAnalysis]", { action: "delete.storage", id, error: removeError.message });
        return { success: false, error: "사진 삭제에 실패했습니다" };
      }
    }

    const { error } = await supabase.from("exam_analyses").delete().eq("id", id);
    if (error) {
      console.error("[ExamAnalysis]", { action: "delete", id, error: error.message });
      return { success: false, error: "시험지 삭제에 실패했습니다" };
    }

    revalidatePath("/exams");
    return { success: true };
  } catch (e) {
    console.error("[ExamAnalysis]", {
      action: "delete",
      id,
      error: e instanceof Error ? e.message : String(e),
    });
    return { success: false, error: "시험지 삭제 중 오류가 발생했습니다" };
  }
}

// ─── R6 입학테스트 리포트 알림톡 ─────────────────────────────────

export interface ExamReportAlimtalkArgs {
  templateCode: string;
  phone: string;
  vars: Record<string, string>;
  subjectType: "exam_analysis";
  subjectId: string;
}

export type PrepareExamReportAlimtalkResult =
  | { success: true; data: ExamReportAlimtalkArgs; templatePending: boolean }
  | { success: false; error: string };

/**
 * AlimtalkSendDialog 의 prepare() 용 발송 인자.
 * 로그인 → 시험·상담 학부모 번호 → 리포트 링크(report_tokens) 회수 여부 확인 →
 * 템플릿이 승인된 경우에만 만료를 greatest(expires_at, now+14일) 로 늘린다.
 * report_tokens 는 authenticated UPDATE 정책이 있어(20260711150000) 서비스 롤이 필요 없다.
 * 상태(sent)는 여기서 바꾸지 않는다 — 발송 성공 뒤 markExamReportSent 가 바꾼다.
 */
export async function prepareExamReportAlimtalk(
  examId: string,
): Promise<PrepareExamReportAlimtalkResult> {
  try {
    const auth = await requireAuthenticated();
    if (!auth.ok) return { success: false, error: auth.error };
    if (!z.uuid().safeParse(examId).success) return { success: false, error: "잘못된 요청입니다" };

    const supabase = await createClient();
    const { data: exam, error: examError } = await supabase
      .from("exam_analyses")
      .select("id, consultation_id, student_name, exam_date, status, report_token")
      .eq("id", examId)
      .maybeSingle();
    if (examError || !exam) {
      console.error("[ExamAnalysis]", { action: "alimtalk.exam", examId, error: examError?.message });
      return { success: false, error: "시험 기록을 찾을 수 없습니다" };
    }
    if (exam.status !== "done" && exam.status !== "sent") {
      return { success: false, error: "분석이 끝난 뒤에 보낼 수 있습니다" };
    }
    const token = typeof exam.report_token === "string" ? exam.report_token : "";
    if (!token) return { success: false, error: "리포트 링크가 아직 없습니다" };
    if (!exam.consultation_id) return { success: false, error: "연결된 상담 기록이 없습니다" };

    const [{ data: consultation, error: consultationError }, { data: tokenRow, error: tokenError }, { data: template, error: templateError }] =
      await Promise.all([
        supabase.from("consultations").select("parent_phone").eq("id", exam.consultation_id).maybeSingle(),
        supabase.from("report_tokens").select("token, expires_at, revoked_at").eq("token", token).maybeSingle(),
        supabase
          .from("nkc_alimtalk_templates")
          .select("kakao_status")
          .eq("template_code", EXAM_REPORT_TEMPLATE_CODE)
          .maybeSingle(),
      ]);

    if (consultationError || tokenError || templateError) {
      console.error("[ExamAnalysis]", {
        action: "alimtalk.lookup",
        examId,
        error: consultationError?.message ?? tokenError?.message ?? templateError?.message,
      });
      return { success: false, error: "발송 정보를 불러오지 못했습니다" };
    }
    if (!template) {
      return { success: false, error: "입학테스트 알림톡 템플릿이 아직 등록되지 않았습니다" };
    }
    const phone = String(consultation?.parent_phone ?? "").trim();
    if (!phone) return { success: false, error: "상담 기록에 학부모 연락처가 없습니다" };

    const block = reportTokenSendBlock(
      tokenRow ? { revoked_at: (tokenRow.revoked_at as string | null) ?? null } : null,
    );
    if (block) return { success: false, error: block };

    const templatePending = isExamTemplatePending(template.kakao_status as string | null);
    // 심사 대기 중이면 어차피 못 보내니 링크를 늘리지 않는다.
    if (!templatePending) {
      const current = (tokenRow!.expires_at as string | null) ?? null;
      const next = extendReportExpiry(current, new Date());
      if (next !== current) {
        const { error: extendError } = await supabase
          .from("report_tokens")
          .update({ expires_at: next })
          .eq("token", token)
          .is("revoked_at", null);
        if (extendError) {
          console.error("[ExamAnalysis]", { action: "alimtalk.extend", examId, error: extendError.message });
          return { success: false, error: "리포트 링크 기간을 늘리지 못했습니다" };
        }
      }
    }

    return {
      success: true,
      templatePending,
      data: {
        templateCode: EXAM_REPORT_TEMPLATE_CODE,
        phone,
        vars: buildExamReportVars(
          { student_name: String(exam.student_name ?? ""), exam_date: (exam.exam_date as string | null) ?? null },
          token,
        ),
        subjectType: "exam_analysis",
        subjectId: String(exam.id),
      },
    };
  } catch (e) {
    console.error("[ExamAnalysis]", {
      action: "alimtalk.prepare",
      examId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { success: false, error: "알림톡 발송 준비 중 오류가 발생했습니다" };
  }
}

/**
 * 발송 성공 뒤에만 status='sent'·sent_at 기록.
 * 다이얼로그는 성공 콜백이 없으므로, 닫힐 때 호출하고 서버가 실제 발송 기록
 * (nkc_scheduled_messages: subject_type='exam_analysis', status='sent')이 있을 때만 바꾼다.
 */
export async function markExamReportSent(
  examId: string,
): Promise<{ success: true; marked: boolean } | { success: false; error: string }> {
  try {
    const auth = await requireAuthenticated();
    if (!auth.ok) return { success: false, error: auth.error };
    if (!z.uuid().safeParse(examId).success) return { success: false, error: "잘못된 요청입니다" };

    const supabase = await createClient();
    const { data: sent, error: sentError } = await supabase
      .from("nkc_scheduled_messages")
      .select("id, updated_at")
      .eq("subject_type", "exam_analysis")
      .eq("subject_id", examId)
      .eq("template_code", EXAM_REPORT_TEMPLATE_CODE)
      .eq("status", "sent")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sentError) {
      console.error("[ExamAnalysis]", { action: "markSent.lookup", examId, error: sentError.message });
      return { success: false, error: "발송 기록을 확인하지 못했습니다" };
    }
    if (!sent) return { success: true, marked: false };

    const sentAt = (sent.updated_at as string | null) ?? new Date().toISOString();
    const { data: current } = await supabase
      .from("exam_analyses")
      .select("status, sent_at")
      .eq("id", examId)
      .maybeSingle();
    // 이미 이 발송(또는 더 뒤 발송)이 기록돼 있으면 다시 쓰지 않는다.
    if (
      current?.status === "sent" &&
      current.sent_at &&
      new Date(current.sent_at as string).getTime() >= new Date(sentAt).getTime()
    ) {
      return { success: true, marked: false };
    }
    const { data: updated, error } = await supabase
      .from("exam_analyses")
      .update({ status: "sent", sent_at: sentAt })
      .eq("id", examId)
      .in("status", ["done", "sent"])
      .select("id");
    if (error) {
      console.error("[ExamAnalysis]", { action: "markSent", examId, error: error.message });
      return { success: false, error: "발송 상태를 저장하지 못했습니다" };
    }

    const marked = (updated ?? []).length > 0;
    if (marked) {
      revalidatePath("/exams");
      revalidatePath(`/exams/${examId}`);
    }
    return { success: true, marked };
  } catch (e) {
    console.error("[ExamAnalysis]", {
      action: "markSent",
      examId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { success: false, error: "발송 상태 저장 중 오류가 발생했습니다" };
  }
}
