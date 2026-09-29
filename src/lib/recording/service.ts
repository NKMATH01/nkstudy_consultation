// 녹음 서버 작업(서비스 롤). 권한 판정은 호출부(route)가 먼저 한다 — 여기는 상태 전이만.
// 전사·분석은 멱등 선점(조건부 UPDATE)으로 동시에 두 번 돌지 않게 한다(D4·D5).
// 로그에는 id·순번·상태만 남긴다(전사문·이름·전화번호 금지).

import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  CLAIM_STALE_MS,
  MAX_SEGMENT_BYTES,
} from "@/lib/recording/constants";
import { analysisClaimOrFilter, canClaimAnalysis, segmentClaimOrFilter } from "@/lib/recording/claim";
import { callTranscribe } from "@/lib/recording/transcribe";
import { callConsultAnalysis, type TranscriptLine } from "@/lib/recording/analyze";
import { downloadSegment, listRecordingObjects } from "@/lib/recording/storage";
import { planFinalize } from "@/lib/recording/finalize";
import { toAbsoluteLines } from "@/lib/recording/transcript";

const REC = "consultation_recordings";
const SEG = "consultation_recording_segments";

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : "unknown").slice(0, 300);
}

type SegmentRow = {
  id: string;
  seq: number;
  path: string;
  status: string;
  duration_sec: number | null;
  transcript: unknown;
};

async function loadSegments(admin: SupabaseClient, recordingId: string): Promise<SegmentRow[]> {
  const { data, error } = await admin
    .from(SEG)
    .select("id, seq, path, status, duration_sec, transcript")
    .eq("recording_id", recordingId)
    .order("seq", { ascending: true });
  if (error) throw new Error(`segments_load_failed: ${error.message}`);
  return (data ?? []) as SegmentRow[];
}

function toLines(segments: SegmentRow[]): TranscriptLine[] {
  return toAbsoluteLines(segments);
}

// ───────────── 조각 업로드 완료 ─────────────

export async function completeSegmentUpload(
  admin: SupabaseClient,
  recordingId: string,
  seq: number,
  durationSec: number | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: seg, error } = await admin
    .from(SEG)
    .select("id, path, status")
    .eq("recording_id", recordingId)
    .eq("seq", seq)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: "부분 조회 실패" };
  if (!seg) return { ok: false, status: 404, error: "발급되지 않은 부분입니다." };
  const { data: recRow } = await admin.from(REC).select("status").eq("id", recordingId).maybeSingle();
  if (!recRow || (recRow as { status: string }).status === "deleting") {
    return { ok: false, status: 409, error: "삭제 중인 녹음입니다." };
  }
  const row = seg as { id: string; path: string; status: string };
  if (row.status !== "pending") return { ok: true }; // 이미 기록됨(멱등)

  const objects = await listRecordingObjects(admin, recordingId);
  const obj = objects.find((o) => o.path === row.path);
  if (!obj) return { ok: false, status: 409, error: "업로드된 파일을 찾지 못했습니다." };
  if (obj.size <= 0 || obj.size > MAX_SEGMENT_BYTES) {
    return { ok: false, status: 400, error: "파일 크기가 올바르지 않습니다." };
  }
  const { error: upErr } = await admin
    .from(SEG)
    .update({
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
      bytes: obj.size,
      duration_sec: durationSec != null ? Math.max(0, Math.round(durationSec)) : null,
    })
    .eq("id", row.id)
    .eq("status", "pending");
  if (upErr) return { ok: false, status: 500, error: "부분 기록 실패" };
  return { ok: true };
}

// ───────────── 마감 ─────────────

export async function finalizeRecording(
  admin: SupabaseClient,
  recordingId: string,
  durationSec: number | null,
  opts: { discardMissing?: boolean } = {},
): Promise<
  | { ok: true; ready: boolean; segmentCount: number }
  | { ok: false; status: number; error: string; missingSeqs?: number[] }
> {
  const { data: rec, error } = await admin
    .from(REC)
    .select("id, status")
    .eq("id", recordingId)
    .maybeSingle();
  if (error || !rec) return { ok: false, status: 404, error: "녹음을 찾을 수 없습니다." };
  if ((rec as { status: string }).status !== "recording") {
    return { ok: false, status: 409, error: "이미 마감된 녹음입니다." };
  }

  // 발급만 되고 완료 기록이 없는 조각(A): 파일이 있으면 uploaded 로 올리고,
  // 없으면 아직 기기에 남아 있을 수 있으므로 마감을 거부한다(사용자가 버리기를 고른 경우만 행 삭제).
  const segments = await loadSegments(admin, recordingId);
  const pending = segments.filter((s) => s.status === "pending");
  if (pending.length > 0) {
    const objects = await listRecordingObjects(admin, recordingId);
    const plan = planFinalize(pending, objects, { discardMissing: opts.discardMissing === true });
    for (const m of plan.markUploaded) {
      await admin
        .from(SEG)
        .update({ status: "uploaded", uploaded_at: new Date().toISOString(), bytes: m.size })
        .eq("id", m.id)
        .eq("status", "pending");
    }
    if (!plan.ok) {
      return {
        ok: false,
        status: 409,
        error: `아직 올라가지 않은 부분(${plan.missingSeqs.join(", ")}번)이 있습니다. 녹음한 기기에서 먼저 '복구 업로드'를 해 주세요.`,
        missingSeqs: plan.missingSeqs,
      };
    }
    if (plan.deleteIds.length > 0) {
      const seqs = pending.filter((p) => plan.deleteIds.includes(p.id)).map((p) => p.seq);
      console.warn("[recording] 조각 버리고 마감", { recordingId, seqs });
    }
    for (const id of plan.deleteIds) {
      await admin.from(SEG).delete().eq("id", id).eq("status", "pending");
    }
  }
  const after = await loadSegments(admin, recordingId);
  const count = after.length;
  const nowIso = new Date().toISOString();
  const { data: updated, error: upErr } = await admin
    .from(REC)
    .update({
      status: count === 0 ? "failed" : "transcribing",
      segment_count: count,
      duration_sec: durationSec != null ? Math.max(0, Math.round(durationSec)) : null,
      finalized_at: nowIso,
      error: count === 0 ? "저장된 녹음 부분이 없습니다." : null,
    })
    .eq("id", recordingId)
    .eq("status", "recording")
    .select("id");
  if (upErr) return { ok: false, status: 500, error: "마감 기록 실패" };
  if (!updated || updated.length === 0) return { ok: false, status: 409, error: "이미 마감된 녹음입니다." };
  const ready = count > 0 ? await completeTranscriptionIfReady(admin, recordingId) : false;
  return { ok: true, ready, segmentCount: count };
}

// ───────────── 전사 ─────────────

/** 마감됐고 모든 조각이 전사됐으면 전체 전사문을 모아 transcribed 로 올린다. 분석 준비 여부를 돌려준다. */
export async function completeTranscriptionIfReady(admin: SupabaseClient, recordingId: string): Promise<boolean> {
  const { data: rec } = await admin
    .from(REC)
    .select("status, finalized_at, segment_count")
    .eq("id", recordingId)
    .maybeSingle();
  if (!rec) return false;
  const r = rec as { status: string; finalized_at: string | null; segment_count: number | null };
  if (r.status === "transcribed") return true;
  if (r.status !== "transcribing" || !r.finalized_at || !r.segment_count) return false;
  const segments = await loadSegments(admin, recordingId);
  if (segments.length !== r.segment_count || !segments.every((s) => s.status === "transcribed")) return false;
  const { data: updated } = await admin
    .from(REC)
    .update({ status: "transcribed", transcript: toLines(segments), transcribed_at: new Date().toISOString() })
    .eq("id", recordingId)
    .eq("status", "transcribing")
    .select("id");
  return !!updated && updated.length > 0;
}

export type TranscribeJobResult =
  | { claimed: false; reason: string }
  | { claimed: true; ok: true; ready: boolean }
  | { claimed: true; ok: false; error: string };

export async function transcribeSegment(
  admin: SupabaseClient,
  recordingId: string,
  seq: number,
  deps: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<TranscribeJobResult> {
  const now = new Date();
  const lockIso = now.toISOString();
  const { data: recState } = await admin.from(REC).select("status").eq("id", recordingId).maybeSingle();
  if (!recState || (recState as { status: string }).status === "deleting") {
    return { claimed: false, reason: "deleting" };
  }
  const { data: claimed, error: claimErr } = await admin
    .from(SEG)
    .update({ status: "transcribing", locked_at: lockIso, error: null })
    .eq("recording_id", recordingId)
    .eq("seq", seq)
    .or(segmentClaimOrFilter(now))
    .select("id, path");
  if (claimErr) return { claimed: false, reason: "claim_error" };
  if (!claimed || claimed.length === 0) return { claimed: false, reason: "not_claimable" };
  const seg = claimed[0] as { id: string; path: string };

  try {
    const { data: rec } = await admin
      .from(REC)
      .select("mime, audio_deleted_at")
      .eq("id", recordingId)
      .maybeSingle();
    const r = rec as { mime: string; audio_deleted_at: string | null } | null;
    if (!r) throw new Error("녹음 없음");
    if (r.audio_deleted_at) throw new Error("원본 오디오가 이미 삭제됨");
    const audio = await downloadSegment(admin, seg.path);
    const utterances = await callTranscribe(
      { audio, mimeType: r.mime },
      {
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_TRANSCRIBE_MODEL,
        fetchImpl: deps.fetchImpl,
        timeoutMs: deps.timeoutMs,
      },
    );
    const { error: saveErr } = await admin
      .from(SEG)
      .update({
        status: "transcribed",
        transcript: utterances,
        transcribed_at: new Date().toISOString(),
        locked_at: null,
        error: null,
      })
      .eq("id", seg.id)
      .eq("status", "transcribing")
      .eq("locked_at", lockIso);
    if (saveErr) throw new Error(`전사 저장 실패: ${saveErr.message}`);
    const ready = await completeTranscriptionIfReady(admin, recordingId);
    return { claimed: true, ok: true, ready };
  } catch (e) {
    const message = errMsg(e);
    console.error("[recording] 조각 전사 실패", { recordingId, seq, error: message });
    await admin
      .from(SEG)
      .update({ status: "failed", error: message, locked_at: null })
      .eq("id", seg.id)
      .eq("status", "transcribing")
      .eq("locked_at", lockIso);
    return { claimed: true, ok: false, error: message };
  }
}

/** 남은 조각 하나(uploaded, 또는 선점이 10분 넘게 멈춘 transcribing). 실패 조각은 사람이 다시 시도한다. */
export async function pickPendingSegment(
  admin: SupabaseClient,
  opts: { consultationId?: string; excludeKeys?: Set<string> } = {},
): Promise<{ recordingId: string; seq: number } | null> {
  const staleIso = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  let q = admin
    .from(SEG)
    .select(`recording_id, seq, ${REC}!inner(consultation_id, audio_deleted_at, status)`)
    .or(`status.eq.uploaded,and(status.eq.transcribing,locked_at.lt."${staleIso}")`)
    .is(`${REC}.audio_deleted_at`, null)
    .neq(`${REC}.status`, "deleting")
    .order("created_at", { ascending: true })
    .limit(1 + (opts.excludeKeys?.size ?? 0));
  if (opts.consultationId) q = q.eq(`${REC}.consultation_id`, opts.consultationId);
  const { data, error } = await q;
  if (error || !data) return null;
  const row = (data as { recording_id: string; seq: number }[]).find(
    (d) => !opts.excludeKeys?.has(`${d.recording_id}|${d.seq}`),
  );
  return row ? { recordingId: row.recording_id, seq: row.seq } : null;
}

// ───────────── 분석 ─────────────

/**
 * 분석 결과(성공·실패) 저장. 우리가 선점한 상태(status='analyzing' + 같은 locked_at)일 때만 쓴다.
 * 그 사이 삭제가 시작돼 'deleting' 이 됐거나 다른 요청이 재선점했으면 0행 → 조용히 false(로그 1줄).
 */
export async function saveAnalysisOutcome(
  admin: SupabaseClient,
  recordingId: string,
  lockIso: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await admin
    .from(REC)
    .update(patch)
    .eq("id", recordingId)
    .eq("status", "analyzing")
    .eq("locked_at", lockIso)
    .select("id");
  if (error) throw new Error(`분석 저장 실패: ${error.message}`);
  if (!data || data.length === 0) {
    console.warn("[recording] 분석 저장 건너뜀(선점 상실 또는 삭제 중)", { recordingId });
    return false;
  }
  return true;
}

export type AnalyzeJobResult =
  | { claimed: false; reason: string }
  | { claimed: true; ok: true }
  | { claimed: true; ok: false; error: string };

export async function analyzeRecording(
  admin: SupabaseClient,
  recordingId: string,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<AnalyzeJobResult> {
  const now = new Date();
  const { data: rec, error } = await admin
    .from(REC)
    .select("id, status, finalized_at, locked_at, segment_count")
    .eq("id", recordingId)
    .maybeSingle();
  if (error || !rec) return { claimed: false, reason: "not_found" };
  const segments = await loadSegments(admin, recordingId);
  const r = rec as { status: string; finalized_at: string | null; locked_at: string | null; segment_count: number | null };
  if (!canClaimAnalysis(r, segments, now)) return { claimed: false, reason: "not_ready" };

  const lockIso = now.toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from(REC)
    .update({ status: "analyzing", locked_at: lockIso, error: null })
    .eq("id", recordingId)
    .or(analysisClaimOrFilter(now))
    .select("id");
  if (claimErr || !claimed || claimed.length === 0) return { claimed: false, reason: "not_claimable" };

  try {
    const lines = toLines(segments);
    if (lines.length === 0) throw new Error("전사문이 비어 있음");
    const analysis = await callConsultAnalysis(lines, {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_CONSULT_MODEL,
      fetchImpl: deps.fetchImpl,
    });
    const saved = await saveAnalysisOutcome(admin, recordingId, lockIso, {
      status: "analyzed",
      analysis,
      transcript: lines,
      analyzed_at: new Date().toISOString(),
      locked_at: null,
      error: null,
    });
    if (!saved) return { claimed: false, reason: "lost_claim" };
    return { claimed: true, ok: true };
  } catch (e) {
    const message = errMsg(e);
    console.error("[recording] 분석 실패", { recordingId, error: message });
    await saveAnalysisOutcome(admin, recordingId, lockIso, { status: "failed", error: message, locked_at: null }).catch(
      () => false,
    );
    return { claimed: true, ok: false, error: message };
  }
}
