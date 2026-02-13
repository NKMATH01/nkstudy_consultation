"use server";

import { createClient } from "@/lib/supabase/server";
import { consultationFormSchema } from "@/lib/validations/consultation";
import type {
  Consultation,
  ConsultationFilters,
  PaginatedResponse,
} from "@/types";
import { revalidatePath } from "next/cache";

export async function getConsultations(
  filters: ConsultationFilters = {}
): Promise<PaginatedResponse<Consultation>> {
  const supabase = await createClient();
  const { page = 1, limit = 20, startDate, endDate, status, search } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("consultations")
    .select("*", { count: "exact" })
    .order("consult_date", { ascending: false, nullsFirst: false })
    .order("consult_time", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (startDate) {
    query = query.gte("consult_date", startDate);
  }
  if (endDate) {
    query = query.lte("consult_date", endDate);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("상담 목록 조회 실패:", error.message);
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  const total = count ?? 0;

  return {
    data: (data as Consultation[]) ?? [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getConsultation(
  id: string
): Promise<Consultation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return data as Consultation;
}

export async function createConsultation(formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      school: formData.get("school") || undefined,
      grade: formData.get("grade") || undefined,
      parent_phone: formData.get("parent_phone") || undefined,
      consult_date: formData.get("consult_date") || undefined,
      consult_time: formData.get("consult_time") || undefined,
      subject: formData.get("subject") || undefined,
      location: formData.get("location") || undefined,
      consult_type: formData.get("consult_type") || "유선 상담",
      memo: formData.get("memo") || undefined,
      prev_academy: formData.get("prev_academy") || undefined,
      prev_complaint: formData.get("prev_complaint") || undefined,
      school_score: formData.get("school_score") || undefined,
      test_score: formData.get("test_score") || undefined,
      advance_level: formData.get("advance_level") || undefined,
      study_goal: formData.get("study_goal") || undefined,
      prefer_days: formData.get("prefer_days") || undefined,
      plan_date: formData.get("plan_date") || undefined,
      plan_class: formData.get("plan_class") || undefined,
      requests: formData.get("requests") || undefined,
      student_consult_note: formData.get("student_consult_note") || undefined,
    };

    const parsed = consultationFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { data, error } = await supabase
      .from("consultations")
      .insert({
        name: parsed.data.name,
        school: parsed.data.school || null,
        grade: parsed.data.grade || null,
        parent_phone: parsed.data.parent_phone || null,
        consult_date: parsed.data.consult_date || null,
        consult_time: parsed.data.consult_time || null,
        subject: parsed.data.subject || null,
        location: parsed.data.location || null,
        consult_type: parsed.data.consult_type,
        memo: parsed.data.memo || null,
        prev_academy: parsed.data.prev_academy || null,
        prev_complaint: parsed.data.prev_complaint || null,
        school_score: parsed.data.school_score || null,
        test_score: parsed.data.test_score || null,
        advance_level: parsed.data.advance_level || null,
        study_goal: parsed.data.study_goal || null,
        prefer_days: parsed.data.prefer_days || null,
        plan_date: parsed.data.plan_date || null,
        plan_class: parsed.data.plan_class || null,
        requests: parsed.data.requests || null,
        student_consult_note: parsed.data.student_consult_note || null,
      })
      .select()
      .single();

    if (error) {
      // TODO: Sentry 등 외부 로깅 서비스로 교체 가능
      console.error("[DB] 상담 등록 실패:", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/consultations");
    return { success: true, data };
  } catch (e) {
    console.error("[상담] 등록 중 예외:", e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : "상담 등록 실패";
    return { success: false, error: msg };
  }
}

export async function updateConsultation(id: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const raw = {
      name: formData.get("name"),
      school: formData.get("school") || undefined,
      grade: formData.get("grade") || undefined,
      parent_phone: formData.get("parent_phone") || undefined,
      consult_date: formData.get("consult_date") || undefined,
      consult_time: formData.get("consult_time") || undefined,
      subject: formData.get("subject") || undefined,
      location: formData.get("location") || undefined,
      consult_type: formData.get("consult_type") || "유선 상담",
      memo: formData.get("memo") || undefined,
      prev_academy: formData.get("prev_academy") || undefined,
      prev_complaint: formData.get("prev_complaint") || undefined,
      school_score: formData.get("school_score") || undefined,
      test_score: formData.get("test_score") || undefined,
      advance_level: formData.get("advance_level") || undefined,
      study_goal: formData.get("study_goal") || undefined,
      prefer_days: formData.get("prefer_days") || undefined,
      plan_date: formData.get("plan_date") || undefined,
      plan_class: formData.get("plan_class") || undefined,
      requests: formData.get("requests") || undefined,
      student_consult_note: formData.get("student_consult_note") || undefined,
    };

    const parsed = consultationFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { data, error } = await supabase
      .from("consultations")
      .update({
        name: parsed.data.name,
        school: parsed.data.school || null,
        grade: parsed.data.grade || null,
        parent_phone: parsed.data.parent_phone || null,
        consult_date: parsed.data.consult_date || null,
        consult_time: parsed.data.consult_time || null,
        subject: parsed.data.subject || null,
        location: parsed.data.location || null,
        consult_type: parsed.data.consult_type,
        memo: parsed.data.memo || null,
        prev_academy: parsed.data.prev_academy || null,
        prev_complaint: parsed.data.prev_complaint || null,
        school_score: parsed.data.school_score || null,
        test_score: parsed.data.test_score || null,
        advance_level: parsed.data.advance_level || null,
        study_goal: parsed.data.study_goal || null,
        prefer_days: parsed.data.prefer_days || null,
        plan_date: parsed.data.plan_date || null,
        plan_class: parsed.data.plan_class || null,
        requests: parsed.data.requests || null,
        student_consult_note: parsed.data.student_consult_note || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[DB] 상담 수정 실패:", { id, error: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/consultations");
    revalidatePath(`/consultations/${id}`);
    return { success: true, data };
  } catch (e) {
    console.error("[상담] 수정 중 예외:", { id, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "상담 수정 실패";
    return { success: false, error: msg };
  }
}

export async function deleteConsultation(id: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("consultations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[DB] 상담 삭제 실패:", { id, error: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/consultations");
    return { success: true };
  } catch (e) {
    console.error("[상담] 삭제 중 예외:", { id, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "상담 삭제 실패";
    return { success: false, error: msg };
  }
}

export async function updateConsultationStatus(
  id: string,
  status: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultations")
    .update({ status })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/consultations");
  revalidatePath(`/consultations/${id}`);
  return { success: true };
}

// 보안: 동적 업데이트 허용 필드 화이트리스트
const ALLOWED_UPDATE_FIELDS = [
  "doc_sent", "call_done", "notify_sent", "consult_done",
  "reserve_text_sent", "reserve_deposit", "status", "result_status",
  "memo", "attitude", "willingness", "parent_level", "student_level",
  "prev_academy", "school_score", "test_score", "plan_date", "plan_class",
  "prefer_days", "requests", "payment_type", "prev_complaint", "referral",
  "has_friend", "advance_level", "study_goal",
  "student_consult_note", "parent_consult_note",
  "test_fee_paid", "test_fee_method"
] as const;

export async function updateConsultationField(
  id: string,
  field: string,
  value: string | boolean
) {
  try {
    // 보안: 허용되지 않은 필드 업데이트 차단
    if (!ALLOWED_UPDATE_FIELDS.includes(field as typeof ALLOWED_UPDATE_FIELDS[number])) {
      return { success: false, error: "허용되지 않은 필드입니다" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("consultations")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/consultations");
    revalidatePath(`/consultations/${id}`);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "필드 업데이트 실패";
    return { success: false, error: msg };
  }
}

// ========== 카카오톡 텍스트 파싱 ==========
export async function parseAndCreateConsultations(text: string) {
  try {
    const supabase = await createClient();

    if (!text || text.trim() === "") {
      return { success: false, count: 0, error: "텍스트가 비어있습니다" };
    }

    const blocks = text.split("[NK test 안내]");
    const results: Consultation[] = [];

    for (const block of blocks) {
      if (!block || block.trim() === "") continue;

      // 이름 추출
      const nameMatch = block.match(/이름\s*[:：]\s*([^\n]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      // 연락처 - "학부모"/"연락처" 필드 우선 확인 (계좌번호 오매칭 방지)
      let parentPhone = "";
      const phoneFieldMatch = block.match(
        /(?:학부모|연락처|전화|핸드폰)\s*[:：]\s*(\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/
      );
      if (phoneFieldMatch) {
        parentPhone = phoneFieldMatch[1].replace(/[-\s]/g, "");
      } else {
        const phoneMatch = block.match(/(\d{3}[-\s]?\d{4}[-\s]?\d{4})/);
        if (phoneMatch) parentPhone = phoneMatch[1].replace(/[-\s]/g, "");
      }

      // 학교/학년
      let school = "";
      let grade = "초6";
      const schoolMatch = block.match(/학교\s*[:：]\s*([^\n]+)/);
      if (schoolMatch) {
        const schoolRaw = schoolMatch[1].trim();
        const gradeMatch2 = schoolRaw.match(/(.+?)(초|중|고)(\d)/);
        if (gradeMatch2) {
          school = gradeMatch2[1].trim();
          grade = gradeMatch2[2] + gradeMatch2[3];
        } else {
          const gradeMatch = schoolRaw.match(/(초|중|고)(\d)/);
          if (gradeMatch) {
            grade = gradeMatch[1] + gradeMatch[2];
            school = schoolRaw
              .replace(/\([^)]*\)/g, "")
              .replace(/(초|중|고)\d/g, "")
              .trim();
          } else {
            school = schoolRaw;
          }
        }
      }

      // 날짜/시간
      const today = new Date();
      let dateStr = today.toISOString().split("T")[0];
      let timeStr = "18:00";

      const dateMatch = block.match(/일시\s*[:：]\s*([^\n]+)/);
      if (dateMatch) {
        const dateRaw = dateMatch[1];

        const mdMatch = dateRaw.match(/(\d+)월\s*(\d+)일/);
        if (mdMatch) {
          const year = today.getFullYear();
          const mon = parseInt(mdMatch[1]);
          const day = parseInt(mdMatch[2]);
          // 날짜 유효성 검증: 월 1-12, 일 1-31, Date 객체 확인
          if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
            const testDate = new Date(year, mon - 1, day);
            if (testDate.getMonth() === mon - 1 && testDate.getDate() === day) {
              dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            }
            // else: invalid date, falls through to use today's date
          }
        }

        const timeMatch2 = dateRaw.match(/(오전|오후)?\s*(\d+)(?:시|:)(\d*)/);
        if (timeMatch2) {
          let hour = parseInt(timeMatch2[2]);
          const min = timeMatch2[3] ? parseInt(timeMatch2[3]) : 0;

          if (timeMatch2[1] === "오후" && hour < 12) hour += 12;
          else if (!timeMatch2[1] && hour >= 1 && hour <= 8) hour += 12;

          timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        }
      }

      // 과목
      let subject = "";
      const subjectMatch = block.match(/테스트\s*과목\s*[:：]\s*([^\n]+)/);
      if (subjectMatch) subject = subjectMatch[1].trim();

      // 장소
      let location = "NK학원(폴리타운 B동 4층)";
      const locMatch = block.match(/위치\s*[:：]\s*([^\n]+)/);
      if (locMatch) {
        const loc = locMatch[1];
        if (loc.includes("자이") || loc.includes("801")) {
          location = "자이센터프라자 801호";
        } else if (loc.includes("7층")) {
          location = "NK학원(폴리타운 A동 7층)";
        }
      }

      // 상담 방식 - "유선/전화" 키워드 또는 시간 패턴으로 판별
      let consultType = "유선 상담";
      const consultMatch = block.match(
        /학부모님\s*상담\s*[:：]\s*([^\n]+)/i
      );
      if (consultMatch) {
        const consultRaw = consultMatch[1];
        const consultLower = consultRaw.toLowerCase();
        if (consultLower.includes("유선") || consultLower.includes("전화")) {
          consultType = "유선 상담";
        } else {
          // "대면" 키워드 또는 시간 패턴(예: "3시에 진행")이 있으면 대면상담
          const faceTimeMatch = consultRaw.match(/(오전|오후)?\s*(\d+)\s*(?:시|:)\s*(\d*)/);
          if (consultLower.includes("대면") || faceTimeMatch) {
            if (faceTimeMatch) {
              let fHour = parseInt(faceTimeMatch[2]);
              const fMin = faceTimeMatch[3] ? parseInt(faceTimeMatch[3]) : 0;
              if (faceTimeMatch[1] === "오후" && fHour < 12) fHour += 12;
              else if (!faceTimeMatch[1] && fHour >= 1 && fHour <= 8) fHour += 12;
              consultType = `대면 (${String(fHour).padStart(2, "0")}:${String(fMin).padStart(2, "0")})`;
            } else {
              consultType = "대면 상담";
            }
          }
        }
      }

      // DB 삽입
      const { data, error } = await supabase
        .from("consultations")
        .insert({
          name,
          school: school || null,
          grade,
          parent_phone: parentPhone || null,
          consult_date: dateStr,
          consult_time: timeStr,
          subject: subject || null,
          location,
          consult_type: consultType,
          reserve_text_sent: true,
        })
        .select()
        .single();

      if (!error && data) {
        results.push(data as Consultation);
      }
    }

    revalidatePath("/consultations");
    return {
      success: true,
      count: results.length,
      data: results,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "텍스트 파싱 실패";
    return { success: false, count: 0, error: msg };
  }
}
