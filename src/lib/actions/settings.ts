"use server";

import { createClient } from "@/lib/supabase/server";
import { classFormSchema, teacherFormSchema } from "@/lib/validations/class";
import type { Class, Teacher } from "@/types";
import { revalidatePath } from "next/cache";

// ========== 반 관리 ==========

export async function getClasses(): Promise<Class[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Class[]) ?? [];
}

export async function createClass(formData: FormData) {
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

  const { error } = await supabase.from("classes").insert({
    name: parsed.data.name,
    teacher: parsed.data.teacher || null,
    target_grade: parsed.data.target_grade || null,
    class_days: parsed.data.class_days || null,
    class_time: parsed.data.class_time || null,
    clinic_time: parsed.data.clinic_time || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updateClass(id: string, formData: FormData) {
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

  const { error } = await supabase
    .from("classes")
    .update({
      name: parsed.data.name,
      teacher: parsed.data.teacher || null,
      target_grade: parsed.data.target_grade || null,
      class_days: parsed.data.class_days || null,
      class_time: parsed.data.class_time || null,
      clinic_time: parsed.data.clinic_time || null,
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteClass(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("classes").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

// ========== 선생님 관리 ==========

export async function getTeachers(): Promise<Teacher[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Teacher[]) ?? [];
}

export async function createTeacher(formData: FormData) {
  const supabase = await createClient();

  const raw = {
    name: formData.get("name"),
    subject: formData.get("subject") || undefined,
    target_grade: formData.get("target_grade") || undefined,
    phone: formData.get("phone") || undefined,
  };

  const parsed = teacherFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.from("teachers").insert({
    name: parsed.data.name,
    subject: parsed.data.subject || null,
    target_grade: parsed.data.target_grade || null,
    phone: parsed.data.phone || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updateTeacher(id: string, formData: FormData) {
  const supabase = await createClient();

  const raw = {
    name: formData.get("name"),
    subject: formData.get("subject") || undefined,
    target_grade: formData.get("target_grade") || undefined,
    phone: formData.get("phone") || undefined,
  };

  const parsed = teacherFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("teachers")
    .update({
      name: parsed.data.name,
      subject: parsed.data.subject || null,
      target_grade: parsed.data.target_grade || null,
      phone: parsed.data.phone || null,
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteTeacher(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("teachers").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}
