import { describe, expect, it } from "vitest";
import { isPublicPath } from "../public-paths";

describe("isPublicPath — 비로그인 공개 경로", () => {
  it("학생·학부모 공개 화면과 그 하위 경로는 열린다", () => {
    for (const p of [
      "/survey",
      "/survey/parent/0123456789abcdef0123456789abcdef",
      "/booking",
      "/booking/done",
      "/report/392f1ec6-6295-48b1-95d2-33cb6db90ce1",
      "/feedback/abc",
      "/login",
      "/auth/callback",
      "/api/sso/consume",
      "/api/cron/recordings",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("앞부분만 같은 직원 화면은 막는다(/surveys·/bookings 사고 재발 방지)", () => {
    for (const p of [
      "/surveys",
      "/surveys/0972a871-de38-440e-a314-1e5fec594f47",
      "/bookings",
      "/reports",
      "/feedbacks",
      "/survey-admin",
      "/loginx",
      "/",
      "/exams",
      "/consultations",
      "/api/ssox",
      "/api/chat",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});
