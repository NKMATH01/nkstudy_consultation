"use server";

import { createClient } from "@/lib/supabase/server";
import { withdrawalFormSchema } from "@/lib/validations/withdrawal";
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

    revalidatePath("/withdrawals");
    return { success: true };
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
  const { data, error } = await supabase
    .from("students")
    .select("teacher_name")
    .eq("is_active", true);

  if (error) {
    console.error("학생 수 조회 실패:", error.message);
    return { total: 0, byTeacher: {} };
  }

  const rows = data ?? [];
  const byTeacher: Record<string, number> = {};
  rows.forEach((row) => {
    const name = row.teacher_name || "미지정";
    byTeacher[name] = (byTeacher[name] || 0) + 1;
  });

  return { total: rows.length, byTeacher };
}
