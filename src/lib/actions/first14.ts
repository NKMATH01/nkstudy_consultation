"use server";

// 첫 14일 확인 루프.
//
// 이 기록은 강사 평가가 아니라 설문 예측의 채점이다. 그래서 담임(teacher)이 직접 쓸 수 있고,
// 작성자 이름은 클라이언트가 보낸 값을 믿지 않고 서버가 로그인 계정에서 읽는다.
// clinic(조교)은 수업 안 행동을 판정할 위치가 아니라 막는다.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTeacher } from "@/lib/actions/settings";
import type { First14Result } from "@/lib/assessment/v2/first14";

const TABLE = "nkc_first14_checks";

/** 확인을 기록할 수 있는 역할. clinic·staff 등은 조회만 가능하다. */
const WRITE_ROLES = new Set(["teacher", "admin", "principal"]);

export interface First14Check {
  itemIndex: number;
  itemText: string;
  teacher: string;
  result: First14Result;
  note: string | null;
  checkedAt: string | null;
}

function toCheck(row: Record<string, unknown>): First14Check {
  const result = row.result;
  return {
    itemIndex: Number(row.item_index ?? 0),
    itemText: String(row.item_text ?? ""),
    teacher: String(row.teacher ?? ""),
    result:
      result === "matched" || result === "differed" || result === "unobserved"
        ? result
        : "unobserved",
    note: (row.note as string | null) ?? null,
    checkedAt: (row.checked_at as string | null) ?? null,
  };
}

/** 저장된 확인 결과. 테이블이 아직 없거나 조회에 실패해도 화면이 깨지지 않게 빈 배열을 돌려준다. */
export async function getFirst14Checks(analysisId: string): Promise<First14Check[]> {
  if (!analysisId) return [];
  try {
    const teacher = await getCurrentTeacher();
    if (!teacher) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("analysis_id", analysisId)
      .order("item_index", { ascending: true });

    if (error) {
      console.error("[first14] 조회 실패", { analysisId, message: error.message });
      return [];
    }
    return (data ?? []).map(toCheck);
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[first14] 조회 예외", { analysisId, message });
    return [];
  }
}

/**
 * 그 학생의 확인 계획 문장(verificationPlan14Days).
 * 온보딩 목록은 분석 원본을 들고 있지 않아, 다이얼로그를 열 때만 따로 읽는다.
 * 강사에게만 보이는 값이라 로그인 확인 뒤에 돌려준다.
 */
export async function getFirst14Hints(analysisId: string): Promise<string[]> {
  if (!analysisId) return [];
  try {
    const teacher = await getCurrentTeacher();
    if (!teacher) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("analyses")
      .select("result_profile_v2")
      .eq("id", analysisId)
      .maybeSingle();

    if (error || !data?.result_profile_v2) return [];

    const profile = data.result_profile_v2 as {
      interpretation?: { verificationPlan14Days?: unknown };
    };
    const plan = profile.interpretation?.verificationPlan14Days;
    return Array.isArray(plan) ? plan.filter((s): s is string => typeof s === "string") : [];
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[first14] 확인 계획 조회 예외", { analysisId, message });
    return [];
  }
}

export type SaveFirst14Result =
  | { success: true; check: First14Check }
  | { success: false; error: string };

/** 한 행의 확인 결과를 저장한다. 같은 (분석, 행)은 덮어쓴다 — 다시 보면 고칠 수 있어야 한다. */
export async function saveFirst14Check(input: {
  analysisId: string;
  itemIndex: number;
  itemText: string;
  result: First14Result;
  note?: string | null;
}): Promise<SaveFirst14Result> {
  const teacher = await getCurrentTeacher();
  if (!teacher) return { success: false, error: "로그인이 필요합니다" };
  if (!WRITE_ROLES.has(teacher.role ?? "")) {
    return { success: false, error: "권한이 없습니다" };
  }

  if (!input.analysisId) return { success: false, error: "분석을 찾을 수 없습니다" };
  if (![1, 2, 3].includes(input.itemIndex)) {
    return { success: false, error: "확인 항목이 올바르지 않습니다" };
  }
  if (!["matched", "differed", "unobserved"].includes(input.result)) {
    return { success: false, error: "확인 결과가 올바르지 않습니다" };
  }

  const itemText = input.itemText.trim();
  if (!itemText) return { success: false, error: "확인 문장이 비어 있습니다" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          analysis_id: input.analysisId,
          item_index: input.itemIndex,
          item_text: itemText.slice(0, 500),
          // 작성자는 클라이언트 입력을 쓰지 않는다.
          teacher: teacher.name,
          result: input.result,
          note: input.note?.trim() ? input.note.trim().slice(0, 300) : null,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "analysis_id,item_index" },
      )
      .select()
      .single();

    if (error) {
      console.error("[first14] 저장 실패", {
        analysisId: input.analysisId,
        itemIndex: input.itemIndex,
        message: error.message,
      });
      return { success: false, error: "저장에 실패했습니다" };
    }
    return { success: true, check: toCheck(data) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[first14] 저장 예외", { analysisId: input.analysisId, message });
    return { success: false, error: "저장에 실패했습니다" };
  }
}
