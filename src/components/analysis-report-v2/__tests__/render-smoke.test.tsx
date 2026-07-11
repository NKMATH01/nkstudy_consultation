import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_ITEMS, isLikert } from "@/lib/assessment/v2/definition";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
} from "@/lib/assessment/v2/interpretation";
import { buildParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import type { LikertItem, ResponseMap, SubjectSelection } from "@/lib/assessment/v2/types";
import { CounselorReport } from "../counselor-report";
import { ParentReport } from "../parent-report";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];

function fill(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT) r[item.id] = value;
  return r;
}

function resultFor(sel: SubjectSelection, value = 4) {
  const sp = computeScoreProfile({
    subjectSelection: sel,
    responses: fill(value),
    scenarioResponses: { C1: 1, C2: 3, MS1: 4, MS2: 2, ES1: 1, ES2: 4 },
    clinicAvailability: 100,
    mbti: { type: "ISTJ", confidence: "high" },
  });
  return buildResultProfileV2({
    scoreProfile: sp,
    interpretation: buildFallbackInterpretation(sp),
    source: "fallback",
  });
}

describe("V2 결과 보고서 렌더 smoke", () => {
  it("상담자 보고서가 14 섹션 골격을 오류 없이 렌더한다", () => {
    const profile = resultFor("both");
    const html = renderToStaticMarkup(
      <CounselorReport
        profile={profile}
        header={{ name: "가상학생", schoolGrade: "중2", createdAt: "2026-07-11" }}
        background={{ prevAcademy: "가상학원", dream: "의사", nkExpectations: ["철저한 숙제 관리"] }}
        contacts={{ studentPhone: "010-1234-5678", parentPhone: "010-2222-3333" }}
      />
    );
    expect(html).toContain("학습 운영 프로필");
    expect(html).toContain("학생 분석 총평");
    expect(html).toContain("핵심 지도 판정");
    expect(html).toContain("선생님 메모");
    expect(html).toContain("MBTI");
    expect(html).toContain("첫 14일 확인 지표");
    expect(html).toContain("읽는 원칙");
    // 연락처는 마스킹되어 원본 뒷자리가 노출되지 않는다.
    expect(html).not.toContain("010-1234-5678");
    expect(html).toContain("가상학생");
  });

  it("수학+영어는 두 과목 전략을 모두 렌더한다", () => {
    const html = renderToStaticMarkup(
      <CounselorReport
        profile={resultFor("both")}
        header={{ name: "가상학생", schoolGrade: "고1" }}
      />
    );
    expect(html).toContain("수학 학습전략");
    expect(html).toContain("영어 학습전략");
  });

  it("수학만 선택이면 영어 전략 카드가 없다", () => {
    const html = renderToStaticMarkup(
      <CounselorReport profile={resultFor("math")} header={{ name: "가상", schoolGrade: "중3" }} />
    );
    expect(html).toContain("수학 학습전략");
    expect(html).not.toContain("영어 학습전략");
  });

  it("학부모 보고서는 상담자 전용 문구를 포함하지 않는다", () => {
    const profile = resultFor("both");
    const safe = buildParentSafeProfile(profile, { name: "가상학생", schoolGrade: "중2" });
    const html = renderToStaticMarkup(<ParentReport data={safe} />);
    // 재설계: 선별된 종합 분석 구조(약점 섹션 포함).
    expect(html).toContain("종합 분석");
    expect(html).toContain("우리 아이의 강점");
    expect(html).toContain("우리 아이의 약점");
    expect(html).toContain("항목별 분석");
    expect(html).toContain("NK의 지도 계획");
    expect(html).toContain("12주 맞춤 계획");
    // 상담자 전용 블록이 학부모 화면에 없다.
    expect(html).not.toContain("선생님 메모");
    expect(html).not.toContain("핵심 지도 판정");
    expect(html).not.toContain("상담 배경과 학생이 쓴 이야기");
    // 점수 echo 제거: MBTI 조정 패널이 학부모 화면에 없다(레이더 축 라벨은 정상 노출).
    expect(html).not.toContain("MBTI");
  });

  it("응답 품질 review이면 중립 확인 문구를 표시한다", () => {
    // 모든 Likert 동일값 → straight_line → review.
    const sp = computeScoreProfile({
      subjectSelection: "math",
      responses: fill(3),
      scenarioResponses: { C1: 1, C2: 1, MS1: 1, MS2: 1 },
      clinicAvailability: 100,
    });
    const profile = buildResultProfileV2({
      scoreProfile: sp,
      interpretation: buildFallbackInterpretation(sp),
      source: "fallback",
    });
    const html = renderToStaticMarkup(
      <CounselorReport profile={profile} header={{ name: "가상", schoolGrade: "중2" }} />
    );
    expect(html).toContain("응답이 한쪽으로 치우쳐 있어");
  });
});
