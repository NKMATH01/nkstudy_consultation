import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_ITEMS, GUIDANCE_CHOICE_ID, MANAGEMENT_DIRECT_ID, isLikert } from "@/lib/assessment/v2/definition";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import type { LikertItem, ResponseMap, SubjectSelection } from "@/lib/assessment/v2/types";
import { ParentReport } from "../parent-report";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];

function fill(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT) r[item.id] = value;
  return r;
}

const SCENARIOS = { [MANAGEMENT_DIRECT_ID]: 2, [GUIDANCE_CHOICE_ID]: 2, MS1: 4, MS2: 2, ES1: 1, ES2: 4 };

function resultFor(sel: SubjectSelection, value = 4) {
  const sp = computeScoreProfile({
    subjectSelection: sel,
    responses: fill(value),
    scenarioResponses: SCENARIOS,
    mbti: { type: "ISTJ", confidence: "high" },
  });
  return buildResultProfileV2({
    scoreProfile: sp,
    interpretation: buildFallbackInterpretation(sp),
    source: "fallback",
  });
}

const DISPLAY = { name: "가상학생", schoolGrade: "중2" };

describe("학부모 결과보고서 3판 렌더 smoke", () => {
  const profile = resultFor("both");
  const safe = buildParentSafeProfile(profile, DISPLAY, fill(4), { type: "ISTJ", confidence: "high" }, {
    prevConcerns: ["질문·오답 피드백 부족", "성적 변화 체감 부족"],
    entryPriority: "숙제를 미루지 않고 시작하는 방법",
    problemSelf: "집중이 오래 안 가요",
    mathDifficultyTags: ["서술형·증명"],
  });
  const html = renderToStaticMarkup(<ParentReport data={safe} />);

  it("열 섹션 골격을 오류 없이 렌더한다", () => {
    for (const title of [
      "검사 개요 및 응답 신뢰도",
      "핵심 판단 두 가지",
      "프로파일",
      "질문별 해석",
      "학생이 직접 적은 것",
      "과목 공부 방식",
      "종합 소견",
      "NK 지도 방향",
      "12주 운영 계획(안)",
      "학부모님께 여쭙니다",
    ]) {
      expect(html, title).toContain(title);
    }
    expect(html).toContain("가상학생");
  });

  it("핵심 판단 두 가지를 판정·본인 답과 함께 보여 준다", () => {
    expect(html).toContain("철저한 관리를 버틸 수 있는가");
    expect(html).toContain("도움이 있으면 버팀");
    expect(html).toContain("힘들어도 해 보겠다");
    expect(html).toContain("강하게 하되 다독임을 같이");
    expect(html).toContain("차분히 고쳐 주는 선생님");
  });

  it("사용자 질문 아홉 개 중 여덟 개가 질문별 해석의 부제로 들어간다", () => {
    for (const q of [
      "공부를 얼마나 열심히 하는가?",
      "숙제를 열심히 하는가?",
      "구체적인 목표가 있는가?",
      "강사가 힘들게 시켜도 따라올 것인가?",
      "철저한 관리를 버틸 수 있는가?",
      "활기차게 질문하는 스타일인가, 아닌가?",
      "휴대폰 때문에 공부를 제대로 못 하는가?",
      "친구 때문에 공부를 제대로 못 하는가?",
    ]) {
      expect(html, q).toContain(q);
    }
  });

  it("학생이 직접 적은 답·어려운 점 선택·이전 학원 운영 조건을 싣는다", () => {
    expect(html).toContain("숙제를 미루지 않고 시작하는 방법");
    expect(html).toContain("집중이 오래 안 가요");
    expect(html).toContain("서술형·증명");
    expect(html).toContain("질문과 오답을 남기지 않기");
    expect(html).toContain("작은 변화 지표를 4주마다 공유합니다.");
  });

  it("학부모 질문 여덟 개가 맨 아래에 있다", () => {
    expect(html).toContain("강한 학습(철저한 관리, 많은 숙제)을 원하시나요?");
    expect(html).toContain("학원에 특별히 바라는 점이 있으신가요?");
    expect(html.match(/pr3-parent__num/g) ?? []).toHaveLength(8);
  });

  it("MBTI는 종합 소견 한 문장으로만 쓰고 원인 문장·유형 이름·점수 숫자는 없다", () => {
    expect(html).toContain("학생이 적은 MBTI는 ISTJ입니다");
    expect(html).not.toContain("MBTI 성향");
    expect(html).not.toMatch(/\d+\.\d+\s*(?:점|\/\s*5)/);
    expect(html).not.toContain("{{학생}}");
    expect(html).not.toContain("선생님 메모");
    expect(html).not.toContain("입학 상담에서 확인할 것");
  });

  it("문항 문장을 그대로 싣지 않는다", () => {
    for (const item of LIKERT.slice(0, 36)) {
      expect(html, item.id).not.toContain(item.text);
    }
  });

  it("수학만 선택이면 영어 공부 방식을 렌더하지 않는다", () => {
    const mathOnly = renderToStaticMarkup(<ParentReport data={buildParentSafeProfile(resultFor("math"), DISPLAY)} />);
    expect(mathOnly).toContain("수학 공부 방식");
    expect(mathOnly).not.toContain("영어 공부 방식");
  });

  it("응답 품질 review이면 확인 후 해석으로 표시한다", () => {
    const sp = computeScoreProfile({ subjectSelection: "math", responses: fill(3), scenarioResponses: SCENARIOS });
    const reviewProfile = buildResultProfileV2({ scoreProfile: sp, interpretation: buildFallbackInterpretation(sp), source: "fallback" });
    const out = renderToStaticMarkup(<ParentReport data={buildParentSafeProfile(reviewProfile, DISPLAY)} />);
    expect(out).toContain("확인 후 해석");
    expect(out).not.toContain("첫 14일");
  });

  it("과거 snapshot(판정 없음)도 깨지지 않고 판정 보류로 렌더한다", () => {
    const legacy = { ...safe, verdicts: undefined, responseDistribution: undefined, studentAnswers: undefined, difficultyTags: undefined };
    const out = renderToStaticMarkup(<ParentReport data={legacy} />);
    expect(out).toContain("판정 보류");
  });
});
