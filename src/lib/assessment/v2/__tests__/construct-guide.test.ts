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
  // 하드코딩이 아니라 definition에서 집계하므로 문항이 바뀌면 여기서 먼저 깨진다.
  it("단일문항 구인 11개를 실제 정의에서 뽑아낸다", () => {
    expect(SINGLE_ITEM_CONSTRUCTS.sort()).toEqual(
      [
        "autonomyNeed",
        "directFeedbackAcceptance",
        "englishReadingAvoidance",
        "englishSelfEfficacy",
        "englishTestInterference",
        "mathNoveltyAvoidance",
        "mathSelfEfficacy",
        "mathTestInterference",
        "peerFocusBoundary",
        "reflectiveProcessingNeed",
        "relationshipSafetyNeed",
      ].sort(),
    );
  });

  it("다문항 구인은 단일문항으로 보지 않는다", () => {
    expect(isSingleItemConstruct("learningAttitude")).toBe(false);
    expect(ITEMS_BY_CONSTRUCT.learningAttitude).toEqual(["LT1", "LT2", "LT3", "LT4"]);
    // structureNeed는 R1·R6 두 문항이라 단일문항이 아니다.
    expect(isSingleItemConstruct("structureNeed")).toBe(false);
  });

  it("단일문항 구인은 문항이 정확히 하나다", () => {
    for (const key of SINGLE_ITEM_CONSTRUCTS) {
      expect(ITEMS_BY_CONSTRUCT[key]).toHaveLength(1);
    }
  });
});

describe("CONSTRUCT_GUIDE", () => {
  it("화면 라벨이 있는 공통축을 모두 덮는다", () => {
    for (const key of Object.keys(CONSTRUCT_LABEL)) {
      expect(CONSTRUCT_GUIDE[key], `${key} 정의 누락`).toBeDefined();
    }
  });

  it("역채점·위험축은 risk 방향으로 정의한다", () => {
    for (const key of [
      "mathNoveltyAvoidance",
      "mathTestInterference",
      "englishReadingAvoidance",
      "englishTestInterference",
      "peerFocusBoundary",
    ]) {
      expect(CONSTRUCT_GUIDE[key].direction, key).toBe("risk");
    }
  });

  it("선호축은 preference 방향으로 정의한다", () => {
    for (const key of [
      "structureNeed",
      "autonomyNeed",
      "relationshipSafetyNeed",
      "reflectiveProcessingNeed",
      "directFeedbackAcceptance",
    ]) {
      expect(CONSTRUCT_GUIDE[key].direction, key).toBe("preference");
    }
  });
});

describe("buildConstructDictionary", () => {
  const dict = buildConstructDictionary();

  it("화면과 같은 한글 라벨을 쓴다", () => {
    expect(dict).toContain("학습 태도");
    expect(dict).toContain("숙제 신뢰도");
    expect(dict).toContain("또래 집중 경계");
  });

  it("단일문항 여부를 표에 밝힌다", () => {
    expect(dict).toContain("단일문항");
    expect(dict).toContain("4문항");
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

  it("단일문항 구인을 한글 라벨로 나열한다", () => {
    expect(rules).toContain("숙고 처리 선호");
    expect(rules).toContain("또래 집중 경계");
  });

  it("천장 문항을 강점 근거에서 배제한다", () => {
    for (const item of CEILING_ITEMS) {
      expect(rules).toContain(item);
    }
  });

  it("영문 키·내부 코드 사용을 금지한다", () => {
    expect(rules).toContain("영문 키");
    expect(rules).toContain("상황문항");
  });
});

describe("buildStudentTypeRule", () => {
  const rule = buildStudentTypeRule();

  it("5축을 한글 라벨로 지정한다", () => {
    expect(STUDENT_TYPE_AXES).toHaveLength(5);
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
    expect(rule).toContain("숙제는 기한 안에 챙기지만");
  });
});
