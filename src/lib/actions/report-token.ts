"use server";

import { createClient } from "@/lib/supabase/server";

// ========== 공유 토큰 생성 ==========
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

// ========== 토큰으로 보고서 조회 (공개) ==========
export async function getReportByToken(token: string): Promise<{
  reportHtml: string;
  reportType: string;
  name: string | null;
  expired: boolean;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("report_tokens")
    .select("report_html, report_type, name, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }

  const expired = new Date(data.expires_at) < new Date();

  return {
    reportHtml: data.report_html,
    reportType: data.report_type,
    name: data.name,
    expired,
  };
}
