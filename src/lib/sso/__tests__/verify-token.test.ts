// SSO 소비측 검증·매칭 단위 테스트.
//
// 여기서 지키려는 것은 "정상 토큰이 통과한다"가 아니라 "이상한 토큰이 반드시 막힌다"다.
// 서명 위조·만료·다른 앱 키·규약 버전·동명이인 — 하나라도 새면 남의 계정이 열린다.
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  matchStaffProfile,
  phoneDigits,
  signSsoToken,
  staffLandingPath,
  verifySsoToken,
  SSO_APP,
  SSO_MAX_AGE_MS,
  SSO_MAX_TOKEN_CHARS,
  SSO_VERSION,
  type SsoPayload,
  type StaffCandidate,
} from "../verify-token";

const SECRET = "test-secret-0123456789";
const NOW = 1_800_000_000_000; // 고정 시각(ms). 시계에 기대는 테스트는 언젠가 깨진다.

/** 기본은 '지금 막 발급된 정상 토큰'. 필요한 필드만 덮어써서 어긋난 경우를 만든다. */
function payload(overrides: Partial<SsoPayload> = {}): SsoPayload {
  return {
    v: SSO_VERSION,
    app: SSO_APP,
    wr_user_id: "wr-uuid-1",
    name: "김기영",
    phone: "010-1234-5678",
    role: "REPRESENTATIVE",
    iat: Math.floor(NOW / 1000),
    exp: Math.floor(NOW / 1000) + 60,
    ...overrides,
  };
}

describe("verifySsoToken", () => {
  it("정상 토큰을 통과시키고 payload 를 돌려준다", () => {
    const result = verifySsoToken(signSsoToken(payload(), SECRET), SECRET, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.name).toBe("김기영");
    expect(result.payload.wr_user_id).toBe("wr-uuid-1");
    expect(result.payload.app).toBe(SSO_APP);
  });

  it("비밀키가 없으면 통과가 아니라 거절이다 (fail closed)", () => {
    const token = signSsoToken(payload(), SECRET);
    expect(verifySsoToken(token, "", NOW)).toEqual({ ok: false, reason: "no_secret" });
    expect(verifySsoToken(token, undefined, NOW)).toEqual({
      ok: false,
      reason: "no_secret",
    });
  });

  it("토큰이 없으면 거절한다", () => {
    expect(verifySsoToken(null, SECRET, NOW)).toEqual({ ok: false, reason: "no_token" });
    expect(verifySsoToken("", SECRET, NOW)).toEqual({ ok: false, reason: "no_token" });
  });

  it("다른 키로 서명한 토큰을 거절한다", () => {
    const forged = signSsoToken(payload(), "another-secret");
    expect(verifySsoToken(forged, SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("payload 를 고치면 서명이 깨진다", () => {
    const token = signSsoToken(payload(), SECRET);
    const [, mac] = token.split(".");
    const tampered = Buffer.from(
      JSON.stringify(payload({ name: "남의이름" })),
      "utf8",
    ).toString("base64url");
    expect(verifySsoToken(`${tampered}.${mac}`, SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("형식이 아닌 문자열을 서명 검사 전에 거른다", () => {
    expect(verifySsoToken("점이없다", SECRET, NOW).ok).toBe(false);
    expect(verifySsoToken("a.b.c", SECRET, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
    // base64url 이 아닌 문자가 섞이면 Buffer 가 조용히 버린다 — 그 전에 막는다.
    expect(verifySsoToken("abc!!!.def", SECRET, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("지나치게 긴 토큰은 파싱조차 하지 않는다", () => {
    const long = `${"a".repeat(SSO_MAX_TOKEN_CHARS)}.b`;
    expect(verifySsoToken(long, SECRET, NOW)).toEqual({ ok: false, reason: "too_long" });
  });

  it("만료된 토큰을 거절한다", () => {
    const token = signSsoToken(payload(), SECRET);
    expect(verifySsoToken(token, SECRET, NOW + 61_000)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("60초보다 멀리 있는 exp 를 거절한다 (장기 토큰 금지)", () => {
    const far = signSsoToken(
      payload({ exp: Math.floor((NOW + 365 * 24 * 3600 * 1000) / 1000) }),
      SECRET,
    );
    expect(verifySsoToken(far, SECRET, NOW)).toEqual({
      ok: false,
      reason: "exp_too_far",
    });
  });

  it("exp 를 초·밀리초 둘 다 받는다", () => {
    const seconds = signSsoToken(payload({ exp: Math.floor(NOW / 1000) + 30 }), SECRET);
    const millis = signSsoToken(payload({ exp: NOW + 30_000 }), SECRET);
    expect(verifySsoToken(seconds, SECRET, NOW).ok).toBe(true);
    expect(verifySsoToken(millis, SECRET, NOW).ok).toBe(true);
  });

  it("시계 오차 5초까지는 받아 준다 (상한 60초 + skew)", () => {
    const edge = signSsoToken(
      payload({ exp: Math.floor((NOW + SSO_MAX_AGE_MS + 4_000) / 1000) }),
      SECRET,
    );
    expect(verifySsoToken(edge, SECRET, NOW).ok).toBe(true);
  });

  it("다른 앱용 토큰을 거절한다", () => {
    const other = signSsoToken(payload({ app: "bogang" }), SECRET);
    expect(verifySsoToken(other, SECRET, NOW)).toEqual({
      ok: false,
      reason: "wrong_app",
    });
  });

  it("규약 버전이 다르면 거절한다", () => {
    const old = signSsoToken(payload({ v: 2 }), SECRET);
    expect(verifySsoToken(old, SECRET, NOW)).toEqual({ ok: false, reason: "bad_version" });
  });

  it("누구인지 특정할 근거가 없으면 거절한다", () => {
    const blank = signSsoToken(payload({ wr_user_id: "", name: "" }), SECRET);
    expect(verifySsoToken(blank, SECRET, NOW)).toEqual({
      ok: false,
      reason: "no_subject",
    });
  });

  it("exp 가 없거나 숫자가 아니면 거절한다", () => {
    const noExp = signSsoToken(
      payload({ exp: undefined as unknown as number }),
      SECRET,
    );
    expect(verifySsoToken(noExp, SECRET, NOW)).toEqual({ ok: false, reason: "no_exp" });
  });

  it("JSON 이 아닌 본문을 거절한다", () => {
    const body = Buffer.from("not json", "utf8");
    const mac = createHmac("sha256", SECRET).update(body).digest();
    const token = `${body.toString("base64url")}.${mac.toString("base64url")}`;
    expect(verifySsoToken(token, SECRET, NOW)).toEqual({ ok: false, reason: "bad_json" });
  });
});

describe("matchStaffProfile", () => {
  const staff: StaffCandidate[] = [
    { id: "t1", name: "김기영", phone: "010-1234-5678", role: "admin" },
    { id: "t2", name: "이수진", phone: "01098765432", role: "teacher" },
    { id: "t3", name: "박클리닉", phone: "010-1111-2222", role: "clinic" },
  ];

  it("전화번호가 유일하게 맞으면 통과한다 (하이픈 유무 무관)", () => {
    const result = matchStaffProfile({ name: "다른이름", phone: "01012345678" }, staff);
    expect(result).toEqual({ ok: true, profile: staff[0], by: "phone" });
  });

  it("번호가 없으면 이름으로 넘어간다", () => {
    const result = matchStaffProfile({ name: "이수진", phone: null }, staff);
    expect(result.ok && result.by).toBe("name");
  });

  it("clinic 은 직원으로 보지 않는다 — 이 프로그램에 로그인할 수 없다", () => {
    expect(matchStaffProfile({ name: "박클리닉", phone: "01011112222" }, staff)).toEqual({
      ok: false,
      reason: "no_match",
    });
  });

  it("전화번호가 겹치면 아무나 고르지 않고 실패한다", () => {
    const shared: StaffCandidate[] = [
      { id: "a", name: "가", phone: "01055556666", role: "teacher" },
      { id: "b", name: "나", phone: "010-5555-6666", role: "teacher" },
    ];
    expect(matchStaffProfile({ name: "가", phone: "01055556666" }, shared)).toEqual({
      ok: false,
      reason: "ambiguous_phone",
    });
  });

  it("동명이인은 실패한다 — 남의 계정으로 들어가는 사고를 막는다", () => {
    const twins: StaffCandidate[] = [
      { id: "a", name: "김철수", phone: null, role: "teacher" },
      { id: "b", name: "김철수", phone: null, role: "teacher" },
    ];
    expect(matchStaffProfile({ name: "김철수", phone: null }, twins)).toEqual({
      ok: false,
      reason: "ambiguous_name",
    });
  });

  it("이름 부분 일치로는 맞추지 않는다", () => {
    expect(matchStaffProfile({ name: "김기", phone: null }, staff)).toEqual({
      ok: false,
      reason: "no_match",
    });
  });

  it("짧은 번호는 근거로 쓰지 않는다", () => {
    const short: StaffCandidate[] = [
      { id: "a", name: "가", phone: "1234", role: "teacher" },
    ];
    expect(matchStaffProfile({ name: "나", phone: "1234" }, short)).toEqual({
      ok: false,
      reason: "no_match",
    });
  });

  it("후보가 없으면 계정을 만들지 않고 실패한다", () => {
    expect(matchStaffProfile({ name: "없는사람", phone: "01000000000" }, [])).toEqual({
      ok: false,
      reason: "no_match",
    });
  });

  it("역할이 null 인 행은 직원으로 보지 않는다", () => {
    const unknown: StaffCandidate[] = [
      { id: "a", name: "가", phone: "01012349999", role: null },
    ];
    expect(matchStaffProfile({ name: "가", phone: "01012349999" }, unknown)).toEqual({
      ok: false,
      reason: "no_match",
    });
  });
});

describe("보조", () => {
  it("phoneDigits 는 숫자만 남긴다", () => {
    expect(phoneDigits("010-1234-5678")).toBe("01012345678");
    expect(phoneDigits(null)).toBe("");
  });

  it("SSO 로 들어온 직원의 첫 화면은 앱의 첫 화면이다", () => {
    expect(staffLandingPath()).toBe("/");
  });
});
