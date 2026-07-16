import { describe, expect, it } from "vitest";
import { roundTimeTo10 } from "../time-utils";

describe("roundTimeTo10", () => {
  it("10분 경계값은 그대로 유지한다", () => {
    expect(roundTimeTo10("15:00")).toBe("15:00");
  });

  it("x4분은 아래 10분으로 반올림한다", () => {
    expect(roundTimeTo10("15:04")).toBe("15:00");
  });

  it("x5분은 위 10분으로 반올림한다", () => {
    expect(roundTimeTo10("15:05")).toBe("15:10");
  });

  it("x9분은 위 10분으로 반올림한다", () => {
    expect(roundTimeTo10("15:09")).toBe("15:10");
  });

  it("자정을 넘어가면 00:00으로 롤오버한다", () => {
    expect(roundTimeTo10("23:58")).toBe("00:00");
  });

  it("빈 문자열과 비정상 포맷은 원본을 반환한다", () => {
    expect(roundTimeTo10("")).toBe("");
    expect(roundTimeTo10("25:99")).toBe("25:99");
    expect(roundTimeTo10("오후 3시")).toBe("오후 3시");
  });

  it("HH:MM:SS 입력은 초를 제거하고 10분 단위로 반환한다", () => {
    expect(roundTimeTo10("15:07:42")).toBe("15:10");
  });
});
