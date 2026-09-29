// 상담 녹음 권한 판정(D1) — 순수 함수. DB 조회는 guard.ts 가 하고 여기에는 사실만 넘긴다.
// 원칙: 모르면 거부(fail closed).

export type RecordingAction = "view" | "mutate";

/** resolveStaff() 결과. 시스템 계정(admin@nk.com)은 teacherId 가 null 이다. */
export interface StaffIdentity {
  teacherId: string | null;
  role: string | null;
}

/** 상담에 연결된 학생과 담당 관계. */
export interface StudentFacts {
  /** consultations.student_id */
  studentId: string | null;
  /** students.teacher_id (직접 FK) */
  studentTeacherId: string | null;
  /** students.class_name 과 이름이 정확히 같은 반들의 classes.teacher_id (반 개수만큼) */
  classTeacherIds: (string | null)[];
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

const FULL_ACCESS_ROLES = new Set(["principal", "admin"]);

/** 녹음 실행(시작·마감·재시도·분석·삭제) 가능한 역할인지. */
export function canMutateRecordings(role: string | null | undefined): boolean {
  return !!role && FULL_ACCESS_ROLES.has(role);
}

export function decideRecordingAccess(
  staff: StaffIdentity | null,
  facts: StudentFacts | null,
  action: RecordingAction,
): AccessDecision {
  if (!staff || !staff.role) return { allowed: false, reason: "no_staff" };

  if (FULL_ACCESS_ROLES.has(staff.role)) return { allowed: true, reason: "full_access_role" };

  if (action === "mutate") return { allowed: false, reason: "mutate_requires_principal_or_admin" };

  if (staff.role !== "teacher") return { allowed: false, reason: "role_not_allowed" };
  if (!staff.teacherId) return { allowed: false, reason: "teacher_unresolved" };
  if (!facts || !facts.studentId) return { allowed: false, reason: "no_student" };

  if (facts.studentTeacherId && facts.studentTeacherId === staff.teacherId) {
    return { allowed: true, reason: "student_teacher_fk" };
  }

  if (facts.classTeacherIds.length !== 1) {
    return {
      allowed: false,
      reason: facts.classTeacherIds.length === 0 ? "no_class_match" : "ambiguous_class_name",
    };
  }
  if (facts.classTeacherIds[0] && facts.classTeacherIds[0] === staff.teacherId) {
    return { allowed: true, reason: "class_teacher" };
  }
  return { allowed: false, reason: "not_assigned" };
}
