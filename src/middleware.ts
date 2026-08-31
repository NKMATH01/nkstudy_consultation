// NOTE: Next.js 16에서 middleware는 여전히 지원됩니다.
// 향후 Next.js가 middleware를 완전 deprecate하면 instrumentation.ts + proxy 방식으로 전환 필요.
// 참고: https://nextjs.org/docs/app/building-your-application/routing/middleware
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/survey") &&
    !request.nextUrl.pathname.startsWith("/booking") &&
    !request.nextUrl.pathname.startsWith("/report") &&
    !request.nextUrl.pathname.startsWith("/feedback") &&
    // SSO 소비측 — 아직 로그인 전인 사람이 들어오는 문이다. 여기를 막으면 업무보고에서
    // 넘어온 사람이 세션을 세우기도 전에 /login 으로 튕겨, 연동이 통째로 죽는다.
    // 대신 인가는 그 라우트가 직접 한다(서명·만료·app 키·직원 계정 유일 매칭).
    !request.nextUrl.pathname.startsWith("/api/sso/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // css·폰트도 제외한다. 빠져 있으면 로그인하지 않은 상태에서 public/nk-shared.css 요청이
    // /login 으로 307 되돌려져 색 토큰이 통째로 사라진다(로그인 화면이 흰 종이가 된다).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|woff|woff2|ttf)$).*)",
  ],
};
