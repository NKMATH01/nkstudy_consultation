"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentTeacher } from "@/lib/actions/settings";
import { canViewRestrictedAnalytics } from "@/lib/menu-sectors";
import { improvementActionSchema } from "@/lib/validations/withdrawal";
import { currentYearMonth, type ImprovementAction } from "@/lib/improvement-actions";
import { revalidatePath } from "next/cache";

/**
 * 개선 액션은 퇴원 분석과 같은 등급의 정보라 principal/admin만 다룰 수 있다.
 * RLS 교체(auth.uid↔teachers actor 매핑)는 아직이라 **이 서버 게이트가 주 방어선**이다.
 * 클라이언트에서 액션을 직접 호출해도 여기서 막힌다.
 */
async function requireAnalyticsRole(): Promise<{ ok: true } | { ok: false; error: string }> {
  const teacher = await getCurrentTeacher();
  if (!canViewRestrictedAnalytics(teacher?.role)) {
    return { ok: false, error: "권한이 없습니다" };
  }
  return { ok: true };
}

const TABLE = "nkc_improvement_actions";
/** 유니크 제약 위반 (같은 달 같은 액션 중복 채택) */
const UNIQUE_VIOLATION = "23505";

function toAction(row: Record<string, unknown>): ImprovementAction {
  const status = row.status;
  return {
    id: String(row.id ?? ""),
    year_month: String(row.year_month ?? ""),
    action_text: String(row.action_text ?? ""),
    source: String(row.source ?? "manual"),
    source_title: (row.source_title as string | null) ?? null,
    owner: (row.owner as string | null) ?? null,
    status: status === "done" || status === "dropped" ? status : "pending",
    done_at: (row.done_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 테이블이 아직 없거나 조회에 실패해도 화면이 깨지지 않도록 빈 배열을 돌려준다. */
export async function getImprovementActions(yearMonth: string): Promise<ImprovementAction[]> {
  try {
    const guard = await requireAnalyticsRole();
    if (!guard.ok) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("year_month", yearMonth)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[improvement-action] 목록 조회 실패", { yearMonth, message: error.message });
      return [];
    }
    return (data ?? []).map(toAction);
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[improvement-action] 목록 조회 예외", { yearMonth, message });
    return [];
  }
}

/** 대시보드 진단 처방을 이번 달 실행 항목으로 채택한다. 이미 채택돼 있으면 조용히 성공 처리. */
export async function adoptPrescriptionAction({
  actionText,
  source,
  sourceTitle,
}: {
  actionText: string;
  source?: string;
  sourceTitle?: string;
}) {
  try {
    const supabase = await createClient();

    const guard = await requireAnalyticsRole();
    if (!guard.ok) return { success: false, error: guard.error };
    const yearMonth = currentYearMonth();

    const parsed = improvementActionSchema.safeParse({
      action_text: actionText,
      source: source || "diagnosis",
      source_title: sourceTitle,
      year_month: yearMonth,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { error } = await supabase.from(TABLE).insert({
      year_month: parsed.data.year_month,
      action_text: parsed.data.action_text,
      source: parsed.data.source || "diagnosis",
      source_title: parsed.data.source_title || null,
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { success: true, alreadyAdopted: true };
      }
      console.error("[improvement-action] 채택 실패", { actionText, message: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals/dashboard");

    revalidatePath("/withdrawals/review");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "실행 항목 채택 실패";
    console.error("[improvement-action] 채택 예외", { actionText, message });
    return { success: false, error: message };
  }
}

export async function addManualAction(formData: FormData) {
  try {
    const supabase = await createClient();

    const guard = await requireAnalyticsRole();
    if (!guard.ok) return { success: false, error: guard.error };
    const yearMonth = currentYearMonth();

    const parsed = improvementActionSchema.safeParse({
      action_text: formData.get("action_text") || "",
      owner: formData.get("owner") || undefined,
      source: "manual",
      year_month: yearMonth,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { error } = await supabase.from(TABLE).insert({
      year_month: parsed.data.year_month,
      action_text: parsed.data.action_text,
      source: "manual",
      owner: parsed.data.owner || null,
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { success: false, error: "이번 달에 같은 실행 항목이 이미 있습니다" };
      }
      console.error("[improvement-action] 수동 추가 실패", { message: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals/dashboard");

    revalidatePath("/withdrawals/review");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "실행 항목 추가 실패";
    console.error("[improvement-action] 수동 추가 예외", { message });
    return { success: false, error: message };
  }
}

export async function updateActionStatus(
  id: string,
  status: ImprovementAction["status"]
) {
  try {
    const supabase = await createClient();

    const guard = await requireAnalyticsRole();
    if (!guard.ok) return { success: false, error: guard.error };
    const now = new Date().toISOString();

    const { error } = await supabase
      .from(TABLE)
      .update({
        status,
        done_at: status === "done" ? now : null,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.error("[improvement-action] 상태 변경 실패", { id, status, message: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals/dashboard");

    revalidatePath("/withdrawals/review");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "실행 항목 상태 변경 실패";
    console.error("[improvement-action] 상태 변경 예외", { id, message });
    return { success: false, error: message };
  }
}

export async function updateActionOwner(id: string, owner: string) {
  try {
    const supabase = await createClient();

    const guard = await requireAnalyticsRole();
    if (!guard.ok) return { success: false, error: guard.error };
    const { error } = await supabase
      .from(TABLE)
      .update({ owner: owner.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[improvement-action] 담당자 변경 실패", { id, message: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals/dashboard");

    revalidatePath("/withdrawals/review");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "담당자 변경 실패";
    console.error("[improvement-action] 담당자 변경 예외", { id, message });
    return { success: false, error: message };
  }
}

export async function deleteAction(id: string) {
  try {
    const supabase = await createClient();

    const guard = await requireAnalyticsRole();
    if (!guard.ok) return { success: false, error: guard.error };
    const { error } = await supabase.from(TABLE).delete().eq("id", id);

    if (error) {
      console.error("[improvement-action] 삭제 실패", { id, message: error.message });
      return { success: false, error: error.message };
    }

    revalidatePath("/withdrawals/dashboard");

    revalidatePath("/withdrawals/review");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "실행 항목 삭제 실패";
    console.error("[improvement-action] 삭제 예외", { id, message });
    return { success: false, error: message };
  }
}
