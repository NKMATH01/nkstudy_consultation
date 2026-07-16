import { describe, expect, it } from "vitest";
import {
  ALLOWED_FIELDS,
  isChatMutationAllowed,
} from "../chat-tools";

describe("chat mutation lifecycle permissions", () => {
  it("예약 mutation을 모두 차단한다", () => {
    expect(isChatMutationAllowed("booking", "create")).toBe(false);
    expect(isChatMutationAllowed("booking", "update")).toBe(false);
    expect(isChatMutationAllowed("booking", "delete")).toBe(false);
  });

  it("상담 삭제는 차단하고 일반 수정은 유지한다", () => {
    expect(isChatMutationAllowed("consultation", "update")).toBe(true);
    expect(isChatMutationAllowed("consultation", "delete")).toBe(false);
  });

  it("상담 상태와 일정 필드는 일반 수정 화이트리스트에서 제외한다", () => {
    expect(ALLOWED_FIELDS.consultation).not.toContain("status");
    expect(ALLOWED_FIELDS.consultation).not.toContain("consult_date");
    expect(ALLOWED_FIELDS.consultation).not.toContain("consult_time");
    expect(ALLOWED_FIELDS.consultation).toContain("result_status");
  });
});
