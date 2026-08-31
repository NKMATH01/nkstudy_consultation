// 업무보고 → 등록·퇴원 한 번 클릭 로그인(SSO) 소비측.
//
//   GET /api/sso/consume?token=<base64url(payload)>.<base64url(HMAC)>
//
// 통과하면 이 앱의 '정상 로그인과 같은 세션'을 세우고 첫 화면으로 302 한다.
// 실패는 전부 로그인 화면으로 돌린다(fail closed). 계정을 새로 만들지 않는다.
//
// ── 왜 새 인증을 만들지 않는가 ────────────────────────────────────────────
// 이 앱의 세션은 Supabase Auth 쿠키다. 로그인 화면(app/login/page.tsx)이
// signInWithPassword 로 굽는 그 쿠키와 똑같은 것을 여기서도 굽는다.
// 세션을 만드는 방법이 두 가지가 되면 한쪽만 고쳐지는 날이 오고, 그날
// 로그아웃·미들웨어·getCurrentTeacher 가 한쪽에서만 듣는다.
//
// 비밀번호는 사용자만 안다(4자리를 각자 바꾼다). 그래서 signInWithPassword 대신
// 서비스 키로 1회용 토큰을 뽑아 그것을 검증하는 경로를 쓴다 — 결과로 나오는 세션은
// 비밀번호로 들어왔을 때와 완전히 같다.
//
//   admin.auth.admin.generateLink({ type: 'recovery' })  → hashed_token
//   supabase.auth.verifyOtp({ token_hash, type: 'recovery' })  → 쿠키 세션
//
// ★ 왜 magiclink 가 아니라 recovery 인가
//   GoTrue 는 magiclink·invite 로 링크를 뽑을 때 그 이메일의 계정이 없으면
//   '새로 만들어 준다'. 그러면 발급측이 보낸 이름·번호만으로 이 앱에 유령 계정이
//   생긴다. recovery 는 없는 계정에 대해 그냥 실패한다 — 우리가 원하는 fail closed 다.
//
// ── 미들웨어와의 관계 ─────────────────────────────────────────────────────
// src/middleware.ts 가 로그인 없는 요청을 전부 /login 으로 돌린다. 그래서 이 경로
// 하나만 예외로 열어 두었다(거기 SSO 주석 참고). 인가는 여기서 직접 한다 —
// 서명·만료·app 키·규약 버전, 그리고 직원 계정 유일 매칭.
//
// ── 절대 하지 않는 것 ─────────────────────────────────────────────────────
//   · 계정 자동 생성 (teachers 행도, Auth 사용자도. 없으면 그냥 실패다)
//   · 비밀키 없을 때 통과 (키가 없으면 문이 아예 열리지 않는다)
//   · 토큰·전화번호를 로그에 그대로 남기기
import { NextResponse, type NextRequest } from "next/server";

import { phoneToEmail } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  matchStaffProfile,
  phoneDigits,
  staffLandingPath,
  verifySsoToken,
  SSO_MIN_PHONE_DIGITS,
  SSO_STAFF_ROLES,
  type StaffCandidate,
} from "@/lib/sso/verify-token";

// node:crypto 와 service_role 키를 쓴다 — 엣지 런타임에서는 돌지 않는다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 화면 문구. 어디서 막혔는지는 사람에게 알려 줄 이유가 없다(계정 열거를 돕는다).
// 대신 sso= 쿼리와 서버 로그에 사유 코드를 남겨 사후에 구분한다.
const MSG = {
  notReady: "업무보고 연동이 아직 준비되지 않았습니다. 전화번호로 로그인해 주세요.",
  badToken: "연동 링크가 만료되었거나 유효하지 않습니다. 전화번호로 로그인해 주세요.",
  noAccount:
    "업무보고 계정과 연결된 등록·퇴원 직원 계정을 찾지 못했습니다. 전화번호로 로그인해 주세요.",
  failed: "로그인 처리에 실패했습니다. 전화번호로 로그인해 주세요.",
} as const;

/**
 * 리다이렉트 기준 주소. Vercel 뒤에서는 request.url 이 내부 주소일 수 있어
 * 프록시 헤더를 먼저 본다.
 */
function originOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** 실패는 전부 여기로 모인다 — 로그인 화면 + 안내 문구 + 사유 코드. */
function deny(request: NextRequest, reason: string, message: string) {
  console.error(`[sso] deny reason=${reason}`);
  const url = new URL("/login", originOf(request));
  url.searchParams.set("error", message);
  url.searchParams.set("sso", reason);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: NextRequest) {
  // 값 앞뒤 공백은 잘라 낸다. Vercel 대시보드에서 붙여 넣을 때 줄바꿈이 딸려 오면
  // 서명이 통째로 어긋나는데, 화면에는 "링크가 유효하지 않습니다"로만 보여 원인을 못 찾는다.
  const secret = env.NK_SSO_SECRET.trim();
  const token = new URL(request.url).searchParams.get("token");

  // ── 1) 토큰 검증 (서명·만료·app·v) ──────────────────────────────────────
  const verified = verifySsoToken(token, secret);
  if (!verified.ok) {
    // 키가 아직 서버에 없는 것(no_secret)은 '설정 안 됨'이라 문구를 따로 준다.
    // 그래도 결과는 같다 — 문은 열리지 않는다.
    return deny(
      request,
      verified.reason,
      verified.reason === "no_secret" ? MSG.notReady : MSG.badToken,
    );
  }
  const payload = verified.payload;

  // ── 2) 이 앱의 '직원' 계정 찾기 ─────────────────────────────────────────
  // RLS 를 우회해야 하므로 서비스 키로 읽는다. 키가 없으면 createAdminClient 가
  // 던지고, 그 역시 실패다(문을 열어 두느니 안 열리는 편이 낫다).
  //
  // ★ is_active 는 getCurrentTeacher 와 같은 규칙으로 거른다 — null 은 '아직 안 쓰는
  //   컬럼'이라 재직으로 본다. 여기서만 다르게 보면 퇴사자가 SSO 로만 들어온다.
  let candidates: StaffCandidate[];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("teachers")
      .select("id, name, phone, role, is_active")
      .in("role", SSO_STAFF_ROLES as readonly string[])
      .or("is_active.is.null,is_active.eq.true");

    if (error) throw new Error(error.message);

    candidates = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      phone: row.phone != null ? String(row.phone) : null,
      role: row.role != null ? String(row.role) : null,
    }));
  } catch (error) {
    // 환경변수 누락·DB 오류. 사유는 로그에만 남기고 화면에는 뭉뚱그린다.
    console.error(
      `[sso] staff lookup failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return deny(request, "lookup_failed", MSG.failed);
  }

  const matched = matchStaffProfile(payload, candidates);
  if (!matched.ok) return deny(request, matched.reason, MSG.noAccount);

  // ── 3) 이 앱의 로그인 아이디(= 전화번호)를 확보한다 ─────────────────────
  // 이 앱의 Auth 이메일은 <전화번호 숫자>@nk.local 이다(lib/auth). 번호가 없으면
  // 세울 세션이 없다 — 이름으로만 맞았는데 번호가 비어 있는 행이 실제로 있을 수 있다.
  const digits = phoneDigits(matched.profile.phone);
  if (digits.length < SSO_MIN_PHONE_DIGITS) {
    return deny(request, "no_login_id", MSG.noAccount);
  }

  // ── 4) 정상 로그인과 같은 세션 세우기 ───────────────────────────────────
  try {
    const admin = createAdminClient();
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: phoneToEmail(digits),
    });

    // 계정이 없으면 여기서 끝난다. recovery 는 없는 계정을 만들지 않는다.
    if (linkError || !link?.properties?.hashed_token) {
      console.error(`[sso] link failed: ${linkError?.message ?? "no hashed_token"}`);
      return deny(request, "no_auth_user", MSG.noAccount);
    }

    // 쿠키를 굽는 것은 이 클라이언트다(lib/supabase/server 의 setAll).
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "recovery",
    });
    if (verifyError) throw new Error(verifyError.message);
  } catch (error) {
    console.error(
      `[sso] session failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return deny(request, "session_failed", MSG.failed);
  }

  console.log(
    `[sso] ok role=${matched.profile.role} by=${matched.by} wr=${payload.wr_user_id}`,
  );
  return NextResponse.redirect(new URL(staffLandingPath(), originOf(request)), {
    status: 302,
  });
}
