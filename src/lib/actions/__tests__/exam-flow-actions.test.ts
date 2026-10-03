import { describe, it, expect, vi, beforeEach } from "vitest";

// requestExamAnalysis·addExamFiles 서버 게이트.
// 작성 중(draft) + 시험지 1장 이상일 때만 pending 으로 넘기고, 분석 요청됨·분석 중에는 파일을 더 붙이지 않는다.
// 거부할 때는 UPDATE 를 부르지 않아야 한다(exam-pull 은 pending 만 가져가므로 상태가 함부로 바뀌면 안 된다).

const { rowRef, updateMock, insertMock, examsRef } = vi.hoisted(() => ({
  rowRef: { current: null as Record<string, unknown> | null },
  examsRef: { current: [] as Record<string, unknown>[] },
  updateMock: vi.fn(),
  insertMock: vi.fn(),
}));

const CONSULTATION = { id: "c-1", name: "박서진", school: "NK중", grade: "중2", subject: null, consult_date: null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/settings", () => ({ getCurrentTeacher: vi.fn() }));
vi.mock("@/lib/actions/report-token", () => ({ revokeReportToken: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "consultations" ? CONSULTATION : rowRef.current, error: null }),
          order: async () => ({ data: examsRef.current, error: null }),
        }),
      }),
      insert: async (row: unknown) => {
        insertMock(row);
        return { error: null };
      },
      update: (patch: unknown) => {
        updateMock(patch);
        const chain = {
          eq: () => chain,
          select: async () => ({ data: [{ id: "x" }], error: null }),
        };
        return chain;
      },
    }),
  })),
}));

const { requestExamAnalysis, addExamFiles } = await import("../exam-analysis");

const EXAM_ID = "11111111-2222-4333-8444-555555555555";
const FILE = `${EXAM_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`;

beforeEach(() => {
  rowRef.current = null;
  examsRef.current = [];
  updateMock.mockReset();
  insertMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requestExamAnalysis", () => {
  it("작성 중 + 시험지 있으면 pending 으로 넘기고 요청자를 남긴다", async () => {
    rowRef.current = { id: EXAM_ID, status: "draft", paper_paths: [FILE] };
    const res = await requestExamAnalysis(EXAM_ID);
    expect(res).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", requested_by: "u-1", requested_at: expect.any(String) }),
    );
  });

  it("시험지가 없으면 막는다", async () => {
    rowRef.current = { id: EXAM_ID, status: "draft", paper_paths: [] };
    expect(await requestExamAnalysis(EXAM_ID)).toEqual({ success: false, error: "시험지를 먼저 올려 주세요" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("이미 요청됐으면 막는다", async () => {
    rowRef.current = { id: EXAM_ID, status: "pending", paper_paths: [FILE] };
    expect(await requestExamAnalysis(EXAM_ID)).toEqual({ success: false, error: "이미 분석 요청됨" });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("addExamFiles", () => {
  it("분석 중이면 거부한다", async () => {
    rowRef.current = { id: EXAM_ID, status: "analyzing", consultation_id: null, paper_paths: [], mathflex_paths: [] };
    expect(await addExamFiles(EXAM_ID, "paper", [FILE])).toEqual({ success: false, error: "이미 분석 요청됨" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("완료된 시험에는 붙이지 않는다(재시험은 한 화면 올리기로)", async () => {
    rowRef.current = { id: EXAM_ID, status: "done", paper_paths: [FILE], mathflex_paths: [] };
    const res = await addExamFiles(EXAM_ID, "mathflex", [FILE]);
    expect(res.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("행이 없으면 상담으로 작성 중 시험을 그 id 로 만들며 파일을 함께 기록한다", async () => {
    rowRef.current = null;
    const CID = "22222222-2222-4333-8444-555555555555";
    expect(await addExamFiles(EXAM_ID, "paper", [FILE], CID)).toEqual({ success: true, examId: EXAM_ID });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: EXAM_ID,
        consultation_id: "c-1",
        status: "draft",
        exam_title: "박서진 입학테스트",
        paper_paths: [FILE],
        mathflex_paths: [],
      }),
    );
  });

  it("행이 없는데 상담 시험이 이미 완료면 만들지 않는다", async () => {
    rowRef.current = null;
    examsRef.current = [{ id: "old", status: "done", paper_paths: [], mathflex_paths: [] }];
    const CID = "22222222-2222-4333-8444-555555555555";
    expect((await addExamFiles(EXAM_ID, "paper", [FILE], CID)).success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("행도 상담 id 도 없으면 거부한다", async () => {
    expect((await addExamFiles(EXAM_ID, "paper", [FILE])).success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("이미 기록된 경로는 다시 붙이지 않는다(재시도 중복 방지)", async () => {
    const extra = `${EXAM_ID}/cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`;
    rowRef.current = { id: EXAM_ID, status: "draft", consultation_id: null, paper_paths: [FILE], mathflex_paths: [] };
    expect(await addExamFiles(EXAM_ID, "paper", [FILE])).toEqual({ success: true, examId: EXAM_ID });
    expect(updateMock).not.toHaveBeenCalled();
    expect(await addExamFiles(EXAM_ID, "paper", [FILE, extra])).toEqual({ success: true, examId: EXAM_ID });
    expect(updateMock).toHaveBeenCalledWith({ paper_paths: [FILE, extra] });
  });

  it("기존 행의 상담이 넘어온 상담과 다르면 거부한다", async () => {
    rowRef.current = {
      id: EXAM_ID,
      status: "draft",
      consultation_id: "33333333-2222-4333-8444-555555555555",
      paper_paths: [],
      mathflex_paths: [],
    };
    const CID = "22222222-2222-4333-8444-555555555555";
    expect(await addExamFiles(EXAM_ID, "paper", [FILE], CID)).toEqual({
      success: false,
      error: "다른 학생의 시험지입니다",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("다른 시험 폴더 경로·시험지 PDF 는 거부한다", async () => {
    rowRef.current = { id: EXAM_ID, status: "draft", consultation_id: null, paper_paths: [], mathflex_paths: [] };
    const other = "99999999-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
    expect((await addExamFiles(EXAM_ID, "paper", [other])).success).toBe(false);
    expect((await addExamFiles(EXAM_ID, "paper", [FILE.replace(".jpg", ".pdf")])).success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("작성 중이면 기존 목록 뒤에 덧붙인다", async () => {
    const prev = `${EXAM_ID}/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`;
    rowRef.current = { id: EXAM_ID, status: "draft", consultation_id: null, paper_paths: [prev], mathflex_paths: [] };
    expect(await addExamFiles(EXAM_ID, "paper", [FILE])).toEqual({ success: true, examId: EXAM_ID });
    expect(updateMock).toHaveBeenCalledWith({ paper_paths: [prev, FILE] });
  });
});
