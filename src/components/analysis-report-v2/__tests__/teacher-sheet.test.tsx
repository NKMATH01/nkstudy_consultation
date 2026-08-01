import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_ITEMS, isLikert } from "@/lib/assessment/v2/definition";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
} from "@/lib/assessment/v2/interpretation";
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
    scenarioResponses: { R2: 2, C1: 1, C2: 3, MS1: 4, MS2: 2, ES1: 1, ES2: 4 },
    clinicAvailability: 100,
    mbti: { type: "ISTJ", confidence: "high" },
  });
  return buildResultProfileV2({
    scoreProfile: sp,
    interpretation: buildFallbackInterpretation(sp),
    source: "fallback",
  });
}

const HEADER = { name: "홍길동", schoolGrade: "중2", createdAt: "2026-08-01T00:00:00Z" };

function render(
  extra: Record<string, unknown> = {},
  responses: ResponseMap = fill(2),
) {
  return renderToStaticMarkup(
    <TeacherSheet
      profile={resultFor("both", responses)}
      header={HEADER}
      responses={fill(4)}
      {...extra}
    />,
  );
}

describe("TeacherSheet — 필수 블록", () => {
  const html = render();

  it("헤더에 이름·학년·과목이 들어간다", () => {
    expect(html).toContain("홍길동");
    expect(html).toContain("중2");
  });

  it("다섯 블록이 모두 있다", () => {
    for (const title of [
      "오늘 할 것 하나",
      "① 지금 상태",
      "② 먼저 도울 것",
      "④ 말 거는 방식",
      "⑤ 2주 뒤 확인",
      "③ 주의",
    ]) {
      expect(html, title).toContain(title);
    }
  });

  it("2주 뒤 확인은 저장 전이면 빈 체크박스 3개다", () => {
    expect(html.match(/☐/g) ?? []).toHaveLength(3);
    expect(html).toContain("수업 진입");
    expect(html).toContain("숙제 기한");
    expect(html).toContain("재시작");
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
    // 시트는 contacts를 아예 받지 않는다. 전화번호 형태가 나오면 회귀다.
    expect(html).not.toMatch(/01[016789]-\d{3,4}-\d{4}/);
  });

  it("말 거는 방식에는 점수를 쓰지 않는다", () => {
    const talk = html.split("④ 말 거는 방식")[1]?.split("⑤ 2주 뒤 확인")[0] ?? "";
    expect(talk).not.toMatch(/\d+(\.\d+)?점/);
    expect(talk).not.toMatch(/\d+\s*\/\s*5/);
  });
});

describe("TeacherSheet — 상태 반영", () => {
  it("저장된 확인 결과가 있으면 체크 표시와 결과 라벨이 보인다", () => {
    const html = render({
      checks: [{ itemIndex: 2, result: "differed", teacher: "김수한" }],
    }, fill(2));
    expect(html).toContain("☑");
    expect(html).toContain("달랐음");
    expect(html).toContain("김수한");
  });

  it("응답 품질이 정상이고 이전 학원 메모가 없으면 주의 블록이 비어 있다고 밝힌다", () => {
    const html = render({}, variedFill());
    expect(html).toContain("특별히 먼저 챙길 주의사항은 없습니다");
  });

  it("응답 품질 경고와 해석 주의가 같은 말을 두 번 하지 않는다", () => {
    const html = render();
    const caution = html.split("③ 주의")[1] ?? "";
    expect(caution).toContain("첫 2주에 직접 확인할 값입니다");
    expect(caution).not.toContain("첫 2주 동안 함께 확인할 부분이에요");
  });

  it("이전 학원 불만이 있으면 첫 통화 주의를 띄운다", () => {
    const html = render({
      background: { prevComplaint: "개인별 관리가 부족했다" },
    });
    expect(html).toContain("학부모 첫 통화");
    expect(html).toContain("개인별 관리가 부족했다");
  });
});
