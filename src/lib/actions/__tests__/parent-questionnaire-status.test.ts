import { beforeEach, describe, expect, it, vi } from "vitest";

// 관리용 상태 조회만 검증한다. supabase 는 목으로 바꾼다(실제 DB 접근 없음).
const state: {
  user: { id: string } | null;
  rows: Array<{ consultation_id: string; answered_at: string | null; revoked_at: string | null }>;
  calls: { in?: [string, string[]] };
} = { user: { id: "u1" }, rows: [], calls: {} };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => ({
      select: () => ({
        in: async (col: string, ids: string[]) => {
          state.calls.in = [col, ids];
          return { data: state.rows.filter((r) => ids.includes(r.consultation_id)), error: null };
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/trusted-write", () => ({ createTrustedWriteClient: vi.fn() }));

import { getQuestionnaireStatusByConsultationIds } from "../parent-questionnaire";

beforeEach(() => {
  state.user = { id: "u1" };
  state.rows = [];
  state.calls = {};
});

describe("getQuestionnaireStatusByConsultationIds", () => {
  it("로그인하지 않으면 거절", async () => {
    state.user = null;
    const r = await getQuestionnaireStatusByConsultationIds(["c1"]);
    expect(r.success).toBe(false);
  });

  it("입력 순서대로, 질문지가 없으면 issued=false", async () => {
    state.rows = [
      { consultation_id: "c1", answered_at: null, revoked_at: null },
      { consultation_id: "c2", answered_at: "2026-10-03T01:00:00Z", revoked_at: null },
      { consultation_id: "c3", answered_at: "2026-10-01T01:00:00Z", revoked_at: "2026-10-02T00:00:00Z" },
    ];
    const r = await getQuestionnaireStatusByConsultationIds(["c2", "c1", "c3", "c4", "c2", ""]);
    expect(r.success).toBe(true);
    expect(r.data).toEqual([
      { consultationId: "c2", issued: true, answeredAt: "2026-10-03T01:00:00Z" },
      { consultationId: "c1", issued: true, answeredAt: null },
      // 회수된 질문지는 링크가 만들어진 것으로도 답한 것으로도 치지 않는다
      { consultationId: "c3", issued: false, answeredAt: null },
      { consultationId: "c4", issued: false, answeredAt: null },
    ]);
    expect(state.calls.in).toEqual(["consultation_id", ["c2", "c1", "c3", "c4"]]);
  });

  it("빈 목록이면 DB 를 부르지 않는다", async () => {
    const r = await getQuestionnaireStatusByConsultationIds([]);
    expect(r).toEqual({ success: true, data: [] });
    expect(state.calls.in).toBeUndefined();
  });
});
