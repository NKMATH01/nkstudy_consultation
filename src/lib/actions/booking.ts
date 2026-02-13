"use server";

import { createClient } from "@/lib/supabase/server";
import { bookingFormSchema } from "@/lib/validations/booking";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Booking, BlockedSlot } from "@/types";
import { revalidatePath } from "next/cache";

// ========== 공개 액션 (학부모용) ==========

export async function getBookingSlots(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const [bookingsRes, blockedRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, booking_date, booking_hour, branch, consult_type, paid")
        .gte("booking_date", startDate)
        .lte("booking_date", endDate),
      supabase
        .from("blocked_slots")
        .select("*")
        .gte("slot_date", startDate)
        .lte("slot_date", endDate),
    ]);

    if (bookingsRes.error) {
      console.error("[Booking] 예약 슬롯 조회 실패:", bookingsRes.error.message);
      return { bookings: [], blocked: [] };
    }
    if (blockedRes.error) {
      console.error("[Booking] 차단 슬롯 조회 실패:", blockedRes.error.message);
      return { bookings: bookingsRes.data ?? [], blocked: [] };
    }

    return {
      bookings: bookingsRes.data ?? [],
      blocked: (blockedRes.data as BlockedSlot[]) ?? [],
    };
  } catch (e) {
    console.error("[Booking] 슬롯 조회 예외:", e);
    return { bookings: [], blocked: [] };
  }
}

export async function submitBooking(data: Record<string, unknown>) {
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

    // 중복 예약 체크
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, consult_type")
      .eq("booking_date", parsed.data.booking_date)
      .eq("booking_hour", parsed.data.booking_hour)
      .eq("branch", parsed.data.branch);

    if (existing && existing.length > 0) {
      const hasInperson = existing.some((b: { consult_type: string }) => b.consult_type === "inperson");
      // 대면상담이 있으면 무조건 차단
      if (hasInperson) {
        return { success: false, error: "이미 대면상담이 예약된 시간입니다. 다른 시간을 선택해주세요." };
      }
      // 새 예약이 대면상담이면 기존 예약과 충돌
      if (parsed.data.consult_type === "inperson") {
        return { success: false, error: "이미 예약이 있는 시간입니다. 다른 시간을 선택해주세요." };
      }
      // 유선상담 + 유선상담 → 중복 허용
    }

    // 차단 슬롯 체크
    const { data: blocked } = await supabase
      .from("blocked_slots")
      .select("id")
      .eq("slot_date", parsed.data.booking_date)
      .eq("slot_hour", parsed.data.booking_hour)
      .eq("branch", parsed.data.branch)
      .limit(1);

    if (blocked && blocked.length > 0) {
      return { success: false, error: "해당 시간은 예약이 불가합니다. 다른 시간을 선택해주세요." };
    }

    const { error } = await supabase.from("bookings").insert({
      branch: parsed.data.branch,
      consult_type: parsed.data.consult_type,
      booking_date: parsed.data.booking_date,
      booking_hour: parsed.data.booking_hour,
      student_name: parsed.data.student_name,
      parent_name: parsed.data.parent_name,
      phone: parsed.data.phone,
      school: parsed.data.school || null,
      grade: parsed.data.grade || null,
      subject: parsed.data.subject,
      progress: parsed.data.progress || null,
      paid: parsed.data.pay_method === "done",
      pay_method: parsed.data.pay_method,
    });

    if (error) {
      console.error("[DB] 예약 생성 실패:", error.message);
      return { success: false, error: "예약 저장에 실패했습니다. 다시 시도해주세요." };
    }

    // 상담관리 자동 연동: 예약 → 상담 레코드 생성
    const branchToLocation: Record<string, string> = {
      "gojan-math": "NK학원(폴리타운 B동 4층)",
      "gojan-eng": "NK학원(폴리타운 B동 4층)",
      "zai-both": "자이센터프라자 801호",
    };
    const subjectMap: Record<string, string> = {
      math: "수학",
      eng: "영어",
      both: "영수",
    };
    const hour = parsed.data.booking_hour;
    const consultTimeStr = `${String(hour).padStart(2, "0")}:00`;
    const consultTypeStr =
      parsed.data.consult_type === "inperson"
        ? `대면 (${String(hour).padStart(2, "0")}:30)`
        : "유선 상담";

    const { error: consultError } = await supabase.from("consultations").insert({
      name: parsed.data.student_name,
      school: parsed.data.school || null,
      grade: parsed.data.grade || null,
      parent_phone: parsed.data.phone,
      consult_date: parsed.data.booking_date,
      consult_time: consultTimeStr,
      subject: subjectMap[parsed.data.subject] || parsed.data.subject,
      location: branchToLocation[parsed.data.branch] || null,
      consult_type: consultTypeStr,
      reserve_text_sent: true,
      reserve_deposit: parsed.data.pay_method === "done",
    });
    if (consultError) {
      console.error("[Booking] 상담 연동 실패:", consultError.message);
      return { success: true, warning: "예약은 완료되었으나 상담 자동 등록에 실패했습니다. 관리자에게 문의하세요." };
    }

    return { success: true };
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
      const { error } = await supabase
        .from("blocked_slots")
        .delete()
        .eq("id", existing[0].id);

      if (error) return { success: false, error: error.message };
      revalidatePath("/bookings");
      return { success: true, blocked: false };
    } else {
      const { error } = await supabase
        .from("blocked_slots")
        .insert({ slot_date: date, slot_hour: hour, branch });

      if (error) return { success: false, error: error.message };
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
      // 일부 또는 전부 미차단 → 전체 차단
      const toInsert = hours
        .filter((h) => !existingHours.has(h))
        .map((h) => ({ slot_date: date, slot_hour: h, branch }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from("blocked_slots")
          .insert(toInsert);
        if (error) return { success: false, error: error.message };
      }
      revalidatePath("/bookings");
      return { success: true, blocked: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "날짜 전체 차단 변경 실패";
    return { success: false, error: msg };
  }
}

export async function deleteBooking(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/bookings");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "예약 삭제 실패";
    return { success: false, error: msg };
  }
}
