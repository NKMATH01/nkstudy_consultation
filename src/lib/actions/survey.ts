"use server";

import { createClient } from "@/lib/supabase/server";
import { surveyFormSchema } from "@/lib/validations/survey";
import { calculateFactors } from "@/lib/factors";
import type { Survey, PaginatedResponse } from "@/types";
import { revalidatePath } from "next/cache";

// ========== 설문 목록 조회 ==========
export async function getSurveys(
  filters: { search?: string; page?: number; limit?: number } = {}
): Promise<PaginatedResponse<Survey>> {
  const supabase = await createClient();
  const { page = 1, limit = 20, search } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("surveys")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("설문 목록 조회 실패:", error.message);
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  const total = count ?? 0;

  return {
    data: (data as Survey[]) ?? [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ========== 설문 단건 조회 ==========
export async function getSurvey(id: string): Promise<Survey | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return data as Survey;
}

// ========== 설문 등록 ==========
export async function createSurvey(formData: FormData) {
  try {
    const supabase = await createClient();

    const raw: Record<string, unknown> = {};
    raw.name = formData.get("name");
    raw.school = formData.get("school") || undefined;
    raw.grade = formData.get("grade") || undefined;
    raw.student_phone = formData.get("student_phone") || undefined;
    raw.parent_phone = formData.get("parent_phone") || undefined;
    raw.referral = formData.get("referral") || undefined;
    raw.prev_academy = formData.get("prev_academy") || undefined;
    raw.prev_complaint = formData.get("prev_complaint") || undefined;

    for (let i = 1; i <= 30; i++) {
      const val = formData.get(`q${i}`);
      raw[`q${i}`] = val ? Number(val) : undefined;
    }

    raw.study_core = formData.get("study_core") || undefined;
    raw.problem_self = formData.get("problem_self") || undefined;
    raw.dream = formData.get("dream") || undefined;
    raw.prefer_days = formData.get("prefer_days") || undefined;
    raw.requests = formData.get("requests") || undefined;

    const parsed = surveyFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    // 6-Factor 계산
    const qValues: Record<string, number | undefined | null> = {};
    for (let i = 1; i <= 30; i++) {
      qValues[`q${i}`] = parsed.data[`q${i}` as keyof typeof parsed.data] as number | undefined | null;
    }
    const factors = calculateFactors(qValues);

    const insertData: Record<string, unknown> = {
      name: parsed.data.name,
      school: parsed.data.school || null,
      grade: parsed.data.grade || null,
      student_phone: parsed.data.student_phone || null,
      parent_phone: parsed.data.parent_phone || null,
      referral: parsed.data.referral || null,
      prev_academy: parsed.data.prev_academy || null,
      prev_complaint: parsed.data.prev_complaint || null,
      study_core: parsed.data.study_core || null,
      problem_self: parsed.data.problem_self || null,
      dream: parsed.data.dream || null,
      prefer_days: parsed.data.prefer_days || null,
      requests: parsed.data.requests || null,
      ...factors,
    };

    for (let i = 1; i <= 30; i++) {
      const key = `q${i}` as keyof typeof parsed.data;
      insertData[`q${i}`] = parsed.data[key] ?? null;
    }

    const { data, error } = await supabase
      .from("surveys")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[DB] 설문 등록 실패:", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/surveys");
    return { success: true, data };
  } catch (e) {
    console.error("[설문] 등록 중 예외:", e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : "설문 등록 실패";
    return { success: false, error: msg };
  }
}

// ========== 설문 삭제 ==========
export async function deleteSurvey(id: string) {
  try {
    const supabase = await createClient();

    // 연결된 분석이 있으면 함께 삭제
    const { data: survey } = await supabase
      .from("surveys")
      .select("analysis_id")
      .eq("id", id)
      .single();

    if (survey?.analysis_id) {
      await supabase.from("analyses").delete().eq("id", survey.analysis_id);
    }

    const { error } = await supabase.from("surveys").delete().eq("id", id);

    if (error) {
      console.error("[DB] 설문 삭제 실패:", { id, error: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/surveys");
    revalidatePath("/analyses");
    return { success: true };
  } catch (e) {
    console.error("[설문] 삭제 중 예외:", { id, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "설문 삭제 실패";
    return { success: false, error: msg };
  }
}
