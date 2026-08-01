import { describe, it, expect, vi, beforeEach } from "vitest";

// saveFirst14Check의 서버 게이트 검증.
// 이 기록은 강사 평가가 아니라 설문 채점이라 담임(teacher)도 쓸 수 있어야 하고,
// 수업 안 행동을 판정할 위치가 아닌 clinic(조교)은 막혀야 한다.
// 작성자 이름은 클라이언트가 보낸 값이 아니라 서버가 읽은 계정 이름이어야 한다.

const { getCurrentTeacherMock, upsertMock } = vi.hoisted(() => ({
  getCurrentTeacherMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/actions/settings", () => ({
  getCurrentTeacher: getCurrentTeacherMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      upsert: (payload: Record<string, unknown>) => {
        upsertMock(payload);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  item_index: payload.item_index,
                  item_text: payload.item_text,
                  teacher: payload.teacher,
                  result: payload.result,
                  note: payload.note,
                  checked_at: payload.checked_at,
                },
                error: null,
              }),
          }),
        };
      },
    }),
  })),
}));

const { saveFirst14Check } = await import("../first14");

const VALID = {
  analysisId: "a-1",
  itemIndex: 1,
  itemText: "숙제를 기한 안에 제출하는지",
  result: "matched" as const,
};

beforeEach(() => {
  getCurrentTeacherMock.mockReset();
  upsertMock.mockReset();
});

describe("saveFirst14Check 권한", () => {
  it("로그인하지 않으면 저장하지 않는다", async () => {
    getCurrentTeacherMock.mockResolvedValue(null);
    const res = await saveFirst14Check(VALID);
    expect(res.success).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("teacher·admin·principal은 저장할 수 있다", async () => {
    for (const role of ["teacher", "admin", "principal"]) {
      getCurrentTeacherMock.mockResolvedValue({ name: "김수한", role });
      const res = await saveFirst14Check(VALID);
      expect(res.success, role).toBe(true);
    }
  });

  it("clinic은 막는다", async () => {
    getCurrentTeacherMock.mockResolvedValue({ name: "조교", role: "clinic" });
    const res = await saveFirst14Check(VALID);
    expect(res.success).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("역할이 없는 계정도 막는다", async () => {
    getCurrentTeacherMock.mockResolvedValue({ name: "이름만", role: null });
    const res = await saveFirst14Check(VALID);
    expect(res.success).toBe(false);
  });
});

describe("saveFirst14Check 입력 검증", () => {
  beforeEach(() => {
    getCurrentTeacherMock.mockResolvedValue({ name: "김수한", role: "teacher" });
  });

  it("1~3 밖의 행 번호를 거부한다", async () => {
    for (const itemIndex of [0, 4, -1]) {
      const res = await saveFirst14Check({ ...VALID, itemIndex });
      expect(res.success, String(itemIndex)).toBe(false);
    }
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("정의되지 않은 결과값을 거부한다", async () => {
    const res = await saveFirst14Check({
      ...VALID,
      result: "good" as never,
    });
    expect(res.success).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("확인 문장이 비면 거부한다", async () => {
    const res = await saveFirst14Check({ ...VALID, itemText: "   " });
    expect(res.success).toBe(false);
  });
});

describe("saveFirst14Check 작성자", () => {
  it("작성자는 서버가 읽은 계정 이름으로 기록한다", async () => {
    getCurrentTeacherMock.mockResolvedValue({ name: "노윤희", role: "principal" });
    const res = await saveFirst14Check({
      ...VALID,
      // 클라이언트가 다른 이름을 끼워 넣어도 payload에 반영되지 않아야 한다.
      ...({ teacher: "남의이름" } as Record<string, unknown>),
    });
    expect(res.success).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0].teacher).toBe("노윤희");
  });

  it("빈 메모는 null로 저장한다", async () => {
    getCurrentTeacherMock.mockResolvedValue({ name: "김수한", role: "teacher" });
    await saveFirst14Check({ ...VALID, note: "   " });
    expect(upsertMock.mock.calls[0][0].note).toBeNull();
  });
});
