"use server";

import { createClient } from "@/lib/supabase/server";
import { bookingFormSchema } from "@/lib/validations/booking";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Booking, BlockedSlot } from "@/types";
import { slotToConsultTime } from "@/lib/booking-slots";
import { revalidatePath } from "next/cache";

const BRANCH_TO_LOCATION: Record<string, string> = {
  "gojan-math": "NK학원(폴리타운 B동 4층)",
  "gojan-eng": "NK학원(폴리타운 B동 4층)",
  "zai-both": "자이센터프라자 801호",
};

const SUBJECT_LABELS: Record<string, string> = {
  math: "수학",
  eng: "영어",
  both: "영수",
};

type SubmitBookingResult = {
  success: boolean;
  error?: string;
  warning?: string;
  bookingId?: string;
  consultationId?: string;
};

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getActorLabel(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "system";
}

// ========== 공개 액션 (학부모용) ==========

export async function getBookingSlots(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_booking_slots", {
      p_start: startDate,
      p_end: endDate,
    });

    if (error) {
      console.error("[Booking] 공개 슬롯 RPC 실패:", error.message);
      return { bookings: [], blocked: [] };
    }

    const payload = (data ?? {}) as {
      bookings?: Array<{
        booking_date: string;
        booking_hour: number;
        branch: string;
        consult_type: string;
        paid: boolean;
      }>;
      blocked?: Array<{
        slot_date: string;
        slot_hour: number;
        branch: string;
      }>;
    };

    return { bookings: payload.bookings ?? [], blocked: payload.blocked ?? [] };
  } catch (e) {
    console.error("[Booking] 슬롯 조회 예외:", e);
    return { bookings: [], blocked: [] };
  }
}

export async function submitBooking(
  data: Record<string, unknown>,
): Promise<SubmitBookingResult> {
  try {
    // Rate limit: 전화번호 기반 분당 3회 제한
    const phone = typeof data.phone === "string" ? data.phone : "unknown";
    const { allowed } = checkRateLimit(`booking:${phone}`, 3, 60 * 1000);
    if (!allowed) {
      return { success: false, error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요." };
    }

    const parsed = bookingFormSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const bookingDate = parseLocalDate(parsed.data.booking_date);
    if (!bookingDate) {
      return { success: false, error: "올바른 예약 날짜가 아닙니다." };
    }

    const consultTime = slotToConsultTime(
      parsed.data.booking_hour,
      bookingDate,
      parsed.data.consult_type,
    );
    if (!consultTime) {
      return { success: false, error: "선택한 예약 시간이 유효하지 않습니다." };
    }

    const consultTypeLabel =
      parsed.data.consult_type === "inperson"
        ? `대면 (${consultTime})`
        : "유선 상담";

    const { data: rpcData, error: rpcError } = await supabase.rpc("book_slot", {
      p_branch: parsed.data.branch,
      p_consult_type: parsed.data.consult_type,
      p_booking_date: parsed.data.booking_date,
      p_booking_hour: parsed.data.booking_hour,
      p_student_name: parsed.data.student_name,
      p_parent_name: parsed.data.parent_name,
      p_phone: parsed.data.phone,
      p_school: parsed.data.school || null,
      p_grade: parsed.data.grade || null,
      p_progress: parsed.data.progress || null,
      p_subject: parsed.data.subject,
      p_pay_method: parsed.data.pay_method,
      p_consult_time: consultTime,
      p_consult_type_label: consultTypeLabel,
      p_location: BRANCH_TO_LOCATION[parsed.data.branch] || null,
      p_subject_label:
        SUBJECT_LABELS[parsed.data.subject] || parsed.data.subject,
    });

    if (rpcError) {
      console.error("[Booking] book_slot RPC 실패:", rpcError.message);
      return { success: false, error: "예약 저장에 실패했습니다. 다시 시도해주세요." };
    }

    const result = (rpcData ?? {}) as {
      success?: boolean;
      error?: "blocked" | "taken";
      booking_id?: string;
      consultation_id?: string;
    };
    if (!result.success) {
      if (result.error === "blocked") {
        return {
          success: false,
          error: "해당 시간은 예약이 불가합니다. 다른 시간을 선택해주세요.",
        };
      }
      if (result.error === "taken") {
        return {
          success: false,
          error: "이미 예약된 시간입니다. 다른 시간을 선택해주세요.",
        };
      }
      return { success: false, error: "예약 처리 중 오류가 발생했습니다." };
    }

    return {
      success: true,
      bookingId: result.booking_id,
      consultationId: result.consultation_id,
    };
  } catch (e) {
    console.error("[Booking] 예약 생성 예외:", e);
    return { success: false, error: "예약 처리 중 오류가 발생했습니다." };
  }
}

// ========== 관리자 액션 ==========

export async function getBookings(filters: {
  startDate?: string;
  endDate?: string;
  filter?: string;
  page?: number;
  limit?: number;
} = {}) {
  try {
    const supabase = await createClient();
    const { page = 1, limit = 50, startDate, endDate, filter } = filters;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("bookings")
      .select("*", { count: "exact" })
      .order("booking_date", { ascending: true })
      .order("booking_hour", { ascending: true })
      .range(offset, offset + limit - 1);

    if (startDate) query = query.gte("booking_date", startDate);
    if (endDate) query = query.lte("booking_date", endDate);
    if (filter === "unpaid") query = query.eq("paid", false);
    if (filter === "today") {
      const today = new Date().toISOString().split("T")[0];
      query = query.eq("booking_date", today);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[Booking] 목록 조회 실패:", error.message);
      return { data: [], total: 0 };
    }

    return {
      data: (data as Booking[]) ?? [],
      total: count ?? 0,
    };
  } catch (e) {
    console.error("[Booking] 목록 조회 예외:", e);
    return { data: [], total: 0 };
  }
}

export async function getBlockedSlots(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blocked_slots")
      .select("*")
      .gte("slot_date", startDate)
      .lte("slot_date", endDate);

    if (error) {
      console.error("[Booking] 차단 슬롯 조회 실패:", error.message);
      return [];
    }
    return (data as BlockedSlot[]) ?? [];
  } catch (e) {
    console.error("[Booking] 차단 슬롯 예외:", e);
    return [];
  }
}

export async function updateBookingProgress(id: string, progress: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("bookings")
      .update({ progress })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/bookings");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "진행 상태 변경 실패";
    return { success: false, error: msg };
  }
}

export async function toggleBookingPaid(id: string) {
  try {
    const supabase = await createClient();

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("paid")
      .eq("id", id)
      .single();

    if (fetchErr || !booking) {
      return { success: false, error: "예약을 찾을 수 없습니다" };
    }

    const { error } = await supabase
      .from("bookings")
      .update({ paid: !booking.paid })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/bookings");
    return { success: true, paid: !booking.paid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "입금 상태 변경 실패";
    return { success: false, error: msg };
  }
}

export async function toggleBlockedSlot(date: string, hour: number, branch: string) {
  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("blocked_slots")
      .select("id")
      .eq("slot_date", date)
      .eq("slot_hour", hour)
      .eq("branch", branch)
      .limit(1);

    if (existing && existing.length > 0) {
      // 단건 id가 아닌 조건 삭제로 중복 행까지 모두 해제
      const { error } = await supabase
        .from("blocked_slots")
        .delete()
        .eq("slot_date", date)
        .eq("slot_hour", hour)
        .eq("branch", branch);

      if (error) return { success: false, error: error.message };
      revalidatePath("/bookings");
      return { success: true, blocked: false };
    } else {
      const { error } = await supabase
        .from("blocked_slots")
        .insert({ slot_date: date, slot_hour: hour, branch });

      // 동시 삽입으로 unique 위반(23505) 시 이미 차단된 것으로 간주
      if (error && error.code !== "23505") return { success: false, error: error.message };
      revalidatePath("/bookings");
      return { success: true, blocked: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "차단 상태 변경 실패";
    return { success: false, error: msg };
  }
}

export async function toggleBlockedDate(date: string, branch: string, hours: number[]) {
  try {
    const supabase = await createClient();

    // 해당 날짜+지점의 기존 차단 슬롯 조회
    const { data: existing } = await supabase
      .from("blocked_slots")
      .select("id, slot_hour")
      .eq("slot_date", date)
      .eq("branch", branch)
      .in("slot_hour", hours);

    const existingHours = new Set((existing || []).map((e: { slot_hour: number }) => e.slot_hour));
    const allBlocked = hours.every((h) => existingHours.has(h));

    if (allBlocked) {
      // 전부 차단 상태 → 전체 해제
      const ids = (existing || []).map((e: { id: string }) => e.id);
      if (ids.length > 0) {
        const { error } = await supabase
          .from("blocked_slots")
          .delete()
          .in("id", ids);
        if (error) return { success: false, error: error.message };
      }
      revalidatePath("/bookings");
      return { success: true, blocked: false };
    } else {
      // 일부 또는 전부 미차단 → 전체 차단 (시간별 개별 insert, 23505=이미 차단됨은 무시)
      const toInsert = hours.filter((h) => !existingHours.has(h));
      for (const h of toInsert) {
        const { error } = await supabase
          .from("blocked_slots")
          .insert({ slot_date: date, slot_hour: h, branch });
        if (error && error.code !== "23505") return { success: false, error: error.message };
      }
      revalidatePath("/bookings");
      return { success: true, blocked: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "날짜 전체 차단 변경 실패";
    return { success: false, error: msg };
  }
}

export async function cancelBooking(id: string, reason?: string) {
  try {
    const supabase = await createClient();
    const actorLabel = await getActorLabel();
    const { data, error } = await supabase.rpc("cancel_booking", {
      p_booking_id: id,
      p_reason: reason?.trim() || null,
      p_actor_label: actorLabel,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = (data ?? {}) as {
      success?: boolean;
      error?: "not_found" | "already_cancelled";
      consultation_id?: string | null;
      mirrored?: boolean;
    };
    if (!result.success) {
      const message =
        result.error === "already_cancelled"
          ? "이미 취소된 예약입니다."
          : "예약을 찾을 수 없습니다.";
      return { success: false, error: message, code: result.error };
    }

    revalidatePath("/bookings");
    revalidatePath("/consultations");
    return {
      success: true,
      consultationId: result.consultation_id,
      mirrored: result.mirrored,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "예약 취소 실패";
    return { success: false, error: msg };
  }
}

export async function rescheduleBooking(
  id: string,
  newDate: string,
  newHour: number,
) {
  try {
    const supabase = await createClient();
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("consult_type")
      .eq("id", id)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: "예약을 찾을 수 없습니다." };
    }

    const parsedDate = parseLocalDate(newDate);
    if (!parsedDate) {
      return { success: false, error: "올바른 변경 날짜가 아닙니다." };
    }

    const consultType =
      booking.consult_type === "inperson" ? "inperson" : "phone";
    const newConsultTime = slotToConsultTime(
      newHour,
      parsedDate,
      consultType,
    );
    if (!newConsultTime) {
      return { success: false, error: "선택한 변경 시간이 유효하지 않습니다." };
    }

    const actorLabel = await getActorLabel();
    const { data, error } = await supabase.rpc("reschedule_booking", {
      p_booking_id: id,
      p_new_date: newDate,
      p_new_hour: newHour,
      p_new_consult_time: newConsultTime,
      p_new_consult_type_label:
        consultType === "inperson" ? `대면 (${newConsultTime})` : null,
      p_actor_label: actorLabel,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = (data ?? {}) as {
      success?: boolean;
      error?: "blocked" | "taken" | "cancelled_booking";
    };
    if (!result.success) {
      const messages = {
        blocked: "해당 시간은 예약이 불가합니다.",
        taken: "이미 예약된 시간입니다.",
        cancelled_booking: "취소된 예약은 시간변경할 수 없습니다.",
      } as const;
      return {
        success: false,
        error: result.error ? messages[result.error] : "시간변경에 실패했습니다.",
        code: result.error,
      };
    }

    revalidatePath("/bookings");
    revalidatePath("/consultations");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "예약 시간변경 실패";
    return { success: false, error: msg };
  }
}

export async function deleteBooking(id: string) {
  try {
    const supabase = await createClient();
    const actorLabel = await getActorLabel();
    const { data, error } = await supabase.rpc("delete_booking_with_event", {
      p_booking_id: id,
      p_actor_label: actorLabel,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const result = (data ?? {}) as { success?: boolean; error?: string };
    if (!result.success) {
      return {
        success: false,
        error:
          result.error === "not_found"
            ? "예약을 찾을 수 없습니다."
            : result.error || "예약 삭제 실패",
      };
    }

    revalidatePath("/bookings");
    revalidatePath("/consultations");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "예약 삭제 실패";
    return { success: false, error: msg };
  }
}
