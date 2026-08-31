// 업무보고(nk-work-report) → 등록·퇴원 한 번 클릭 로그인(SSO)의 토큰 검증 + 계정 매칭.
//
// ★ 이 파일은 순수 모듈이다. next/supabase/env 를 부르지 않는다 — 그래야 서버 없이
//   `npm run test` 로 서명 위조·만료·앱 불일치·동명이인을 그대로 돌려볼 수 있다.
//   비밀키와 현재 시각은 인자로 받는다. 여기서 process.env 를 읽으면 테스트가 환경에 묶인다.
//
// 규약 (발급측 업무보고 lib/sso/token.ts 와 같아야 한다. 한쪽만 바꾸면 그날부터 전부 튕긴다):
//   token   = base64url(payloadJSON) + "." + base64url(HMAC_SHA256(payloadJSON, secret))
//   payload = { v: 1, app: "consult", wr_user_id, name, phone, role, iat, exp, jti }
//   유효기간 = 60초
//
//   ★ 서명은 '다시 만든 JSON'이 아니라 '받은 payload 바이트 그대로'에 건다.
//     JSON.parse → JSON.stringify 를 거치면 키 순서·공백이 달라져 서명이 깨진다.
//
// 통과 조건은 네 가지다. 하나라도 어긋나면 실패다(fail closed).
//   1) 서명이 맞는가
//   2) exp 가 지났는가 / 60초보다 멀리 있는가
//   3) app === "consult" 인가 — 다른 앱용 토큰을 여기서 쓰지 못하게
//   4) v === 1 인가 — 규약이 바뀌면 옛 토큰을 조용히 받아 주지 않는다
import { createHmac, timingSafeEqual } from "node:crypto";

/** 이 앱의 키. 업무보고가 payload.app 에 넣어 보내는 값과 같아야 한다(lib/sso/apps.ts). */
export const SSO_APP = "consult";

/** 규약 버전. 형식이 바뀌면 올린다(옛 토큰은 그 즉시 거절된다). */
export const SSO_VERSION = 1;

/** 발급 후 유효 시간. 규약이 60초다. */
export const SSO_MAX_AGE_MS = 60_000;

/**
 * 시계 오차 허용치. 발행 서버와 이 서버의 시계가 몇 초 어긋나는 것은 흔하다.
 * exp 상한(60초)에만 얹고, '이미 지났는가'에는 얹지 않는다 —
 * 만료 쪽을 늘리면 그만큼 재사용 창이 길어진다.
 */
export const SSO_CLOCK_SKEW_MS = 5_000;

/** payload 길이 상한. 이보다 길면 파싱 전에 끊는다(서명 검사도 하지 않는다). */
export const SSO_MAX_TOKEN_CHARS = 4_096;

export interface SsoPayload {
  v: number;
  app: string;
  /** 업무보고 wr_users.id. 이 앱에 저장하지 않는다 — 로그·감사용으로만 쓴다. */
  wr_user_id: string;
  name: string;
  phone?: string | null;
  /** 업무보고의 역할(INSTRUCTOR 등)이다. 이 앱의 teacher·admin 과 다르므로 인가에 쓰지 않는다. */
  role?: string | null;
  /** 발급 시각. 초·밀리초 둘 다 받는다(아래 toMillis 참고). */
  iat?: number;
  /** 만료 시각. 초·밀리초 둘 다 받는다. */
  exp: number;
}

/**
 * 실패 사유. 화면에는 뭉뚱그린 한 문장만 내보내고, 이 코드는 URL 쿼리와
 * 서버 로그에만 남긴다 — 어느 단계에서 막혔는지 사후에 구분하기 위해서다.
 */
export type SsoFailure =
  | "no_secret"
  | "no_token"
  | "too_long"
  | "malformed"
  | "bad_signature"
  | "bad_json"
  | "bad_version"
  | "wrong_app"
  | "no_subject"
  | "no_exp"
  | "expired"
  | "exp_too_far";

export type SsoResult =
  | { ok: true; payload: SsoPayload }
  | { ok: false; reason: SsoFailure };

/**
 * exp·iat 를 밀리초로 맞춘다. 업무보고는 초(epoch)로 보내지만, 규약 문서에 단위가
 * 못 박혀 있지 않아 둘 다 받는다. JWT 관례는 초(10자리), Date.now() 는 밀리초(13자리)다.
 * 1e11 (= 1973년) 보다 작으면 초로 본다 — 그보다 작은 밀리초 값은 1970년대라
 * 어차피 만료로 걸린다.
 */
function toMillis(value: number): number {
  return value < 1e11 ? value * 1000 : value;
}

/** 서명 비교. 길이가 다르면 timingSafeEqual 이 던지므로 먼저 거른다. */
function signaturesMatch(a: Buffer, b: Buffer): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * base64url 한 조각을 바이트로. 형식이 아니면 null.
 * Buffer 는 잘못된 문자를 조용히 버리므로, 되돌려 인코딩해서 같은지 본다 —
 * 그러지 않으면 "abc!!!" 같은 쓰레기가 서명 검사까지 흘러간다.
 */
function decodeSegment(segment: string): Buffer | null {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  const buf = Buffer.from(segment, "base64url");
  if (buf.length === 0) return null;
  return buf.toString("base64url") === segment ? buf : null;
}

/** payload JSON 에 서명해 토큰 한 줄을 만든다. 테스트가 쓴다(이 앱은 발행하지 않는다). */
export function signSsoToken(payload: SsoPayload, secret: string): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8");
  const mac = createHmac("sha256", secret).update(body).digest();
  return `${body.toString("base64url")}.${mac.toString("base64url")}`;
}

/**
 * 토큰을 검증한다. 통과하면 payload, 아니면 사유.
 *
 * @param token  쿼리로 받은 문자열(없을 수 있다)
 * @param secret NK_SSO_SECRET. 비어 있으면 통과가 아니라 'no_secret' 이다 —
 *               Vercel 에 아직 값이 없는 동안에도 문이 열려서는 안 된다(fail closed).
 * @param now    현재 시각(ms). 테스트가 시계를 고정할 수 있게 인자로 둔다.
 */
export function verifySsoToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  now: number = Date.now(),
): SsoResult {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!token) return { ok: false, reason: "no_token" };
  if (token.length > SSO_MAX_TOKEN_CHARS) return { ok: false, reason: "too_long" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const body = decodeSegment(parts[0]);
  const mac = decodeSegment(parts[1]);
  if (!body || !mac) return { ok: false, reason: "malformed" };

  // 서명을 먼저 본다. 통과하지 못한 payload 는 파싱조차 하지 않는다.
  const expected = createHmac("sha256", secret).update(body).digest();
  if (!signaturesMatch(mac, expected)) return { ok: false, reason: "bad_signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "bad_json" };
  }

  const raw = parsed as Record<string, unknown>;

  if (raw.v !== SSO_VERSION) return { ok: false, reason: "bad_version" };
  if (raw.app !== SSO_APP) return { ok: false, reason: "wrong_app" };

  const wrUserId = typeof raw.wr_user_id === "string" ? raw.wr_user_id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  // 누구인지 특정할 근거가 하나도 없으면 계정 매칭 단계로 보내지 않는다.
  if (!wrUserId && !name) return { ok: false, reason: "no_subject" };

  if (typeof raw.exp !== "number" || !Number.isFinite(raw.exp)) {
    return { ok: false, reason: "no_exp" };
  }
  const expMs = toMillis(raw.exp);
  if (now > expMs) return { ok: false, reason: "expired" };
  // 60초보다 멀리 있는 exp 는 규약 위반이다. 이 상한이 없으면 키를 쥔 쪽이
  // 1년짜리 토큰을 찍어 링크 하나로 계정을 계속 열 수 있다.
  if (expMs > now + SSO_MAX_AGE_MS + SSO_CLOCK_SKEW_MS) {
    return { ok: false, reason: "exp_too_far" };
  }

  return {
    ok: true,
    payload: {
      v: SSO_VERSION,
      app: SSO_APP,
      wr_user_id: wrUserId,
      name,
      phone: typeof raw.phone === "string" ? raw.phone : null,
      role: typeof raw.role === "string" ? raw.role : null,
      iat: typeof raw.iat === "number" ? raw.iat : undefined,
      exp: raw.exp,
    },
  };
}

// ── 계정 매칭 ────────────────────────────────────────────────────────────────
// 여기부터는 DB 를 부르지 않는다. 라우트가 '직원 계정만' 뽑아 넘겨주고,
// 그중에서 누구인지 고르는 규칙만 순수 함수로 둔다(테스트가 가능해야 한다).

/**
 * 이 앱에서 SSO 로 들어올 수 있는 역할 — teachers.role 의 값이다(types/index.ts).
 *
 * ★ clinic 은 뺀다. 클리닉 선생님은 이 프로그램에 로그인할 수 없고(app/login/page.tsx
 *   에서 로그인 직후 signOut 시킨다), SSO 가 그 문을 우회해서는 안 된다.
 *
 * ★ 목록으로 못 박아 둔다 — 나중에 학부모·학생 역할이 생겨도 이 문은 저절로 닫혀 있어야 한다.
 */
export const SSO_STAFF_ROLES = [
  "admin",
  "director",
  "principal",
  "manager",
  "staff",
  "teacher",
] as const;
export type SsoStaffRole = (typeof SSO_STAFF_ROLES)[number];

/** 전화번호 매칭 최소 자릿수. 짧은 번호는 남과 겹치기 쉬워 근거로 쓰지 않는다. */
export const SSO_MIN_PHONE_DIGITS = 9;

export interface StaffCandidate {
  id: string;
  name: string;
  /**
   * teachers.phone — 하이픈이 있을 수도 없을 수도 있다(둘 다 실데이터로 존재한다).
   * 이 앱의 Supabase Auth 이메일(<숫자>@nk.local)을 만드는 근거이기도 하다.
   */
  phone: string | null;
  role: string | null;
}

export type MatchResult =
  | { ok: true; profile: StaffCandidate; by: "phone" | "name" }
  | {
      ok: false;
      reason: "no_match" | "ambiguous_phone" | "ambiguous_name" | "not_staff";
    };

/** 숫자만 남긴다(lib/auth 의 phoneToEmail 과 같은 규칙). */
export function phoneDigits(raw?: string | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

function isStaff(role: string | null): role is SsoStaffRole {
  return role != null && (SSO_STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * payload 를 이 앱의 직원 계정 하나에 붙인다.
 *
 * 순서 — ① 전화번호 유일 일치 ② 이름 유일 일치.
 * 후보가 둘 이상이면 고르지 않고 실패한다. 동명이인·번호 공유가 실제로 있는
 * 조직에서 '아무나 하나'를 고르면 남의 계정으로 들어가는 사고가 된다.
 *
 * ★ 없으면 실패다. 계정을 새로 만들지 않는다.
 *   남의 앱이 보낸 이름·번호를 근거로 teachers 행이나 Auth 사용자를 찍어 내면,
 *   발급측 데이터가 틀린 날 이 앱에 유령 선생님이 생긴다.
 *
 * ★ candidates 에는 직원만 들어와야 한다. 그래도 여기서 한 번 더 거른다 —
 *   호출부의 쿼리 한 줄이 잘못 고쳐졌을 때를 막는 마지막 문이다.
 */
export function matchStaffProfile(
  payload: Pick<SsoPayload, "name" | "phone">,
  candidates: StaffCandidate[],
): MatchResult {
  const staff = candidates.filter((c) => isStaff(c.role));
  if (staff.length === 0) return { ok: false, reason: "no_match" };

  // ① 전화번호. 이 앱은 번호가 곧 로그인 아이디라 가장 믿을 만한 근거다.
  const wanted = phoneDigits(payload.phone);
  if (wanted.length >= SSO_MIN_PHONE_DIGITS) {
    const hit = staff.filter((c) => {
      const digits = phoneDigits(c.phone);
      return digits.length >= SSO_MIN_PHONE_DIGITS && digits === wanted;
    });
    if (hit.length === 1) return { ok: true, profile: hit[0], by: "phone" };
    if (hit.length > 1) return { ok: false, reason: "ambiguous_phone" };
    // 0건이면 이름으로 넘어간다.
  }

  // ② 이름. 공백만 다듬어 정확히 같은 것만 본다(부분 일치는 쓰지 않는다).
  const wantedName = (payload.name ?? "").trim();
  if (wantedName) {
    const hit = staff.filter((c) => (c.name ?? "").trim() === wantedName);
    if (hit.length === 1) return { ok: true, profile: hit[0], by: "name" };
    if (hit.length > 1) return { ok: false, reason: "ambiguous_name" };
  }

  return { ok: false, reason: "no_match" };
}

/**
 * 직원이 SSO 로 들어왔을 때의 첫 화면.
 *
 * 역할을 받지 않는다 — 이 앱은 모든 직원이 같은 첫 화면(상담 및 등록 현황)에서
 * 시작하고, 갈리는 것은 사이드 메뉴뿐이다(teachers.allowed_menus).
 * 쓰지도 않을 역할을 인자로 받아 두면 "역할별로 다른가 보다"로 읽힌다.
 */
export function staffLandingPath(): string {
  return "/";
}
