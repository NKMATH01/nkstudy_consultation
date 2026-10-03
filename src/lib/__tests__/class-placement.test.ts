import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  pickTestScoreDefaults,
  rankClassesForStudent,
  examReportTarget,
  unitNamesMatch,
  type EntranceExam,
  type PlacementClass,
} from "@/lib/class-placement";
import { buildExamScoreSummary } from "../../../scripts/lib/exam-score-summary.mjs";

// getLatestExamForConsultation 용 supabase 목 — 이 파일의 다른 테스트는 supabase 를 쓰지 않는다.
const { queryResult, getReportByTokenMock, inCalls } = vi.hoisted(() => ({
  queryResult: { current: { data: null as unknown, error: null as unknown } },
  getReportByTokenMock: vi.fn(),
  inCalls: [] as [string, unknown][],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "eq", "order", "limit"]) chain[k] = () => chain;
    chain.in = (column: string, values: unknown) => {
      inCalls.push([column, values]);
      return chain;
    };
    chain.maybeSingle = () => Promise.resolve(queryResult.current);
    return { from: () => chain };
  }),
}));

vi.mock("@/lib/actions/report-token", () => ({
  getReportByToken: getReportByTokenMock,
}));

const { getLatestExamForConsultation } = await import("@/lib/actions/exam-lookup");

function cls(over: Partial<PlacementClass>): PlacementClass {
  return {
    classId: over.className ?? "c",
    className: "고2 A",
    teacherName: null,
    classDays: null,
    classTime: null,
    studentCount: 0,
    abilityLevel: null,
    classPace: null,
    mainTextbook: null,
    currentMajorUnit: null,
    currentMinorUnit: null,
    actualPercent: null,
    expectedPercent: null,
    passedUnits: [],
    ongoingUnits: [],
    ...over,
  };
}

function exam(over: Partial<EntranceExam> = {}): EntranceExam {
  return {
    id: "e-1",
    status: "done",
    examTitle: "미적분1 입학테스트",
    examDate: "2026-09-28",
    subject: "수학",
    reportToken: "tok",
    tokenUsable: true,
    score: { raw: 35, max: 100, grade: "5" },
    scoreSummary: "약점: 접선의 방정식 12%",
    units: [{ name: "접선의 방정식", me: 12, national: 61 }],
    ...over,
  };
}

describe("rankClassesForStudent", () => {
  it("rank_excludesGradeMismatch — 학생 학년과 다른 반은 목록에서 빠진다", () => {
    const ranked = rankClassesForStudent(
      { grade: "고2" },
      null,
      [cls({ className: "고2 A" }), cls({ className: "고1 B" }), cls({ className: "중3 C" })]
    );
    expect(ranked.map((r) => r.className)).toEqual(["고2 A"]);
  });

  it("rank_unmatchedUnit_flagsNotGuess — 매칭 안 되는 약점 단원은 '확인 필요'로 두고 감점하지 않는다", () => {
    const ranked = rankClassesForStudent(
      { grade: "고2" },
      { score: { raw: 35, max: 100 }, units: [{ name: "접선의 방정식", me: 12 }, { name: "도함수", me: 100 }] },
      [
        cls({ className: "고2 A", abilityLevel: "하", passedUnits: ["공수1"] }),
        cls({ className: "고2 B", abilityLevel: "하", passedUnits: ["미적분1"] }),
      ]
    );
    const a = ranked.find((r) => r.className === "고2 A")!;
    const b = ranked.find((r) => r.className === "고2 B")!;
    expect(a.weakChecks).toEqual([
      { unit: "접선의 방정식", me: 12, status: "확인 필요", matchedWith: null },
    ]);
    expect(a.passedWeakCount).toBe(0);
    expect(b.weakChecks[0]).toMatchObject({ status: "지나감", matchedWith: "미적분1" });
    expect(b.passedWeakCount).toBe(1);
    // 수준은 같고(하=하), 지나간 약점이 있는 B 가 뒤로
    expect(ranked.map((r) => r.className)).toEqual(["고2 A", "고2 B"]);
    expect(a.levelFit).toBe("일치");
  });

  it("rank_unverified_exactCurrentOnly — 순서표 확인 전 과목은 현재 소단원과 이름이 정확히 같을 때만 '배우는 중'", () => {
    const [c] = rankClassesForStudent(
      { grade: "중2" },
      {
        score: { raw: 35, max: 100 },
        units: [
          { name: "일차함수와 그래프", me: 20 },
          { name: "일차함수", me: 30 },
        ],
      },
      [cls({ className: "중2 A", mainTextbook: "쎈 중2-1", currentMajorUnit: "함수", currentMinorUnit: "일차함수와 그래프" })]
    );
    expect(c.weakChecks.map((w) => [w.unit, w.status])).toEqual([
      ["일차함수와 그래프", "배우는 중"],
      ["일차함수", "확인 필요"],
    ]);
    expect(c.passedWeakCount).toBe(0);
  });

  it("rank_prefixNameNoLongerPassed — 앞부분만 같은 이름('접선의 방정식 (기본)' 완료)은 지나감으로 새지 않는다", () => {
    const [c] = rankClassesForStudent(
      { grade: "고2" },
      { score: null, units: [{ name: "접선의 방정식", me: 12 }] },
      [cls({ className: "고2 C", passedUnits: ["접선의 방정식 (기본)"] })]
    );
    expect(c.weakChecks[0].status).toBe("확인 필요");
    expect(c.passedWeakCount).toBe(0);
  });

  it("rank_crossCourse_noClassify — 미적분Ⅰ 시험 약점 '도함수의 활용' × 미적분(2015) 반 → 다른 과정, 분류 안 함", () => {
    const [c] = rankClassesForStudent(
      { grade: "고3" },
      { score: null, examTitle: "미적분1 입학테스트", subject: "수학", units: [{ name: "도함수의 활용", me: 20 }] },
      [cls({ className: "고3 A", mainTextbook: "쎈 미적분", currentMajorUnit: "적분법", currentMinorUnit: "여러 가지 적분법" })]
    );
    expect(c.subject).toMatchObject({ label: "미적분", verified: true, located: true });
    expect(c.weakChecks[0]).toMatchObject({ status: "확인 필요", reason: "다른 과정 — 확인 필요" });
    expect(c.passedWeakCount).toBe(0);
  });

  it("rank_catalog_passedWeak — 약점 '함수의 극한', 반 현재 '미분법 › 접선의 방정식' → 지나간 약점(감점)", () => {
    const units = [{ name: "함수의 극한", me: 25 }];
    const [withBook] = rankClassesForStudent(
      { grade: "고2" },
      { score: { raw: 35, max: 100 }, units },
      [cls({ className: "고2 A", mainTextbook: "쎈 미적분1", currentMajorUnit: "미분법", currentMinorUnit: "접선의 방정식" })]
    );
    expect(withBook.weakChecks[0]).toMatchObject({ unit: "함수의 극한", status: "지나감" });
    expect(withBook.passedWeakCount).toBe(1);
    expect(withBook.score).toBe(-1);
    expect(withBook.subject).toMatchObject({ label: "미적분Ⅰ", verified: true });

    // 교재 이름이 없어도 진행 중 과정(미적분1)으로 과목을 찾는다
    const [byCourse] = rankClassesForStudent({ grade: "고2" }, { score: null, units }, [
      cls({ className: "고2 B", ongoingUnits: ["미적분1"], currentMajorUnit: "미분법", currentMinorUnit: "접선의 방정식" }),
    ]);
    expect(byCourse.weakChecks[0].status).toBe("지나감");
  });

  it("rank_catalog_learningAndUpcoming — 같은 소단원은 배우는 중, 뒤 단원은 앞으로(감점 없음)", () => {
    const [c] = rankClassesForStudent(
      { grade: "고2" },
      {
        score: { raw: 35, max: 100 },
        units: [
          { name: "평균값 정리", me: 10 },
          { name: "부정적분", me: 20 },
        ],
      },
      [cls({ className: "고2 A", mainTextbook: "개념원리 미적분1", currentMajorUnit: "미분법", currentMinorUnit: "도함수의 활용(1)" })]
    );
    expect(c.weakChecks.map((w) => [w.unit, w.status])).toEqual([
      ["평균값 정리", "배우는 중"],
      ["부정적분", "앞으로"],
    ]);
    expect(c.passedWeakCount).toBe(0);
  });

  it("rank_completedCourse_allPassed — '완료' 과정의 단원은 전부 지나감", () => {
    const [c] = rankClassesForStudent(
      { grade: "고2" },
      { score: null, units: [{ name: "도함수", me: 30 }] },
      [cls({ className: "고2 A", mainTextbook: "쎈 미적분2", passedUnits: ["미적분1"], currentMinorUnit: "급수" })]
    );
    expect(c.weakChecks[0]).toMatchObject({ status: "지나감", matchedWith: "미적분1" });
  });

  it("rank_unverifiedSubject_noClassify — 순서표 확인 전 과목(중학교)은 앞 단원이어도 분류하지 않는다", () => {
    const [c] = rankClassesForStudent(
      { grade: "중2" },
      { score: null, units: [{ name: "유리수와 순환소수", me: 20 }] },
      [cls({ className: "중2 A", mainTextbook: "쎈 중2-1", currentMajorUnit: "함수", currentMinorUnit: "일차함수와 그래프" })]
    );
    expect(c.weakChecks[0].status).toBe("확인 필요");
    expect(c.passedWeakCount).toBe(0);
    expect(c.subject).toMatchObject({ label: "중2-1", verified: false });
  });

  it("rank_catalog_unknownWeak_flagsNotGuess — 반 과목 순서표에 없는 약점은 확인 필요", () => {
    const [c] = rankClassesForStudent(
      { grade: "고2" },
      { score: null, units: [{ name: "이차곡선", me: 20 }] },
      [cls({ className: "고2 A", mainTextbook: "쎈 미적분1", currentMajorUnit: "미분법", currentMinorUnit: "접선의 방정식" })]
    );
    expect(c.weakChecks[0].status).toBe("확인 필요");
  });

  it("rank_emptyClasses_returnsEmpty — 반이 없으면 빈 목록", () => {
    expect(rankClassesForStudent({ grade: "고2" }, null, [])).toEqual([]);
  });
});

describe("unitNamesMatch", () => {
  it("완전 일치 또는 4글자 이상이 어절 경계에서 시작할 때만 같은 단원", () => {
    expect(unitNamesMatch("함수", "이차함수")).toBe(false);
    expect(unitNamesMatch("도함수", "도함수의 활용")).toBe(false);
    expect(unitNamesMatch("함수의 극한", "함수의 극한과 연속")).toBe(true);
    expect(unitNamesMatch("접선의 방정식", "접선의 방정식")).toBe(true);
    expect(unitNamesMatch("극한", "함수의 극한")).toBe(false);
  });
});

describe("pickTestScoreDefaults", () => {
  it("defaults_consultationScoreWins — 상담에 적힌 점수가 있으면 그게 우선", () => {
    const d = pickTestScoreDefaults("72점", exam());
    expect(d.testScore).toBe("72점");
    expect(d.fromExam.testScore).toBe(false);
  });

  it("defaults_examFillsOnlyEmpty — 빈칸일 때만 입학테스트 값으로 채운다", () => {
    const d = pickTestScoreDefaults("", exam());
    expect(d.testScore).toBe("35/100 · 5등급 (미적분1 입학테스트 09.28)");
    expect(d.testNote).toBe("약점: 접선의 방정식 12%");
    expect(d.fromExam).toEqual({ testScore: true, testNote: true });

    const kept = pickTestScoreDefaults(null, exam(), "직접 쓴 메모");
    expect(kept.testNote).toBe("직접 쓴 메모");
    expect(kept.fromExam.testNote).toBe(false);

    const none = pickTestScoreDefaults(null, null);
    expect(none).toEqual({ testScore: "", testNote: "", fromExam: { testScore: false, testNote: false } });
  });
});

describe("buildExamScoreSummary", () => {
  it("summary_picksWeakAndStrong — 약한 단원 2개·강한 단원 1개", () => {
    const s = buildExamScoreSummary([
      { name: "도함수", me: 100 },
      { name: "함수의 연속", me: 25 },
      { name: "함수의 극한", me: 40 },
      { name: "접선의 방정식", me: 12 },
      { name: "평균변화율", me: 80 },
    ]);
    expect(s).toBe("약점: 접선의 방정식 12%·함수의 연속 25% · 강점: 도함수 100%");
    expect(buildExamScoreSummary([])).toBeNull();
  });
});

describe("examReportTarget", () => {
  it("done + 쓸 수 있는 토큰 → 새 탭 분석지, 대기·토큰 불가 → 상세, 없음 → 올리기/숨김", () => {
    expect(examReportTarget(exam(), "c-1")).toMatchObject({ kind: "report", href: "/report/tok", newTab: true });
    expect(examReportTarget(exam({ tokenUsable: false }), "c-1")).toMatchObject({ kind: "exam", href: "/exams/e-1" });
    expect(examReportTarget(exam({ status: "pending", reportToken: null }), "c-1")).toMatchObject({ kind: "exam" });
    expect(examReportTarget(null, "c-1")).toMatchObject({ kind: "upload", href: "/exams/new?consultation=c-1" });
    expect(examReportTarget(null, null)).toBeNull();
  });
});

describe("getLatestExamForConsultation", () => {
  beforeEach(() => {
    getReportByTokenMock.mockReset();
  });

  it("작성 중(draft) 시험은 빼고 최신 1건을 고른다(재시험 draft 가 완료 점수를 가리지 않게)", async () => {
    inCalls.length = 0;
    queryResult.current = { data: null, error: null };
    await expect(getLatestExamForConsultation("c-1")).resolves.toBeNull();
    expect(inCalls).toEqual([["status", ["pending", "analyzing", "done", "sent"]]]);
  });

  it("lookup_missingColumns_returnsNull — score_* 칸이 없으면(마이그레이션 전) null + 로그", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    queryResult.current = {
      data: null,
      error: { code: "42703", message: "column exam_analyses.score_raw does not exist" },
    };
    await expect(getLatestExamForConsultation("c-1")).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalledWith("[exam-lookup]", expect.stringContaining("score_raw"));
    expect(getReportByTokenMock).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("점수 칸이 비었으면 분석지 JSON 으로 채우고 요약을 즉석 계산한다", async () => {
    queryResult.current = {
      data: {
        id: "e-9",
        status: "done",
        exam_title: "미적분1 입학테스트",
        exam_date: "2026-09-28",
        subject: "수학",
        report_token: "tok-9",
        score_raw: null,
        score_max: null,
        score_grade: null,
        score_summary: null,
      },
      error: null,
    };
    getReportByTokenMock.mockResolvedValue({
      kind: "exam_v1",
      expired: false,
      revoked: false,
      name: "박서진",
      createdAt: null,
      data: {
        version: "exam_v1",
        student: { name: "박서진" },
        exam: { title: "미적분1 입학테스트", date: "2026-09-28" },
        score: { raw: 35, max: 100, grade: 5 },
        tally: { correct: 7, wrongWithWork: 6, blank: 7 },
        difficulty: [],
        units: [
          { name: "접선의 방정식", cells: ["x"], me: 12, national: 61 },
          { name: "도함수", cells: ["o"], me: 100, national: 80 },
        ],
        summary: [],
        picks: [],
        causes: [],
        plan: [],
      },
    });
    const r = await getLatestExamForConsultation("c-1");
    expect(r).toMatchObject({
      id: "e-9",
      tokenUsable: true,
      score: { raw: 35, max: 100, grade: "5" },
      scoreSummary: "약점: 접선의 방정식 12% · 강점: 도함수 100%",
    });
    expect(r?.units).toHaveLength(2);
  });
});
