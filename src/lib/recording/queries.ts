// 상담 상세 화면용 녹음 목록 조회(서비스 롤). 호출 전에 반드시 권한 판정을 통과해야 한다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseConsultAnalysis, type TranscriptLine } from "@/lib/recording/analyze";
import { computeDisplayStatus, type RecordingView } from "@/lib/recording/view";

interface Row {
  id: string;
  status: string;
  created_at: string;
  finalized_at: string | null;
  segment_count: number | null;
  duration_sec: number | null;
  audio_delete_after: string;
  audio_deleted_at: string | null;
  error: string | null;
  locked_at: string | null;
  analysis: unknown;
  transcript: unknown;
  consultation_recording_segments: { seq: number; status: string; error: string | null }[] | null;
}

function toTranscript(v: unknown): TranscriptLine[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter(
    (l): l is TranscriptLine =>
      !!l && typeof l === "object" && typeof (l as TranscriptLine).text === "string",
  );
}

export async function listRecordingViews(
  admin: SupabaseClient,
  consultationId: string,
): Promise<RecordingView[]> {
  const { data, error } = await admin
    .from("consultation_recordings")
    .select(
      "id, status, created_at, finalized_at, segment_count, duration_sec, audio_delete_after, audio_deleted_at, error, locked_at, analysis, transcript, consultation_recording_segments(seq, status, error)",
    )
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`recordings_list_failed: ${error.message}`);
  return ((data ?? []) as Row[]).map((r) => {
    const segments = [...(r.consultation_recording_segments ?? [])].sort((a, b) => a.seq - b.seq);
    const analysis = r.analysis ? parseConsultAnalysis(r.analysis) : null;
    return {
      id: r.id,
      status: r.status,
      displayStatus: computeDisplayStatus(r.status, segments),
      createdAt: r.created_at,
      finalizedAt: r.finalized_at,
      segmentCount: r.segment_count,
      durationSec: r.duration_sec,
      audioDeleteAfter: r.audio_delete_after,
      audioDeletedAt: r.audio_deleted_at,
      error: r.error,
      lockedAt: r.locked_at,
      analysis: analysis?.success ? analysis.data : null,
      transcript: toTranscript(r.transcript),
      segments: segments.map((s) => ({ seq: s.seq, status: s.status, error: s.error })),
    };
  });
}
