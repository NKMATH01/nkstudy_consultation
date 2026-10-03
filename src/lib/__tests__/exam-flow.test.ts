import { describe, expect, it } from "vitest";
import {
  EXAM_FINISHED_MESSAGE,
  EXAM_LIST_START_DATE,
  EXAM_STATUS_LABEL,
  decideExamAddFiles,
  decideExamDraft,
  examFileLimitBlock,
  examFlowIcons,
  examRequestBlock,
  latestExamByConsultation,
  pickExamTarget,
  arrangeExamList,
  surveyBasedUnregistered,
  mergeUnregisteredCandidates,
  unregisteredExamConsultations,
  type ExamFlowStatus,
} from "../exam-alimtalk";

// 입학테스트 상태 전이(작성 중 → 분석 요청됨 → 분석 중 → 완료 → 보냄) 규칙.
// exam-pull 은 pending 만 가져가므로 draft 는 원장님 PC 로 넘어가지 않는다.

const ALL: ExamFlowStatus[] = ["draft", "pending", "analyzing", "done", "sent"];

describe("decideExamAddFiles", () => {
  it("작성 중(draft)에만 파일을 덧붙인다", () => {
    expect(decideExamAddFiles("draft")).toEqual({ kind: "append" });
  });
  it("분석 요청됨·분석 중이면 거부한다", () => {
    expect(decideExamAddFiles("pending")).toEqual({ kind: "blocked", error: "이미 분석 요청됨" });
    expect(decideExamAddFiles("analyzing")).toEqual({ kind: "blocked", error: "이미 분석 요청됨" });
  });
  it("완료·보냄이면 거부한다(재시험은 한 화면 올리기로)", () => {
    expect(decideExamAddFiles("done")).toEqual({ kind: "blocked", error: EXAM_FINISHED_MESSAGE });
    expect(decideExamAddFiles("sent")).toEqual({ kind: "blocked", error: EXAM_FINISHED_MESSAGE });
  });
});

describe("decideExamDraft", () => {
  it("시험이 없으면 새로 만든다", () => {
    expect(decideExamDraft([])).toEqual({ kind: "create" });
  });
  it("작성 중이 있으면 그것을 다시 쓴다", () => {
    expect(decideExamDraft([{ id: "a", status: "done" }, { id: "b", status: "draft" }])).toEqual({
      kind: "reuse",
      id: "b",
    });
  });
  it("가장 최근이 분석 요청됨·분석 중이면 막는다", () => {
    expect(decideExamDraft([{ id: "a", status: "pending" }])).toEqual({ kind: "blocked", error: "이미 분석 요청됨" });
    expect(decideExamDraft([{ id: "a", status: "analyzing" }]).kind).toBe("blocked");
  });
  it("가장 최근이 완료·보냄이면 막는다(재시험은 한 화면 올리기로)", () => {
    expect(decideExamDraft([{ id: "a", status: "sent" }, { id: "b", status: "done" }])).toEqual({
      kind: "blocked",
      error: EXAM_FINISHED_MESSAGE,
    });
  });
});

describe("examRequestBlock", () => {
  it("작성 중 + 시험지 1장 이상이면 요청할 수 있다", () => {
    expect(examRequestBlock("draft", 1)).toBeNull();
  });
  it("시험지가 없으면 막는다", () => {
    expect(examRequestBlock("draft", 0)).toBe("시험지를 먼저 올려 주세요");
  });
  it("작성 중이 아니면 막는다", () => {
    for (const s of ALL.filter((x) => x !== "draft")) expect(examRequestBlock(s, 3)).not.toBeNull();
    expect(examRequestBlock("pending", 3)).toBe("이미 분석 요청됨");
  });
});

describe("examFileLimitBlock", () => {
  it("시험지는 40장, 매쓰플랫은 2개까지", () => {
    expect(examFileLimitBlock("paper", 39, 1)).toBeNull();
    expect(examFileLimitBlock("paper", 39, 2)).not.toBeNull();
    expect(examFileLimitBlock("mathflex", 1, 1)).toBeNull();
    expect(examFileLimitBlock("mathflex", 2, 1)).not.toBeNull();
  });
  it("0개는 막는다", () => {
    expect(examFileLimitBlock("paper", 0, 0)).not.toBeNull();
  });
});

describe("examFlowIcons", () => {
  const exam = (status: ExamFlowStatus, paperCount = 0, mathflexCount = 0) => ({
    id: "e1",
    status,
    paperCount,
    mathflexCount,
  });

  it("상담이 없거나 여러 건이면 셋 다 비활성", () => {
    for (const count of [0, 2]) {
      const icons = examFlowIcons(count, null);
      for (const icon of [icons.paper, icons.mathflex, icons.request]) {
        expect(icon.enabled).toBe(false);
        expect(icon.title).toBe("상담을 먼저 연결하세요");
      }
    }
  });

  it("시험이 없으면 올리기는 흐리게 열려 있고 분석 요청은 막힌다", () => {
    const icons = examFlowIcons(1, null);
    expect(icons.paper).toMatchObject({ enabled: true, tone: "empty", action: "upload" });
    expect(icons.mathflex).toMatchObject({ enabled: true, tone: "empty", action: "upload" });
    expect(icons.request).toMatchObject({ enabled: false, title: "시험지를 먼저 올려 주세요" });
  });

  it("작성 중: 올린 쪽은 색, 시험지가 있으면 분석 요청 가능", () => {
    const icons = examFlowIcons(1, exam("draft", 3, 0));
    expect(icons.paper.tone).toBe("filled");
    expect(icons.mathflex.tone).toBe("empty");
    expect(icons.request).toMatchObject({ enabled: true, tone: "ready", action: "request" });
    expect(examFlowIcons(1, exam("draft", 0, 1)).request.enabled).toBe(false);
  });

  it("분석 요청됨·분석 중이면 올리기·요청 모두 잠긴다", () => {
    for (const s of ["pending", "analyzing"] as const) {
      const icons = examFlowIcons(1, exam(s, 3, 1));
      expect(icons.paper.enabled).toBe(false);
      expect(icons.mathflex.enabled).toBe(false);
      expect(icons.request.enabled).toBe(false);
      expect(icons.request.tone).toBe(s === "pending" ? "requested" : "analyzing");
    }
  });

  it("완료·보냄이면 아이콘 셋 다 '완료'로, 누르면 상세 화면으로 간다", () => {
    for (const s of ["done", "sent"] as const) {
      const icons = examFlowIcons(1, exam(s, 3, 1));
      for (const icon of [icons.paper, icons.mathflex, icons.request]) {
        expect(icon).toMatchObject({ enabled: true, tone: "done", action: "open" });
      }
    }
  });
});

describe("EXAM_STATUS_LABEL", () => {
  it("상태 칩 문구", () => {
    expect(EXAM_STATUS_LABEL).toEqual({
      unregistered: "미등록",
      draft: "작성 중",
      pending: "분석 요청됨",
      analyzing: "분석 중",
      done: "완료",
      sent: "보냄",
    });
  });
});

describe("latestExamByConsultation", () => {
  it("상담마다 가장 최근 시험 하나", () => {
    const rows = [
      { id: "1", consultation_id: "c1", created_at: "2026-10-01T00:00:00Z" },
      { id: "2", consultation_id: "c1", created_at: "2026-10-02T00:00:00Z" },
      { id: "3", consultation_id: null, created_at: "2026-10-03T00:00:00Z" },
      { id: "4", consultation_id: "c2", created_at: "2026-09-01T00:00:00Z" },
    ];
    const map = latestExamByConsultation(rows);
    expect(map.get("c1")?.id).toBe("2");
    expect(map.get("c2")?.id).toBe("4");
    expect(map.size).toBe(2);
  });
});

describe("unregisteredExamConsultations", () => {
  const c = (id: string, analysis_id: string | null) => ({
    id,
    name: id,
    school: null,
    grade: null,
    subject: null,
    analysis_id,
    consult_date: null,
  });

  it("설문 분석이 있고 시험 행이 없는 상담만, 같은 분석은 최신 상담 하나만", () => {
    // 최신순으로 들어온다
    const consultations = [c("c1", "a1"), c("c2", "a1"), c("c3", "a2"), c("c4", null), c("c5", "a3")];
    const result = unregisteredExamConsultations(consultations, new Set(["c5"]));
    expect(result.map((r) => r.id)).toEqual(["c1", "c3"]);
  });

  it("같은 분석의 다른 상담에 시험이 있으면 뺀다", () => {
    const consultations = [c("c1", "a1"), c("c2", "a1")];
    expect(unregisteredExamConsultations(consultations, new Set(["c2"]))).toEqual([]);
  });
});

describe("pickExamTarget", () => {
  const ex = (id: string, status: ExamFlowStatus, created_at: string) => ({
    id,
    status,
    paperCount: 1,
    mathflexCount: 0,
    created_at,
  });

  it("진행 중(draft) 시험이 예전 상담에 있으면 최신 상담이 아니라 그 시험에 붙인다(draft 두 개 방지)", () => {
    // c-new(최신 상담)에는 시험 없음, c-old 에 draft
    const exams = { "c-old": ex("e-draft", "draft", "2026-10-01T00:00:00Z") };
    const target = pickExamTarget(["c-new", "c-old"], exams, "c-new");
    expect(target).toEqual({ consultationId: "c-old", exam: exams["c-old"] });
    // 아이콘이 c-old 로 올리므로 그 상담에서 decideExamDraft 는 기존 draft 를 다시 쓴다(새로 만들지 않음)
    expect(decideExamDraft([{ id: "e-draft", status: "draft" }])).toEqual({ kind: "reuse", id: "e-draft" });
  });

  it("분석 요청됨·분석 중이면 그 시험 상태를 보여 준다", () => {
    const exams = {
      "c-old": ex("e-p", "pending", "2026-10-01T00:00:00Z"),
      "c-new": ex("e-d", "done", "2026-09-01T00:00:00Z"),
    };
    expect(pickExamTarget(["c-new", "c-old"], exams, "c-new")).toEqual({ consultationId: "c-old", exam: exams["c-old"] });
  });

  it("진행 중 시험이 없으면 고른(또는 최신) 상담 + 가장 최근 시험", () => {
    const exams = {
      "c-old": ex("e-1", "done", "2026-09-01T00:00:00Z"),
      "c-mid": ex("e-2", "sent", "2026-09-20T00:00:00Z"),
    };
    expect(pickExamTarget(["c-new", "c-mid", "c-old"], exams, "c-new")).toEqual({
      consultationId: "c-new",
      exam: exams["c-mid"],
    });
    expect(pickExamTarget(["c-new"], {}, "c-new")).toEqual({ consultationId: "c-new", exam: null });
  });
});

describe("arrangeExamList", () => {
  const e = (id: string, status: ExamFlowStatus, created_at: string) => ({ id, status, created_at });
  const u = (id: string, consult_date: string | null, survey_date: string | null) => ({ id, consult_date, survey_date });

  it("진행 중 → 최근 30일 미등록 → 완료·보냄, 각 묶음은 날짜 내림차순. 30일 전 미등록은 따로", () => {
    const result = arrangeExamList(
      [
        e("done-old", "done", "2026-09-01T00:00:00Z"),
        e("draft", "draft", "2026-09-20T00:00:00Z"),
        e("sent-new", "sent", "2026-09-25T00:00:00Z"),
        e("pending", "pending", "2026-10-01T00:00:00Z"),
        e("analyzing", "analyzing", "2026-09-28T00:00:00Z"),
      ],
      [
        u("old", "2026-08-01", "2026-08-01"),
        u("by-survey", "2026-08-01", "2026-09-30T10:00:00Z"),
        u("future", "2026-10-10", null),
        u("edge", "2026-09-03", null),
        u("none", null, null),
      ],
      "2026-10-03",
      30,
      "2000-01-01", // 시작일 제한 없이 30일 규칙만 본다
    );
    expect(result.active.map((x) => x.id)).toEqual(["pending", "analyzing", "draft"]);
    expect(result.recent.map((x) => x.id)).toEqual(["future", "by-survey", "edge"]);
    expect(result.older.map((x) => x.id)).toEqual(["old"]); // 날짜 없는 학생은 뺀다
    expect(result.finished.map((x) => x.id)).toEqual(["sent-new", "done-old"]);
  });

  it("기본값: 박서진 시험일(2026-09-28) 전 미등록 학생은 목록에 나오지 않는다", () => {
    expect(EXAM_LIST_START_DATE).toBe("2026-09-28");
    const result = arrangeExamList(
      [],
      [
        u("before", "2026-09-19", null),
        u("start-day", "2026-09-28", null),
        u("survey-after", "2026-09-10", "2026-10-01T03:00:00Z"),
        u("after", "2026-10-02", null),
        u("none", null, null),
      ],
      "2026-10-03",
    );
    expect(result.recent.map((x) => x.id)).toEqual(["after", "survey-after", "start-day"]);
    expect(result.older).toEqual([]);
  });
});

describe("surveyBasedUnregistered — 설문하면 입학테스트 목록에 자동으로", () => {
  const consult = (id: string, name: string, phone: string | null, consult_date: string | null, analysis_id: string | null = null) => ({
    id,
    name,
    school: "NK중",
    grade: "중1",
    subject: "수학",
    parent_phone: phone,
    analysis_id,
    consult_date,
  });
  const survey = (id: string, name: string, phone: string | null, created_at: string, analysis_id: string | null = "a-" + id) => ({
    id,
    name,
    school: "NK중",
    grade: "중1",
    parent_phone: phone,
    analysis_id,
    created_at,
    ambiguousName: false,
  });

  it("분석 링크 없는 상담 2건 + 학부모 번호 강매칭(지유찬형) → 최신 상담으로 1행", () => {
    // 상담은 최신순으로 들어온다(10/6 → 10/2), 둘 다 analysis_id 비어 있음
    const consultations = [consult("c-1006", "지유찬", "010-5336-2546", "2026-10-06"), consult("c-1002", "지유찬", "010-5336-2546", "2026-10-02")];
    const { rows } = surveyBasedUnregistered(
      [survey("s-1", "지유찬", "010-5336-2546", "2026-10-02T03:00:00Z")],
      consultations,
      new Set(),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        key: "s-1",
        consultation_id: "c-1006",
        name: "지유찬",
        consult_date: "2026-10-06",
        survey_date: "2026-10-02T03:00:00Z",
      }),
    ]);
  });

  it("매칭 상담 중 하나라도 시험이 있으면 미등록이 아니다", () => {
    const consultations = [consult("c-new", "박서진", "010-1", "2026-10-01"), consult("c-old", "박서진", "010-1", "2026-09-20")];
    const { rows, coveredConsultationIds } = surveyBasedUnregistered(
      [survey("s-1", "박서진", "010-1", "2026-09-28T00:00:00Z")],
      consultations,
      new Set(["c-old"]),
    );
    expect(rows).toEqual([]);
    expect([...coveredConsultationIds].sort()).toEqual(["c-new", "c-old"]);
  });

  it("이름만으로 잡히면 상담 없이(아이콘 비활성) 행만 보여 준다", () => {
    const { rows } = surveyBasedUnregistered(
      [survey("s-1", "김도은", null, "2026-10-01T00:00:00Z", null)],
      [consult("c-1", "김도은", "010-9", "2026-10-01")],
      new Set(),
      // 분석 id·번호가 모두 없는 설문(분석은 analyses.survey_id 로만 찾은 경우를 흉내)
      () => true,
    );
    expect(rows).toEqual([expect.objectContaining({ key: "s-1", consultation_id: null, consult_date: null })]);
  });

  it("시작일 전 설문·분석 없는 설문은 뺀다", () => {
    const { rows } = surveyBasedUnregistered(
      [
        survey("s-old", "옛학생", "010-2", "2026-09-27T14:00:00Z"),
        survey("s-noanalysis", "새학생", "010-3", "2026-10-01T00:00:00Z", null),
      ],
      [consult("c-2", "옛학생", "010-2", "2026-09-27"), consult("c-3", "새학생", "010-3", "2026-10-01")],
      new Set(),
      (s) => s.analysis_id !== null,
    );
    expect(rows).toEqual([]);
  });

  it("같은 상담에 설문이 여러 장이면 1행(최신 설문)", () => {
    const { rows } = surveyBasedUnregistered(
      [survey("s-new", "정다은", "010-4", "2026-10-02T00:00:00Z"), survey("s-old", "정다은", "010-4", "2026-09-29T00:00:00Z")],
      [consult("c-1", "정다은", "010-4", "2026-10-02")],
      new Set(),
    );
    expect(rows.map((r) => r.key)).toEqual(["s-new"]);
  });
});

describe("mergeUnregisteredCandidates", () => {
  it("설문 기반 우선, 같은 상담·같은 분석 학생은 analysis_id 기반에서 뺀다", () => {
    const surveyRows = [{ key: "s-1", consultation_id: "c-1", analysis_id: "a-1" }];
    const analysisRows = [
      { key: "c-1", consultation_id: "c-1", analysis_id: "a-1" },
      { key: "c-2", consultation_id: "c-2", analysis_id: "a-1" },
      { key: "c-3", consultation_id: "c-3", analysis_id: "a-3" },
      { key: "c-4", consultation_id: "c-4", analysis_id: "a-4" },
    ];
    const merged = mergeUnregisteredCandidates(surveyRows, analysisRows, new Set(["c-4"]));
    expect(merged.map((r) => r.key)).toEqual(["s-1", "c-3"]);
  });
});
