import { describe, expect, it } from "vitest";
import {
  canViewRestrictedAnalytics,
  filterMenuItems,
  getVisibleSectors,
  RESTRICTED_ANALYTICS_PATHS,
  withdrawalItems,
} from "../menu-sectors";
import type { CurrentTeacherInfo } from "@/types";

function teacher(overrides: Partial<CurrentTeacherInfo> = {}): CurrentTeacherInfo {
  return { name: "홍길동", role: "teacher", allowed_menus: null, ...overrides } as CurrentTeacherInfo;
}

const restricted = [...RESTRICTED_ANALYTICS_PATHS];

describe("퇴원 분석 경로 role 게이트", () => {
  it("principal과 admin만 통과한다", () => {
    expect(canViewRestrictedAnalytics("principal")).toBe(true);
    expect(canViewRestrictedAnalytics("admin")).toBe(true);
    for (const role of ["teacher", "clinic", "manager", "staff", "director", null, undefined, ""]) {
      expect(canViewRestrictedAnalytics(role)).toBe(false);
    }
  });

  // 기존 fail-open(레코드 없음 / allowed_menus 미설정)이 이 경로에는 통하지 않아야 한다.
  it("teacher 레코드가 없어도 제한 경로는 노출하지 않는다", () => {
    const hrefs = filterMenuItems(withdrawalItems, null).map((item) => item.href);
    expect(hrefs).toEqual(["/withdrawals"]);
  });

  it("allowed_menus 미설정(fail-open) 강사에게도 제한 경로는 노출하지 않는다", () => {
    for (const allowed_menus of [null, [] as string[]]) {
      const hrefs = filterMenuItems(withdrawalItems, teacher({ allowed_menus })).map((i) => i.href);
      expect(hrefs).toEqual(["/withdrawals"]);
    }
  });

  it("clinic이 allowed_menus로 제한 경로를 갖고 있어도 노출하지 않는다", () => {
    const hrefs = filterMenuItems(
      withdrawalItems,
      teacher({ role: "clinic", allowed_menus: ["/withdrawals", ...restricted] }),
    ).map((item) => item.href);
    expect(hrefs).toEqual(["/withdrawals"]);
  });

  it("principal에게는 제한 경로가 모두 보인다", () => {
    const hrefs = filterMenuItems(withdrawalItems, teacher({ role: "principal" })).map((i) => i.href);
    expect(hrefs).toEqual(withdrawalItems.map((item) => item.href));
  });

  it("admin에게도 제한 경로가 모두 보인다", () => {
    const hrefs = filterMenuItems(
      withdrawalItems,
      teacher({ role: "admin", allowed_menus: ["/"] }),
    ).map((item) => item.href);
    expect(hrefs).toEqual(withdrawalItems.map((item) => item.href));
  });

  it("퇴원생 관리 카테고리는 일반 강사에게 목록 1개만 남는다", () => {
    const sector = getVisibleSectors(teacher()).find((s) => s.name === "퇴원생 관리");
    expect(sector?.items.map((item) => item.href)).toEqual(["/withdrawals"]);
  });
});
