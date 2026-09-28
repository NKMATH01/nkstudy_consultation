import { describe, it, expect } from "vitest";

import { examReportV1Schema } from "@/components/exam-report/types";
import { validateExamReportV1 } from "../../../scripts/lib/exam-report-validate.mjs";

/**
 * 분석지 JSON 검증이 두 곳에 있다.
 *   ① 올릴 때  — scripts/lib/exam-report-validate.mjs (로컬 명령어)
 *   ② 보여줄 때 — src/components/exam-report/types.ts 의 zod
 *
 * 이 둘이 어긋나면 "올릴 때는 통과했는데 학부모 화면은 불러올 수 없습니다" 가 되고,
 * 그 시점엔 exam-push 가 작업 폴더를 이미 지운 뒤라 원본이 없다.
 * 그래서 같은 입력에 대해 **둘의 판정이 항상 같아야** 한다. 이 테스트가 그 계약이다.
 */

function base() {
  return {
    version: "exam_v1",
    student: { name: "박서진", school: "OO고", grade: 2 },
    exam: { title: "입학테스트 미적분1", date: "2026-09-28", subject: "수학", totalQuestions: 20 },
    score: { raw: 35, max: 100, grade: 5 },
    tally: { correct: 7, wrongWithWork: 6, blank: 7 },
    difficulty: [{ level: "하", me: 100, national: 90 }],
    units: [{ name: "접선의 방정식", cells: ["o", "x", "x"], me: 12, national: 61 }],
    summary: ["기초는 평균을 넘고 한 칸 위에서 끊깁니다."],
    picks: [{ no: 11, topic: "접선의 기울기", verdict: "x", nationalAvg: 65, read: "대입 한 줄에서 틀렸습니다." }],
    causes: [{ tone: "deep", count: 5, title: "문자로 못 바꿈", body: "그림은 그리는데 미지수를 못 세웁니다." }],
    plan: [{ title: "한 줄만 한 달", body: "움직이는 점을 (t, f(t)) 로 놓는 연습." }],
  };
}

/** [설명, 값을 어떻게 망가뜨리나] — 전부 "거부"가 정답인 사례 */
const REJECT: Array<[string, (r: Record<string, unknown>) => void]> = [
  ["version 이 다르다", (r) => { r.version = "exam_v2"; }],
  ["tally 가 통째로 없다", (r) => { delete r.tally; }],
  ["tally.correct 가 음수", (r) => { (r.tally as Record<string, number>).correct = -1; }],
  ["tally.blank 가 소수", (r) => { (r.tally as Record<string, number>).blank = 1.5; }],
  ["student.name 이 빈 문자열", (r) => { (r.student as Record<string, string>).name = ""; }],
  ["exam.title 이 빈 문자열", (r) => { (r.exam as Record<string, string>).title = ""; }],
  ["score.max 가 0", (r) => { (r.score as Record<string, number>).max = 0; }],
  ["난이도 정답률이 150", (r) => { (r.difficulty as Array<Record<string, unknown>>)[0].me = 150; }],
  ["난이도 정답률이 음수", (r) => { (r.difficulty as Array<Record<string, unknown>>)[0].national = -5; }],
  ["난이도 level 이 숫자", (r) => { (r.difficulty as Array<Record<string, unknown>>)[0].level = 1; }],
  ["단원 cells 에 이상한 값", (r) => { (r.units as Array<Record<string, unknown>>)[0].cells = ["z"]; }],
  ["단원 이름이 빈 문자열", (r) => { (r.units as Array<Record<string, unknown>>)[0].name = ""; }],
  ["단원 정답률이 101", (r) => { (r.units as Array<Record<string, unknown>>)[0].me = 101; }],
  ["손풀이 verdict 이 o/x 가 아님", (r) => { (r.picks as Array<Record<string, unknown>>)[0].verdict = "maybe"; }],
  ["손풀이 topic 이 빈 문자열", (r) => { (r.picks as Array<Record<string, unknown>>)[0].topic = ""; }],
  ["손풀이 nationalAvg 가 범위 밖", (r) => { (r.picks as Array<Record<string, unknown>>)[0].nationalAvg = 120; }],
  ["원인 tone 이 목록 밖", (r) => { (r.causes as Array<Record<string, unknown>>)[0].tone = "unknown"; }],
  ["원인 title 이 빈 문자열", (r) => { (r.causes as Array<Record<string, unknown>>)[0].title = ""; }],
  ["처방 title 이 빈 문자열", (r) => { (r.plan as Array<Record<string, unknown>>)[0].title = ""; }],
  ["summary 가 배열이 아님", (r) => { r.summary = "한 줄"; }],
  ["units 가 배열이 아님", (r) => { r.units = {}; }],
];

/** 전부 "통과"가 정답인 사례 — 선택 항목이 없어도 멀쩡해야 한다 */
const ACCEPT: Array<[string, (r: Record<string, unknown>) => void]> = [
  ["아무것도 안 바꿈", () => {}],
  ["nationalAvg 가 없다(선택)", (r) => { delete (r.picks as Array<Record<string, unknown>>)[0].nationalAvg; }],
  ["hand 가 없다(선택)", (r) => { delete (r.picks as Array<Record<string, unknown>>)[0].hand; }],
  ["학교·학년이 없다(선택)", (r) => { r.student = { name: "박서진" }; }],
  ["과목·문항수가 없다(선택)", (r) => { r.exam = { title: "입학테스트", date: "2026-09-28" }; }],
  ["등급이 없다(선택)", (r) => { r.score = { raw: 35, max: 100 }; }],
  ["해설 박스 3개가 있다(선택)", (r) => { r.difficultyNote = "**문턱** 하나"; r.unitsNote = "접선이 약함"; r.causesTitle = "세 가지"; }],
  ["배열이 전부 비어 있다", (r) => { r.difficulty = []; r.picks = []; r.causes = []; r.plan = []; r.summary = []; }],
  ["학년이 문자열", (r) => { (r.student as Record<string, unknown>).grade = "고2"; }],
  ["정답률이 경계값 0 과 100", (r) => { (r.units as Array<Record<string, unknown>>)[0].me = 0; (r.units as Array<Record<string, unknown>>)[0].national = 100; }],
];

describe("exam_v1 검증 — 올릴 때와 보여줄 때가 같은 판정을 내려야 한다", () => {
  it.each(REJECT)("거부해야 한다: %s", (_label, mutate) => {
    const r = base() as Record<string, unknown>;
    mutate(r);
    expect(validateExamReportV1(r).ok, "로컬 명령어(exam-push) 검증").toBe(false);
    expect(examReportV1Schema.safeParse(r).success, "학부모 화면(zod) 검증").toBe(false);
  });

  it.each(ACCEPT)("통과해야 한다: %s", (_label, mutate) => {
    const r = base() as Record<string, unknown>;
    mutate(r);
    expect(validateExamReportV1(r).ok, "로컬 명령어(exam-push) 검증").toBe(true);
    expect(examReportV1Schema.safeParse(r).success, "학부모 화면(zod) 검증").toBe(true);
  });

  it("거부할 때는 사람이 읽을 수 있는 이유를 준다", () => {
    const r = base() as Record<string, unknown>;
    delete r.tally;
    const out = validateExamReportV1(r);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.errors.length).toBeGreaterThan(0);
      expect(out.errors.join(" ")).toContain("tally");
    }
  });
});
