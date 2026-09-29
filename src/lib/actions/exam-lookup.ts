"use server";

import { createClient } from "@/lib/supabase/server";
import { getReportByToken } from "@/lib/actions/report-token";
import { parseExamReportV1 } from "@/components/exam-report/types";
import type { EntranceExam, EntranceExamStatus } from "@/lib/class-placement";
import { buildExamScoreSummary } from "../../../scripts/lib/exam-score-summary.mjs";

/**
 * 상담에 연결된 입학테스트 중 가장 최근 1건(상태 무관) — 공유 계약 D9.
 *
 * - 점수는 exam_analyses.score_* 칸을 먼저 쓰고, 비었으면 분석지 JSON(report_tokens, zod 검증)에서 읽는다.
 * - scoreSummary 칸이 비었으면 units 로 즉석 계산한다(scripts/lib/exam-score-summary.mjs 공유 규칙).
 * - 칸이 없거나(마이그레이션 20260929100000 적용 전) 조회 오류면 null + console.error("[exam-lookup]", …).
 *   시험이 없는 것은 오류가 아니므로 로그 없이 null.
 */

const STATUSES: EntranceExamStatus[] = ["pending", "analyzing", "done", "sent"];

type DbRow = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getLatestExamForConsultation(
  consultationId: string
): Promise<EntranceExam | null> {
  if (!consultationId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exam_analyses")
      .select(
        "id, status, exam_title, exam_date, subject, report_token, score_raw, score_max, score_grade, score_summary"
      )
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[exam-lookup]", error.message ?? error);
      return null;
    }
    if (!data) return null;

    const row = data as DbRow;
    const rawStatus = String(row.status ?? "pending") as EntranceExamStatus;
    const status = STATUSES.includes(rawStatus) ? rawStatus : "pending";
    const reportToken = str(row.report_token);

    // 분석지(JSON) — 토큰 사용 가능 여부와 단원 정답률을 읽는다.
    let tokenUsable = false;
    let report: ReturnType<typeof parseExamReportV1> = null;
    if (reportToken) {
      try {
        const view = await getReportByToken(reportToken);
        if (view && view.kind === "exam_v1") {
          tokenUsable = !view.expired && !view.revoked;
          report = parseExamReportV1(view.data);
        }
      } catch (e) {
        console.error("[exam-lookup] 분석지 조회 실패:", e instanceof Error ? e.message : e);
      }
    }

    const units = report
      ? report.units.map((u) => ({ name: u.name, me: u.me, national: u.national ?? null }))
      : null;

    const rawCol = num(row.score_raw);
    const maxCol = num(row.score_max);
    let score: EntranceExam["score"] = null;
    if (rawCol != null && maxCol != null && maxCol > 0) {
      score = { raw: rawCol, max: maxCol, grade: str(row.score_grade) };
    } else if (report) {
      score = {
        raw: report.score.raw,
        max: report.score.max,
        grade: report.score.grade == null ? null : str(report.score.grade),
      };
    }

    const scoreSummary = str(row.score_summary) ?? (units ? buildExamScoreSummary(units) : null);

    return {
      id: String(row.id ?? ""),
      status,
      examTitle: String(row.exam_title ?? ""),
      examDate: str(row.exam_date),
      subject: str(row.subject),
      reportToken,
      tokenUsable,
      score,
      scoreSummary,
      units,
    };
  } catch (e) {
    console.error("[exam-lookup]", e instanceof Error ? e.message : e);
    return null;
  }
}
