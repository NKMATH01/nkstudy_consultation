"use server";

import { createClient } from "@/lib/supabase/server";
import { consultationFormSchema } from "@/lib/validations/consultation";
import type {
  Consultation,
  ConsultationFilters,
  PaginatedResponse,
} from "@/types";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  escapeLikePattern,
  selectSurveyConsultation,
} from "@/lib/student-identity";
import { consultTimeToSlot } from "@/lib/booking-slots";
import { roundTimeTo10 } from "@/lib/time-utils";
import { getActorLabel } from "@/lib/actions/booking";
import type { ConsultationEvent } from "@/types";

const BOOKING_SYNC_WARNING = "상담은 저장되었으나 예약 현황판 반영에 실패했습니다";

type ConsultationMutationResult = {
  success: boolean;
  data?: Consultation;
  error?: string;
  warning?: string;
};

function normalizeConsultTypeTime(value: string): string {
  const match = /^(대면 상담)\s+(\d{2}:\d{2}(?::\d{2})?)$/.exec(value);
  if (!match) return value;
  return `${match[1]} ${roundTimeTo10(match[2])}`;
}

// 상담 → 예약 동기화 헬퍼
async function syncConsultationToBooking(consultation: {
  id: string;
  booking_id: string | null;
  name: string;
  consult_date: string | null;
  consult_time: string | null;
  consult_type: string;
  location: string | null;
  subject: string | null;
  parent_phone: string | null;
  school: string | null;
  grade: string | null;
}) {
  if (!consultation.consult_date || !consultation.consult_time) return;

  const slotCode = consultTimeToSlot(
    consultation.consult_date,
    consultation.consult_time,
  );
  if (slotCode === null) {
    console.warn("[Consultation] 슬롯 비대응 시간 — 예약 동기화 생략", {
      name: consultation.name,
      consultDate: consultation.consult_date,
      consultTime: consultation.consult_time,
    });
    return;
  }

  const admin = createAdminClient();

  // consult_type 매핑
  const bookingType = consultation.consult_type?.includes("대면") ? "inperson" : "phone";

  // location + subject → branch 매핑
  let branch = "gojan-math";
  if (consultation.location?.includes("자이")) {
    branch = "zai-both";
  } else if (consultation.subject?.includes("영어")) {
    branch = "gojan-eng";
  }

  // subject 매핑
  let subjectCode = "math";
  if (consultation.subject?.includes("영어수학") || consultation.subject?.includes("영수")) {
    subjectCode = "both";
  } else if (consultation.subject?.includes("영어")) {
    subjectCode = "eng";
  }

  if (consultation.booking_id) {
    const { error } = await admin
      .from("bookings")
      .update({
        booking_date: consultation.consult_date,
        booking_hour: slotCode,
        consult_type: bookingType,
        branch,
        subject: subjectCode,
        phone: consultation.parent_phone || "",
        school: consultation.school || null,
        grade: consultation.grade || null,
      })
      .eq("id", consultation.booking_id);
    if (error) throw error;
    return;
  }

  // booking_id가 없는 레거시 상담만 이름+날짜+시간으로 보조 매칭한다.
  const { data: existing } = await admin
    .from("bookings")
    .select("id")
    .eq("student_name", consultation.name)
    .eq("booking_date", consultation.consult_date)
    .eq("booking_hour", slotCode)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existing && existing.length > 0) {
    // 기존 예약 업데이트
    const { error } = await admin
      .from("bookings")
      .update({
        consult_type: bookingType,
        branch,
        subject: subjectCode,
        phone: consultation.parent_phone || "",
        school: consultation.school || null,
        grade: consultation.grade || null,
      })
      .eq("id", existing[0].id);
    if (error) throw error;

    const { error: linkError } = await admin
      .from("consultations")
      .update({ booking_id: existing[0].id })
      .eq("id", consultation.id);
    if (linkError) throw linkError;
  } else {
    // 새 예약 생성
    const { data: booking, error } = await admin
      .from("bookings")
      .insert({
        student_name: consultation.name,
        parent_name: consultation.name,
        phone: consultation.parent_phone || "",
        booking_date: consultation.consult_date,
        booking_hour: slotCode,
        consult_type: bookingType,
        branch,
        subject: subjectCode,
        school: consultation.school || null,
        grade: consultation.grade || null,
        paid: false,
        pay_method: "later",
      })
      .select("id")
      .single();
    if (error || !booking) throw error ?? new Error("예약 생성 결과가 없습니다.");

    const { error: linkError } = await admin
      .from("consultations")
      .update({ booking_id: booking.id })
      .eq("id", consultation.id);
    if (linkError) throw linkError;
  }
}

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
    .order("created_at", { ascending: false })
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

export async function getConsultationByName(
  name: string,
  identity?: {
    parentPhone?: string | null;
    analysisId?: string | null;
    allowNameFallback?: boolean;
  }
): Promise<Consultation | null> {
  const supabase = await createClient();

  // 분석 ID/학부모 연락처가 있으면 이름만 같은 동명이인의 상담을 절대 반환하지 않는다.
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;

  const fetchRows = async (analysisId?: string | null) => {
    let query = supabase
      .from("consultations")
      .select("*")
      .ilike("name", `${escapeLikePattern(trimmed)}%`)
      .order("consult_date", { ascending: false, nullsFirst: false })
      .order("consult_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (analysisId) query = query.eq("analysis_id", analysisId);
    const result = await query;
    if (result.error) return [];
    return result.data ?? [];
  };

  if (identity?.analysisId) {
    const analysisRows = await fetchRows(identity.analysisId);
    const analysisMatch = selectSurveyConsultation(analysisRows, {
      name: trimmed,
      analysisId: identity.analysisId,
      parentPhone: identity.parentPhone,
    });
    if (analysisMatch) return analysisMatch as Consultation;
  }

  const nameRows = await fetchRows();
  return selectSurveyConsultation(
    nameRows,
    {
      name: trimmed,
      analysisId: identity?.analysisId,
      parentPhone: identity?.parentPhone,
    },
    { allowNameFallback: identity?.allowNameFallback ?? true },
  ) as Consultation | null;
}

export async function getConsultationByLink({
  analysisId,
  registrationId,
}: {
  analysisId?: string | null;
  registrationId?: string | null;
}): Promise<Consultation | null> {
  if (!analysisId && !registrationId) return null;

  const supabase = await createClient();
  let query = supabase.from("consultations").select("*").limit(2);
  if (analysisId) query = query.eq("analysis_id", analysisId);
  if (registrationId) query = query.eq("registration_id", registrationId);

  const { data, error } = await query;
  if (error || !data || data.length !== 1) return null;
  return data[0] as Consultation;
}

type CreateConsultationFromSurveyResult = {
  success: boolean;
  consultation?: Consultation;
  created?: boolean;
  error?: string;
};

export async function createConsultationFromSurvey(
  surveyId: string,
): Promise<CreateConsultationFromSurveyResult> {
  try {
    const supabase = await createClient();
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("name, school, grade, parent_phone, student_phone, analysis_id")
      .eq("id", surveyId)
      .single();

    if (surveyError || !survey) {
      return {
        success: false,
        error: surveyError?.message || "설문을 찾을 수 없습니다.",
      };
    }

    const name = survey.name.trim();
    const { data: candidates, error: candidateError } = await supabase
      .from("consultations")
      .select("*")
      .ilike("name", `${escapeLikePattern(name)}%`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (candidateError) {
      return { success: false, error: candidateError.message };
    }

    const matches = (candidates ?? []).filter((candidate) =>
      selectSurveyConsultation(
        [candidate],
        { name, parentPhone: survey.parent_phone },
        { allowNameFallback: false },
      ),
    );
    if (matches.length > 1) {
      return {
        success: false,
        error: `이름과 학부모 연락처가 같은 상담이 ${matches.length}건 있어 자동으로 연결할 수 없습니다.`,
      };
    }
    if (matches.length === 1) {
      return {
        success: true,
        consultation: matches[0] as Consultation,
        created: false,
      };
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const { data: consultation, error: createError } = await supabase
      .from("consultations")
      .insert({
        name,
        school: survey.school,
        grade: survey.grade,
        parent_phone: survey.parent_phone,
        consult_date: today,
        consult_type: "유선 상담",
        status: "active",
        analysis_id: survey.analysis_id ?? null,
        memo: "설문 기반 자동 생성",
      })
      .select()
      .single();

    if (createError || !consultation) {
      return {
        success: false,
        error: createError?.message || "상담 기록을 생성하지 못했습니다.",
      };
    }

    revalidatePath("/surveys");
    revalidatePath("/consultations");
    return {
      success: true,
      consultation: consultation as Consultation,
      created: true,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "상담 기록을 생성하지 못했습니다.",
    };
  }
}

export async function createConsultation(formData: FormData): Promise<ConsultationMutationResult> {
  try {
    const supabase = await createClient();
    let warning: string | undefined;

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
      parent_consult_note: formData.get("parent_consult_note") || undefined,
      parent_consult_date: formData.get("parent_consult_date") || undefined,
      parent_consult_time: formData.get("parent_consult_time") || undefined,
      parent_location: formData.get("parent_location") || undefined,
    };

    const parsed = consultationFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const normalizedConsultTime = parsed.data.consult_time
      ? roundTimeTo10(parsed.data.consult_time)
      : null;
    const normalizedParentConsultTime = parsed.data.parent_consult_time
      ? roundTimeTo10(parsed.data.parent_consult_time)
      : null;
    const normalizedConsultType = normalizeConsultTypeTime(
      parsed.data.consult_type || "유선 상담",
    );

    const { data, error } = await supabase
      .from("consultations")
      .insert({
        name: parsed.data.name,
        school: parsed.data.school || null,
        grade: parsed.data.grade || null,
        parent_phone: parsed.data.parent_phone || null,
        consult_date: parsed.data.consult_date || null,
        consult_time: normalizedConsultTime,
        subject: parsed.data.subject || null,
        location: parsed.data.location || null,
        consult_type: normalizedConsultType,
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
        parent_consult_note: parsed.data.parent_consult_note || null,
        parent_consult_date: parsed.data.parent_consult_date || null,
        parent_consult_time: normalizedParentConsultTime,
        parent_location: parsed.data.parent_location || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[DB] 상담 등록 실패:", error.message);
      return { success: false, error: error.message };
    }

    // 예약 현황판 동기화
    try {
      await syncConsultationToBooking({
        id: data.id,
        booking_id: data.booking_id ?? null,
        name: parsed.data.name,
        consult_date: parsed.data.consult_date || null,
        consult_time: normalizedConsultTime,
        consult_type: normalizedConsultType,
        location: parsed.data.location || null,
        subject: parsed.data.subject || null,
        parent_phone: parsed.data.parent_phone || null,
        school: parsed.data.school || null,
        grade: parsed.data.grade || null,
      });
    } catch (syncErr) {
      console.error("[Booking Sync] 예약 동기화 실패:", syncErr);
      warning = BOOKING_SYNC_WARNING;
    }

    revalidatePath("/consultations");
    revalidatePath("/bookings");
    return { success: true, data, warning };
  } catch (e) {
    console.error("[상담] 등록 중 예외:", e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : "상담 등록 실패";
    return { success: false, error: msg };
  }
}

export async function updateConsultation(
  id: string,
  formData: FormData,
): Promise<ConsultationMutationResult> {
  try {
    const supabase = await createClient();
    let warning: string | undefined;

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
      parent_consult_note: formData.get("parent_consult_note") || undefined,
      parent_consult_date: formData.get("parent_consult_date") || undefined,
      parent_consult_time: formData.get("parent_consult_time") || undefined,
      parent_location: formData.get("parent_location") || undefined,
    };

    const parsed = consultationFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const normalizedConsultTime = parsed.data.consult_time
      ? roundTimeTo10(parsed.data.consult_time)
      : null;
    const normalizedParentConsultTime = parsed.data.parent_consult_time
      ? roundTimeTo10(parsed.data.parent_consult_time)
      : null;
    const normalizedConsultType = normalizeConsultTypeTime(
      parsed.data.consult_type || "유선 상담",
    );

    const { data: previous, error: previousError } = await supabase
      .from("consultations")
      .select("consult_date, consult_time, booking_id")
      .eq("id", id)
      .single();
    if (previousError || !previous) {
      return {
        success: false,
        error: previousError?.message || "상담을 찾을 수 없습니다.",
      };
    }

    const nextConsultDate = parsed.data.consult_date || null;
    const previousTime = previous.consult_time?.slice(0, 5) ?? null;
    const nextTime = normalizedConsultTime?.slice(0, 5) ?? null;
    const scheduleChanged =
      previous.consult_date !== nextConsultDate || previousTime !== nextTime;
    const updatePayload: Record<string, unknown> = {
      name: parsed.data.name,
      school: parsed.data.school || null,
      grade: parsed.data.grade || null,
      parent_phone: parsed.data.parent_phone || null,
      consult_date: nextConsultDate,
      consult_time: normalizedConsultTime,
      subject: parsed.data.subject || null,
      location: parsed.data.location || null,
      consult_type: normalizedConsultType,
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
      parent_consult_note: parsed.data.parent_consult_note || null,
      parent_consult_date: parsed.data.parent_consult_date || null,
      parent_consult_time: normalizedParentConsultTime,
      parent_location: parsed.data.parent_location || null,
    };
    if (scheduleChanged) {
      updatePayload.rescheduled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("consultations")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[DB] 상담 수정 실패:", { id, error: error.message });
      return { success: false, error: error.message };
    }

    if (scheduleChanged) {
      const actorLabel = await getActorLabel();
      const { error: eventError } = await supabase
        .from("consultation_events")
        .insert({
          booking_id: previous.booking_id,
          consultation_id: id,
          event_type: "rescheduled",
          old_value: {
            date: previous.consult_date,
            time: previous.consult_time,
          },
          new_value: {
            date: nextConsultDate,
            time: normalizedConsultTime,
          },
          created_by_label: actorLabel,
        });
      if (eventError) {
        console.error("[Consultation] 시간변경 이벤트 기록 실패:", eventError.message);
        warning = "상담 일정은 수정되었으나 변경 이력 기록에 실패했습니다.";
      }
    }

    // 예약 현황판 동기화
    try {
      await syncConsultationToBooking({
        id,
        booking_id: previous.booking_id ?? data.booking_id ?? null,
        name: parsed.data.name,
        consult_date: parsed.data.consult_date || null,
        consult_time: normalizedConsultTime,
        consult_type: normalizedConsultType,
        location: parsed.data.location || null,
        subject: parsed.data.subject || null,
        parent_phone: parsed.data.parent_phone || null,
        school: parsed.data.school || null,
        grade: parsed.data.grade || null,
      });
    } catch (syncErr) {
      console.error("[Booking Sync] 예약 동기화 실패:", syncErr);
      warning = BOOKING_SYNC_WARNING;
    }

    revalidatePath("/consultations");
    revalidatePath("/bookings");
    revalidatePath(`/consultations/${id}`);
    return { success: true, data, warning };
  } catch (e) {
    console.error("[상담] 수정 중 예외:", { id, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "상담 수정 실패";
    return { success: false, error: msg };
  }
}

export async function deleteConsultation(id: string) {
  try {
    const supabase = await createClient();
    const actorLabel = await getActorLabel();
    const { data, error } = await supabase.rpc(
      "delete_consultation_with_event",
      {
        p_consultation_id: id,
        p_actor_label: actorLabel,
      },
    );
    if (error) {
      return { success: false, error: error.message };
    }
    const result = (data ?? {}) as { success?: boolean; error?: string };
    if (!result.success) {
      return {
        success: false,
        error:
          result.error === "not_found"
            ? "상담을 찾을 수 없습니다."
            : result.error || "상담 삭제 실패",
      };
    }

    revalidatePath("/consultations");
    revalidatePath("/bookings");
    return { success: true };
  } catch (e) {
    console.error("[상담] 삭제 중 예외:", { id, error: e instanceof Error ? e.message : e });
    const msg = e instanceof Error ? e.message : "상담 삭제 실패";
    return { success: false, error: msg };
  }
}

export async function updateConsultationStatus(
  id: string,
  status: string,
  reason?: string | null,
) {
  const supabase = await createClient();
  const actorLabel = await getActorLabel();
  const { data, error } = await supabase.rpc("update_consultation_status", {
    p_consultation_id: id,
    p_status: status,
    p_reason: reason?.trim() || null,
    p_actor_label: actorLabel,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  const result = (data ?? {}) as {
    success?: boolean;
    error?: string;
    event?: string;
  };
  if (!result.success) {
    return { success: false, error: result.error || "상태 변경 실패" };
  }

  revalidatePath("/consultations");
  revalidatePath("/bookings");
  revalidatePath(`/consultations/${id}`);
  return { success: true, event: result.event };
}

export async function cancelConsultation(id: string, reason?: string) {
  return updateConsultationStatus(id, "cancelled", reason);
}

export async function getConsultationEvents(
  consultationId: string,
): Promise<ConsultationEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultation_events")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Consultation] 변경 이력 조회 실패:", error.message);
    return [];
  }
  return (data as ConsultationEvent[]) ?? [];
}

export async function getBookingEvents(
  bookingId: string,
): Promise<ConsultationEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultation_events")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Booking] 변경 이력 조회 실패:", error.message);
    return [];
  }
  return (data as ConsultationEvent[]) ?? [];
}

// 보안: 동적 업데이트 허용 필드 화이트리스트
const ALLOWED_UPDATE_FIELDS = [
  "doc_sent", "call_done", "notify_sent", "consult_done",
  "reserve_text_sent", "reserve_deposit", "result_status",
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

/** 식별된 상담 ID 기준으로 등록 상태 + 추가 정보 업데이트 */
export async function updateRegistrationInfo(
  consultationId: string,
  data: {
    result_status: string;
    plan_date?: string;
    plan_class?: string;
    reserve_deposit?: boolean;
  }
) {
  try {
    const supabase = await createClient();
    if (!consultationId) {
      return {
        success: false,
        error: "학생을 안전하게 식별할 상담 정보가 없습니다",
      };
    }

    const updateData: Record<string, unknown> = {
      result_status: data.result_status,
    };
    if (data.plan_date !== undefined) updateData.plan_date = data.plan_date || null;
    if (data.plan_class !== undefined) updateData.plan_class = data.plan_class || null;
    if (data.reserve_deposit !== undefined) updateData.reserve_deposit = data.reserve_deposit;

    const { error } = await supabase
      .from("consultations")
      .update(updateData)
      .eq("id", consultationId);

    if (error) {
      return { success: false, error: error.message };
    }

    // 여기서 analysis_id를 스탬프하지 않는다. 재상담으로 생긴 최신 상담에
    // 옛 분석이 잘못 연결될 수 있고, 화면 매칭은 selectSurveyConsultation이
    // 최신 상담을 고르는 것으로 충분하다.
    revalidatePath("/consultations");
    revalidatePath("/surveys");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "등록 정보 업데이트 실패";
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

      // 학생 연락처
      let studentPhone = "";
      const studentPhoneMatch = block.match(
        /(?:학생)\s*[:：]\s*(\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/
      );
      if (studentPhoneMatch) {
        studentPhone = studentPhoneMatch[1].replace(/[-\s]/g, "");
      }

      // 학부모 연락처 - "학부모"/"연락처"/"전화"/"핸드폰" 필드 우선 확인 (계좌번호 오매칭 방지)
      let parentPhone = "";
      const phoneFieldMatch = block.match(
        /(?:학부모|연락처|전화|핸드폰)\s*[:：]\s*(\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/
      );
      if (phoneFieldMatch) {
        parentPhone = phoneFieldMatch[1].replace(/[-\s]/g, "");
      } else if (!studentPhone) {
        // 학생 전화번호도 없으면 아무 전화번호 매칭
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

      // 메모 추출 - ▶ 필드가 아닌 나머지 텍스트 + 학생 연락처
      const memoParts: string[] = [];
      if (studentPhone) memoParts.push(`학생연락처: ${studentPhone}`);
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const extraLines = lines.filter((l) => !l.startsWith("▶") && !l.startsWith(">") && !l.match(/^(이름|학교|학생|학부모|연락처|전화|핸드폰|일시|테스트|상담비|계좌|준비물|위치|학부모님)\s*[:：]/));
      if (extraLines.length > 0) memoParts.push(extraLines.join("\n"));
      const memo = memoParts.join("\n").trim();

      // DB 삽입
      const { data, error } = await supabase
        .from("consultations")
        .insert({
          name,
          school: school || null,
          grade,
          parent_phone: parentPhone || studentPhone || null,
          consult_date: dateStr,
          consult_time: timeStr,
          subject: subject || null,
          location,
          consult_type: consultType,
          memo: memo || null,
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
