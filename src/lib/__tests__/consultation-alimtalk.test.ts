import { describe, expect, it } from "vitest";
import { buildAlimtalkSendMap } from "../consultation-alimtalk";

describe("buildAlimtalkSendMap", () => {
  it("상담별 최신 발송 이력만 남기고 consultation_id가 없는 행은 제외한다", () => {
    expect(
      buildAlimtalkSendMap([
        {
          consultation_id: "consultation-1",
          status: "failed",
          send_at: "2026-07-23T03:00:00.000Z",
        },
        {
          consultation_id: null,
          status: "sent",
          send_at: "2026-07-24T04:00:00.000Z",
        },
        {
          consultation_id: "consultation-2",
          status: "retry",
          send_at: "2026-07-24T02:00:00.000Z",
        },
        {
          consultation_id: "consultation-1",
          status: "sent",
          send_at: "2026-07-24T03:00:00.000Z",
        },
      ]),
    ).toEqual({
      "consultation-1": {
        status: "sent",
        sendAt: "2026-07-24T03:00:00.000Z",
      },
      "consultation-2": {
        status: "pending",
        sendAt: "2026-07-24T02:00:00.000Z",
      },
    });
  });
});
