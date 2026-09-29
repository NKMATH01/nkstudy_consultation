import { describe, expect, it, vi } from "vitest";
import { planFinalize } from "@/lib/recording/finalize";
import { validateUploadRequest } from "@/lib/recording/upload";
import { canClaimAnalysis, analysisClaimOrFilter } from "@/lib/recording/claim";
import { toAbsoluteLines } from "@/lib/recording/transcript";
import { parseConsultAnalysis } from "@/lib/recording/analyze";
import { deleteRecordingWithAudio, type DeleteRecordingStore } from "@/lib/recording/purge";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("재작업 1회차", () => {
  it("finalize_withPendingLocalParts_rejected", () => {
    const pending = [
      { id: "a", seq: 2, path: "r/seg-002.webm" },
      { id: "b", seq: 3, path: "r/seg-003.webm" },
    ];
    // 2번은 파일이 있음(완료 기록만 빠짐), 3번은 파일 없음(아직 기기에 있을 수 있음)
    const plan = planFinalize(pending, [{ path: "r/seg-002.webm", size: 100 }], { discardMissing: false });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.missingSeqs).toEqual([3]);
    expect(plan.markUploaded).toEqual([{ id: "a", size: 100 }]);
    // 사용자가 명시적으로 버리기를 고른 경우에만 통과
    const forced = planFinalize(pending, [{ path: "r/seg-002.webm", size: 100 }], { discardMissing: true });
    expect(forced).toEqual({ ok: true, markUploaded: [{ id: "a", size: 100 }], deleteIds: ["b"] });
    expect(planFinalize([], [], { discardMissing: false })).toEqual({ ok: true, markUploaded: [], deleteIds: [] });
  });

  it("uploadUrl_afterExpiry_rejected", () => {
    const base = { seq: 1, recordingStatus: "recording", existing: null, now: NOW };
    expect(validateUploadRequest({ ...base, audioDeleteAfter: minutesAgo(1), audioDeletedAt: null }).ok).toBe(false);
    expect(
      validateUploadRequest({ ...base, audioDeleteAfter: "2026-10-29T00:00:00.000Z", audioDeletedAt: minutesAgo(5) }).ok,
    ).toBe(false);
    expect(
      validateUploadRequest({ ...base, audioDeleteAfter: "2026-10-29T00:00:00.000Z", audioDeletedAt: null }).ok,
    ).toBe(true);
  });

  it("claim_staleAnalyzing_reclaimable", () => {
    const done = [{ status: "transcribed" }];
    const rec = { status: "analyzing", finalized_at: minutesAgo(30), segment_count: 1 };
    expect(canClaimAnalysis({ ...rec, locked_at: minutesAgo(11) }, done, NOW)).toBe(true);
    expect(canClaimAnalysis({ ...rec, locked_at: minutesAgo(9) }, done, NOW)).toBe(false);
    expect(analysisClaimOrFilter(NOW)).toContain(`locked_at.lt."${minutesAgo(10)}"`);
  });

  it("transcript_absoluteOffsets", () => {
    const lines = toAbsoluteLines([
      { seq: 1, duration_sec: 600, transcript: [{ speaker: "spk:0", startSec: 1, endSec: 2, text: "a" }] },
      { seq: 2, duration_sec: null, transcript: [{ speaker: "spk:1", startSec: 5, endSec: 590, text: "b" }] },
      { seq: 3, duration_sec: 100, transcript: [{ speaker: "spk:0", startSec: 3, endSec: 4, text: "c" }] },
    ]);
    expect(lines.map((l) => [l.seq, l.startSec, l.endSec])).toEqual([
      [1, 1, 2],
      [2, 605, 1190],
      // 2번 조각 길이를 모르면 마지막 발화 끝(590초)으로 대신한다
      [3, 1193, 1194],
    ]);
  });

  it("analysis_schema_acceptsSingleEvidence", () => {
    const one = {
      speakers: [{ label: "S1-spk:0", role: "원장" }],
      summary: ["짧은 상담"],
      studentState: { grades: "", habits: "", attitude: "" },
      parentNeeds: [],
      parentConcerns: [],
      followUps: [],
      placementNotes: [],
      warningSignals: [],
      evidence: [{ speaker: "S1-spk:0", quote: "네" }],
    };
    expect(parseConsultAnalysis(one).success).toBe(true);
    expect(parseConsultAnalysis({ ...one, evidence: [] }).success).toBe(false);
    expect(parseConsultAnalysis({ ...one, summary: [] }).success).toBe(false);
  });

  it("deleteRecording_partialRemove_keepsRow", async () => {
    const store: DeleteRecordingStore = {
      markDeleting: vi.fn(async () => {}),
      listObjects: vi.fn(async () => ["r/seg-001.webm", "r/seg-002.webm"]),
      removeObjects: vi.fn(async () => ({ removed: 1, error: null })),
      deleteRow: vi.fn(async () => {}),
      markPurgeError: vi.fn(async () => {}),
    };
    const r = await deleteRecordingWithAudio(store, "r");
    expect(r.ok).toBe(false);
    expect(store.deleteRow).not.toHaveBeenCalled();
    expect(store.markPurgeError).toHaveBeenCalledTimes(1);

    let n = 0;
    const okStore: DeleteRecordingStore = {
      ...store,
      // 첫 조회 2개 → 삭제 후 재조회 0개
      listObjects: vi.fn(async () => (n++ === 0 ? ["r/seg-001.webm", "r/seg-002.webm"] : [])),
      removeObjects: vi.fn(async (p: string[]) => ({ removed: p.length, error: null })),
      deleteRow: vi.fn(async () => {}),
    };
    expect((await deleteRecordingWithAudio(okStore, "r")).ok).toBe(true);
    expect(okStore.deleteRow).toHaveBeenCalledWith("r");
  });
});
