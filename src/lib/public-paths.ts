// 로그인 없이 열리는 공개 경로 판별(미들웨어 전용, 서버 의존성 없음 — 테스트 가능).
//
// ★ 앞부분만 같다고 열면 안 된다. 예전에는 startsWith("/survey") 였는데,
//   직원 화면 /surveys(선생님 명단이 실려 옴)·/bookings 까지 비로그인으로 열렸다(2026-10-03 발견).
//   그래서 "그 경로 자체" 또는 "그 경로 + /…" 만 공개로 본다.

/** 학생·학부모가 로그인 없이 여는 화면. 하위 경로(/survey/parent/<token> 등)도 공개. */
const PUBLIC_SECTIONS = ["/survey", "/booking", "/report", "/feedback", "/login", "/auth"] as const;

/** 앞부분이 같으면 공개인 API 경로(끝이 / 라 이름이 비슷한 다른 경로와 섞이지 않는다). */
const PUBLIC_API_PREFIXES = [
  // SSO 소비측 — 아직 로그인 전인 사람이 들어오는 문이다. 여기를 막으면 업무보고에서
  // 넘어온 사람이 세션을 세우기도 전에 /login 으로 튕겨, 연동이 통째로 죽는다.
  // 대신 인가는 그 라우트가 직접 한다(서명·만료·app 키·직원 계정 유일 매칭).
  "/api/sso/",
  "/api/cron/",
] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_SECTIONS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}
