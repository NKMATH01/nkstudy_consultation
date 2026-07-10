"use server";

import { createClient } from "@/lib/supabase/server";
import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";

// ========== 공유 토큰 생성 (V1: report_html) ==========
export async function createReportToken(params: {
  reportType: "analysis" | "registration";
  reportHtml: string;
  name?: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("report_tokens")
      .insert({
        report_type: params.reportType,
        report_html: params.reportHtml,
        name: params.name || null,
      })
      .select("token")
      .single();

    if (error) {
      console.error("[ReportToken] 생성 실패:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, token: data.token };
  } catch (e) {
    console.error("[ReportToken] 예외:", e instanceof Error ? e.message : e);
    return { success: false, error: "토큰 생성 실패" };
  }
}

// ========== V2 공유 토큰 생성 (parent-safe snapshot) ==========
// §14 불변 스냅샷: 재분석해도 기존 링크는 바뀌지 않는다(항상 새 token·새 snapshot).
// parent-safe payload를 JSON 문자열로 report_html(text)에 저장하므로 마이그레이션 전에도 동작한다.
// report_type='analysis_v2'로 V1 HTML 토큰과 구분한다.
export async function createReportTokenV2(params: {
  profile: ParentSafeProfile;
  name?: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const insertRow: Record<string, unknown> = {
      report_type: "analysis_v2",
      report_html: JSON.stringify(params.profile),
      name: params.name || null,
    };
    // template_version 컬럼이 있으면 표시(없으면 PostgREST가 무시하지 않고 에러 → 안전하게 생략).
    const { data, error } = await supabase
      .from("report_tokens")
      .insert(insertRow)
      .select("token")
      .single();

    if (error) {
      console.error("[ReportToken V2] 생성 실패:", error.message);
      return { success: false, error: "공유 링크 생성에 실패했습니다" };
    }

    return { success: true, token: data.token };
  } catch (e) {
    console.error("[ReportToken V2] 예외:", e instanceof Error ? e.message : e);
    return { success: false, error: "공유 링크 생성 실패" };
  }
}

// ========== 토큰으로 보고서 조회 (공개) ==========
export type ReportTokenView =
  | {
      kind: "html";
      reportType: string;
      reportHtml: string;
      name: string | null;
      createdAt: string | null;
      expired: boolean;
      revoked: boolean;
    }
  | {
      kind: "v2";
      profile: ParentSafeProfile;
      name: string | null;
      createdAt: string | null;
      expired: boolean;
      revoked: boolean;
    };

interface RawTokenRow {
  report_type: string;
  report_html: string;
  name: string | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at?: string | null;
  template_version?: string | null;
}

/**
 * 단일 token 조회. 하드닝된 DB(anon SELECT revoke)에서는 SECURITY DEFINER RPC로,
 * 마이그레이션 전에는 직접 단건 select로 조회한다. 두 상태 모두에서 동작한다.
 * anon이 전체 목록을 조회할 수 없도록 항상 정확히 1건만 다룬다.
 */
async function fetchTokenRow(token: string): Promise<RawTokenRow | null> {
  const supabase = await createClient();

  // 1) 하드닝된 경로: get_report_token RPC (anon 허용, 단건만 반환).
  const rpc = await supabase.rpc("get_report_token", { p_token: token });
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    return rpc.data[0] as RawTokenRow;
  }

  // 2) 마이그레이션 전 fallback: 직접 단건 select(정확한 token 1건).
  const { data, error } = await supabase
    .from("report_tokens")
    .select("report_type, report_html, name, created_at, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) return null;
  return data as RawTokenRow;
}

export async function getReportByToken(
  token: string
): Promise<ReportTokenView | null> {
  const row = await fetchTokenRow(token);
  if (!row) return null;

  const expired = row.expires_at
    ? new Date(row.expires_at) < new Date()
    : false;
  const revoked = !!row.revoked_at;

  if (row.report_type === "analysis_v2") {
    let profile: ParentSafeProfile | null = null;
    try {
      profile = JSON.parse(row.report_html) as ParentSafeProfile;
    } catch {
      return null;
    }
    if (!profile || profile.instrumentVersion !== "v2") return null;
    return {
      kind: "v2",
      profile,
      name: row.name,
      createdAt: row.created_at,
      expired,
      revoked,
    };
  }

  return {
    kind: "html",
    reportType: row.report_type,
    reportHtml: row.report_html,
    name: row.name,
    createdAt: row.created_at,
    expired,
    revoked,
  };
}

// ========== 공유 토큰 취소 (관리자) ==========
// §14: 재분석 시 기존 링크를 조용히 바꾸지 않고, 관리자가 명시적으로 취소할 수 있다.
export async function revokeReportToken(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("report_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", token);
    if (error) {
      console.error("[ReportToken] 취소 실패:", error.message);
      return {
        success: false,
        error:
          "링크 취소에 실패했습니다(마이그레이션 적용 후 사용 가능). 관리자에게 문의하세요.",
      };
    }
    return { success: true };
  } catch (e) {
    console.error("[ReportToken] 취소 예외:", e instanceof Error ? e.message : e);
    return { success: false, error: "링크 취소 실패" };
  }
}
