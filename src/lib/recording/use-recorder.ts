"use client";

// 상담 녹음 브라우저 훅(D2).
// - getUserMedia 1회, 10분마다 새 MediaRecorder 를 먼저 start 하고 0.5초 뒤 옛 레코더 stop(겹침).
// - timeslice 10초 파트는 IndexedDB 에 쌓고, 조각 업로드 + 서버 완료 기록 확인 뒤에만 지운다.
// - 트랙 종료(마이크 끊김·권한 회수) 시 현재 조각을 즉시 마감·업로드하고 경고.
// - Wake Lock 을 잡고, 화면이 다시 보이면 재요청.
// - 새로고침·끊김으로 남은 파트는 "복구 업로드"로 이어 붙여 올린다.
// - 업로드 원본은 메모리 사본, IndexedDB 는 백업(B). 녹음 중인 탭은 Web Lock 을 쥐고,
//   복구는 그 잠금이 없을 때만 한다(C, 미지원 브라우저는 확인창).

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AUDIO_BITS_PER_SECOND,
  MAX_SEGMENT_SEQ,
  RECORDING_BUCKET,
  SEGMENT_SECONDS,
  TIMESLICE_MS,
} from "@/lib/recording/constants";
import { CONSENT_VERSION } from "@/lib/recording/consent";
import {
  deleteParts,
  groupParts,
  listParts,
  partKey,
  purgeOldParts,
  putPart,
  type LocalSegmentGroup,
} from "@/lib/recording/idb";
import { readLeftoverParts } from "@/lib/recording/local-parts";

const LOCAL_PART_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function recordingLockName(recordingId: string): string {
  return `nk-rec-${recordingId}`;
}

interface LockManagerLike {
  request(name: string, cb: () => Promise<void>): Promise<void>;
  request(name: string, opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<void>): Promise<void>;
  query(): Promise<{ held?: { name?: string }[] }>;
}

function getLocks(): LockManagerLike | null {
  if (typeof navigator === "undefined") return null;
  return ((navigator as Navigator & { locks?: LockManagerLike }).locks ?? null) as LockManagerLike | null;
}

/** 녹음 중인 탭이 잠금을 쥔다. 반환 함수로 푼다. 미지원이면 null. */
function holdRecordingLock(recordingId: string): Promise<(() => void) | null> {
  const locks = getLocks();
  if (!locks) return Promise.resolve(null);
  return new Promise((resolveOuter) => {
    void locks
      .request(recordingLockName(recordingId), () => new Promise<void>((release) => resolveOuter(release)))
      .catch(() => resolveOuter(null));
  });
}

async function heldLockNames(): Promise<Set<string> | null> {
  const locks = getLocks();
  if (!locks) return null;
  try {
    const q = await locks.query();
    return new Set((q.held ?? []).map((l) => l.name ?? ""));
  } catch {
    return null;
  }
}

export type RecorderPhase = "idle" | "starting" | "recording" | "interrupted" | "finishing";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
];

export function pickRecorderMime(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // 일부 브라우저는 isTypeSupported 가 예외를 던진다
    }
  }
  return null;
}

function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function postJson(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(res.status, typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json;
}

/** 조각 하나 업로드: 서명 URL → Storage 직접 업로드 → 서버 완료 기록. 끝까지 성공해야 resolve. */
async function uploadSegmentBlob(recordingId: string, seq: number, blob: Blob, durationSec: number | null) {
  let signed: Record<string, unknown> | null = null;
  try {
    signed = await postJson(`/api/recordings/${recordingId}/upload-url`, { seq });
  } catch (e) {
    // 409 = 이미 올라갔거나(완료 기록 전) 발급된 순번. 완료 기록만 다시 시도해 본다.
    if (!(e instanceof HttpError && e.status === 409)) throw e;
  }
  if (signed) {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(RECORDING_BUCKET)
      .uploadToSignedUrl(String(signed.path), String(signed.token), blob, {
        contentType: baseMime(String(signed.contentType ?? blob.type)),
      });
    if (error) {
      // E: 파일은 이미 올라갔는데 완료 기록 전에 끊긴 경우 → 완료 기록으로 진행
      const status = String((error as { statusCode?: string | number }).statusCode ?? "");
      const duplicate = status === "409" || /duplicate|already exists|409/i.test(error.message ?? "");
      if (!duplicate) throw new Error("오디오 업로드 실패");
    }
  }
  await postJson(`/api/recordings/${recordingId}/segments/${seq}`, { durationSec });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof HttpError && e.status < 500 && e.status !== 409) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

/** 전사 요청(기다리지 않음). 마지막 조각이면 분석까지 이어 부른다. */
function kickTranscribe(recordingId: string, seq: number, onChanged?: () => void) {
  void postJson(`/api/recordings/${recordingId}/segments/${seq}/transcribe`)
    .then((r) => {
      onChanged?.();
      if (r.ready === true) {
        return postJson(`/api/recordings/${recordingId}/analyze`).then(() => onChanged?.());
      }
    })
    .catch(() => onChanged?.());
}

interface ActiveSegment {
  recorder: MediaRecorder;
  seq: number;
  nextIdx: number;
  startedAt: number;
  saves: Promise<void>[];
  /** 업로드 원본(메모리 사본). IndexedDB 는 백업. */
  chunks: Blob[];
  idbFailed: boolean;
  finished: Promise<void>;
  resolveFinished: () => void;
}

interface WakeLockLike {
  release(): Promise<void>;
}

export function useRecorder(opts: { userKey: string; consultationId: string; onChanged?: () => void }) {
  const { userKey, consultationId, onChanged } = opts;
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [savedSegments, setSavedSegments] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<LocalSegmentGroup[]>([]);
  const [recovering, setRecovering] = useState(false);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  /** 이 기기의 다른 탭이 녹음 중(잠금 보유)인 녹음 id — 삭제 버튼을 숨긴다. */
  const [heldRecordingIds, setHeldRecordingIds] = useState<string[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("");
  const recordingIdRef = useRef<string | null>(null);
  const currentRef = useRef<ActiveSegment | null>(null);
  const overlapRef = useRef<ActiveSegment | null>(null);
  const lastSeqRef = useRef(0);
  const startedAtRef = useRef(0);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockLike | null>(null);
  const pendingRef = useRef<Set<Promise<void>>>(new Set());
  const phaseRef = useRef<RecorderPhase>("idle");
  const onChangedRef = useRef(onChanged);
  /** 올리지 못한 조각의 메모리 사본(마치기 때 다시 시도). */
  const unsentRef = useRef<Map<number, { blob: Blob; durationSec: number }>>(new Map());
  const releaseLockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  const updatePhase = useCallback((p: RecorderPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const refreshRecovery = useCallback(async () => {
    const heldNow = await heldLockNames();
    setHeldRecordingIds(
      heldNow
        ? [...heldNow].filter((n) => n.startsWith("nk-rec-")).map((n) => n.slice("nk-rec-".length))
        : [],
    );
    try {
      const parts = await listParts(userKey);
      const active = phaseRef.current === "recording" || phaseRef.current === "interrupted" || phaseRef.current === "finishing"
        ? recordingIdRef.current
        : null;
      const held = await heldLockNames();
      setRecovery(
        groupParts(parts).filter(
          (g) => g.recordingId !== active && !(held && held.has(recordingLockName(g.recordingId))),
        ),
      );
    } catch {
      setRecovery([]);
    }
  }, [userKey]);

  // 다른 탭의 녹음 잠금 상태를 주기적으로 다시 본다.
  useEffect(() => {
    const t = setInterval(() => void refreshRecovery(), 15_000);
    return () => clearInterval(t);
  }, [refreshRecovery]);

  // L: 패널을 열 때 3일 넘은 로컬 파트(사용자 무관) 정리 → 복구 목록 갱신.
  useEffect(() => {
    void purgeOldParts(LOCAL_PART_MAX_AGE_MS)
      .catch(() => 0)
      .then(() => refreshRecovery());
  }, [refreshRecovery]);

  // L: 로그아웃하면 이 사용자의 로컬 파트를 지운다(가능한 범위: 이 화면이 열려 있을 때).
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      void listParts(userKey)
        .then((parts) => deleteParts(parts.map((p) => p.key)))
        .catch(() => {});
    });
    return () => data.subscription.unsubscribe();
  }, [userKey]);

  // ───────── Wake Lock ─────────
  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockLike> } };
      if (!nav.wakeLock) return;
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      // 지원하지 않거나 거부됨 — 안내 문구로 대신한다
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) void lock.release().catch(() => {});
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && phaseRef.current === "recording") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  /** 조각 업로드 성공 뒤 IndexedDB 백업 파트를 지운다. */
  const dropLocalSeq = useCallback(
    async (recordingId: string, seq: number) => {
      try {
        const parts = (await listParts(userKey)).filter((p) => p.recordingId === recordingId && p.seq === seq);
        await deleteParts(parts.map((p) => p.key));
      } catch {
        // 백업 정리 실패는 3일 뒤 자동 정리에 맡긴다
      }
    },
    [userKey],
  );

  const uploadFromMemory = useCallback(
    async (recordingId: string, seq: number, blob: Blob, durationSec: number): Promise<boolean> => {
      setUploading((n) => n + 1);
      try {
        await withRetry(() => uploadSegmentBlob(recordingId, seq, blob, durationSec));
        unsentRef.current.delete(seq);
        await dropLocalSeq(recordingId, seq);
        setSavedSegments((n) => n + 1);
        kickTranscribe(recordingId, seq, onChangedRef.current);
        return true;
      } catch {
        unsentRef.current.set(seq, { blob, durationSec });
        return false;
      } finally {
        setUploading((n) => n - 1);
      }
    },
    [dropLocalSeq],
  );

  // ───────── 조각 마감·업로드(메모리 사본이 원본) ─────────
  const finishSegment = useCallback(
    async (seg: ActiveSegment, durationSec: number) => {
      const recordingId = recordingIdRef.current;
      if (!recordingId) return;
      await Promise.allSettled(seg.saves);
      if (seg.chunks.length === 0) return;
      const blob = new Blob(seg.chunks, { type: baseMime(mimeRef.current) });
      const ok = await uploadFromMemory(recordingId, seg.seq, blob, durationSec);
      if (!ok) {
        setWarning(
          seg.idbFailed
            ? `${seg.seq}번째 조각을 올리지 못했고 이 기기 임시 저장도 실패했습니다. 화면을 닫지 말고 '녹음 마치기'로 다시 올려 주세요.`
            : `${seg.seq}번째 조각을 올리지 못했습니다. '녹음 마치기' 때 다시 올리고, 그래도 안 되면 '복구 업로드'를 써 주세요.`,
        );
      }
    },
    [uploadFromMemory],
  );

  const stopTimers = useCallback(() => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = null;
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
  }, []);

  const stopSegment = useCallback((seg: ActiveSegment | null) => {
    if (!seg) return;
    if (seg.recorder.state !== "inactive") {
      try {
        seg.recorder.stop();
      } catch {
        seg.resolveFinished();
      }
    }
  }, []);

  const startSegmentRef = useRef<(seq: number) => void>(() => {});

  const startSegment = useCallback(
    (seq: number) => {
      const stream = streamRef.current;
      const recordingId = recordingIdRef.current;
      if (!stream || !recordingId) return;
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeRef.current,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      let resolveFinished: () => void = () => {};
      const finished = new Promise<void>((r) => {
        resolveFinished = r;
      });
      const seg: ActiveSegment = {
        recorder,
        seq,
        nextIdx: 0,
        startedAt: Date.now(),
        saves: [],
        chunks: [],
        idbFailed: false,
        finished,
        resolveFinished,
      };
      recorder.ondataavailable = (e: BlobEvent) => {
        if (!e.data || e.data.size === 0) return;
        const idx = seg.nextIdx++;
        seg.chunks.push(e.data);
        seg.saves.push(
          putPart({
            key: partKey(userKey, recordingId, seq, idx),
            userKey,
            recordingId,
            seq,
            idx,
            mime: mimeRef.current,
            blob: e.data,
            savedAt: Date.now(),
          }).catch(() => {
            seg.idbFailed = true;
            setWarning(
              "이 기기에 녹음 백업을 저장하지 못했습니다(저장 공간 확인). 녹음은 계속되며, 조각이 끝나는 즉시 올립니다. 화면을 닫지 마세요.",
            );
          }),
        );
      };
      recorder.onstop = () => {
        const duration = (Date.now() - seg.startedAt) / 1000;
        const p = finishSegment(seg, duration).finally(() => {
          pendingRef.current.delete(p);
          seg.resolveFinished();
        });
        pendingRef.current.add(p);
      };
      recorder.start(TIMESLICE_MS);
      currentRef.current = seg;
      lastSeqRef.current = seq;

      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
      rotateTimerRef.current = setTimeout(() => {
        const old = currentRef.current;
        if (!old || phaseRef.current !== "recording") return;
        const next = old.seq + 1;
        if (next > MAX_SEGMENT_SEQ) {
          setWarning("최대 녹음 시간(12시간)에 도달해 녹음을 멈췄습니다.");
          stopTimers();
          stopSegment(old);
          updatePhase("interrupted");
          return;
        }
        startSegmentRef.current(next); // 새 레코더 먼저
        overlapRef.current = old;
        setTimeout(() => stopSegment(old), 500); // 약 0.5초 겹친 뒤 옛 레코더 정지
      }, SEGMENT_SECONDS * 1000);
    },
    [finishSegment, stopSegment, stopTimers, updatePhase, userKey],
  );

  useEffect(() => {
    startSegmentRef.current = startSegment;
  }, [startSegment]);

  const handleTrackEnded = useCallback(() => {
    if (phaseRef.current !== "recording") return;
    stopTimers();
    stopSegment(overlapRef.current);
    stopSegment(currentRef.current);
    releaseWakeLock();
    updatePhase("interrupted");
    setWarning("마이크 연결이 끊겼습니다. 여기까지 녹음된 부분은 올리고 있습니다. '이어서 녹음' 또는 '녹음 마치기'를 눌러 주세요.");
  }, [releaseWakeLock, stopSegment, stopTimers, updatePhase]);

  const acquireStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    stream.getAudioTracks().forEach((t) => {
      t.onended = handleTrackEnded;
    });
    stream.addEventListener("inactive", handleTrackEnded);
    streamRef.current = stream;
    return stream;
  }, [handleTrackEnded]);

  const startTick = useCallback(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  }, []);

  const start = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    setError(null);
    setWarning(null);
    const mime = pickRecorderMime();
    if (!mime) {
      setError("이 브라우저는 녹음을 지원하지 않습니다.");
      return;
    }
    updatePhase("starting");
    try {
      await acquireStream();
    } catch {
      updatePhase("idle");
      setError("마이크를 사용할 수 없습니다. 브라우저의 마이크 권한을 확인해 주세요.");
      return;
    }
    try {
      const res = await postJson("/api/recordings", {
        consultationId,
        mime,
        consentChecked: true,
        consentVersion: CONSENT_VERSION,
      });
      recordingIdRef.current = String(res.id);
      setActiveRecordingId(String(res.id));
      mimeRef.current = mime;
      unsentRef.current.clear();
      releaseLockRef.current = await holdRecordingLock(String(res.id));
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      updatePhase("idle");
      setError(e instanceof Error ? e.message : "녹음을 시작하지 못했습니다.");
      return;
    }
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    setSavedSegments(0);
    updatePhase("recording");
    startSegment(1);
    startTick();
    void requestWakeLock();
    onChangedRef.current?.();
  }, [acquireStream, consultationId, requestWakeLock, startSegment, startTick, updatePhase]);

  const resume = useCallback(async () => {
    if (phaseRef.current !== "interrupted" || !recordingIdRef.current) return;
    const next = lastSeqRef.current + 1;
    if (next > MAX_SEGMENT_SEQ) return;
    try {
      await acquireStream();
    } catch {
      setError("마이크를 다시 켜지 못했습니다.");
      return;
    }
    setWarning(null);
    updatePhase("recording");
    startSegment(next);
    startTick();
    void requestWakeLock();
  }, [acquireStream, requestWakeLock, startSegment, startTick, updatePhase]);

  const finish = useCallback(async () => {
    const recordingId = recordingIdRef.current;
    if (!recordingId || (phaseRef.current !== "recording" && phaseRef.current !== "interrupted")) return;
    updatePhase("finishing");
    stopTimers();
    const old = overlapRef.current;
    stopSegment(old);
    if (old) await old.finished;
    overlapRef.current = null;
    const cur = currentRef.current;
    stopSegment(cur);
    if (cur) await cur.finished;
    await Promise.allSettled([...pendingRef.current]);
    streamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    streamRef.current = null;
    releaseWakeLock();

    // 메모리에 남은(올리지 못한) 조각을 다시 올린다. 그래도 실패하면 마감하지 않고 멈춤 상태로 둔다.
    for (const [seq, item] of [...unsentRef.current.entries()]) {
      await uploadFromMemory(recordingId, seq, item.blob, item.durationSec);
    }
    if (unsentRef.current.size > 0) {
      updatePhase("interrupted");
      setError(
        `올리지 못한 조각(${[...unsentRef.current.keys()].join(", ")}번)이 있습니다. 인터넷 연결을 확인하고 '녹음 마치기'를 다시 눌러 주세요.`,
      );
      return;
    }

    // 재작업2-3: IndexedDB 읽기가 실패해도 멈추지 않는다 — 경고만 하고 메모리 기준으로 마무리·잠금 해제.
    const { parts: localParts, readFailed } = await readLeftoverParts(() => listParts(userKey));
    if (readFailed) {
      setWarning("이 기기 임시 저장소를 읽지 못했습니다. 올라간 조각 기준으로 마무리합니다.");
    }
    const leftover = localParts.filter((p) => p.recordingId === recordingId);
    if (leftover.length > 0) {
      // 올리지 못한 조각이 있으면 마감하지 않는다(마감 뒤에는 업로드 URL 이 발급되지 않음).
      recordingIdRef.current = null;
      setActiveRecordingId(null);
      currentRef.current = null;
      releaseLockRef.current?.();
      releaseLockRef.current = null;
      updatePhase("idle");
      setWarning("아직 올라가지 않은 조각이 있습니다. '복구 업로드'를 눌러 마저 올려 주세요.");
      await refreshRecovery();
      onChangedRef.current?.();
      return;
    }
    try {
      const r = await postJson(`/api/recordings/${recordingId}/finalize`, {
        durationSec: Math.floor((Date.now() - startedAtRef.current) / 1000),
      });
      if (r.ready === true) {
        void postJson(`/api/recordings/${recordingId}/analyze`)
          .then(() => onChangedRef.current?.())
          .catch(() => onChangedRef.current?.());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "녹음 마감에 실패했습니다.");
    }
    recordingIdRef.current = null;
    setActiveRecordingId(null);
    currentRef.current = null;
    releaseLockRef.current?.();
    releaseLockRef.current = null;
    updatePhase("idle");
    onChangedRef.current?.();
  }, [refreshRecovery, releaseWakeLock, stopSegment, stopTimers, updatePhase, uploadFromMemory, userKey]);

  /**
   * 남은 로컬 파트를 조각별로 이어 붙여 올리고, 그 녹음을 마감한다.
   * C: 다른 탭이 녹음 중(잠금 보유)인 녹음은 건너뛴다. Web Locks 미지원이면 확인창을 먼저 띄운다.
   */
  const recoverUpload = useCallback(async () => {
    if (recovering) return;
    const locks = getLocks();
    if (
      !locks &&
      !window.confirm("다른 탭이나 창에서 이 녹음이 아직 진행 중이 아닌지 확인해 주세요. 복구 업로드를 계속할까요?")
    ) {
      return;
    }
    setRecovering(true);
    setError(null);
    const failed: string[] = [];
    let skippedActive = 0;
    try {
      const groups = groupParts(await listParts(userKey)).filter(
        (g) => !(phaseRef.current !== "idle" && g.recordingId === recordingIdRef.current),
      );
      const byRecording = new Map<string, LocalSegmentGroup[]>();
      for (const g of groups) byRecording.set(g.recordingId, [...(byRecording.get(g.recordingId) ?? []), g]);

      const recoverOne = async (recordingId: string, list: LocalSegmentGroup[]) => {
        for (const g of list) {
          try {
            const blob = new Blob(g.parts.map((p) => p.blob), { type: baseMime(g.parts[0].mime) });
            await withRetry(() => uploadSegmentBlob(g.recordingId, g.seq, blob, null));
            await deleteParts(g.parts.map((p) => p.key));
            kickTranscribe(g.recordingId, g.seq, onChangedRef.current);
          } catch {
            failed.push(`${g.seq}번째 조각`);
          }
        }
        const stillLocal = (await listParts(userKey)).some((p) => p.recordingId === recordingId);
        if (stillLocal) return;
        try {
          await postJson(`/api/recordings/${recordingId}/finalize`, {});
        } catch {
          // 이미 마감됐거나(409) 다른 기기에 남은 조각이 있으면 거부 — 목록의 안내를 따른다
        }
      };

      for (const [recordingId, list] of byRecording) {
        if (!locks) {
          await recoverOne(recordingId, list);
          continue;
        }
        await locks.request(recordingLockName(recordingId), { ifAvailable: true }, async (lock) => {
          if (!lock) {
            skippedActive++;
            return;
          }
          await recoverOne(recordingId, list);
        });
      }
      if (failed.length > 0) {
        setError(`${failed.join(", ")}을(를) 올리지 못했습니다. 이미 마감되었거나 보관 기간이 지난 녹음이면 올릴 수 없습니다.`);
      } else if (skippedActive > 0) {
        setWarning("다른 탭에서 녹음 중인 조각은 건너뛰었습니다.");
      } else {
        setWarning(null);
      }
    } finally {
      setRecovering(false);
      await refreshRecovery();
      onChangedRef.current?.();
    }
  }, [recovering, refreshRecovery, userKey]);

  /** 올릴 수 없는 로컬 파트를 이 기기에서 지운다(사용자 확인 뒤 호출). */
  const discardRecovery = useCallback(async () => {
    const held = await heldLockNames();
    const parts = (await listParts(userKey)).filter(
      (p) =>
        !(phaseRef.current !== "idle" && p.recordingId === recordingIdRef.current) &&
        !(held && held.has(recordingLockName(p.recordingId))),
    );
    await deleteParts(parts.map((p) => p.key));
    setError(null);
    await refreshRecovery();
  }, [refreshRecovery, userKey]);

  // 화면을 떠날 때 마이크·타이머 정리(파트는 IndexedDB 에 남아 복구 가능).
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      const cur = currentRef.current;
      if (cur && cur.recorder.state !== "inactive") {
        try {
          cur.recorder.stop();
        } catch {
          // 무시
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const lock = wakeLockRef.current;
      if (lock) void lock.release().catch(() => {});
      releaseLockRef.current?.();
      pending.clear();
    };
  }, []);

  // 녹음 중 새로고침·닫기 경고
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === "recording" || phaseRef.current === "finishing") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    activeRecordingId,
    heldRecordingIds,
    phase,
    elapsedSec,
    savedSegments,
    uploading,
    warning,
    error,
    recovery,
    recovering,
    start,
    resume,
    finish,
    recoverUpload,
    discardRecovery,
  };
}
