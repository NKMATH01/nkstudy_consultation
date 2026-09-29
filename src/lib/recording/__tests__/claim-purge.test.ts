import { describe, expect, it, vi } from "vitest";
import { canClaimSegment, canClaimAnalysis, segmentClaimOrFilter } from "@/lib/recording/claim";
import { purgeExpiredRecordings, type PurgeStore } from "@/lib/recording/purge";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("claim (D4 멱등 선점)", () => {
  it("claim_staleTranscribing_reclaimable", () => {
    expect(canClaimSegment({ status: "transcribing", locked_at: minutesAgo(11) }, NOW)).toBe(true);
    expect(canClaimSegment({ status: "transcribing", locked_at: null }, NOW)).toBe(true);
    expect(canClaimSegment({ status: "uploaded", locked_at: null }, NOW)).toBe(true);
    expect(canClaimSegment({ status: "failed", locked_at: minutesAgo(1) }, NOW)).toBe(true);
  });

  it("claim_freshTranscribing_notReclaimable", () => {
    expect(canClaimSegment({ status: "transcribing", locked_at: minutesAgo(5) }, NOW)).toBe(false);
    expect(canClaimSegment({ status: "transcribed", locked_at: null }, NOW)).toBe(false);
    expect(canClaimSegment({ status: "pending", locked_at: null }, NOW)).toBe(false);
  });

  it("claim_orFilter_matchesRule", () => {
    const f = segmentClaimOrFilter(NOW);
    expect(f).toContain("status.in.(uploaded,failed)");
    expect(f).toContain(`locked_at.lt."${minutesAgo(10)}"`);
    expect(f).toContain("locked_at.is.null");
  });

  it("claim_analysis_requiresFinalizedAndAllTranscribed", () => {
    const rec = { status: "transcribed", finalized_at: minutesAgo(1), locked_at: null, segment_count: 2 };
    const done = [{ status: "transcribed" }, { status: "transcribed" }];
    expect(canClaimAnalysis(rec, done, NOW)).toBe(true);
    expect(canClaimAnalysis({ ...rec, finalized_at: null }, done, NOW)).toBe(false);
    expect(canClaimAnalysis(rec, [{ status: "transcribed" }, { status: "failed" }], NOW)).toBe(false);
    expect(canClaimAnalysis(rec, [{ status: "transcribed" }], NOW)).toBe(false);
    expect(canClaimAnalysis({ ...rec, status: "analyzing", locked_at: minutesAgo(3) }, done, NOW)).toBe(false);
    expect(canClaimAnalysis({ ...rec, status: "analyzing", locked_at: minutesAgo(12) }, done, NOW)).toBe(true);
  });
});

function fakeStore(overrides: Partial<PurgeStore>): PurgeStore & {
  markDeleted: ReturnType<typeof vi.fn>;
  markPurgeError: ReturnType<typeof vi.fn>;
} {
  return {
    listExpired: vi.fn(async () => [{ id: "rec-1" }]),
    listObjects: vi.fn(async () => ["rec-1/seg-001.webm", "rec-1/seg-002.webm", "rec-1/seg-003.webm"]),
    removeObjects: vi.fn(async (paths: string[]) => ({ removed: paths.length, error: null })),
    markDeleted: vi.fn(async () => {}),
    markPurgeError: vi.fn(async () => {}),
    ...overrides,
  } as never;
}

describe("purgeExpiredRecordings (D6)", () => {
  it("purge_partialRemove_noDeletedAt", async () => {
    const store = fakeStore({
      removeObjects: vi.fn(async () => ({ removed: 2, error: null })),
    });
    const result = await purgeExpiredRecordings(store, { now: NOW, limit: 20 });
    expect(store.markDeleted).not.toHaveBeenCalled();
    expect(store.markPurgeError).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 1, deleted: 0, failed: 1 });
  });

  it("purge_fullRemove_setsDeletedAt", async () => {
    const store = fakeStore({});
    const result = await purgeExpiredRecordings(store, { now: NOW, limit: 20 });
    expect(store.markDeleted).toHaveBeenCalledWith("rec-1", NOW.toISOString());
    expect(result).toEqual({ checked: 1, deleted: 1, failed: 0 });
  });

  it("purge_removeError_noDeletedAt", async () => {
    const store = fakeStore({
      removeObjects: vi.fn(async () => ({ removed: 0, error: "boom" })),
    });
    const result = await purgeExpiredRecordings(store, { now: NOW, limit: 20 });
    expect(store.markDeleted).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it("purge_noObjects_marksDeleted", async () => {
    const store = fakeStore({ listObjects: vi.fn(async () => []) });
    const result = await purgeExpiredRecordings(store, { now: NOW, limit: 20 });
    expect(store.removeObjects).not.toHaveBeenCalled();
    expect(result.deleted).toBe(1);
  });
});
