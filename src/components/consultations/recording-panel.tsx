"use client";

// 상담 상세의 "상담 녹음" 패널(R4).
// - principal·admin: 동의 → 녹음 버튼, 실패 시 다시 시도, 패널이 뜬 뒤 백그라운드 정리(만료 최대 20건 + 남은 작업 1개).
// - 열람 권한자(D1): 녹음 목록·분석 요약·전사문·원본 재생.
// 권한 판정은 서버(page.tsx·route)가 한다. 이 컴포넌트는 권한 없는 사람에게는 아예 렌더되지 않는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { RecordingRecorder } from "@/components/consultations/recording-recorder";
import { RecordingItem } from "@/components/consultations/recording-item";
import { useRecorder } from "@/lib/recording/use-recorder";
import { isStaleAnalyzing, type RecordingView } from "@/lib/recording/view";

export interface RecordingPanelProps {
  consultationId: string;
  canRecord: boolean;
  userKey: string;
  initialRecordings: RecordingView[];
}

const POLL_MS = 20_000;

function useRecordingList(consultationId: string, initial: RecordingView[]) {
  const [recordings, setRecordings] = useState<RecordingView[]>(initial);
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/recordings?consultationId=${encodeURIComponent(consultationId)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const j = (await res.json()) as { recordings?: RecordingView[] };
      if (Array.isArray(j.recordings)) setRecordings(j.recordings);
    } catch {
      // 다음 새로고침 때 다시 시도
    }
  }, [consultationId]);
  return { recordings, reload };
}

function usePolling(active: boolean, reload: () => Promise<void>) {
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, reload]);
}

function PanelShell({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div
      className="bg-nk-surface rounded-2xl p-6"
      style={{
        border: "1px solid rgb(var(--wr-navy-strong) / 0.04)",
        boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)",
      }}
    >
      <h3 className="mb-4 flex items-center gap-2 text-[14.5px] font-bold text-nk-ink">
        <div className="h-5 w-1 rounded-full bg-nk-cat-3" />
        상담 녹음
        {count > 0 && <span className="text-[12px] font-semibold text-nk-ink-hint">{count}건</span>}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function RecordingList({
  recordings,
  canMutate,
  activeRecordingId,
  localRecordingIds,
  heldRecordingIds,
  onChanged,
}: {
  recordings: RecordingView[];
  canMutate: boolean;
  activeRecordingId: string | null;
  localRecordingIds: Set<string>;
  heldRecordingIds: Set<string>;
  onChanged: () => void;
}) {
  if (recordings.length === 0) {
    return <p className="text-[12.5px] text-nk-ink-hint">아직 녹음이 없습니다.</p>;
  }
  return (
    <div className="space-y-3">
      {recordings.map((r) => (
        <RecordingItem
          key={r.id}
          recording={r}
          canMutate={canMutate}
          isActiveLocally={r.id === activeRecordingId || heldRecordingIds.has(r.id)}
          hasLocalParts={localRecordingIds.has(r.id)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function needsPolling(recordings: RecordingView[]): boolean {
  return recordings.some((r) => r.displayStatus === "transcribing" || r.displayStatus === "analyzing");
}

/** 원장·관리자: 녹음기 + 목록 + 백그라운드 정리. */
function RecordingPanelWithRecorder({ consultationId, userKey, initialRecordings }: Omit<RecordingPanelProps, "canRecord">) {
  const { recordings, reload } = useRecordingList(consultationId, initialRecordings);
  const rec = useRecorder({ userKey, consultationId, onChanged: () => void reload() });
  const activeId = rec.activeRecordingId;
  usePolling(needsPolling(recordings) || activeId !== null, reload);

  // 패널이 뜬 뒤 한 번: 만료 원본 정리(최대 20건) → 남은 작업 1개(분석 대기 우선, 없으면 올라간 조각 전사).
  const backgroundDone = useRef(false);
  const initialRef = useRef(initialRecordings);
  useEffect(() => {
    if (backgroundDone.current) return;
    backgroundDone.current = true;
    const list = initialRef.current;
    void (async () => {
      await fetch("/api/recordings/purge-expired", { method: "POST" }).catch(() => null);
      const now = Date.now();
      // 분석 대기 또는 10분 넘게 멈춘 분석(F)을 먼저 처리한다.
      const waitingAnalysis = list.find((r) => r.status === "transcribed" || isStaleAnalyzing(r, now));
      if (waitingAnalysis) {
        await fetch(`/api/recordings/${waitingAnalysis.id}/analyze`, { method: "POST" }).catch(() => null);
        await reload();
        return;
      }
      for (const r of list) {
        if (r.status === "recording" || r.audioDeletedAt) continue;
        const seg = r.segments.find((s) => s.status === "uploaded");
        if (seg) {
          const res = await fetch(`/api/recordings/${r.id}/segments/${seg.seq}/transcribe`, { method: "POST" }).catch(
            () => null,
          );
          const j = res ? ((await res.json().catch(() => ({}))) as { ready?: boolean }) : {};
          if (j.ready) await fetch(`/api/recordings/${r.id}/analyze`, { method: "POST" }).catch(() => null);
          await reload();
          return;
        }
      }
    })();
  }, [reload]);

  return (
    <PanelShell count={recordings.length}>
      <RecordingRecorder rec={rec} />
      <RecordingList
        recordings={recordings}
        canMutate
        activeRecordingId={activeId}
        localRecordingIds={new Set(rec.recovery.map((g) => g.recordingId))}
        heldRecordingIds={new Set(rec.heldRecordingIds)}
        onChanged={() => void reload()}
      />
    </PanelShell>
  );
}

/** 열람만 가능한 사람(담당 선생님). */
function RecordingPanelReadOnly({ consultationId, initialRecordings }: Omit<RecordingPanelProps, "canRecord" | "userKey">) {
  const { recordings, reload } = useRecordingList(consultationId, initialRecordings);
  usePolling(needsPolling(recordings), reload);
  if (recordings.length === 0) return null;
  return (
    <PanelShell count={recordings.length}>
      <RecordingList
        recordings={recordings}
        canMutate={false}
        activeRecordingId={null}
        localRecordingIds={new Set()}
        heldRecordingIds={new Set()}
        onChanged={() => void reload()}
      />
    </PanelShell>
  );
}

export function RecordingPanel(props: RecordingPanelProps) {
  if (props.canRecord) {
    return (
      <RecordingPanelWithRecorder
        consultationId={props.consultationId}
        userKey={props.userKey}
        initialRecordings={props.initialRecordings}
      />
    );
  }
  return <RecordingPanelReadOnly consultationId={props.consultationId} initialRecordings={props.initialRecordings} />;
}
