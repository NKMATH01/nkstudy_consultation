import { describe, expect, it } from "vitest";
import {
  buildConstructDictionary,
  buildNamingRules,
  buildStudentTypeRule,
  CEILING_ITEMS,
  CONSTRUCT_GUIDE,
  isSingleItemConstruct,
  ITEMS_BY_CONSTRUCT,
  SINGLE_ITEM_CONSTRUCTS,
  STUDENT_TYPE_AXES,
} from "../construct-guide";
import { CONSTRUCT_LABEL } from "@/components/analysis-report-v2/report-theme";

describe("ITEMS_BY_CONSTRUCT — definition.ts 실측 집계", () => {
  it("단일문항 구인은 과목 위험 신호 4개와 강제선택 1개뿐이다", () => {
    expect(SINGLE_ITEM_CONSTRUCTS.sort()).toEqual(
      ["coachingChoice", "englishReadingAvoidance", "englishTestInterference", "mathNoveltyAvoidance", "mathTestInterference"].sort(),
    );
  });

  it("공통 아홉 척도는 모두 다문항이다", () => {
    for (const key of Object.keys(CONSTRUCT_LABEL)) {
      expect(isSingleItemConstruct(key), key).toBe(false);
    }
    expect(ITEMS_BY_CONSTRUCT.learningAttitude).toEqual(["LA1", "LA2", "LA3", "LA4"]);
    expect(ITEMS_BY_CONSTRUCT.shortTermRecovery).toHaveLength(5);
    // 직접 질문 MA5는 상황형이라 점수 문항에 세지 않는다.
    expect(ITEMS_BY_CONSTRUCT.managementAcceptance).toEqual(["MA1", "MA2", "MA3", "MA4"]);
  });

  it("단일문항 구인은 문항이 정확히 하나다", () => {
    for (const key of SINGLE_ITEM_CONSTRUCTS) expect(ITEMS_BY_CONSTRUCT[key]).toHaveLength(1);
  });
});

describe("CONSTRUCT_GUIDE", () => {
  it("화면 라벨이 있는 공통축을 모두 덮는다", () => {
    for (const key of Object.keys(CONSTRUCT_LABEL)) {
      expect(CONSTRUCT_GUIDE[key], `${key} 정의 누락`).toBeDefined();
    }
  });

  it("과목 위험축은 risk 방향으로 정의한다", () => {
    for (const key of ["mathNoveltyAvoidance", "mathTestInterference", "englishReadingAvoidance", "englishTestInterference"]) {
      expect(CONSTRUCT_GUIDE[key].direction, key).toBe("risk");
    }
  });

  it("지도 방식 반응은 우열이 아닌 preference, 친구와 있을 때 조절은 positive다", () => {
    expect(CONSTRUCT_GUIDE.coachingResponse.direction).toBe("preference");
    expect(CONSTRUCT_GUIDE.peerFocusBoundary.direction).toBe("positive");
    expect(CONSTRUCT_GUIDE.managementAcceptance.direction).toBe("positive");
  });
});

describe("buildConstructDictionary", () => {
  const dict = buildConstructDictionary();

  it("화면과 같은 한글 라벨을 쓴다", () => {
    expect(dict).toContain("학습 태도");
    expect(dict).toContain("관리 수용");
    expect(dict).toContain("친구와 있을 때 조절");
    expect(dict).toContain("지도 방식 반응");
  });

  it("문항 수를 표에 밝힌다", () => {
    expect(dict).toContain("단일문항");
    expect(dict).toContain("4문항");
    expect(dict).toContain("5문항");
  });

  it("위험축에 '낮다고 우수한 것이 아님'을 명시한다", () => {
    expect(dict).toContain("낮다고 우수한 것이 아님");
  });
});

describe("buildNamingRules", () => {
  const rules = buildNamingRules();

  it("100점 표기를 금지한다", () => {
    expect(rules).toContain("100점 환산");
  });

  it("다문항은 5점 만점 평균 표기를 지시한다", () => {
    expect(rules).toContain("평균 1.8/5");
  });

  it("강제선택 구인을 고른 보기로만 쓰게 한다", () => {
    expect(rules).toContain("고른 선생님");
    expect(rules).toContain("둘 중 하나를 고르는 문항");
  });

  it("천장 문항은 아직 없다(새 문항 운영 응답이 쌓이면 다시 채운다)", () => {
    expect(CEILING_ITEMS).toEqual([]);
  });

  it("영문 키·내부 코드 사용을 금지한다", () => {
    expect(rules).toContain("영문 키");
    expect(rules).toContain("문항 ID");
  });
});

describe("buildStudentTypeRule", () => {
  const rule = buildStudentTypeRule();

  it("여덟 핵심 학습행동을 한글 라벨로 지정한다(지도 방식 반응 제외)", () => {
    expect(STUDENT_TYPE_AXES).toHaveLength(8);
    expect(STUDENT_TYPE_AXES).not.toContain("coachingResponse");
    for (const axis of STUDENT_TYPE_AXES) {
      expect(rule).toContain(CONSTRUCT_LABEL[axis]);
    }
  });

  it("유형명·상투구·실명·점수를 금지한다", () => {
    expect(rule).toContain("유형명");
    expect(rule).toContain("상투구");
    expect(rule).toContain("실명");
    expect(rule).toContain("점수 수치를 넣지 마세요");
  });

  it("행동 조합 예시 문장을 제시한다", () => {
    expect(rule).toContain("숙제는 기한 안에 스스로 챙기지만");
  });
});
