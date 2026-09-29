// 서버 공통 권한 확인(D1). 모든 route·action 이 매번 이 함수를 거친다.
// resolveStaff() → (teacher 면) 학생 담당 사실 조회 → decideRecordingAccess.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canMutateRecordings,
  decideRecordingAccess,
  type RecordingAction,
  type StudentFacts,
} from "@/lib/recording/access";
import { resolveStaff, type ResolvedStaff } from "@/lib/recording/staff";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export type GuardOk = { ok: true; staff: ResolvedStaff; admin: SupabaseClient };
export type GuardFail = { ok: false; status: number; error: string };

function getAdmin(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** 상담 → 학생 → 담당 선생님 사실. 조회 오류는 throw(호출부에서 거부 처리). */
export async function loadStudentFacts(
  admin: SupabaseClient,
  consultationId: string,
): Promise<{ exists: boolean; facts: StudentFacts }> {
  const empty: StudentFacts = { studentId: null, studentTeacherId: null, classTeacherIds: [] };
  const { data: c, error: cErr } = await admin
    .from("consultations")
    .select("id, student_id")
    .eq("id", consultationId)
    .maybeSingle();
  if (cErr) throw new Error(`consultation_lookup_failed: ${cErr.message}`);
  if (!c) return { exists: false, facts: empty };
  const studentId = (c as { student_id: string | null }).student_id;
  if (!studentId) return { exists: true, facts: empty };

  const { data: s, error: sErr } = await admin
    .from("students")
    .select("id, teacher_id, class_name")
    .eq("id", studentId)
    .maybeSingle();
  if (sErr) throw new Error(`student_lookup_failed: ${sErr.message}`);
  if (!s) return { exists: true, facts: empty };
  const student = s as { teacher_id: string | null; class_name: string | null };

  let classTeacherIds: (string | null)[] = [];
  const className = student.class_name?.trim();
  if (className) {
    const { data: cls, error: clsErr } = await admin
      .from("classes")
      .select("id, teacher_id")
      .eq("name", className);
    if (clsErr) throw new Error(`class_lookup_failed: ${clsErr.message}`);
    classTeacherIds = ((cls ?? []) as { teacher_id: string | null }[]).map((r) => r.teacher_id ?? null);
  }
  return {
    exists: true,
    facts: { studentId, studentTeacherId: student.teacher_id ?? null, classTeacherIds },
  };
}

export async function authorizeConsultation(
  consultationId: string,
  action: RecordingAction,
): Promise<GuardOk | GuardFail> {
  if (!isUuid(consultationId)) return { ok: false, status: 400, error: "잘못된 상담 id" };
  const staff = await resolveStaff();
  if (!staff) return { ok: false, status: 403, error: "권한이 없습니다." };
  const admin = getAdmin();
  if (!admin) return { ok: false, status: 503, error: "서버 설정(서비스 롤 키)이 없습니다." };

  let facts: StudentFacts | null = null;
  try {
    const loaded = await loadStudentFacts(admin, consultationId);
    if (!loaded.exists) return { ok: false, status: 404, error: "상담을 찾을 수 없습니다." };
    facts = loaded.facts;
  } catch (e) {
    console.error("[recording] 권한 사실 조회 실패", {
      consultationId,
      error: e instanceof Error ? e.message : "unknown",
    });
    return { ok: false, status: 403, error: "권한을 확인하지 못했습니다." };
  }
  const decision = decideRecordingAccess(staff, facts, action);
  if (!decision.allowed) return { ok: false, status: 403, error: "권한이 없습니다." };
  return { ok: true, staff, admin };
}

export interface RecordingRow {
  id: string;
  consultation_id: string;
  status: string;
  mime: string;
  segment_count: number | null;
  finalized_at: string | null;
  audio_delete_after: string;
  audio_deleted_at: string | null;
}

/** 녹음 id 로 상담을 찾아 같은 판정을 한다. */
export async function authorizeRecording(
  recordingId: string,
  action: RecordingAction,
): Promise<(GuardOk & { recording: RecordingRow }) | GuardFail> {
  if (!isUuid(recordingId)) return { ok: false, status: 400, error: "잘못된 녹음 id" };
  const admin = getAdmin();
  if (!admin) return { ok: false, status: 503, error: "서버 설정(서비스 롤 키)이 없습니다." };
  const { data, error } = await admin
    .from("consultation_recordings")
    .select("id, consultation_id, status, mime, segment_count, finalized_at, audio_delete_after, audio_deleted_at")
    .eq("id", recordingId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: "녹음 조회 실패" };
  if (!data) return { ok: false, status: 404, error: "녹음을 찾을 수 없습니다." };
  const recording = data as RecordingRow;
  const auth = await authorizeConsultation(recording.consultation_id, action);
  if (!auth.ok) return auth;
  return { ...auth, recording };
}

/** 상담과 무관한 관리 작업(만료 정리)용: principal·admin 만. */
export async function authorizeMaintenance(): Promise<GuardOk | GuardFail> {
  const staff = await resolveStaff();
  if (!staff || !canMutateRecordings(staff.role)) return { ok: false, status: 403, error: "권한이 없습니다." };
  const admin = getAdmin();
  if (!admin) return { ok: false, status: 503, error: "서버 설정(서비스 롤 키)이 없습니다." };
  return { ok: true, staff, admin };
}
