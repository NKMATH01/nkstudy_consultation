"use client";

// 녹음 실행 영역(principal·admin 전용): 동의 확인 → 녹음 → 마감, 복구 업로드.

import { useState } from "react";
import { Mic, Square, RotateCcw, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CONSENT_CHECK_LABEL,
  CONSENT_PURPOSE_SUMMARY,
  CONSENT_READ_ALOUD,
} from "@/lib/recording/consent";
import type { useRecorder } from "@/lib/recording/use-recorder";

function hhmmss(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function RecordingRecorder({ rec }: { rec: ReturnType<typeof useRecorder> }) {
  const [consented, setConsented] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const active = rec.phase === "recording" || rec.phase === "interrupted" || rec.phase === "finishing";

  return (
    <div className="space-y-3">
      {!active && (
        <div className="rounded-xl border border-nk-line bg-nk-sunken p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONSENT_PURPOSE_SUMMARY.map((item) => (
              <div key={item.title} className="rounded-lg bg-nk-surface px-3 py-2">
                <div className="text-[11px] font-semibold text-nk-ink-hint">{item.title}</div>
                <div className="text-[12.5px] font-semibold text-nk-ink">{item.body}</div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowScript((v) => !v)}
            className="text-[12.5px] font-semibold text-nk-navy underline-offset-2 hover:underline"
          >
            {showScript ? "읽어 줄 안내문 접기" : "읽어 줄 안내문 보기"}
          </button>
          {showScript && (
            <ol className="list-decimal space-y-1 rounded-lg bg-nk-surface py-3 pl-8 pr-3 text-[13px] leading-relaxed text-nk-ink">
              {CONSENT_READ_ALOUD.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          )}

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-nk-navy"
            />
            <span className="text-[12.5px] leading-relaxed text-nk-ink-sub">{CONSENT_CHECK_LABEL}</span>
          </label>

          <Button
            type="button"
            onClick={() => void rec.start()}
            disabled={!consented || rec.phase !== "idle"}
            className="rounded-lg"
          >
            <Mic className="h-4 w-4" />
            {rec.phase === "starting" ? "준비 중..." : "녹음 시작"}
          </Button>
          {!consented && (
            <p className="text-[11.5px] text-nk-ink-hint">동의 확인에 체크해야 녹음 버튼이 켜집니다.</p>
          )}
        </div>
      )}

      {active && (
        <div className="rounded-xl border border-nk-late bg-nk-late-soft p-4 space-y-2" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-nk-late">
              <span className={`h-2.5 w-2.5 rounded-full bg-nk-late ${rec.phase === "recording" ? "animate-pulse" : ""}`} />
              {rec.phase === "recording" ? "녹음 중" : rec.phase === "finishing" ? "마무리 중" : "녹음 멈춤"}
            </span>
            <span className="font-mono text-[18px] font-bold text-nk-ink">{hhmmss(rec.elapsedSec)}</span>
            <span className="text-[12.5px] text-nk-ink-sub">
              저장된 부분 {rec.savedSegments}개{rec.uploading > 0 ? ` · 올리는 중 ${rec.uploading}` : ""}
            </span>
          </div>
          <p className="text-[12.5px] font-semibold text-nk-ink">
            녹음 중에는 화면을 끄지 마세요. 다른 앱으로 나가지 말고 이 화면을 켜 두세요.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {rec.phase === "interrupted" && (
              <Button type="button" variant="outline" onClick={() => void rec.resume()} className="rounded-lg">
                <RotateCcw className="h-4 w-4" />
                이어서 녹음
              </Button>
            )}
            <Button
              type="button"
              onClick={() => void rec.finish()}
              disabled={rec.phase === "finishing"}
              className="rounded-lg"
            >
              <Square className="h-4 w-4" />
              {rec.phase === "finishing" ? "마무리 중..." : "녹음 마치기"}
            </Button>
          </div>
        </div>
      )}

      {rec.warning && (
        <p className="flex items-start gap-1.5 rounded-lg bg-nk-warn-soft px-3 py-2 text-[12.5px] text-nk-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {rec.warning}
        </p>
      )}
      {rec.error && (
        <p className="rounded-lg bg-nk-late-soft px-3 py-2 text-[12.5px] font-semibold text-nk-late">{rec.error}</p>
      )}

      {rec.phase === "idle" && rec.recovery.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-nk-warn bg-nk-warn-soft px-3 py-2.5">
          <span className="text-[12.5px] font-semibold text-nk-warn">
            이 기기에 올리지 못한 녹음 부분 {rec.recovery.length}개가 있습니다.
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void rec.recoverUpload()}
            disabled={rec.recovering}
            className="rounded-lg"
          >
            <Upload className="h-3.5 w-3.5" />
            {rec.recovering ? "올리는 중..." : "복구 업로드"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={rec.recovering}
            onClick={() => {
              if (window.confirm("이 기기에 남은 녹음 부분을 지웁니다. 되돌릴 수 없습니다. 계속할까요?")) {
                void rec.discardRecovery();
              }
            }}
            className="rounded-lg text-nk-ink-sub"
          >
            지우기
          </Button>
        </div>
      )}
    </div>
  );
}
