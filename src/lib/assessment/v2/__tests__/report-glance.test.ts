import { describe, expect, it } from "vitest";
import { CONSTRUCT_LABEL, dockItemsFor } from "@/components/analysis-report-v2/report-theme";
import { signalBandOf } from "@/components/analysis-report-v2/signal-descriptions";
import type { CommonScores } from "../types";

// 00 한 장 요약이 의존하는 규칙을 고정한다.
// (컴포넌트 렌더 대신 규칙만 검증 — 렌더 스모크는 배포 후 브라우저로 확인)

/** 00 요약 정렬 바에 쓰는 5축. peerLearningResource는 합산 축에서 뺐다(P1-B). */
const GLANCE_KEYS: (keyof CommonScores)[] = [
  "learningAttitude",
  "homeworkReliability",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
];

function sortDesc(items: { label: string; score: number | null }[]) {
  return [...items].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

describe("00 한 장 요약 — 정렬 바", () => {
  it("합산 축은 또래 자원을 제외한 5축이다", () => {
    expect(GLANCE_KEYS).toHaveLength(5);
    expect(GLANCE_KEYS).not.toContain("peerLearningResource");
    expect(GLANCE_KEYS).not.toContain("peerFocusBoundary");
  });

  it("각 축에 화면 한글 라벨이 있다", () => {
    for (const k of GLANCE_KEYS) {
      expect(CONSTRUCT_LABEL[k], k).toBeTruthy();
    }
  });

  it("점수 내림차순으로 정렬해 위에서부터 잘 되는 순으로 읽힌다", () => {
    const sorted = sortDesc([
      { label: "a", score: 40 },
      { label: "b", score: 80 },
      { label: "c", score: 60 },
    ]);
    expect(sorted.map((x) => x.label)).toEqual(["b", "c", "a"]);
  });

  it("정보 부족(null)은 맨 뒤로 보낸다", () => {
    const sorted = sortDesc([
      { label: "none", score: null },
      { label: "low", score: 10 },
    ]);
    expect(sorted.map((x) => x.label)).toEqual(["low", "none"]);
  });
});

describe("00 한 장 요약 — 강점 칩 / 도와줄 부분", () => {
  // 강점 칩은 high 밴드만, 최대 2개, 라벨만(점수 노출 금지 — 학부모 패널 합의).
  function strengthLabels(items: { label: string; score: number }[]) {
    return items
      .filter((it) => signalBandOf(it.score) === "high")
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((it) => it.label);
  }

  it("high 밴드만 강점 칩으로 뽑는다", () => {
    const labels = strengthLabels([
      { label: "높음", score: 80 },
      { label: "중간", score: 50 },
      { label: "낮음", score: 20 },
    ]);
    expect(labels).toEqual(["높음"]);
  });

  it("최대 2개까지만 노출한다", () => {
    const labels = strengthLabels([
      { label: "1등", score: 90 },
      { label: "2등", score: 85 },
      { label: "3등", score: 80 },
    ]);
    expect(labels).toEqual(["1등", "2등"]);
  });

  it("high가 없으면 칩을 만들지 않는다", () => {
    expect(strengthLabels([{ label: "중간", score: 50 }])).toEqual([]);
  });
});

describe("밴드 기준(signalBandOf) — 학부모 화면 단일 기준", () => {
  it("65 이상 high / 45 이상 mid / 그 미만 low", () => {
    expect(signalBandOf(80)).toBe("high");
    expect(signalBandOf(65)).toBe("high");
    expect(signalBandOf(64)).toBe("mid");
    expect(signalBandOf(45)).toBe("mid");
    expect(signalBandOf(44)).toBe("low");
  });

  it("점수가 산출되지 않으면 밴드도 없다", () => {
    expect(signalBandOf("insufficient")).toBeNull();
  });
});

describe("dockItemsFor — 실제 렌더 섹션과 일치", () => {
  it("00 요약이 첫 항목이다", () => {
    expect(dockItemsFor(false)[0].id).toBe("sec-glance");
  });

  it("과목 섹션이 없으면 과목 항목을 넣지 않는다", () => {
    const ids = dockItemsFor(false).map((d) => d.id);
    expect(ids).not.toContain("sec-subject");
  });

  it("과목 섹션이 있으면 계획 앞에 과목을 끼운다", () => {
    const ids = dockItemsFor(true).map((d) => d.id);
    expect(ids).toContain("sec-subject");
    expect(ids.indexOf("sec-subject")).toBeLessThan(ids.indexOf("sec-plan"));
  });

  it("모든 dock 항목이 결과지에 실제로 있는 섹션 id를 가리킨다", () => {
    const rendered = new Set([
      "sec-glance",
      "sec-summary",
      "sec-strength",
      "sec-weakness",
      "sec-signals",
      "sec-subject",
      "sec-preference",
      "sec-plan",
    ]);
    for (const d of dockItemsFor(true)) {
      expect(rendered.has(d.id), d.id).toBe(true);
    }
  });
});
