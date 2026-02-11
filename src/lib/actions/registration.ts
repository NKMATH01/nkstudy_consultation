"use server";

import { createClient } from "@/lib/supabase/server";
import {
  callGeminiAPI,
  extractJSON,
  surveyToText,
  buildRegistrationPrompt,
} from "@/lib/gemini";
import type { AdminData } from "@/lib/gemini";
import type { Registration, Analysis, Survey, PaginatedResponse } from "@/types";
import { TUITION_TABLE } from "@/types";
import { revalidatePath } from "next/cache";

// ========== 등록 안내 목록 조회 ==========
export async function getRegistrations(
  filters: { search?: string; page?: number; limit?: number } = {}
): Promise<PaginatedResponse<Registration>> {
  const supabase = await createClient();
  const { page = 1, limit = 20, search } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("registrations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;

  return {
    data: (data as Registration[]) ?? [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ========== 등록 안내 단건 조회 ==========
export async function getRegistration(id: string): Promise<Registration | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return data as Registration;
}

// ========== 등록 안내문 생성 (분석 결과 → Gemini) ==========
export async function generateRegistration(
  analysisId: string,
  adminFormData: {
    registration_date: string;
    assigned_class: string;
    teacher: string;
    use_vehicle?: string;
    test_score?: string;
    test_note?: string;
    location?: string;
    consult_date?: string;
    additional_note?: string;
    tuition_fee?: number;
  }
) {
  const supabase = await createClient();

  // 1. 분석 결과 조회
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", analysisId)
    .single();

  if (analysisError || !analysis) {
    return { success: false, error: "분석 결과를 찾을 수 없습니다" };
  }

  const analysisData = analysis as Analysis;

  // 2. 설문 데이터 조회
  let surveyData: Survey | null = null;
  if (analysisData.survey_id) {
    const { data: survey } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", analysisData.survey_id)
      .single();
    surveyData = survey as Survey | null;
  }

  if (!surveyData) {
    return { success: false, error: "설문 데이터를 찾을 수 없습니다" };
  }

  // 3. 수업료 계산
  const tuitionFee =
    adminFormData.tuition_fee ||
    TUITION_TABLE[analysisData.grade || ""] ||
    0;

  // 4. Gemini 프롬프트 생성 + 호출
  const surveyText = surveyToText(surveyData);
  const adminData: AdminData = {
    registrationDate: adminFormData.registration_date,
    assignedClass: adminFormData.assigned_class,
    teacher: adminFormData.teacher,
    useVehicle: adminFormData.use_vehicle || "미사용",
    testScore: adminFormData.test_score || "",
    testNote: adminFormData.test_note || "",
    location: adminFormData.location || "",
    consultDate: adminFormData.consult_date || "",
    additionalNote: adminFormData.additional_note || "",
    tuitionFee,
  };

  const prompt = buildRegistrationPrompt(surveyText, analysisData, adminData);

  let reportData: Record<string, unknown>;
  try {
    const response = await callGeminiAPI(prompt);
    reportData = extractJSON(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "등록 안내문 생성 실패";
    return { success: false, error: msg };
  }

  // 5. DB 저장
  const insertData = {
    analysis_id: analysisId,
    name: analysisData.name,
    school: analysisData.school,
    grade: analysisData.grade,
    student_phone: surveyData.student_phone,
    parent_phone: surveyData.parent_phone,
    registration_date: adminFormData.registration_date,
    assigned_class: adminFormData.assigned_class,
    teacher: adminFormData.teacher,
    use_vehicle: adminFormData.use_vehicle || null,
    test_score: adminFormData.test_score || null,
    test_note: adminFormData.test_note || null,
    location: adminFormData.location || null,
    consult_date: adminFormData.consult_date || null,
    additional_note: adminFormData.additional_note || null,
    tuition_fee: tuitionFee,
    report_data: reportData,
  };

  const { data: registration, error: insertError } = await supabase
    .from("registrations")
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath("/registrations");
  revalidatePath("/analyses");
  return { success: true, data: registration };
}

// ========== 등록 안내 삭제 ==========
export async function deleteRegistration(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("registrations").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/registrations");
  return { success: true };
}
