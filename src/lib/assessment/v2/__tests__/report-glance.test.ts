import { describe, expect, it } from "vitest";
import { CONSTRUCT_LABEL, dockItemsFor, positiveBand } from "@/components/analysis-report-v2/report-theme";
import { ANSWER_LINE, signalBandOf } from "@/components/analysis-report-v2/signal-descriptions";
import type { CommonScores } from "../types";

// 결과지 3판이 의존하는 규칙을 고정한다.

/** 03 프로파일·04 질문별 해석에 쓰는 여덟 척도. 지도 방식 반응은 02 핵심 판단에서만 다룬다. */
const PROFILE_KEYS: (keyof CommonScores)[] = [
  "learningAttitude",
  "homeworkReliability",
  "goalClarity",
  "shortTermRecovery",
  "managementAcceptance",
  "questionInitiative",
  "phoneBoundary",
  "peerFocusBoundary",
];

describe("03 프로파일 — 여덟 척도", () => {
  it("지도 방식 반응을 제외한 여덟 척도다", () => {
    expect(PROFILE_KEYS).toHaveLength(8);
    expect(PROFILE_KEYS).not.toContain("coachingResponse");
  });

  it("각 척도에 화면 한글 라벨과 등급별 한 줄 답이 있다", () => {
    for (const k of PROFILE_KEYS) {
      expect(CONSTRUCT_LABEL[k], k).toBeTruthy();
      expect(ANSWER_LINE[k].high, k).toBeTruthy();
      expect(ANSWER_LINE[k].mid, k).toBeTruthy();
      expect(ANSWER_LINE[k].low, k).toBeTruthy();
    }
  });
});

describe("등급 기준 — 학부모 화면 단일 기준", () => {
  it("75 이상 잘 되고 있음 / 62.5 이상 지켜볼 것 / 그 미만 먼저 도울 것", () => {
    expect(signalBandOf(80)).toBe("high");
    expect(signalBandOf(75)).toBe("high");
    expect(signalBandOf(74.9)).toBe("mid");
    expect(signalBandOf(62.5)).toBe("mid");
    expect(signalBandOf(62.4)).toBe("low");
    expect(signalBandOf(50)).toBe("low");
  });

  it("3점(50)은 '보통'이 아니라 먼저 도울 것이다", () => {
    expect(positiveBand(50).label).toBe("먼저 도울 것");
    expect(positiveBand(68.75).label).toBe("지켜볼 것");
    expect(positiveBand(81.25).label).toBe("잘 되고 있음");
  });

  it("점수가 산출되지 않으면 등급도 없다", () => {
    expect(signalBandOf("insufficient")).toBeNull();
    expect(positiveBand("insufficient").label).toBe("정보 부족");
  });
});

describe("dockItemsFor — 실제 렌더 섹션과 일치", () => {
  it("02 핵심 판단이 첫 항목이다", () => {
    expect(dockItemsFor(false)[0].id).toBe("sec-verdict");
  });

  it("모바일 dock은 핵심 네 섹션만 둔다", () => {
    expect(dockItemsFor(false).map((d) => d.id)).toEqual(["sec-verdict", "sec-profile", "sec-questions", "sec-plan"]);
  });

  it("과목 유무와 관계없이 모바일 dock은 간결하게 유지한다", () => {
    expect(dockItemsFor(true)).toEqual(dockItemsFor(false));
  });

  it("모든 dock 항목이 결과지에 실제로 있는 섹션 id를 가리킨다", () => {
    const rendered = new Set([
      "sec-overview",
      "sec-verdict",
      "sec-profile",
      "sec-questions",
      "sec-answers",
      "sec-subject",
      "sec-summary",
      "sec-guidance",
      "sec-plan",
      "sec-parent",
    ]);
    for (const d of dockItemsFor(true)) expect(rendered.has(d.id), d.id).toBe(true);
  });
});
