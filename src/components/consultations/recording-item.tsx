"use client";

// 녹음 한 건: 상태 칩(글자+색) · 분석 요약 · 화자 붙은 전사문(접기) · 원본 재생 · 원본 삭제 예정일 · 다시 시도.

import { useState } from "react";
import { format } from "date-fns";
import { Play, RefreshCw, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakerLabel } from "@/lib/recording/speaker-label";
import { DISPLAY_STATUS_LABELS, isStaleAnalyzing, type DisplayStatus, type RecordingView } from "@/lib/recording/view";

const CHIP_CLASS: Record<DisplayStatus, string> = {
  recording: "bg-nk-cat-3-soft text-nk-cat-3",
  transcribing: "bg-nk-progress-soft text-nk-progress",
  analyzing: "bg-nk-wait-soft text-nk-wait",
  done: "bg-nk-done-soft text-nk-done",
  failed: "bg-nk-late-soft text-nk-late",
};

export function RecordingStatusChip({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${CHIP_CLASS[status]}`}>
      {DISPLAY_STATUS_LABELS[status]}
    </span>
  );
}

function fmtDate(iso: string | null, pattern = "yyyy-MM-dd"): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : format(d, pattern);
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분 ${sec % 60}초`;
}

/** 녹음 전체 기준 시각(J). 1시간 넘으면 h:mm:ss. */
function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`mb-1 text-[12px] font-bold ${tone === "warn" ? "text-nk-late" : "text-nk-ink-sub"}`}>{title}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-[13px] leading-relaxed text-nk-ink">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

async function post(url: string) {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok && res.status !== 502) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
}

export function RecordingItem({
  recording,
  canMutate,
  isActiveLocally,
  hasLocalParts,
  onChanged,
}: {
  recording: RecordingView;
  canMutate: boolean;
  isActiveLocally: boolean;
  /** 이 기기에 아직 올리지 못한 조각이 있음(A: 마감 대신 복구 업로드 먼저). */
  hasLocalParts: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{ seq: number; url: string | null }[] | null>(null);
  const r = recording;
  const roleByLabel = new Map((r.analysis?.speakers ?? []).map((s) => [s.label, s.role]));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const retry = () =>
    run(async () => {
      const failedSegs = r.segments.filter((s) => s.status === "failed");
      for (const s of failedSegs) {
        await post(`/api/recordings/${r.id}/segments/${s.seq}/transcribe`);
      }
      // 분석은 준비(마감 + 모든 조각 전사 완료)가 안 됐으면 서버가 아무것도 하지 않는다.
      await post(`/api/recordings/${r.id}/analyze`);
    });

  const callFinalize = async (discardMissing: boolean) => {
    const res = await fetch(`/api/recordings/${r.id}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discardMissing }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; ready?: boolean; missingSeqs?: number[] };
    return { res, j };
  };

  const finalize = () => {
    if (!window.confirm("다른 기기나 탭에서 이 녹음이 아직 진행 중이 아닌지 확인해 주세요. 녹음을 마감할까요?")) return;
    return run(async () => {
      let { res, j } = await callFinalize(false);
      if (res.status === 409 && j.missingSeqs && j.missingSeqs.length > 0) {
        // A: 서버에 없는 조각이 있음 → 녹음한 기기에서 복구하는 게 먼저. 사용자가 명시적으로 고를 때만 버리고 마감.
        const discard = window.confirm(
          `${j.missingSeqs.join(", ")}번 조각이 서버에 없습니다. 녹음한 기기에서 '복구 업로드'를 먼저 해 주세요.\n\n그 조각을 영구히 버리고 지금 마감하려면 [확인]을 누르세요.`,
        );
        if (!discard) throw new Error(j.error ?? "마감하지 않았습니다.");
        ({ res, j } = await callFinalize(true));
      }
      if (!res.ok) throw new Error(j.error ?? "마감 실패");
      if (j.ready) await post(`/api/recordings/${r.id}/analyze`);
    });
  };

  const reanalyze = () => run(async () => post(`/api/recordings/${r.id}/analyze`));

  const remove = () => {
    if (
      !window.confirm(
        "이 녹음을 삭제합니다. 원본 오디오·전사문·분석이 모두 지워지고 되돌릴 수 없습니다(동의 철회 시 사용). 계속할까요?",
      )
    ) {
      return;
    }
    return run(async () => {
      const res = await fetch(`/api/recordings/${r.id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "녹음 삭제 실패");
    });
  };

  const staleAnalyzing = isStaleAnalyzing(r, Date.now());

  const loadPlayback = () =>
    run(async () => {
      const res = await fetch(`/api/recordings/${r.id}/playback`);
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        segments?: { seq: number; url: string | null }[];
      };
      if (!res.ok) throw new Error(j.error ?? "재생 주소를 받지 못했습니다.");
      setPlayback(j.segments ?? []);
    });

  const failedSegErrors = r.segments.filter((s) => s.status === "failed" && s.error);
  const transcribedCount = r.segments.filter((s) => s.status === "transcribed").length;

  return (
    <div className="rounded-xl border border-nk-line bg-nk-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <RecordingStatusChip status={r.displayStatus} />
        <span className="text-[13px] font-semibold text-nk-ink">{fmtDate(r.createdAt, "yyyy-MM-dd HH:mm")}</span>
        {r.durationSec != null && <span className="text-[12px] text-nk-ink-sub">{fmtDuration(r.durationSec)}</span>}
        {r.segmentCount != null && r.segmentCount > 0 && r.displayStatus === "transcribing" && (
          <span className="text-[12px] text-nk-ink-hint">
            전사 {transcribedCount}/{r.segmentCount}
          </span>
        )}
        <span className="ml-auto text-[11.5px] text-nk-ink-hint">
          {r.audioDeletedAt
            ? `원본 삭제됨 (${fmtDate(r.audioDeletedAt)})`
            : `원본 삭제 예정일 ${fmtDate(r.audioDeleteAfter)}`}
        </span>
      </div>

      {(r.error || failedSegErrors.length > 0) && r.displayStatus === "failed" && (
        <p className="rounded-lg bg-nk-late-soft px-3 py-2 text-[12px] text-nk-late">
          {r.error ?? `${failedSegErrors.map((s) => `${s.seq}번 조각`).join(", ")} 전사 실패`}
        </p>
      )}
      {actionError && <p className="text-[12px] font-semibold text-nk-late">{actionError}</p>}

      <div className="flex flex-wrap gap-2">
        {canMutate && r.displayStatus === "failed" && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void retry()} className="rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
            다시 시도
          </Button>
        )}
        {canMutate && staleAnalyzing && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void reanalyze()} className="rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
            다시 분석
          </Button>
        )}
        {canMutate && r.status === "recording" && !isActiveLocally && !hasLocalParts && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void finalize()} className="rounded-lg">
            <Square className="h-3.5 w-3.5" />
            녹음 마감
          </Button>
        )}
        {!r.audioDeletedAt && r.status !== "recording" && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void loadPlayback()} className="rounded-lg">
            <Play className="h-3.5 w-3.5" />
            원본 듣기
          </Button>
        )}
        {canMutate && !isActiveLocally && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void remove()}
            className="rounded-lg text-nk-late hover:bg-nk-late-soft"
          >
            <Trash2 className="h-3.5 w-3.5" />
            녹음 삭제
          </Button>
        )}
      </div>
      {canMutate && r.status === "recording" && !isActiveLocally && hasLocalParts && (
        <p className="text-[12px] text-nk-warn">
          이 기기에 아직 올리지 못한 조각이 있습니다. 위의 &apos;복구 업로드&apos;를 먼저 해 주세요(복구가 끝나면 자동으로 마감됩니다).
        </p>
      )}

      {playback && (
        <div className="space-y-2">
          {playback.map((p) =>
            p.url ? (
              <div key={p.seq} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[11.5px] text-nk-ink-hint">{p.seq}번 조각</span>
                <audio controls preload="none" src={p.url} className="h-9 w-full" />
              </div>
            ) : null,
          )}
          <p className="text-[11px] text-nk-ink-hint">재생 주소는 10분 동안만 유효합니다.</p>
        </div>
      )}

      {r.analysis && (
        <div className="space-y-3 rounded-lg bg-nk-sunken p-3">
          <Section title="핵심 요약" items={r.analysis.summary} />
          <div>
            <div className="mb-1 text-[12px] font-bold text-nk-ink-sub">학생 현재 상태</div>
            <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-0.5 text-[13px] text-nk-ink">
              <dt className="text-nk-ink-hint">성적</dt>
              <dd>{r.analysis.studentState.grades || "언급 없음"}</dd>
              <dt className="text-nk-ink-hint">습관</dt>
              <dd>{r.analysis.studentState.habits || "언급 없음"}</dd>
              <dt className="text-nk-ink-hint">태도</dt>
              <dd>{r.analysis.studentState.attitude || "언급 없음"}</dd>
            </dl>
          </div>
          <Section title="학부모 요구" items={r.analysis.parentNeeds} />
          <Section title="학부모 걱정" items={r.analysis.parentConcerns} />
          <Section title="약속한 후속 조치" items={r.analysis.followUps} />
          <Section title="반 배정 참고" items={r.analysis.placementNotes} />
          <Section title="주의 신호" items={r.analysis.warningSignals} tone="warn" />
          <div>
            <div className="mb-1 text-[12px] font-bold text-nk-ink-sub">근거 인용</div>
            <ul className="space-y-1">
              {r.analysis.evidence.map((ev, i) => (
                <li key={i} className="border-l-2 border-nk-brass pl-2 text-[12.5px] text-nk-ink">
                  <span className="font-semibold text-nk-ink-sub">{roleByLabel.get(ev.speaker) ?? ev.speaker}</span> “{ev.quote}”
                  {ev.point && <span className="text-nk-ink-hint"> — {ev.point}</span>}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-nk-ink-hint">자동 분석 결과입니다. 원문(전사문)과 함께 확인하세요.</p>
        </div>
      )}

      {r.transcript && r.transcript.length > 0 && (
        <details className="rounded-lg border border-nk-line-soft">
          <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-semibold text-nk-ink-sub">
            전사문 보기 ({r.transcript.length}개 발화)
          </summary>
          <div className="max-h-96 space-y-1.5 overflow-y-auto px-3 pb-3">
            {r.transcript.map((l, i) => {
              const label = speakerLabel(l.seq, l.speaker);
              return (
                <p key={i} className="text-[12.5px] leading-relaxed text-nk-ink">
                  <span className="mr-1.5 font-mono text-[11px] text-nk-ink-hint">
                    {clock(l.startSec)}
                  </span>
                  <span className="mr-1 font-semibold text-nk-navy">{roleByLabel.get(label) ?? label}</span>
                  {l.text}
                </p>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
