import { describe, it, expect } from "vitest";

import fixture from "../../../docs/nk-team-routine/evidence/class-unit-strings-2026-09-30.json";
import { CURRICULUM_CATALOG, getSubjectById } from "@/lib/curriculum/catalog";
import {
  detectSubject,
  locateInSubject,
  locateNameInTrack,
  locateRecord,
  normalizeCurriculumName,
} from "@/lib/curriculum/locate";

type Row = { textbook: string; major: string; minor: string };
const rows = fixture as Row[];
const rowKey = (r: Row) => `${r.textbook} | ${r.major} | ${r.minor}`;

/** 위치(소단원)를 못 찾는 게 맞는 행 — 이유를 함께 적는다. 이 밖의 행은 전부 찾아야 한다. */
const EXPECTED_UNLOCATED: Record<string, string> = {
  "디딤돌 기본응용4-2 | 곱셈과 나눗셈 | 곱셈과 나눗셈": "초4-2 초안에 '곱셈과 나눗셈' 없음(4-1 단원)",
  "심화유형서 중1(하) | 부등식 | 일차부등식": "일차부등식은 중2-1 단원 — 중1-2 교재와 안 맞음",
  "쎈 중1-1 | 수와 식 | 유리수와 소수": "유리수와 소수는 중2-1 단원 — 중1-1 교재와 안 맞음",
  "일품 중등수학 1-1 | 수와 식 | 유리수와 순환소수": "유리수와 순환소수는 중2-1 단원 — 중1-1 교재와 안 맞음",
  "이해원 N제 시즌1 | 수학Ⅰ | 실전모의고사": "실전모의고사(단원 아님)",
  "이해원 N제 시즌1 수학Ⅱ | 수학Ⅱ | 실전모의고사": "실전모의고사(단원 아님)",
  "이해원 N제 시즌1_확률과통계 | 확률과통계 | 실전모의고사": "실전모의고사(단원 아님)",
};

describe("curriculum catalog", () => {
  it("고등 14과목은 verified, 중학교·초등은 unverified", () => {
    const high = CURRICULUM_CATALOG.filter((s) => s.level === "high");
    expect(high).toHaveLength(14);
    expect(high.every((s) => s.verified)).toBe(true);
    expect(CURRICULUM_CATALOG.filter((s) => s.level !== "high").every((s) => !s.verified)).toBe(true);
    expect(CURRICULUM_CATALOG.filter((s) => s.level === "middle")).toHaveLength(10);
    expect(CURRICULUM_CATALOG.filter((s) => s.level === "elementary")).toHaveLength(8);
  });

  it("같은 과정: 수학Ⅱ≡미적분Ⅰ, 수학Ⅰ≡대수, 미적분(2015)≡미적분Ⅱ — 같은 단원 키", () => {
    const math2 = getSubjectById("h2015-math2")!;
    const calc1 = getSubjectById("h2022-calc1")!;
    expect(locateInSubject(math2, { minor: "함수의 극한" })!.key).toBe(locateInSubject(calc1, { minor: "함수의 극한" })!.key);
    expect(getSubjectById("h2015-math1")!.track).toBe(getSubjectById("h2022-algebra")!.track);
    expect(getSubjectById("h2015-calculus")!.track).toBe(getSubjectById("h2022-calc2")!.track);
    // 수학Ⅰ 이름("지수")으로 대수 과목 위치를 찾는다
    const algebra = getSubjectById("h2022-algebra")!;
    expect(locateNameInTrack(algebra, "지수")!.minor).toBe("지수와 로그");
  });
});

describe("normalize / detectSubject", () => {
  it("로마숫자·(상)(하)·공수1 등 이름 정규화", () => {
    expect(normalizeCurriculumName("미적분Ⅰ")).toBe("미적분1");
    expect(normalizeCurriculumName("교과서 미적분I")).toBe("교과서미적분1");
    expect(normalizeCurriculumName("도함수의 활용(2)")).toBe("도함수의활용");
    expect(detectSubject("공수1")?.label).toBe("공통수학1");
    expect(detectSubject("AXIS 공통수학Ⅱ")?.label).toBe("공통수학2");
    expect(detectSubject("수능특강 수학2")?.label).toBe("수학Ⅱ");
    expect(detectSubject("수학(상)")?.label).toBe("수학(상)");
    expect(detectSubject("쎈 중3(상)")?.label).toBe("중3-1");
    expect(detectSubject("일품 중등수학 1-1")?.label).toBe("중1-1");
    expect(detectSubject("최상위수학s 6-1")?.label).toBe("초6-1");
    expect(detectSubject("미적분2")?.label).toBe("미적분Ⅱ");
    expect(detectSubject("확률통계")?.label).toBe("확률과통계");
  });

  it("학기 표기(N-M)·중등·중학·중N 이 있으면 고등으로 판정하지 않는다", () => {
    for (const [name, label] of [
      ["쎈 수학 1-1", "중1-1"],
      ["개념쎈 수학 2-1", "중2-1"],
      ["중학수학 2-1", "중2-1"],
      ["쎈 중3(상)", "중3-1"],
      ["일품 중등수학 1-1", "중1-1"],
    ]) {
      const s = detectSubject(name);
      expect([name, s?.level, s?.label, s?.verified]).toEqual([name, "middle", label, false]);
    }
    expect(detectSubject("중학수학 개념편")).toBeNull();
  });
});

describe("실제 반 기록 51행", () => {
  const results = rows.map((r) => ({
    row: r,
    found: locateRecord({ textbook: r.textbook, major: r.major, minor: r.minor }),
  }));

  it("명시 목록 밖의 행은 전부 과목·소단원 위치를 찾는다", () => {
    expect(rows).toHaveLength(51);
    const unlocated = results.filter((x) => x.found?.location?.minorIndex == null).map((x) => rowKey(x.row));
    expect(unlocated.sort()).toEqual(Object.keys(EXPECTED_UNLOCATED).sort());
  });

  it("고등 과목으로 찾은 행은 실전모의고사 말고 전부 위치가 있다", () => {
    const high = results.filter((x) => x.found?.subject.level === "high");
    expect(high.length).toBeGreaterThanOrEqual(30);
    for (const x of high) {
      if (x.row.minor === "실전모의고사") continue;
      expect(x.found!.location?.minorIndex, rowKey(x.row)).not.toBeNull();
    }
  });

  it("대표 행 위치", () => {
    const get = (textbook: string, minor: string) => {
      const r = rows.find((x) => x.textbook === textbook && x.minor === minor)!;
      return locateRecord(r)!;
    };
    const a = get("쎈 미적분1", "부정적분");
    expect([a.subject.label, a.location!.major, a.location!.minor]).toEqual(["미적분Ⅰ", "적분", "부정적분과 정적분"]);
    const b = get("라이트쎈 미적분1", "도함수의 활용(2)");
    expect([b.subject.label, b.location!.major, b.location!.minor]).toEqual(["미적분Ⅰ", "미분", "도함수의 활용"]);
    const c = get("AXIS 미적분1", "접선의 방정식");
    expect(c.location!.minor).toBe("도함수의 활용");
    const d = get("학교 학습지 쌍둥이", "미분계수와 도함수");
    expect([d.subject.track, d.location!.minor]).toEqual(["calc1", "미분계수와 도함수"]);
    expect(get("이해원 N제 시즌1", "실전모의고사").subject.label).toBe("수학Ⅰ");
  });
});

describe("매쓰플랫 세부 이름 → 미적분Ⅰ 위치", () => {
  const calc1 = getSubjectById("h2022-calc1")!;
  it.each([
    ["함수의 극한", "함수의 극한"],
    ["극한에 대한 성질", "함수의 극한"],
    ["함수의 연속", "함수의 연속"],
    ["연속함수의 성질", "함수의 연속"],
    ["도함수", "미분계수와 도함수"],
    ["접선의 방정식", "도함수의 활용"],
    ["평균값 정리", "도함수의 활용"],
  ])("%s → %s", (name, minor) => {
    expect(locateNameInTrack(calc1, name)?.minor).toBe(minor);
  });
});
