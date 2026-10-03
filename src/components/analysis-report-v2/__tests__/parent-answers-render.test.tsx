import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_ITEMS, GUIDANCE_CHOICE_ID, MANAGEMENT_DIRECT_ID, isLikert } from "@/lib/assessment/v2/definition";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import type { LikertItem, ResponseMap } from "@/lib/assessment/v2/types";
import { ParentReport } from "../parent-report";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];
const fill = (v: number): ResponseMap => Object.fromEntries(LIKERT.map((i) => [i.id, v]));
const sp = computeScoreProfile({
  subjectSelection: "both",
  responses: fill(4),
  scenarioResponses: { [MANAGEMENT_DIRECT_ID]: 2, [GUIDANCE_CHOICE_ID]: 2, MS1: 4, MS2: 2, ES1: 1, ES2: 4 },
});
const full = buildResultProfileV2({
  scoreProfile: sp,
  interpretation: buildFallbackInterpretation(sp),
  source: "fallback",
});
const DISPLAY = { name: "가상학생", schoolGrade: "중2" };

const SAMPLE_PARENT_ANSWERS = {
  q1: "적당히",
  q2: "숙제는 하지만 오답을 다시 안 봐요",
  q3: "2주에 한 번",
  q4: "반반이다",
  q5: "그렇다",
  q6_math: 90,
  q7: "다독여 주기",
};

function section10(html: string) {
  const start = html.indexOf('id="sec-parent"');
  return html.slice(start, html.indexOf("</section>", start));
}

describe("결과지 10번 — 학부모 답변", () => {
  it("답이 없으면 지금 제목·질문 목록·안내 문구 그대로", () => {
    const html = section10(renderToStaticMarkup(<ParentReport data={buildParentSafeProfile(full, DISPLAY)} />));
    expect(html).toContain("학부모님께 여쭙니다");
    expect(html).toContain("이 결과지가 파악한 학생 모습이 학부모님 생각과 같으신가요?");
    expect(html).toContain("표시해 주신 답은 입학 상담에서 함께 봅니다.");
    expect(html).not.toContain("학부모님 답변");
  });

  it("답이 있으면 '학부모님 답변' + 문항별 답 + 안내", () => {
    const withAnswers = { ...full, parentAnswers: SAMPLE_PARENT_ANSWERS };
    const html = section10(
      renderToStaticMarkup(<ParentReport data={buildParentSafeProfile(withAnswers, DISPLAY)} />),
    );
    expect(html).toContain("학부모님 답변");
    expect(html).not.toContain("학부모님께 여쭙니다");
    expect(html).toContain("학부모님이 보시는 학생의 공부 모습을 한 줄로 적어 주세요");
    expect(html).not.toContain("이 결과지가 파악한 학생 모습");
    expect(html).toContain("숙제는 하지만 오답을 다시 안 봐요");
    expect(html).toContain("수학 90점");
    expect(html).toContain("답하신 내용은 입학 상담에서 함께 봅니다.");
  });
});
