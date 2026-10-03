import { describe, it, expect } from "vitest";
import { quadDotStyle, quadrantPlacement } from "../parent-report";

describe("지도 방식 사분면 칸·이름 위치 계산", () => {
  it("점수가 없으면 칸을 정하지 않는다", () => {
    expect(quadrantPlacement("insufficient", 70)).toBeNull();
    expect(quadrantPlacement(70, "insufficient")).toBeNull();
  });

  it("경계 62.5는 위·오른쪽 칸에 넣는다", () => {
    expect(quadrantPlacement(62.5, 62.5)).toEqual({ cell: "tr", labelAt: "top" });
    expect(quadrantPlacement(62.4, 62.4)).toEqual({ cell: "bl", labelAt: "bottom" });
  });

  it("네 칸을 가른다(이름 기본 위치)", () => {
    expect(quadrantPlacement(70, 70)).toEqual({ cell: "tr", labelAt: "top" });
    expect(quadrantPlacement(20, 70)).toEqual({ cell: "tl", labelAt: "top" });
    expect(quadrantPlacement(20, 40)).toEqual({ cell: "bl", labelAt: "bottom" });
    expect(quadrantPlacement(90, 40)).toEqual({ cell: "br", labelAt: "bottom" });
  });

  it("점이 이름 쪽 절반에 있으면 이름을 반대쪽으로 옮긴다", () => {
    expect(quadrantPlacement(88, 81)).toEqual({ cell: "tr", labelAt: "top" });
    expect(quadrantPlacement(88, 81.25)).toEqual({ cell: "tr", labelAt: "bottom" });
    expect(quadrantPlacement(0, 100)).toEqual({ cell: "tl", labelAt: "bottom" });
    expect(quadrantPlacement(100, 0)).toEqual({ cell: "br", labelAt: "top" });
    expect(quadrantPlacement(30, 31.24)).toEqual({ cell: "bl", labelAt: "top" });
    expect(quadrantPlacement(30, 31.25)).toEqual({ cell: "bl", labelAt: "bottom" });
  });
});

describe("지도 방식 사분면 점 위치(격자와 같은 좌표계)", () => {
  it("점수를 그대로 % 로 쓰고, 테두리 밖으로만 안 나가게 막는다", () => {
    expect(quadDotStyle(62.5, 62.5)).toEqual({
      left: "clamp(6px, 62.5%, calc(100% - 6px))",
      bottom: "clamp(6px, 62.5%, calc(100% - 6px))",
    });
    expect(quadDotStyle(0, 100)).toEqual({
      left: "clamp(6px, 0%, calc(100% - 6px))",
      bottom: "clamp(6px, 100%, calc(100% - 6px))",
    });
  });

  it("62.4·62.5·62.6 에서 점이 경계선 기준 칸 판정과 같은 쪽에 있다", () => {
    for (const v of [62.4, 62.5, 62.6, 0, 100]) {
      const at = parseFloat(quadDotStyle(v, v).left.split(",")[1]);
      const place = quadrantPlacement(v, v)!;
      expect(at >= 62.5, `x=${v}`).toBe(place.cell === "tr");
      expect(at, `x=${v}`).toBe(v);
    }
  });
});
