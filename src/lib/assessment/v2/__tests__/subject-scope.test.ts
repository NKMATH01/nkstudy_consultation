import { describe, expect, it } from "vitest";
import { getItemsForSubject, pruneToSubjectScope } from "../definition";

function idsFor(selection: "math" | "english" | "both"): Set<string> {
  return new Set(getItemsForSubject(selection).map((item) => item.id));
}

describe("pruneToSubjectScope", () => {
  it("새 과목 범위 밖의 응답만 제거하고 공통 문항은 남긴다", () => {
    const mathIds = idsFor("math");
    const englishOnly = [...idsFor("english")].filter((id) => !mathIds.has(id));
    expect(englishOnly.length).toBeGreaterThan(0);

    const values: Record<string, number> = { LT1: 4, LT2: 3 };
    for (const id of englishOnly) values[id] = 2;

    const result = pruneToSubjectScope(values, "math");

    expect(result.kept).toEqual({ LT1: 4, LT2: 3 });
    expect(result.removed.sort()).toEqual([...englishOnly].sort());
  });

  it("both으로 바꾸면 수학·영어 응답을 모두 남긴다", () => {
    const bothIds = [...idsFor("both")];
    const values = Object.fromEntries(bothIds.map((id) => [id, 3]));

    const result = pruneToSubjectScope(values, "both");

    expect(result.removed).toEqual([]);
    expect(Object.keys(result.kept).length).toBe(bothIds.length);
  });

  it("정의에 없는 키도 제거 대상으로 본다", () => {
    const result = pruneToSubjectScope({ LT1: 5, unknown_item: 1 }, "math");

    expect(result.kept).toEqual({ LT1: 5 });
    expect(result.removed).toEqual(["unknown_item"]);
  });

  it("빈 응답이면 아무것도 제거하지 않는다", () => {
    expect(pruneToSubjectScope({}, "english")).toEqual({ kept: {}, removed: [] });
  });
});
