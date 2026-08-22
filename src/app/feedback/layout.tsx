// 학생·학부모가 여는 적응 체크 설문을 라이트로 못 박기 위한 최소 래퍼.
//
// data-theme="day" 는 nk-shared.css 24행의 탈출구다 — 라이트 토큰을 이 안쪽에서 다시
// 선언한다. 야간 플래그는 <html> 에 찍히므로 직원이 켜 두면 이 화면까지 물려받는데,
// 이 래퍼가 그 아래를 되돌린다.
//
// ★ 덮는 범위는 이 <div> 의 자손, 그중에서도 --wr-* 를 읽는 요소들뿐이다.
//   루트 레이아웃의 <Toaster /> 는 {children} 의 형제라 애초에 이 밖에 있고,
//   sonner·Radix 는 document.body 로 포털을 띄우므로 어차피 여기 밖에서 렌더된다.
//   이 페이지는 실제로 toast.success/error 를 쓴다(feedback-form-client.tsx) —
//   즉 그 토스트는 이 한 줄로 라이트가 되지 않는다.
//
// ★ 그래도 실피해가 작은 이유
//   학생·학부모 브라우저에는 nk:wr-theme 저장값이 없어 늘 라이트다. 어두운 토스트가
//   뜨는 건 직원이 야간을 켠 채 자기 브라우저로 이 링크를 열었을 때뿐이다.
//   포털까지 덮으려면 학부모 화면 구조를 바꿔야 해서 그건 따로 다룬다.
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
