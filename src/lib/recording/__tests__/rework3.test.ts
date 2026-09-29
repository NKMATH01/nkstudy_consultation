import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// service.ts 는 env 를 읽으므로 테스트에서는 최소 값으로 대신한다(실제 Gemini 호출 없음).
vi.mock("@/lib/env", () => ({
  env: { GEMINI_API_KEY: "", GEMINI_TRANSCRIBE_MODEL: "m", GEMINI_CONSULT_MODEL: "m" },
}));

import { saveAnalysisOutcome } from "@/lib/recording/service";
import { createSupabaseOrphanStore, ORPHAN_PAGE_SIZE } from "@/lib/recording/purge";

/** update(...).eq(...)...select() 체인을 흉내 내고, 조건이 행과 맞을 때만 갱신된 것으로 돌려준다. */
function fakeAdminWithRow(row: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        const filters: [string, unknown][] = [];
        const chain = {
          eq(col: string, val: unknown) {
            filters.push([col, val]);
            return chain;
          },
          async select() {
            const match = filters.every(([c, v]) => row[c] === v);
            if (match) {
              Object.assign(row, patch);
              updates.push(patch);
              return { data: [{ id: row.id }], error: null };
            }
            return { data: [], error: null };
          },
        };
        return chain;
      },
    }),
  };
  return { admin: admin as unknown as SupabaseClient, updates };
}

describe("재작업 3회차", () => {
  it("analyzeSave_skipsWhenDeleting", async () => {
    const lock = "2026-09-29T10:00:00.000Z";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 분석 중 삭제가 시작돼 status 가 'deleting' 으로 바뀐 행
    const deleting = { id: "r", status: "deleting", locked_at: lock };
    const a = fakeAdminWithRow(deleting);
    expect(await saveAnalysisOutcome(a.admin, "r", lock, { status: "analyzed" })).toBe(false);
    expect(await saveAnalysisOutcome(a.admin, "r", lock, { status: "failed" })).toBe(false);
    expect(deleting.status).toBe("deleting");
    expect(a.updates.length).toBe(0);
    expect(warn).toHaveBeenCalled();

    // 선점 상태 그대로면 저장된다
    const analyzing = { id: "r", status: "analyzing", locked_at: lock };
    const b = fakeAdminWithRow(analyzing);
    expect(await saveAnalysisOutcome(b.admin, "r", lock, { status: "analyzed" })).toBe(true);
    expect(analyzing.status).toBe("analyzed");
    warn.mockRestore();
  });

  it("orphanSweep_paginates", async () => {
    const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const all = Array.from({ length: ORPHAN_PAGE_SIZE + 5 }, (_, i) => ({ name: uuid(i), id: null }));
    const list = vi.fn(async (_prefix: string, opts: { limit: number; offset: number }) => ({
      data: all.slice(opts.offset, opts.offset + opts.limit),
      error: null,
    }));
    const admin = { storage: { from: () => ({ list }) } } as unknown as SupabaseClient;
    const folders = await createSupabaseOrphanStore(admin).listTopFolders();
    expect(folders.length).toBe(ORPHAN_PAGE_SIZE + 5);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1][1]).toEqual({ limit: ORPHAN_PAGE_SIZE, offset: ORPHAN_PAGE_SIZE });
  });
});
