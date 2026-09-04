import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 공개 설문 저장이 서버 전용 신뢰 경로(service role)로만 나가는지 검증한다.
// 이유 1: anon 키는 브라우저에 노출돼 있어 PostgREST 직호출로 서버 재채점을 우회할 수 있다.
// 이유 2: 중복 확인 SELECT가 anon 권한이면 RLS에 막혀 항상 비어 있어 중복 방어가 무력화된다.

// vi.mock 팩토리는 최상단으로 hoist되므로 mock 상태도 vi.hoisted로 함께 끌어올린다.
const { envMock, createAdminClientMock, createServerClientMock } = vi.hoisted(
  () => ({
    envMock: { SUPABASE_SERVICE_ROLE_KEY: "" },
    createAdminClientMock: vi.fn(),
    createServerClientMock: vi.fn(),
  })
);

vi.mock("@/lib/env", () => ({ env: envMock }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createServerClientMock,
}));

// rate limit은 이 테스트의 관심사가 아니므로 항상 통과시킨다.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 3 }),
}));

import {
  getItemsForSubject,
  isChoiceItem,
  isLikert,
} from "@/lib/assessment/v2/definition";
import type { SubjectSelection } from "@/lib/assessment/v2/types";
import { submitPublicSurveyV2 } from "@/lib/actions/public-survey-v2";

// 테스트별로 주입하는 중복 확인 SELECT 결과.
let dupRows: { id: string }[] = [];

type Call = { label: "admin" | "server"; table: string };
let selectCalls: Call[] = [];
let insertCalls: Call[] = [];

/** from(...) 체인만 흉내내는 최소 Supabase 목. select→eq→gte→(eq)→limit, insert 를 지원한다. */
function makeClient(label: "admin" | "server") {
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = () => {
        selectCalls.push({ label, table });
        return builder;
      };
      builder.eq = chain;
      builder.gte = chain;
      builder.limit = () => Promise.resolve({ data: dupRows, error: null });
      builder.insert = () => {
        insertCalls.push({ label, table });
        return Promise.resolve({ error: null });
      };
      return builder;
    },
  };
}

/** 주어진 과목의 모든 Likert=3, 모든 상황문항·강제선택=1로 채운 유효 제출 payload. */
function validSubmission(subject: SubjectSelection = "math") {
  const responses: Record<string, number> = {};
  const scenarios: Record<string, number> = {};
  for (const item of getItemsForSubject(subject)) {
    if (isLikert(item)) responses[item.id] = 3;
    else if (isChoiceItem(item)) scenarios[item.id] = 1;
  }
  return {
    intake: {
      name: "홍길동",
      school: "안산중학교",
      grade: "중2",
      subject_selection: subject,
      student_phone: "010-1111-2222",
      parent_phone: "010-3333-4444",
      profile_notice_acknowledged: true,
    },
    responses,
    scenarios,
    supplements: {},
    commitment14: "수학 개념을 어디서부터 다시 잡을지 함께 정하고 싶습니다.",
  };
}

describe("submitPublicSurveyV2 신뢰 쓰기 경로", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    dupRows = [];
    selectCalls = [];
    insertCalls = [];
    envMock.SUPABASE_SERVICE_ROLE_KEY = "";
    createAdminClientMock.mockImplementation(() => makeClient("admin"));
    createServerClientMock.mockImplementation(async () => makeClient("server"));
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("service role 키가 있으면 admin 클라이언트로 select·insert 하고 anon 서버 클라이언트는 쓰지 않는다", async () => {
    envMock.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const result = await submitPublicSurveyV2(validSubmission());

    expect(result).toEqual({ success: true });
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(selectCalls).toEqual([{ label: "admin", table: "surveys" }]);
    expect(insertCalls).toEqual([{ label: "admin", table: "surveys" }]);
  });

  it("service role 키가 없으면 anon 서버 클라이언트로 폴백하고 경고를 1회 남긴다", async () => {
    const result = await submitPublicSurveyV2(validSubmission());

    expect(result).toEqual({ success: true });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(insertCalls).toEqual([{ label: "server", table: "surveys" }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("[trusted-write]");
  });

  it("Zod 검증에 실패하면 어느 클라이언트도 만들지 않는다", async () => {
    envMock.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const result = await submitPublicSurveyV2({ intake: { name: "" } });

    expect(result.success).toBe(false);
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(insertCalls).toEqual([]);
  });

  it("최근 10분 내 중복 행이 있으면 insert 없이 중복 메시지를 반환한다", async () => {
    envMock.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    dupRows = [{ id: "existing-survey" }];

    const result = await submitPublicSurveyV2(validSubmission());

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      error: expect.stringContaining("이미 제출된 설문"),
    });
    expect(selectCalls).toEqual([{ label: "admin", table: "surveys" }]);
    expect(insertCalls).toEqual([]);
  });
});
