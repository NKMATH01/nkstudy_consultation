"use server";

import { createClient } from "@/lib/supabase/server";
import {
  callClaudeAPI,
  surveyToText,
  buildRegistrationPrompt,
  buildReportHTML,
  type RegistrationAdminData,
  type ReportTemplateData,
} from "@/lib/claude";
import { extractJSON } from "@/lib/gemini";
import type { Registration, Analysis, Survey, PaginatedResponse } from "@/types";
import { TUITION_TABLE } from "@/types";
import { revalidatePath } from "next/cache";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토"] as const;

/** 파이프 구분 class_days + weekly_test_time에서 테스트 요일 추출 */
function parseTestDaysFromClass(classDays?: string | null, weeklyTestTime?: string | null): string | undefined {
  if (!classDays || !weeklyTestTime) return undefined;
  const daysSets = classDays.split("|");
  const testSets = weeklyTestTime.split("|");
  let testDaysStr = "";
  daysSets.forEach((days, i) => {
    if (testSets[i]?.includes("~")) testDaysStr += days;
  });
  const sorted = WEEKDAYS.filter((d) => testDaysStr.includes(d)).join("");
  return sorted || undefined;
}

/** 파이프 구분 시간 문자열에서 첫 번째 유효 시간 추출 */
function parseFirstTime(timeStr?: string | null): string | undefined {
  if (!timeStr) return undefined;
  const first = timeStr.split("|").find((t) => t.includes("~"));
  return first || undefined;
}

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
    console.error("등록 목록 조회 실패:", error.message);
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
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

// ========== 등록 안내문 생성 (분석 결과 → Claude Haiku) ==========
export async function generateRegistration(
  analysisId: string,
  adminFormData: {
    registration_date: string;
    grade: string;
    subject: string;
    preferred_days: string;
    assigned_class: string;
    teacher: string;
    math_class_days?: string;
    math_class_time: string;
    math_clinic_time: string;
    assigned_class_2?: string;
    teacher_2?: string;
    eng_class_days?: string;
    eng_class_time?: string;
    eng_clinic_time?: string;
    math_test_days?: string;
    math_test_time?: string;
    eng_test_days?: string;
    eng_test_time?: string;
    use_vehicle?: string;
    test_score?: string;
    test_note?: string;
    school_score?: string;
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
    TUITION_TABLE[adminFormData.grade || analysisData.grade || ""] ||
    0;

  // 4. 반 시간표 정보 (폼에서 이미 파싱된 데이터 사용, 폴백으로 DB 조회)
  let classInfo: { class_days: string | null; class_time: string | null; clinic_time: string | null; test_days: string | null; test_time: string | null } | null = null;
  let classInfo2: { class_days: string | null; class_time: string | null; clinic_time: string | null; test_days: string | null; test_time: string | null } | null = null;

  if (adminFormData.assigned_class) {
    const { data: cls } = await supabase
      .from("classes")
      .select("description, class_time, clinic_time, weekly_test_time")
      .eq("name", adminFormData.assigned_class)
      .single();
    if (cls) {
      const raw = cls as Record<string, unknown>;
      classInfo = { class_days: raw.description as string | null, class_time: cls.class_time, clinic_time: cls.clinic_time, test_days: null, test_time: raw.weekly_test_time as string | null };
    }
  }

  if (adminFormData.subject === "영어수학" && adminFormData.assigned_class_2) {
    const { data: cls2 } = await supabase
      .from("classes")
      .select("description, class_time, clinic_time, weekly_test_time")
      .eq("name", adminFormData.assigned_class_2)
      .single();
    if (cls2) {
      const raw2 = cls2 as Record<string, unknown>;
      classInfo2 = { class_days: raw2.description as string | null, class_time: cls2.class_time, clinic_time: cls2.clinic_time, test_days: null, test_time: raw2.weekly_test_time as string | null };
    }
  }

  // 5. Claude 프롬프트 생성 + 호출
  const surveyText = surveyToText(surveyData);
  const adminData: RegistrationAdminData = {
    registrationDate: adminFormData.registration_date,
    assignedClass: adminFormData.assigned_class,
    teacher: adminFormData.teacher,
    assignedClass2: adminFormData.assigned_class_2 || undefined,
    teacher2: adminFormData.teacher_2 || undefined,
    subject: adminFormData.subject,
    preferredDays: adminFormData.preferred_days,
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
    const response = await callClaudeAPI(prompt);
    reportData = extractJSON(response);
  } catch (e) {
    console.error("[Claude API] 등록 안내문 생성 실패:", { analysisId, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "등록 안내문 생성 실패";
    return { success: false, error: msg };
  }

  // 6. HTML 보고서 생성
  const page1Data = (reportData.page1 || {}) as ReportTemplateData["page1"];
  const page2Data = (reportData.page2 || {}) as ReportTemplateData["page2"];

  const templateData: ReportTemplateData = {
    name: analysisData.name,
    school: analysisData.school || "",
    grade: adminFormData.grade || analysisData.grade || "",
    studentPhone: surveyData.student_phone || "",
    parentPhone: surveyData.parent_phone || "",
    registrationDate: adminFormData.registration_date,
    assignedClass: adminFormData.assigned_class,
    teacher: adminFormData.teacher,
    assignedClass2: adminFormData.assigned_class_2 || undefined,
    teacher2: adminFormData.teacher_2 || undefined,
    subject: adminFormData.subject,
    preferredDays: adminFormData.preferred_days,
    useVehicle: adminFormData.use_vehicle || "미사용",
    location: adminFormData.location || "",
    tuitionFee,
    page1: {
      docNo: page1Data.docNo || "",
      deptLabel: page1Data.deptLabel || "",
      profileSummary: page1Data.profileSummary || "",
      studentBackground: page1Data.studentBackground || undefined,
      sixFactorScores: page1Data.sixFactorScores || undefined,
      tendencyAnalysis: page1Data.tendencyAnalysis || [],
      managementGuide: page1Data.managementGuide || [],
      firstMonthPlan: page1Data.firstMonthPlan || undefined,
      actionChecklist: page1Data.actionChecklist || [],
    },
    page2: {
      welcomeTitle: page2Data.welcomeTitle || "",
      welcomeSubtitle: page2Data.welcomeSubtitle || "",
      expertDiagnosis: page2Data.expertDiagnosis || "",
      focusPoints: page2Data.focusPoints || [],
      parentMessage: page2Data.parentMessage || undefined,
      academyRules: page2Data.academyRules || undefined,
    },
    classDays: adminFormData.math_class_days && adminFormData.math_class_days !== "N/A" ? adminFormData.math_class_days : classInfo?.class_days || adminFormData.preferred_days || undefined,
    classTime: adminFormData.math_class_time && adminFormData.math_class_time !== "N/A" ? adminFormData.math_class_time : classInfo?.class_time || undefined,
    clinicTime: adminFormData.math_clinic_time && adminFormData.math_clinic_time !== "N/A" ? adminFormData.math_clinic_time : classInfo?.clinic_time || undefined,
    testDays: adminFormData.math_test_days || undefined,
    testTime: adminFormData.math_test_time || undefined,
    classDays2: adminFormData.eng_class_days || classInfo2?.class_days || adminFormData.preferred_days || undefined,
    classTime2: adminFormData.eng_class_time || classInfo2?.class_time || undefined,
    clinicTime2: adminFormData.eng_clinic_time || classInfo2?.clinic_time || undefined,
    testDays2: adminFormData.eng_test_days || undefined,
    testTime2: adminFormData.eng_test_time || undefined,
  };

  let reportHTML: string;
  try {
    reportHTML = buildReportHTML(templateData);
  } catch (e) {
    console.error("[Template] HTML 생성 실패:", e instanceof Error ? e.message : e);
    reportHTML = "";
  }

  // 7. DB 저장
  const insertData = {
    analysis_id: analysisId,
    name: analysisData.name,
    school: analysisData.school,
    grade: adminFormData.grade || analysisData.grade,
    student_phone: surveyData.student_phone,
    parent_phone: surveyData.parent_phone,
    registration_date: adminFormData.registration_date,
    assigned_class: adminFormData.assigned_class,
    teacher: adminFormData.teacher,
    assigned_class_2: adminFormData.assigned_class_2 || null,
    teacher_2: adminFormData.teacher_2 || null,
    subject: adminFormData.subject,
    preferred_days: adminFormData.preferred_days,
    use_vehicle: adminFormData.use_vehicle || null,
    test_score: adminFormData.test_score || null,
    test_note: adminFormData.test_note || null,
    location: adminFormData.location || null,
    consult_date: adminFormData.consult_date || null,
    additional_note: [
      adminFormData.school_score ? `[내신] ${adminFormData.school_score}` : "",
      adminFormData.additional_note || "",
    ].filter(Boolean).join("\n") || null,
    tuition_fee: tuitionFee,
    report_data: reportData,
    report_html: reportHTML,
  };

  const { data: registration, error: insertError } = await supabase
    .from("registrations")
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    console.error("[DB] 등록 안내 저장 실패:", { analysisId, error: insertError.message });
    return { success: false, error: insertError.message };
  }

  // 8. 학생 관리에 자동 등록/업데이트
  try {
    // 선생님 이름 → teacher_id 조회
    let teacherId: string | null = null;
    if (adminFormData.teacher) {
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("name", adminFormData.teacher)
        .limit(1)
        .maybeSingle();
      teacherId = teacherRow?.id || null;
    }

    // 기존 학생 확인 (이름 기준)
    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("name", analysisData.name)
      .limit(1)
      .maybeSingle();

    const studentData: Record<string, unknown> = {
      name: analysisData.name,
      school: analysisData.school || null,
      grade: adminFormData.grade || analysisData.grade || null,
      phone: surveyData.student_phone || null,
      parent_phone: surveyData.parent_phone || null,
      class_name: adminFormData.assigned_class || null,
      teacher_id: teacherId,
      is_active: true,
      registration_date: adminFormData.registration_date || null,
    };

    if (existingStudent) {
      await supabase
        .from("students")
        .update(studentData)
        .eq("id", existingStudent.id);
    } else {
      await supabase.from("students").insert(studentData);
    }
  } catch (e) {
    console.error("[Student] 학생 자동 등록/업데이트 실패:", e instanceof Error ? e.message : e);
  }

  revalidatePath("/registrations");
  revalidatePath("/analyses");
  revalidatePath("/surveys");
  revalidatePath("/settings/students");
  revalidatePath("/onboarding");
  return { success: true, data: registration };
}

// ========== 등록 안내 보고서 재생성 ==========
export async function regenerateRegistration(id: string) {
  const supabase = await createClient();

  // 1. 기존 등록 데이터 조회
  const { data: reg, error: regError } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", id)
    .single();

  if (regError || !reg) {
    return { success: false, error: "등록 안내를 찾을 수 없습니다" };
  }

  const registration = reg as Registration;

  if (!registration.analysis_id) {
    return { success: false, error: "연결된 분석 결과가 없습니다" };
  }

  // 2. 분석 결과 조회
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", registration.analysis_id)
    .single();

  if (analysisError || !analysis) {
    return { success: false, error: "분석 결과를 찾을 수 없습니다" };
  }

  const analysisData = analysis as Analysis;

  // 3. 설문 데이터 조회
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

  // 4. 반 시간표 정보 조회 (DB 컬럼: description→class_days, is_active→active)
  let classInfo: { class_days: string | null; class_time: string | null; clinic_time: string | null; weekly_test_time: string | null } | null = null;
  let classInfo2: { class_days: string | null; class_time: string | null; clinic_time: string | null; weekly_test_time: string | null } | null = null;

  if (registration.assigned_class) {
    const { data: cls } = await supabase
      .from("classes")
      .select("description, class_time, clinic_time, weekly_test_time")
      .eq("name", registration.assigned_class)
      .single();
    if (cls) {
      const raw = cls as Record<string, unknown>;
      classInfo = { class_days: raw.description as string | null, class_time: cls.class_time, clinic_time: cls.clinic_time, weekly_test_time: raw.weekly_test_time as string | null };
    }
  }

  if (registration.subject === "영어수학" && registration.assigned_class_2) {
    const { data: cls2 } = await supabase
      .from("classes")
      .select("description, class_time, clinic_time, weekly_test_time")
      .eq("name", registration.assigned_class_2)
      .single();
    if (cls2) {
      const raw2 = cls2 as Record<string, unknown>;
      classInfo2 = { class_days: raw2.description as string | null, class_time: cls2.class_time, clinic_time: cls2.clinic_time, weekly_test_time: raw2.weekly_test_time as string | null };
    }
  }

  // 5. Claude 프롬프트 생성 + 호출
  const surveyText = surveyToText(surveyData);
  const adminData: RegistrationAdminData = {
    registrationDate: registration.registration_date || "",
    assignedClass: registration.assigned_class || "",
    teacher: registration.teacher || "",
    assignedClass2: registration.assigned_class_2 || undefined,
    teacher2: registration.teacher_2 || undefined,
    subject: registration.subject || "",
    preferredDays: registration.preferred_days || "",
    useVehicle: registration.use_vehicle || "미사용",
    testScore: registration.test_score || "",
    testNote: registration.test_note || "",
    location: registration.location || "",
    consultDate: registration.consult_date || "",
    additionalNote: registration.additional_note || "",
    tuitionFee: registration.tuition_fee || 0,
  };

  const prompt = buildRegistrationPrompt(surveyText, analysisData, adminData);

  let reportData: Record<string, unknown>;
  try {
    const response = await callClaudeAPI(prompt);
    reportData = extractJSON(response);
  } catch (e) {
    console.error("[Claude API] 등록 보고서 재생성 실패:", { id, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "보고서 재생성 실패";
    return { success: false, error: msg };
  }

  // 6. HTML 보고서 생성
  const page1Data = (reportData.page1 || {}) as ReportTemplateData["page1"];
  const page2Data = (reportData.page2 || {}) as ReportTemplateData["page2"];

  const templateData: ReportTemplateData = {
    name: registration.name,
    school: registration.school || "",
    grade: registration.grade || "",
    studentPhone: registration.student_phone || "",
    parentPhone: registration.parent_phone || "",
    registrationDate: registration.registration_date || "",
    assignedClass: registration.assigned_class || "",
    teacher: registration.teacher || "",
    assignedClass2: registration.assigned_class_2 || undefined,
    teacher2: registration.teacher_2 || undefined,
    subject: registration.subject || "",
    preferredDays: registration.preferred_days || "",
    useVehicle: registration.use_vehicle || "미사용",
    location: registration.location || "",
    tuitionFee: registration.tuition_fee || 0,
    page1: {
      docNo: page1Data.docNo || "",
      deptLabel: page1Data.deptLabel || "",
      profileSummary: page1Data.profileSummary || "",
      studentBackground: page1Data.studentBackground || undefined,
      sixFactorScores: page1Data.sixFactorScores || undefined,
      tendencyAnalysis: page1Data.tendencyAnalysis || [],
      managementGuide: page1Data.managementGuide || [],
      firstMonthPlan: page1Data.firstMonthPlan || undefined,
      actionChecklist: page1Data.actionChecklist || [],
    },
    page2: {
      welcomeTitle: page2Data.welcomeTitle || "",
      welcomeSubtitle: page2Data.welcomeSubtitle || "",
      expertDiagnosis: page2Data.expertDiagnosis || "",
      focusPoints: page2Data.focusPoints || [],
      parentMessage: page2Data.parentMessage || undefined,
      academyRules: page2Data.academyRules || undefined,
    },
    classDays: classInfo?.class_days || undefined,
    classTime: classInfo?.class_time || undefined,
    clinicTime: classInfo?.clinic_time || undefined,
    testDays: parseTestDaysFromClass(classInfo?.class_days, classInfo?.weekly_test_time),
    testTime: parseFirstTime(classInfo?.weekly_test_time),
    classDays2: classInfo2?.class_days || undefined,
    classTime2: classInfo2?.class_time || undefined,
    clinicTime2: classInfo2?.clinic_time || undefined,
    testDays2: parseTestDaysFromClass(classInfo2?.class_days, classInfo2?.weekly_test_time),
    testTime2: parseFirstTime(classInfo2?.weekly_test_time),
  };

  let reportHTML: string;
  try {
    reportHTML = buildReportHTML(templateData);
  } catch (e) {
    console.error("[Template] HTML 재생성 실패:", e instanceof Error ? e.message : e);
    reportHTML = "";
  }

  // 7. DB 업데이트
  const { error: updateError } = await supabase
    .from("registrations")
    .update({
      report_data: reportData,
      report_html: reportHTML,
    })
    .eq("id", id);

  if (updateError) {
    console.error("[DB] 등록 보고서 업데이트 실패:", { id, error: updateError.message });
    return { success: false, error: updateError.message };
  }

  revalidatePath(`/registrations/${id}`);
  revalidatePath("/registrations");
  return { success: true };
}

// ========== 등록 안내 HTML 직접 수정 ==========
export async function updateRegistrationHtml(id: string, html: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("registrations")
    .update({ report_html: html })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/registrations/${id}`);
  revalidatePath("/registrations");
  return { success: true };
}

// ========== AI 초안 수정 ==========
export async function aiEditRegistrationHtml(id: string, instruction: string) {
  const supabase = await createClient();

  // 현재 HTML 조회
  const { data: reg, error: fetchErr } = await supabase
    .from("registrations")
    .select("report_html")
    .eq("id", id)
    .single();

  if (fetchErr || !reg?.report_html) {
    return { success: false, error: "보고서를 찾을 수 없습니다" };
  }

  const currentHtml = reg.report_html as string;

  // Claude에게 수정 요청
  const prompt = `당신은 학원 등록 안내문 HTML을 수정하는 어시스턴트입니다.

아래는 현재 등록 안내문의 HTML입니다:

<current_html>
${currentHtml}
</current_html>

사용자의 수정 요청:
${instruction}

위 요청에 따라 HTML을 수정해주세요.

중요 규칙:
- 전체 HTML 구조(DOCTYPE, head, body, 스타일)를 유지하세요
- 요청된 부분만 정확히 수정하세요
- 수정된 전체 HTML만 반환하세요 (설명 없이)
- 반드시 <!DOCTYPE html>로 시작하세요`;

  try {
    const response = await callClaudeAPI(prompt);

    // HTML 추출 (```html ... ``` 블록이 있으면 추출)
    let editedHtml = response;
    const codeBlockMatch = response.match(/```html?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      editedHtml = codeBlockMatch[1].trim();
    } else if (response.includes("<!DOCTYPE")) {
      editedHtml = response.substring(response.indexOf("<!DOCTYPE")).trim();
    }

    // DB 업데이트
    const { error: updateErr } = await supabase
      .from("registrations")
      .update({ report_html: editedHtml })
      .eq("id", id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath(`/registrations/${id}`);
    revalidatePath("/registrations");
    return { success: true, html: editedHtml };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 수정 실패";
    return { success: false, error: msg };
  }
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
