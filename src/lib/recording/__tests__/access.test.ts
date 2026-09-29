import { describe, expect, it } from "vitest";
import { decideRecordingAccess } from "@/lib/recording/access";

const T1 = "teacher-1";
const T2 = "teacher-2";

describe("decideRecordingAccess (D1, fail closed)", () => {
  it("access_principal_allowed", () => {
    const staff = { teacherId: "p-1", role: "principal" };
    const facts = { studentId: null, studentTeacherId: null, classTeacherIds: [] };
    expect(decideRecordingAccess(staff, facts, "view").allowed).toBe(true);
    expect(decideRecordingAccess(staff, facts, "mutate").allowed).toBe(true);
    // 시스템 계정(admin@nk.com)은 teachers 행이 없어 teacherId 가 null 이다.
    expect(decideRecordingAccess({ teacherId: null, role: "admin" }, null, "mutate").allowed).toBe(true);
  });

  it("access_teacher_directFk_allowed", () => {
    const staff = { teacherId: T1, role: "teacher" };
    const facts = { studentId: "s-1", studentTeacherId: T1, classTeacherIds: [] };
    expect(decideRecordingAccess(staff, facts, "view").allowed).toBe(true);
  });

  it("access_teacher_singleClassMatch_allowed", () => {
    const staff = { teacherId: T1, role: "teacher" };
    const facts = { studentId: "s-1", studentTeacherId: null, classTeacherIds: [T1] };
    expect(decideRecordingAccess(staff, facts, "view").allowed).toBe(true);
  });

  it("access_teacher_duplicateClassName_denied", () => {
    const staff = { teacherId: T1, role: "teacher" };
    const facts = { studentId: "s-1", studentTeacherId: null, classTeacherIds: [T1, T2] };
    expect(decideRecordingAccess(staff, facts, "view").allowed).toBe(false);
    // 반 0개도 거부
    const none = { studentId: "s-1", studentTeacherId: null, classTeacherIds: [] };
    expect(decideRecordingAccess(staff, none, "view").allowed).toBe(false);
  });

  it("access_studentIdNull_denied", () => {
    const staff = { teacherId: T1, role: "teacher" };
    const facts = { studentId: null, studentTeacherId: T1, classTeacherIds: [T1] };
    expect(decideRecordingAccess(staff, facts, "view").allowed).toBe(false);
    expect(decideRecordingAccess(staff, null, "view").allowed).toBe(false);
  });

  it("access_teacher_cannotMutate", () => {
    const staff = { teacherId: T1, role: "teacher" };
    const facts = { studentId: "s-1", studentTeacherId: T1, classTeacherIds: [T1] };
    expect(decideRecordingAccess(staff, facts, "mutate").allowed).toBe(false);
  });

  it("access_unknownStaffOrRole_denied", () => {
    const facts = { studentId: "s-1", studentTeacherId: T1, classTeacherIds: [T1] };
    expect(decideRecordingAccess(null, facts, "view").allowed).toBe(false);
    expect(decideRecordingAccess({ teacherId: T1, role: "clinic" }, facts, "view").allowed).toBe(false);
    expect(decideRecordingAccess({ teacherId: null, role: "teacher" }, facts, "view").allowed).toBe(false);
    expect(decideRecordingAccess({ teacherId: T1, role: null }, facts, "view").allowed).toBe(false);
  });
});
