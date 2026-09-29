import { describe, expect, it, vi } from "vitest";
import { deleteRecordingWithAudio, sweepOrphanFolders, type DeleteRecordingStore, type OrphanStore } from "@/lib/recording/purge";
import { validateUploadRequest } from "@/lib/recording/upload";
import { readLeftoverParts } from "@/lib/recording/local-parts";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe("재작업 2회차", () => {
  it("delete_marksDeletingFirst", async () => {
    const calls: string[] = [];
    let listed = 0;
    const store: DeleteRecordingStore = {
      markDeleting: vi.fn(async () => {
        calls.push("markDeleting");
      }),
      listObjects: vi.fn(async () => {
        calls.push("list");
        listed++;
        // 첫 조회 1개 → 삭제 → 재조회 때 다른 탭이 늦게 올린 1개가 새로 보임
        return listed === 1 ? ["r/seg-001.webm"] : ["r/seg-002.webm"];
      }),
      removeObjects: vi.fn(async (p: string[]) => {
        calls.push("remove");
        return { removed: p.length, error: null };
      }),
      deleteRow: vi.fn(async () => {
        calls.push("deleteRow");
      }),
      markPurgeError: vi.fn(async () => {}),
    };
    const r = await deleteRecordingWithAudio(store, "r");
    expect(calls[0]).toBe("markDeleting");
    // 재조회에서 파일이 남아 있으면 행을 지우지 않는다
    expect(r.ok).toBe(false);
    expect(store.deleteRow).not.toHaveBeenCalled();

    // 재조회 0개면 행 삭제
    const clean: DeleteRecordingStore = {
      ...store,
      listObjects: vi.fn(async () => []),
      deleteRow: vi.fn(async () => {}),
    };
    expect((await deleteRecordingWithAudio(clean, "r")).ok).toBe(true);
    expect(clean.deleteRow).toHaveBeenCalledWith("r");
  });

  it("uploadUrl_rejectsDeleting", () => {
    const r = validateUploadRequest({
      seq: 1,
      recordingStatus: "deleting",
      existing: null,
      audioDeleteAfter: "2099-01-01T00:00:00.000Z",
      audioDeletedAt: null,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("삭제");
  });

  it("orphanSweep_onlyOldFoldersWithoutRow", async () => {
    const objects: Record<string, { path: string; at: string | null }[]> = {
      oldOrphan: [{ path: "oldOrphan/seg-001.webm", at: hoursAgo(30) }],
      newOrphan: [{ path: "newOrphan/seg-001.webm", at: hoursAgo(2) }],
      liveRow: [{ path: "liveRow/seg-001.webm", at: hoursAgo(100) }],
      oldDeleting: [{ path: "oldDeleting/seg-001.webm", at: hoursAgo(100) }],
      newDeleting: [{ path: "newDeleting/seg-001.webm", at: hoursAgo(100) }],
    };
    const store: OrphanStore = {
      listTopFolders: vi.fn(async () => Object.keys(objects)),
      getRows: vi.fn(async () => [
        { id: "liveRow", status: "analyzed", deleting_at: null },
        { id: "oldDeleting", status: "deleting", deleting_at: hoursAgo(25) },
        { id: "newDeleting", status: "deleting", deleting_at: hoursAgo(1) },
      ]),
      listObjectsWithTime: vi.fn(async (folder: string) => objects[folder] ?? []),
      removeObjects: vi.fn(async (paths: string[]) => {
        for (const p of paths) {
          const f = p.split("/")[0];
          objects[f] = (objects[f] ?? []).filter((o) => o.path !== p);
        }
        return { removed: paths.length, error: null };
      }),
      deleteRow: vi.fn(async () => {}),
    };
    const r = await sweepOrphanFolders(store, { now: NOW, limit: 20 });
    expect(r.swept.sort()).toEqual(["oldDeleting", "oldOrphan"]);
    expect(objects.newOrphan.length).toBe(1);
    expect(objects.liveRow.length).toBe(1);
    expect(objects.newDeleting.length).toBe(1);
    expect(store.deleteRow).toHaveBeenCalledWith("oldDeleting");
    expect(store.deleteRow).toHaveBeenCalledTimes(1);
  });

  it("finish_listPartsThrows_releasesLock", async () => {
    // 훅 전체는 브라우저가 필요해 여기서는 마무리 경로가 쓰는 읽기 도우미만 검증한다:
    // IndexedDB 읽기가 예외여도 멈추지 않고 "남은 파트 없음 + 읽기 실패"로 돌아와 마무리·잠금 해제로 이어간다.
    const r = await readLeftoverParts(async () => {
      throw new Error("idb broken");
    });
    expect(r).toEqual({ parts: [], readFailed: true });
    const ok = await readLeftoverParts(async () => [1, 2]);
    expect(ok).toEqual({ parts: [1, 2], readFailed: false });
  });
});
