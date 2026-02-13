"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail, toAuthPassword } from "@/lib/auth";
import { classFormSchema, teacherFormSchema, studentFormSchema } from "@/lib/validations/class";
import type { Class, Teacher, Student } from "@/types";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";

/** PostgREST 또는 PostgreSQL의 "컬럼 없음" 에러 감지 */
function isColumnNotFoundError(error: { code?: string; message?: string }): boolean {
  if (error.code === "42703" || error.code === "PGRST204") return true;
  if (error.message?.includes("Could not find") && error.message?.includes("column")) return true;
  if (error.message?.includes("does not exist")) return true;
  return false;
}

// =============================================
// ========== 반 관리 (classes) ==========
// =============================================
// 실제 DB 컬럼: id, name, teacher_id, description, is_active, created_at, updated_at

function mapDbToClass(row: Record<string, unknown>): Class {
  // teachers join 결과에서 이름 추출
  const teacherObj = row.teachers as Record<string, unknown> | null;
  const teacherName = teacherObj?.name ? String(teacherObj.name) : null;

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    teacher: teacherName,
    target_grade: null, // DB에 없음 - 프론트에서 이름에서 추출
    class_days: row.description != null ? String(row.description) : null,
    class_time: null,
    clinic_time: null,
    active: row.is_active !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getClasses(): Promise<Class[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("*, teachers(name)")
    .order("name", { ascending: true });

  if (error) {
    console.error("반 목록 조회 실패:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapDbToClass(row as Record<string, unknown>));
}

export async function createClass(formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      teacher: formData.get("teacher") || undefined,
      target_grade: formData.get("target_grade") || undefined,
      class_days: formData.get("class_days") || undefined,
      class_time: formData.get("class_time") || undefined,
      clinic_time: formData.get("clinic_time") || undefined,
    };

    const parsed = classFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    // 선생님 이름 → teacher_id 조회
    let teacherId: string | null = null;
    if (parsed.data.teacher) {
      const { data: tData } = await supabase
        .from("teachers")
        .select("id")
        .eq("name", parsed.data.teacher)
        .limit(1)
        .single();
      if (tData) teacherId = tData.id;
    }

    const { error } = await supabase.from("classes").insert({
      name: parsed.data.name,
      description: parsed.data.class_days || null,
      ...(teacherId ? { teacher_id: teacherId } : {}),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/classes");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "반 등록 실패";
    return { success: false, error: msg };
  }
}

export async function updateClass(id: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      teacher: formData.get("teacher") || undefined,
      target_grade: formData.get("target_grade") || undefined,
      class_days: formData.get("class_days") || undefined,
      class_time: formData.get("class_time") || undefined,
      clinic_time: formData.get("clinic_time") || undefined,
    };

    const parsed = classFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    // 선생님 이름 → teacher_id 조회
    let teacherId: string | null = null;
    if (parsed.data.teacher) {
      const { data: tData } = await supabase
        .from("teachers")
        .select("id")
        .eq("name", parsed.data.teacher)
        .limit(1)
        .single();
      if (tData) teacherId = tData.id;
    }

    const { error } = await supabase
      .from("classes")
      .update({
        name: parsed.data.name,
        description: parsed.data.class_days || null,
        teacher_id: teacherId,
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/classes");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "반 수정 실패";
    return { success: false, error: msg };
  }
}

export async function deleteClass(id: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("classes").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/classes");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "반 삭제 실패";
    return { success: false, error: msg };
  }
}

// =============================================
// ========== 선생님 관리 (teachers) ==========
// =============================================
// 실제 DB 컬럼: id, name, phone, is_active, created_at, updated_at, password, role, building

function mapDbToTeacher(row: Record<string, unknown>): Teacher {
  const password = row.password != null ? String(row.password) : null;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    subject: row.building != null ? String(row.building) : null, // DB building 컬럼을 subject로 매핑
    target_grade: null,
    phone: row.phone != null ? String(row.phone) : null,
    role: row.role != null ? (String(row.role) as Teacher["role"]) : null,
    password,
    password_changed: password !== "1234", // DB 컬럼 없이 password 값으로 판단
    auth_user_id: row.auth_user_id != null ? String(row.auth_user_id) : null,
    active: row.is_active !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getTeachers(): Promise<Teacher[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("선생님 목록 조회 실패:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapDbToTeacher(row as Record<string, unknown>));
}

export async function createTeacher(formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      subject: formData.get("subject") || undefined,
      target_grade: formData.get("target_grade") || undefined,
      phone: formData.get("phone") || undefined,
      role: formData.get("role") || undefined,
      password: formData.get("password") || undefined,
    };

    const parsed = teacherFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const password = parsed.data.password || "1234";
    let authUserId: string | null = null;

    // Supabase Auth 사용자 생성 (전화번호가 있고, 클리닉 선생님이 아닌 경우)
    if (parsed.data.phone && env.SUPABASE_SERVICE_ROLE_KEY && parsed.data.role !== "clinic") {
      try {
        const admin = createAdminClient();
        const email = phoneToEmail(parsed.data.phone);
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email,
          password: toAuthPassword(password),
          email_confirm: true,
        });
        if (authError) {
          console.error("[Teacher Auth] 생성 실패:", authError.message);
        } else if (authData.user) {
          authUserId = authData.user.id;
        }
      } catch (authErr) {
        console.error("[Teacher Auth] 에러:", authErr);
      }
    }

    const insertData = {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      building: parsed.data.subject || null,
      role: parsed.data.role || "teacher",
      password,
    };

    const { error } = await supabase.from("teachers").insert(insertData);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/teachers");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "선생님 등록 실패";
    return { success: false, error: msg };
  }
}

export async function updateTeacher(id: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      subject: formData.get("subject") || undefined,
      target_grade: formData.get("target_grade") || undefined,
      phone: formData.get("phone") || undefined,
      role: formData.get("role") || undefined,
      password: formData.get("password") || undefined,
    };

    const parsed = teacherFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const updateData: Record<string, unknown> = {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      building: parsed.data.subject || null,
    };
    if (parsed.data.role) updateData.role = parsed.data.role;
    if (parsed.data.password) updateData.password = parsed.data.password;

    const { error } = await supabase
      .from("teachers")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/teachers");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "선생님 수정 실패";
    return { success: false, error: msg };
  }
}

export async function resetTeacherPassword(id: string) {
  try {
    const supabase = await createClient();

    // 선생님 phone 조회해서 Auth 사용자도 리셋
    const { data: teacher } = await supabase
      .from("teachers")
      .select("phone")
      .eq("id", id)
      .single();

    if (teacher?.phone && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createAdminClient();
        const authEmail = phoneToEmail(teacher.phone);
        const { data: { users } } = await admin.auth.admin.listUsers();
        const authUser = users.find((u) => u.email === authEmail);
        if (authUser) {
          await admin.auth.admin.updateUserById(authUser.id, { password: toAuthPassword("1234") });
        }
      } catch (authErr) {
        console.error("[Teacher Auth] 비밀번호 리셋 실패:", authErr);
      }
    }

    const { error } = await supabase
      .from("teachers")
      .update({ password: "1234" })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/teachers");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "비밀번호 초기화 실패";
    return { success: false, error: msg };
  }
}

export async function changeTeacherPassword(phone: string, newPassword: string) {
  try {
    const supabase = await createClient();

    // 선생님 조회 (하이픈 포함/미포함 형식 모두 검색)
    const digits = phone.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length === 11) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    const { data: teacher, error: fetchErr } = await supabase
      .from("teachers")
      .select("id, phone")
      .or(`phone.eq.${digits},phone.eq.${formatted}`)
      .limit(1)
      .single();

    if (fetchErr || !teacher) {
      return { success: false, error: "선생님 정보를 찾을 수 없습니다" };
    }

    const teacherId = teacher.id;

    // teachers 테이블의 password 업데이트 (Auth 비밀번호는 클라이언트에서 변경)
    const { error } = await supabase
      .from("teachers")
      .update({ password: newPassword })
      .eq("id", teacherId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "비밀번호 변경 실패";
    return { success: false, error: msg };
  }
}

/** 전화번호로 선생님 조회 (로그인 후 password_changed 및 role 확인용) */
export async function getTeacherByPhone(phone: string): Promise<{ password_changed: boolean; name: string; role: string | null } | null> {
  try {
    const supabase = await createClient();
    const digits = phone.replace(/\D/g, "");

    // DB에 하이픈 포함/미포함 형식 모두 검색
    let formatted = digits;
    if (digits.length === 11) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    const { data } = await supabase
      .from("teachers")
      .select("name, role, password")
      .or(`phone.eq.${digits},phone.eq.${formatted}`)
      .limit(1)
      .single();

    if (!data) return null;
    // 비밀번호가 "1234"(초기값)이면 아직 변경하지 않은 것으로 판단
    const passwordChanged = data.password !== "1234";
    return { password_changed: passwordChanged, name: String(data.name), role: data.role ?? null };
  } catch {
    return null;
  }
}

export async function deleteTeacher(id: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("teachers").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/teachers");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "선생님 삭제 실패";
    return { success: false, error: msg };
  }
}

// =============================================
// ========== 학생 관리 (students) ==========
// =============================================
// 실제 DB 컬럼: id, name, class_name, school, grade, phone, parent_phone,
//              teacher_id, clinic_teacher_id, is_active, teacher_name,
//              created_at, updated_at
// ❌ 없는 컬럼: memo, registration_date

/** DB 컬럼 → Student 인터페이스 매핑 */
function mapDbToStudent(row: Record<string, unknown>): Student {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    school: row.school != null ? String(row.school) : null,
    grade: row.grade != null ? String(row.grade) : null,
    student_phone: row.phone != null ? String(row.phone) : null,
    parent_phone: row.parent_phone != null ? String(row.parent_phone) : null,
    assigned_class: row.class_name != null ? String(row.class_name) : null,
    teacher: row.teacher_name != null ? String(row.teacher_name) : null,
    memo: row.memo != null ? String(row.memo) : null,
    registration_date: row.registration_date != null ? String(row.registration_date) : null,
    active: row.is_active !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Student 인터페이스 → DB 실제 컬럼 매핑 */
function mapStudentToDb(parsed: Record<string, unknown>): Record<string, unknown> {
  return {
    name: parsed.name || null,
    school: parsed.school || null,
    grade: parsed.grade || null,
    phone: parsed.student_phone || null,
    parent_phone: parsed.parent_phone || null,
    class_name: parsed.assigned_class || null,
    teacher_name: parsed.teacher || null,
  };
}

export async function getStudents(): Promise<Student[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("학생 목록 조회 실패:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapDbToStudent(row as Record<string, unknown>));
}

export async function createStudent(formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      school: formData.get("school") || undefined,
      grade: formData.get("grade") || undefined,
      student_phone: formData.get("student_phone") || undefined,
      parent_phone: formData.get("parent_phone") || undefined,
      assigned_class: formData.get("assigned_class") || undefined,
      teacher: formData.get("teacher") || undefined,
      memo: formData.get("memo") || undefined,
      registration_date: formData.get("registration_date") || undefined,
    };

    const parsed = studentFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const dbData = mapStudentToDb(parsed.data as Record<string, unknown>);

    // registration_date, memo 컬럼 포함 시도 → 없으면 제외하고 재시도
    const fullData = {
      ...dbData,
      registration_date: parsed.data.registration_date || null,
      memo: parsed.data.memo || null,
    };

    const { error } = await supabase.from("students").insert(fullData);

    if (error && isColumnNotFoundError(error)) {
      const { error: retryErr } = await supabase.from("students").insert(dbData);
      if (retryErr) {
        return { success: false, error: retryErr.message };
      }
    } else if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/students");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "학생 등록 실패";
    return { success: false, error: msg };
  }
}

export async function updateStudent(id: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      school: formData.get("school") || undefined,
      grade: formData.get("grade") || undefined,
      student_phone: formData.get("student_phone") || undefined,
      parent_phone: formData.get("parent_phone") || undefined,
      assigned_class: formData.get("assigned_class") || undefined,
      teacher: formData.get("teacher") || undefined,
      memo: formData.get("memo") || undefined,
      registration_date: formData.get("registration_date") || undefined,
    };

    const parsed = studentFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const dbData = mapStudentToDb(parsed.data as Record<string, unknown>);

    const fullData = {
      ...dbData,
      registration_date: parsed.data.registration_date || null,
      memo: parsed.data.memo || null,
    };

    const { error } = await supabase.from("students").update(fullData).eq("id", id);

    if (error && isColumnNotFoundError(error)) {
      const { error: retryErr } = await supabase.from("students").update(dbData).eq("id", id);
      if (retryErr) {
        return { success: false, error: retryErr.message };
      }
    } else if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/students");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "학생 수정 실패";
    return { success: false, error: msg };
  }
}

export async function updateStudentRegistrationDate(id: string, registrationDate: string | null) {
  try {
    const supabase = await createClient();

    // registration_date 컬럼 저장 시도
    const { error } = await supabase
      .from("students")
      .update({ registration_date: registrationDate || null })
      .eq("id", id);

    if (error && isColumnNotFoundError(error)) {
      // 컬럼 없음 → DB 마이그레이션 필요
      return {
        success: false,
        error: "DB에 registration_date 컬럼이 없습니다. Supabase SQL Editor에서 실행: ALTER TABLE students ADD COLUMN registration_date TEXT;",
      };
    } else if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/students");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "등록일 수정 실패";
    return { success: false, error: msg };
  }
}

export async function deleteStudent(id: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("students").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/students");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "학생 삭제 실패";
    return { success: false, error: msg };
  }
}
