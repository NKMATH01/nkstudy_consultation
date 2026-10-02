import { describe, it, expect, vi, beforeEach } from "vitest";

// deleteExamAnalysis 서버 게이트 검증.
// 입학테스트 화면은 모든 강사에게 열려 있지만(check-permission ALWAYS_ALLOWED_PATHS),
// 지우기는 원장(principal)·관리자(admin)만 할 수 있다.
// 역할을 못 읽으면(null) 거부하고, 거부할 때는 DB·Storage 를 전혀 건드리지 않아야 한다.

const { getCurrentTeacherMock, fromMock, revokeMock } = vi.hoisted(() => ({
  getCurrentTeacherMock: vi.fn(),
  fromMock: vi.fn(),
  revokeMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/actions/settings", () => ({
  getCurrentTeacher: getCurrentTeacherMock,
}));

vi.mock("@/lib/actions/report-token", () => ({
  revokeReportToken: revokeMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }) },
    // 게이트를 통과하면 첫 조회에서 "없음"으로 멈추게 한다(통과 여부만 본다).
    from: (table: string) => {
      fromMock(table);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    },
  })),
}));

const { deleteExamAnalysis } = await import("../exam-analysis");

const EXAM_ID = "11111111-2222-4333-8444-555555555555";
const DENIED = "삭제는 원장·관리자만 할 수 있습니다";

beforeEach(() => {
  getCurrentTeacherMock.mockReset();
  fromMock.mockReset();
  revokeMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteExamAnalysis 권한", () => {
  it("담임(teacher)은 막고 DB 를 건드리지 않는다", async () => {
    getCurrentTeacherMock.mockResolvedValue({ name: "김수한", role: "teacher" });
    const res = await deleteExamAnalysis(EXAM_ID);
    expect(res).toEqual({ success: false, error: DENIED });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("clinic·staff·director 도 막는다", async () => {
    for (const role of ["clinic", "staff", "director"]) {
      getCurrentTeacherMock.mockResolvedValue({ name: "강사", role });
      const res = await deleteExamAnalysis(EXAM_ID);
      expect(res, role).toEqual({ success: false, error: DENIED });
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("선생님 기록이 없거나 역할이 비면 막는다(fail-closed)", async () => {
    for (const teacher of [null, { name: "이름만", role: null }]) {
      getCurrentTeacherMock.mockResolvedValue(teacher);
      const res = await deleteExamAnalysis(EXAM_ID);
      expect(res).toEqual({ success: false, error: DENIED });
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("원장·관리자는 게이트를 통과해 시험 기록 조회로 넘어간다", async () => {
    for (const role of ["principal", "admin"]) {
      fromMock.mockReset();
      getCurrentTeacherMock.mockResolvedValue({ name: "원장", role });
      const res = await deleteExamAnalysis(EXAM_ID);
      // 조회 결과가 없도록 꾸며 두었으므로 "찾을 수 없음"에서 멈춘다 — 권한 거부가 아니다.
      expect(res, role).toEqual({ success: false, error: "시험지를 찾을 수 없습니다" });
      expect(fromMock, role).toHaveBeenCalledWith("exam_analyses");
    }
  });
});
