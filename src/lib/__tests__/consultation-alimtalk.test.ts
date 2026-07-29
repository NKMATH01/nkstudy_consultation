import { describe, expect, it } from "vitest";
import {
  buildAlimtalkSendMap,
  buildConsultConfirmVars,
} from "../consultation-alimtalk";
import type { Consultation } from "@/types";

function makeConsultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "consultation-1",
    name: "홍길동",
    school: "안산고",
    grade: "고1",
    parent_phone: "01012345678",
    consult_date: "2026-07-30",
    consult_time: "14:00",
    subject: "수학",
    location: "NK학원(폴리타운 B동 4층)",
    consult_type: "유선 상담",
    status: "active",
    result_status: "none",
    ...overrides,
  } as Consultation;
}

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

describe("buildConsultConfirmVars", () => {
  it("대면 상담 시각에도 오전/오후 접두어를 붙인다", () => {
    expect(
      buildConsultConfirmVars(
        makeConsultation({ consult_type: "대면 상담 15:30" }),
      ).학부모상담,
    ).toBe("7/30(목) 오후 3시 30분에 진행됩니다.");

    expect(
      buildConsultConfirmVars(
        makeConsultation({ consult_type: "대면 상담 10:00" }),
      ).학부모상담,
    ).toBe("7/30(목) 오전 10시에 진행됩니다.");
  });

  it("학부모 상담 일정이 따로 있으면 그 일정을 쓴다", () => {
    expect(
      buildConsultConfirmVars(
        makeConsultation({
          parent_consult_date: "2026-08-03",
          parent_consult_time: "19:00",
          parent_location: "자이센터프라자 801호",
        }),
      ).학부모상담,
    ).toBe("8/3(월) 오후 7시 (자이센터프라자 801호)에 진행됩니다.");
  });

  it("일시는 오전/오후 표기로 렌더한다", () => {
    expect(buildConsultConfirmVars(makeConsultation()).일시).toBe(
      "7/30(목) 오후 2시",
    );
  });
});
