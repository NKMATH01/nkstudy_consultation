import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mapDirectorSchedule, scheduleAuthorized, scheduleRange, type ScheduleRow } from "../nbrain-schedule";

const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { GET } from "@/app/api/integrations/nbrain/consultations/route";

const token = "a".repeat(48);
const range = { from: "2026-09-01", to: "2026-09-30" };
const row: ScheduleRow = {
  id: "11111111-1111-4111-8111-111111111111", name: "테스트", parent_phone: "010-0000-0000",
  consult_date: "2026-09-18", consult_time: "14:00:00", consult_type: "대면 상담 15:30",
  location: "본원", parent_consult_date: "2026-09-20", parent_consult_time: "17:10:00",
  parent_location: "별도 장소", status: "active", consult_done: false,
};

describe("director schedule contract", () => {
  it("accepts only exact strong bearer authentication", () => {
    expect(scheduleAuthorized(`Bearer ${token}`, token)).toBe(true);
    for (const header of [null, token, `bearer ${token}`, `Bearer ${token} `, `Bearer ${token.slice(1)}`, `Bearer ${token}\n`]) expect(scheduleAuthorized(header, token)).toBe(false);
    expect(scheduleAuthorized("Bearer short", "short")).toBe(false);
    expect(scheduleAuthorized(`Bearer ${token}`, undefined)).toBe(false);
  });
  it("validates real inclusive dates and a maximum 93 days", () => {
    expect(scheduleRange("2026-01-01", "2026-04-03")).not.toBeNull();
    for (const dates of [["2026-01-01", "2026-04-04"], ["2026-02-30", "2026-03-01"], ["2026-09-30", "2026-09-01"], [null, "2026-09-01"]]) expect(scheduleRange(dates[0], dates[1])).toBeNull();
  });
  it("maps face time and independent parent date/time without private notes", () => {
    const items = mapDirectorSchedule([row], range);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: `${row.id}:main`, time: "15:30", date: "2026-09-18", mode: "in_person" });
    expect(items[1]).toMatchObject({ id: `${row.id}:parent`, time: "17:10", date: "2026-09-20", location: "별도 장소" });
    expect(Object.keys(items[0]).sort()).toEqual(["id", "consultation_id", "student_name", "parent_phone", "date", "time", "mode", "location", "status", "kind", "source_url", "subject", "lifecycle"].sort());
  });
  it("prefers parenthesized booking face time over the earlier test slot", () => {
    const items = mapDirectorSchedule([{ ...row, consult_type: "대면 (15:30)", consult_time: "15:00" }], range);
    expect(items[0].time).toBe("15:30");
  });
  it("rejects malformed embedded times without accepting a partial clock", () => {
    for (const consult_type of ["대면 (25:30)", "대면 (15:70)", "대면 (115:30)", "대면 (15:300)", "대면 (15:30:99)"]) {
      expect(mapDirectorSchedule([{ ...row, consult_type, consult_time: "14:00" }], range)[0].time).toBe("14:00");
    }
  });
  it("includes both consultation modes but excludes cancelled, completed and done", () => {
    for (const override of [{ status: "cancelled" }, { status: "completed" }, { consult_done: true }]) expect(mapDirectorSchedule([{ ...row, ...override }], range)).toEqual([]);
    expect(mapDirectorSchedule([{ ...row, consult_type: "유선 상담" }], range)[0].mode).toBe("phone");
    expect(mapDirectorSchedule([{ ...row, status: "pending" }], range)).toHaveLength(2);
  });
  it("filters each date independently and never borrows main time for parent", () => {
    const items = mapDirectorSchedule([{ ...row, consult_date: "2026-08-31", parent_consult_time: null }], range);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "parent", date: "2026-09-20", time: null });
    expect(mapDirectorSchedule([{ ...row, consult_date: null, parent_consult_date: null }], range)).toEqual([]);
  });
});

describe("schedule route authorization boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NK_BRAIN_SCHEDULE_TOKEN", token); });
  const request = (authorization?: string, query = "from=2026-09-01&to=2026-09-30") => new NextRequest(`https://example.test/api/integrations/nbrain/consultations?${query}`, { headers: authorization ? { authorization } : {} });
  it("never creates admin client before authentication and valid range", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request(`Bearer ${"b".repeat(48)}`))).status).toBe(401);
    expect((await GET(request(`Bearer ${token}`, "from=bad"))).status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("returns active schedules with no-store", async () => {
    const query = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), then: vi.fn((resolve) => resolve({ data: [row, { ...row, status: "cancelled" }], count: 2, error: null })) };
    mocks.admin.mockReturnValue({ from: () => query });
    const response = await GET(request(`Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).items).toHaveLength(2);
    query.then.mockImplementation(resolve => resolve({ data: [row], count: 1001, error: null }));
    expect((await GET(request(`Bearer ${token}`))).status).toBe(422);
  });
});

it("includes subject and lifecycle only when historical rows are requested", () => {
  const done = {...row, subject: "영어수학", consult_done: true};
  expect(mapDirectorSchedule([done], range)).toEqual([]);
  expect(mapDirectorSchedule([done], range, true)[0]).toMatchObject({subject:"영어수학",lifecycle:"completed"});
  expect(mapDirectorSchedule([{...row,status:"cancelled"}], range, true)[0].lifecycle).toBe("cancelled");
});
