export const metadata = {
  title: "NK Academy 상담 예약",
  description: "NK Academy 상담 테스트 예약",
};

export default function BookingPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-theme="day" — 학부모가 여는 화면이라 이 서브트리를 라이트로 못 박는다.
    // 야간 플래그는 <html> 에 찍히므로 직원이 켜 두면 이 화면까지 물려받는데,
    // 여기서 라이트 토큰을 다시 선언해 그 아래를 되돌린다(nk-shared.css 24행 탈출구).
    //
    // ★ 덮는 범위는 이 <div> 의 자손뿐이다.
    //   루트 레이아웃의 <Toaster /> 는 {children} 의 형제라 애초에 이 밖에 있고,
    //   sonner·Radix 는 document.body 로 포털을 띄우므로 어차피 여기 밖에서 렌더된다.
    //   즉 이 한 줄로 토스트·다이얼로그까지 라이트로 만들 수는 없다.
    //
    // ★ 그래도 실피해가 작은 이유
    //   학부모 브라우저에는 nk:wr-theme 이 저장돼 있을 리 없어 늘 라이트다. 어두운
    //   토스트가 뜨는 건 직원이 야간을 켠 채 자기 브라우저로 이 링크를 열었을 때뿐이다.
    //   포털까지 덮으려면 학부모 화면 구조를 바꿔야 해서 그건 따로 다룬다.
    <div className="min-h-screen" data-theme="day" style={{ background: "#F8F9FC" }}>
      <header className="bg-white sticky top-0 z-50" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="max-w-[520px] mx-auto px-4 py-3 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--accent-warm), var(--chart-4))" }}
          >
            NK
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: "#0F172A", letterSpacing: "-0.02em" }}>
              NK Academy
            </span>
            <span className="text-[10px] ml-2" style={{ color: "#94A3B8" }}>
              상담 예약
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-[520px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
