"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retrospectiveFormSchema, withdrawalFormSchema } from "@/lib/validations/withdrawal";
import {
  isRetrospectiveComplete,
  parseRetrospective,
  type WithdrawalRetrospective,
} from "@/lib/withdrawal-retrospective";
import type { Withdrawal } from "@/types";
import { revalidatePath } from "next/cache";

export async function getWithdrawals(): Promise<Withdrawal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .order("withdrawal_date", { ascending: false });

  if (error) {
    console.error("퇴원생 목록 조회 실패:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    school: row.school ?? null,
    subject: row.subject ?? null,
    class_name: row.class_name ?? null,
    teacher: row.teacher ?? null,
    grade: row.grade ?? null,
    enrollment_start: row.enrollment_start ?? null,
    enrollment_end: row.enrollment_end ?? null,
    duration_months: row.duration_months != null ? Number(row.duration_months) : null,
    withdrawal_date: row.withdrawal_date ?? null,
    class_attitude: row.class_attitude ?? null,
    homework_submission: row.homework_submission ?? null,
    attendance: row.attendance ?? null,
    grade_change: row.grade_change ?? null,
    recent_grade: row.recent_grade ?? null,
    reason_category: row.reason_category ?? null,
    student_opinion: row.student_opinion ?? null,
    parent_opinion: row.parent_opinion ?? null,
    teacher_opinion: row.teacher_opinion ?? null,
    final_consult_date: row.final_consult_date ?? null,
    final_counselor: row.final_counselor ?? null,
    final_consult_summary: row.final_consult_summary ?? null,
    parent_thanks: row.parent_thanks === true,
    comeback_possibility: row.comeback_possibility ?? null,
    expected_comeback_date: row.expected_comeback_date ?? null,
    special_notes: row.special_notes ?? null,
    raw_text: row.raw_text ?? null,
    // retrospective 컬럼이 아직 없는 DB에서도 undefined → null로 안전하게 처리된다.
    retrospective: parseRetrospective(row.retrospective),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  })) as Withdrawal[];
}

export async function createWithdrawal(formData: FormData) {
  try {
    const supabase = await createClient();

    const raw: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "parent_thanks") {
        raw[key] = value === "true";
      } else if (key === "duration_months") {
        raw[key] = value ? Number(value) : undefined;
      } else {
        raw[key] = value || undefined;
      }
    }

    const parsed = withdrawalFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { error } = await supabase.from("withdrawals").insert({
      name: parsed.data.name,
      school: parsed.data.school || null,
      subject: parsed.data.subject || null,
      class_name: parsed.data.class_name || null,
      teacher: parsed.data.teacher || null,
      grade: parsed.data.grade || null,
      enrollment_start: parsed.data.enrollment_start || null,
      enrollment_end: parsed.data.enrollment_end || null,
      duration_months: parsed.data.duration_months || null,
      withdrawal_date: parsed.data.withdrawal_date || null,
      class_attitude: parsed.data.class_attitude || null,
      homework_submission: parsed.data.homework_submission || null,
      attendance: parsed.data.attendance || null,
      grade_change: parsed.data.grade_change || null,
      recent_grade: parsed.data.recent_grade || null,
      reason_category: parsed.data.reason_category || null,
      student_opinion: parsed.data.student_opinion || null,
      parent_opinion: parsed.data.parent_opinion || null,
      teacher_opinion: parsed.data.teacher_opinion || null,
      final_consult_date: parsed.data.final_consult_date || null,
      final_counselor: parsed.data.final_counselor || null,
      final_consult_summary: parsed.data.final_consult_summary || null,
      parent_thanks: parsed.data.parent_thanks || false,
      comeback_possibility: parsed.data.comeback_possibility || null,
      expected_comeback_date: parsed.data.expected_comeback_date || null,
      special_notes: parsed.data.special_notes || null,
      raw_text: parsed.data.raw_text || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // 퇴원 등록 시 학생관리에서 해당 학생 비활성화 (admin 클라이언트로 RLS 우회)
    let warning: string | undefined;
    if (parsed.data.name) {
      const admin = createAdminClient();
      const rawClassName = parsed.data.class_name || "";
      const normalizedClass = rawClassName.includes("-")
        ? rawClassName
        : rawClassName.replace(/([가-힣\d])([A-Z])/, "$1-$2");

      let deactivated = false;

      if (normalizedClass) {
        // 1차: 반 이름 정확 매칭
        const { data: exact } = await admin
          .from("students")
          .update({ is_active: false })
          .eq("name", parsed.data.name)
          .eq("class_name", normalizedClass)
          .eq("is_active", true)
          .select("id");
        if (exact && exact.length > 0) deactivated = true;

        // 2차: 반 이름 부분 매칭 (DB에 괄호 붙은 경우: "고1-C3(화목)" like "고1-C3%")
        if (!deactivated) {
          const { data: partial } = await admin
            .from("students")
            .update({ is_active: false })
            .eq("name", parsed.data.name)
            .like("class_name", `${normalizedClass}%`)
            .eq("is_active", true)
            .select("id");
          if (partial && partial.length > 0) deactivated = true;
        }
      }

      // 3차: 반 매칭 실패 시 이름만으로 비활성화
      if (!deactivated) {
        const { data: byName, error: deactivateError } = await admin
          .from("students")
          .update({ is_active: false })
          .eq("name", parsed.data.name)
          .eq("is_active", true)
          .select("id");
        if (deactivateError) {
          console.error("[퇴원] 학생 비활성화 실패:", deactivateError.message);
        } else if (byName && byName.length > 0) {
          deactivated = true;
        }
      }

      // 1~3차 모두 비활성화하지 못한 경우 사용자에게 고지
      if (!deactivated) {
        warning = "퇴원은 기록되었으나 학생 비활성화에 실패했습니다. 학생관리에서 수동 확인해주세요.";
      }
    }

    revalidatePath("/withdrawals");
    revalidatePath("/settings/students");
    return { success: true, warning };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "퇴원생 등록 실패";
    return { success: false, error: msg };
  }
}

export async function updateWithdrawal(id: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const raw: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "parent_thanks") {
        raw[key] = value === "true";
      } else if (key === "duration_months") {
        raw[key] = value ? Number(value) : undefined;
      } else {
        raw[key] = value || undefined;
      }
    }

    const parsed = withdrawalFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { error } = await supabase
      .from("withdrawals")
      .update({
        name: parsed.data.name,
        school: parsed.data.school || null,
        subject: parsed.data.subject || null,
        class_name: parsed.data.class_name || null,
        teacher: parsed.data.teacher || null,
        grade: parsed.data.grade || null,
        enrollment_start: parsed.data.enrollment_start || null,
        enrollment_end: parsed.data.enrollment_end || null,
        duration_months: parsed.data.duration_months || null,
        withdrawal_date: parsed.data.withdrawal_date || null,
        class_attitude: parsed.data.class_attitude || null,
        homework_submission: parsed.data.homework_submission || null,
        attendance: parsed.data.attendance || null,
        grade_change: parsed.data.grade_change || null,
        recent_grade: parsed.data.recent_grade || null,
        reason_category: parsed.data.reason_category || null,
        student_opinion: parsed.data.student_opinion || null,
        parent_opinion: parsed.data.parent_opinion || null,
        teacher_opinion: parsed.data.teacher_opinion || null,
        final_consult_date: parsed.data.final_consult_date || null,
        final_counselor: parsed.data.final_counselor || null,
        final_consult_summary: parsed.data.final_consult_summary || null,
        parent_thanks: parsed.data.parent_thanks || false,
        comeback_possibility: parsed.data.comeback_possibility || null,
        expected_comeback_date: parsed.data.expected_comeback_date || null,
        special_notes: parsed.data.special_notes || null,
        raw_text: parsed.data.raw_text || null,
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "퇴원생 수정 실패";
    return { success: false, error: msg };
  }
}

/**
 * 퇴원 회고 저장. retrospective 컬럼만 갱신하며 다른 퇴원 필드는 건드리지 않는다.
 * 필수 문항이 모두 채워지면 completed_at을 남기고(기존 값이 있으면 유지), 미완이면 비운다.
 */
export async function saveRetrospective(id: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const raw: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      raw[key] = typeof value === "string" ? value : undefined;
    }

    const parsed = retrospectiveFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { data: existingRow, error: fetchError } = await supabase
      .from("withdrawals")
      .select("retrospective")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[퇴원 회고] 기존 회고 조회 실패", { id, message: fetchError.message });
      return { success: false, error: fetchError.message };
    }

    const existing = parseRetrospective(existingRow?.retrospective);

    const retrospective: WithdrawalRetrospective = {
      first_sign: parsed.data.first_sign ?? "",
      our_attempts: parsed.data.our_attempts ?? "",
      do_differently: parsed.data.do_differently ?? "",
      system_change: parsed.data.system_change ?? "",
      lesson: parsed.data.lesson ?? "",
      manager_comment: parsed.data.manager_comment ?? "",
      author: parsed.data.author ?? "",
      completed_at: null,
    };

    retrospective.completed_at = isRetrospectiveComplete(retrospective)
      ? existing?.completed_at ?? new Date().toISOString()
      : null;

    const { error } = await supabase
      .from("withdrawals")
      .update({ retrospective })
      .eq("id", id);

    if (error) {
      console.error("[퇴원 회고] 저장 실패", { id, message: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals");
    revalidatePath("/withdrawals/dashboard");
    revalidatePath("/withdrawals/review");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "퇴원 회고 저장 실패";
    console.error("[퇴원 회고] 저장 예외", { id, message: msg });
    return { success: false, error: msg };
  }
}

export async function deleteWithdrawal(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("withdrawals").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "퇴원생 삭제 실패";
    return { success: false, error: msg };
  }
}

export async function getStudentCountsByTeacher(): Promise<{ total: number; byTeacher: Record<string, number> }> {
  const supabase = await createClient();
  // teacher_id → teachers 테이블 JOIN으로 선생님 이름 조회
  const { data, error } = await supabase
    .from("students")
    .select("teacher_id, teachers:teacher_id(name)")
    .eq("is_active", true);

  if (error) {
    console.error("학생 수 조회 실패:", error.message);
    return { total: 0, byTeacher: {} };
  }

  const rows = data ?? [];
  const byTeacher: Record<string, number> = {};
  rows.forEach((row) => {
    const teacherObj = row.teachers as { name?: string } | null;
    const name = teacherObj?.name || "미지정";
    byTeacher[name] = (byTeacher[name] || 0) + 1;
  });

  return { total: rows.length, byTeacher };
}

/**
 * N월 퇴원율 계산을 위한 (N-1)월 말일 기준 재원생 수 역산
 *
 * 계산 공식:
 *   (N-1)월 말일 재원생 = 현재 활성 학생 + (N월~현재 퇴원생) - (N월~현재 신규등록 학생)
 *
 * students.registration_date 또는 created_at 기반으로 등록 시점 판단
 * withdrawals.withdrawal_date 기반으로 퇴원 시점 판단
 */
export async function getMonthlyBaseStudentCounts(): Promise<{
  /** 월별 전달 말일 기준 총 재원생 수 (key: month number 1~12) */
  byMonth: Record<number, number>;
  /** 월별 + 강사별 전달 말일 기준 재원생 수 */
  byMonthTeacher: Record<number, Record<string, number>>;
}> {
  const supabase = await createClient();

  // 1. 현재 활성 학생 (teacher JOIN 포함)
  const { data: activeStudents } = await supabase
    .from("students")
    .select("teacher_id, teachers:teacher_id(name), registration_date, created_at")
    .eq("is_active", true);

  // 2. 전체 퇴원생 (teacher, withdrawal_date)
  const { data: allWithdrawals } = await supabase
    .from("withdrawals")
    .select("teacher, withdrawal_date");

  const active = (activeStudents ?? []).map((s) => {
    const teacherObj = s.teachers as { name?: string } | null;
    return { ...s, teacherName: teacherObj?.name || "미지정" };
  });
  const withdrawn = allWithdrawals ?? [];

  const now = new Date();
  const currentYear = now.getFullYear();

  // 현재 활성 학생 수 (전체 + 강사별)
  const currentTotal = active.length;
  const currentByTeacher: Record<string, number> = {};
  active.forEach((s) => {
    currentByTeacher[s.teacherName] = (currentByTeacher[s.teacherName] || 0) + 1;
  });

  // 학생의 등록 월 파싱 (registration_date 또는 created_at 기반)
  function getStudentRegMonth(s: { registration_date?: string | null; created_at?: string | null }): number | null {
    const dateStr = s.registration_date || s.created_at || null;
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})[.\-/](\d{1,2})/);
    if (match && parseInt(match[1]) === currentYear) return parseInt(match[2]);
    return null;
  }

  // 퇴원 월 파싱
  function getWithdrawalMonth(w: { withdrawal_date?: string | null }): number | null {
    if (!w.withdrawal_date) return null;
    const match = w.withdrawal_date.match(/(\d{4})[.\-/](\d{1,2})/);
    if (match && parseInt(match[1]) === currentYear) return parseInt(match[2]);
    // 연도 없이 "2.15" 같은 형식
    const shortMatch = w.withdrawal_date.match(/^(\d{1,2})[.\-/]/);
    if (shortMatch) {
      const m = parseInt(shortMatch[1]);
      if (m >= 1 && m <= 12) return m;
    }
    return null;
  }

  const byMonth: Record<number, number> = {};
  const byMonthTeacher: Record<number, Record<string, number>> = {};

  // 각 월(1~12)에 대해 전달 말일 기준 재원생 수 계산
  // N월 퇴원율 기준 = (N-1)월 말일 재원생 수
  // = 현재 활성 학생 + (N월~현재 퇴원생) - (N월~현재 신규 등록 학생)
  for (let month = 1; month <= 12; month++) {
    // N월 이후(N월 포함) 퇴원한 학생 수
    let withdrawnAfter = 0;
    const withdrawnAfterByTeacher: Record<string, number> = {};
    withdrawn.forEach((w) => {
      const wm = getWithdrawalMonth(w);
      if (wm !== null && wm >= month) {
        withdrawnAfter++;
        const t = w.teacher || "미지정";
        withdrawnAfterByTeacher[t] = (withdrawnAfterByTeacher[t] || 0) + 1;
      }
    });

    // N월 이후(N월 포함) 신규 등록한 현재 활성 학생 수
    let registeredAfter = 0;
    const registeredAfterByTeacher: Record<string, number> = {};
    active.forEach((s) => {
      const rm = getStudentRegMonth(s);
      if (rm !== null && rm >= month) {
        registeredAfter++;
        registeredAfterByTeacher[s.teacherName] = (registeredAfterByTeacher[s.teacherName] || 0) + 1;
      }
    });

    // (N-1)월 말일 재원생 = 현재 활성 + N월 이후 퇴원 - N월 이후 신규등록
    const baseTotal = currentTotal + withdrawnAfter - registeredAfter;
    byMonth[month] = Math.max(baseTotal, 0);

    // 강사별
    const teacherBase: Record<string, number> = {};
    const allTeachers = new Set([
      ...Object.keys(currentByTeacher),
      ...Object.keys(withdrawnAfterByTeacher),
      ...Object.keys(registeredAfterByTeacher),
    ]);
    allTeachers.forEach((t) => {
      const val = (currentByTeacher[t] || 0) + (withdrawnAfterByTeacher[t] || 0) - (registeredAfterByTeacher[t] || 0);
      if (val > 0) teacherBase[t] = val;
    });
    byMonthTeacher[month] = teacherBase;
  }

  return { byMonth, byMonthTeacher };
}
