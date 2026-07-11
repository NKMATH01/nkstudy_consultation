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

  // 비프로덕션 전용 미리보기 라우트(결과지 검증 + 코럴 리디자인 미리보기).
  // 각 페이지도 production에서 notFound()로 404를 반환하므로 이중 방어이며, 운영 환경에는 공개되지 않는다.
  const isDevPreview =
    process.env.NODE_ENV !== "production" &&
    (request.nextUrl.pathname.startsWith("/dev-report-preview") ||
      request.nextUrl.pathname.startsWith("/design-preview"));

  if (
    !user &&
    !isDevPreview &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/survey") &&
    !request.nextUrl.pathname.startsWith("/booking") &&
    !request.nextUrl.pathname.startsWith("/report") &&
    !request.nextUrl.pathname.startsWith("/feedback")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
