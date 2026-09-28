"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revokeReportToken } from "@/lib/actions/report-token";

/** 시험지·매쓰플랫 사진이 올라가는 비공개 Storage 버킷. */
const EXAM_PAPERS_BUCKET = "exam-papers";

export type ExamAnalysisStatus = "pending" | "analyzing" | "done" | "sent";

export interface ExamAnalysis {
  id: string;
  student_id: string | null;
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

const createExamAnalysisSchema = z
  .object({
    /** 클라이언트가 미리 만든 id. Storage 경로(<id>/<uuid>.<ext>)의 폴더명과 같아야 한다. */
    id: z.uuid("잘못된 요청입니다"),
    student_id: z.string().min(1, "학생을 선택하세요"),
    exam_title: z.string().trim().min(1, "시험명을 입력하세요").max(200),
    exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시험일을 입력하세요"),
    subject: z.string().trim().min(1, "과목을 입력하세요").max(50),
    note: z.string().trim().max(2000).optional(),
    paper_paths: z.array(z.string()).min(1, "시험지 사진을 1장 이상 올려주세요").max(40),
    mathflex_paths: z.array(z.string()).max(10),
  })
  .superRefine((value, ctx) => {
    const pattern = new RegExp(`^${value.id}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`, "i");
    for (const path of [...value.paper_paths, ...value.mathflex_paths]) {
      if (!pattern.test(path)) {
        ctx.addIssue({ code: "custom", message: "업로드 경로가 올바르지 않습니다" });
        return;
      }
    }
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

    // 학생 이름·학교·학년은 클라이언트 값을 믿지 않고 students 테이블에서 다시 읽는다.
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, school, grade")
      .eq("id", value.student_id)
      .maybeSingle();
    if (studentError || !student) {
      console.error("[ExamAnalysis]", {
        action: "create.student",
        student_id: value.student_id,
        error: studentError?.message,
      });
      return { success: false, error: "학생 정보를 찾을 수 없습니다" };
    }

    const { data, error } = await supabase
      .from("exam_analyses")
      .insert({
        id: value.id,
        student_id: student.id,
        student_name: student.name,
        school: student.school ?? null,
        grade: student.grade ?? null,
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
