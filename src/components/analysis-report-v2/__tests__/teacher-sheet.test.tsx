import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_ITEMS, GUIDANCE_CHOICE_ID, MANAGEMENT_DIRECT_ID, isLikert } from "@/lib/assessment/v2/definition";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import { buildFallbackInterpretation, buildResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { LikertItem, ResponseMap, SubjectSelection } from "@/lib/assessment/v2/types";
import { TeacherSheet } from "../teacher-sheet";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];

function fill(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT) r[item.id] = value;
  return r;
}

/** 같은 값만 채우면 straight_line으로 응답 품질이 review가 된다. 값을 흩어 정상 응답을 만든다. */
function variedFill(): ResponseMap {
  const r: ResponseMap = {};
  LIKERT.forEach((item, idx) => {
    r[item.id] = [2, 3, 4, 3, 2][idx % 5];
  });
  return r;
}

function resultFor(sel: SubjectSelection, responses: ResponseMap = fill(2)) {
  const sp = computeScoreProfile({
    subjectSelection: sel,
    responses,
    scenarioResponses: { [MANAGEMENT_DIRECT_ID]: 2, [GUIDANCE_CHOICE_ID]: 2, MS1: 4, MS2: 2, ES1: 1, ES2: 4 },
    mbti: { type: "ISTJ", confidence: "high" },
  });
  return buildResultProfileV2({
    scoreProfile: sp,
    interpretation: buildFallbackInterpretation(sp),
    source: "fallback",
  });
}

const HEADER = { name: "홍길동", schoolGrade: "중2", createdAt: "2026-08-01T00:00:00Z" };

function render(extra: Record<string, unknown> = {}, responses: ResponseMap = fill(2)) {
  return renderToStaticMarkup(
    <TeacherSheet profile={resultFor("both", responses)} header={HEADER} responses={fill(4)} {...extra} />,
  );
}

describe("TeacherSheet — 필수 블록", () => {
  const html = render();

  it("헤더에 이름·학년·과목이 들어간다", () => {
    expect(html).toContain("홍길동");
    expect(html).toContain("중2");
  });

  it("다섯 블록이 모두 있다", () => {
    for (const title of ["오늘 할 것 하나", "① 지금 상태", "② 먼저 도울 것", "④ 핵심 판단", "⑤ 입학 상담 확인", "③ 주의"]) {
      expect(html, title).toContain(title);
    }
  });

  it("핵심 판단 두 가지와 첫 달·첫 수업 처방을 보여 준다", () => {
    expect(html).toContain("철저한 관리를 버틸 수 있는가");
    expect(html).toContain("강하게 밀어도 되는가");
    expect(html).toContain("첫 달");
    expect(html).toContain("첫 수업");
    expect(html).toContain("고른 선생님");
  });

  it("입학 상담에서 확인할 질문을 빈 체크박스로 보여 준다", () => {
    expect((html.match(/☐/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("스스로 세운 공부 계획");
    expect(html).toContain("휴대폰을 어디에 두는지");
  });

  it("지금 상태는 점수 대신 등급 라벨로 보여 준다", () => {
    expect(html).toContain("먼저 도울 것");
  });

  it("먼저 도울 것에 금지형·행동형이 함께 나온다", () => {
    expect(html).toContain("하지 말 것");
    expect(html).toContain("할 것");
  });
});

describe("TeacherSheet — 노출 금지", () => {
  const html = render();

  it("MBTI 4글자를 쓰지 않는다", () => {
    expect(html).not.toContain("ISTJ");
    expect(html).not.toContain("MBTI");
  });

  it("연락처 필드를 렌더하지 않는다", () => {
    expect(html).not.toMatch(/01[016789]-\d{3,4}-\d{4}/);
  });

  it("핵심 판단에는 점수를 쓰지 않는다", () => {
    const block = html.split("④ 핵심 판단")[1]?.split("⑤ 입학 상담 확인")[0] ?? "";
    expect(block).not.toMatch(/\d+(\.\d+)?점/);
    expect(block).not.toMatch(/\d+\s*\/\s*5/);
  });
});

describe("TeacherSheet — 입학 상담 상태", () => {
  it("등록 후 확인 결과를 입학 당일 강사 시트에 섞지 않는다", () => {
    const html = render({}, fill(2));
    expect(html).not.toContain("☑");
    expect(html).not.toContain("달랐음");
    expect(html).not.toContain("14일");
  });

  it("응답 품질이 정상이고 이전 학원 메모가 없으면 주의 블록이 비어 있다고 밝힌다", () => {
    const html = render({}, variedFill());
    expect(html).toContain("특별히 먼저 챙길 주의사항은 없습니다");
  });

  it("응답 품질 경고와 해석 주의가 같은 말을 두 번 하지 않는다", () => {
    const caution = render().split("③ 주의")[1] ?? "";
    expect(caution).toContain("입학 상담과 첫 수업에서");
    expect(caution).not.toContain("첫 2주 동안");
  });

  it("이전 학원 불만이 있으면 첫 통화 주의를 띄우고, 학생의 우선 도움을 보여 준다", () => {
    const html = render({ background: { prevComplaint: "개인별 관리가 부족했다", entryPriority: "오답을 어디부터 볼지" } });
    expect(html).toContain("학부모 첫 통화");
    expect(html).toContain("개인별 관리가 부족했다");
    expect(html).toContain("오답을 어디부터 볼지");
  });
});
