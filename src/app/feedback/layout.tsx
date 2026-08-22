// 학생·학부모가 여는 적응 체크 설문을 라이트로 못 박기 위한 최소 래퍼.
//
// data-theme="day" 는 nk-shared.css 의 탈출구다 — 라이트 토큰을 이 안쪽에서 다시 선언한다.
// 직원이 야간 모드를 켜 두면 <html> 의 data-theme="night" 를 이 화면까지 물려받는데,
// 여기는 색을 hex 로 직접 지정한 자리가 많아 대부분 그대로고 공유 UI(Toaster·Dialog)만
// 토큰을 따라 어두워진다 — "부분만 어두운" 화면이 가장 나쁘다.
//
// 스타일 클래스는 일부러 넣지 않는다. 기존 페이지(FeedbackShell)가 min-h-screen·배경을
// 이미 갖고 있어서, 여기서 무엇이든 더하면 그 레이아웃이 흔들린다.

export default function FeedbackPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-theme="day">{children}</div>;
}
