import { describe, expect, it, vi } from "vitest";

// 목록 컴포넌트가 끌고 오는 서버 전용 표식(server-only)은 순수 함수 검증에 필요 없어 빈 모듈로 바꾼다.
vi.mock("server-only", () => ({}));

import { getParentQuestionnaireChip } from "../survey-list-client";

const STATUS = {
  "c-new": { issued: true, answeredAt: null },
  "c-old": { issued: true, answeredAt: "2026-10-02T09:00:00Z" },
  "c-none": { issued: false, answeredAt: null },
};

describe("getParentQuestionnaireChip", () => {
  it("재상담 여러 건 중 예전 상담에 답이 있으면 '학부모 답변', 분석이 먼저였으면 다시 분석 안내", () => {
    const chip = getParentQuestionnaireChip(["c-new", "c-old"], STATUS, "2026-10-01T00:00:00Z");
    expect(chip).toMatchObject({ kind: "answered", label: "학부모 답변" });
    expect(chip?.title).toContain("다시 분석하면 반영됩니다");
    const reflected = getParentQuestionnaireChip(["c-old"], STATUS, "2026-10-03T00:00:00Z");
    expect(reflected?.title).not.toContain("다시 분석");
  });

  it("링크만 있으면 '질문지 보냄', 아무것도 없으면 null", () => {
    expect(getParentQuestionnaireChip(["c-new"], STATUS, null)).toMatchObject({ kind: "issued", label: "질문지 보냄" });
    expect(getParentQuestionnaireChip(["c-none", "c-missing"], STATUS, null)).toBeNull();
    expect(getParentQuestionnaireChip([], STATUS, null)).toBeNull();
  });
});
