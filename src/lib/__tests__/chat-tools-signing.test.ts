import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { envMock, createAdminClientMock } = vi.hoisted(() => ({
  envMock: {
    CHAT_PROPOSAL_SIGNING_SECRET: "a".repeat(64),
  },
  createAdminClientMock: vi.fn(() => {
    throw new Error("서명 단위 테스트에서 DB 접근은 허용되지 않습니다.");
  }),
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import {
  signProposal,
  verifyProposal,
  type Proposal,
} from "../chat-tools";

const NOW = Date.parse("2026-07-25T03:00:00.000Z");
const TEST_SIGNING_SECRET = "a".repeat(64);

function proposalData(timestamp = NOW): Omit<Proposal, "signature"> {
  return {
    entity: "consultation",
    operation: "update",
    targetId: "consultation-1",
    targetName: "홍길동",
    changes: { memo: "재상담 필요" },
    description: "상담 메모 갱신",
    timestamp,
  };
}

function signedProposal(timestamp = NOW): Proposal {
  const data = proposalData(timestamp);
  return {
    ...data,
    signature: signProposal(data),
  };
}

describe("chat proposal HMAC signing", () => {
  beforeEach(() => {
    envMock.CHAT_PROPOSAL_SIGNING_SECRET = TEST_SIGNING_SECRET;
    createAdminClientMock.mockClear();
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("정상 서명을 검증한다", () => {
    expect(verifyProposal(signedProposal())).toEqual({ valid: true });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("changes가 한 글자라도 변조되면 거부한다", () => {
    const proposal = signedProposal();

    expect(
      verifyProposal({
        ...proposal,
        changes: { memo: "재상담 필요!" },
      }),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining("변조"),
    });
  });

  it("30초 허용 범위를 넘은 미래 timestamp를 거부한다", () => {
    expect(verifyProposal(signedProposal(NOW + 31_000))).toMatchObject({
      valid: false,
      error: expect.stringContaining("유효하지 않습니다"),
    });
  });

  it("5분을 초과한 과거 timestamp를 만료 처리한다", () => {
    expect(
      verifyProposal(signedProposal(NOW - 5 * 60 * 1000 - 1)),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining("만료"),
    });
  });

  it("비정상 hex와 빈 서명을 예외 없이 거부한다", () => {
    for (const signature of ["not-hex", ""]) {
      expect(() =>
        verifyProposal({
          ...proposalData(),
          signature,
        }),
      ).not.toThrow();
      expect(
        verifyProposal({
          ...proposalData(),
          signature,
        }),
      ).toMatchObject({
        valid: false,
        error: expect.stringContaining("변조"),
      });
    }
  });

  it("전용 서명 시크릿이 없으면 제안 서명을 생성하지 않는다", () => {
    envMock.CHAT_PROPOSAL_SIGNING_SECRET = " ";

    expect(() => signProposal(proposalData())).toThrow(
      "CHAT_PROPOSAL_SIGNING_SECRET 미설정 — 챗 제안 기능을 사용할 수 없습니다.",
    );
  });
});
