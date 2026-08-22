export const metadata = {
  title: "NK 학습성향 설문",
  description: "NK Academy 학습성향 진단 설문 조사",
};

export default function SurveyPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-theme="day" — 학생·학부모가 여는 설문이라 이 서브트리를 라이트로 못 박는다.
    // 야간 플래그는 <html> 에 찍히므로 직원이 켜 두면 여기까지 물려받는데,
    // 라이트 토큰을 다시 선언해 그 아래를 되돌린다(nk-shared.css 24행 탈출구).
    //
    // ★ 덮는 범위는 이 <div> 의 자손, 그중에서도 --wr-* 를 읽는 요소들뿐이다.
    //   루트 레이아웃의 <Toaster /> 는 {children} 의 형제고 sonner·Radix 는
    //   document.body 로 포털을 띄우므로 이 한 줄로는 덮이지 않는다.
    //
    // ★ 실피해가 작은 이유 — 학생·학부모 브라우저에는 nk:wr-theme 저장값이 없어 늘 라이트다.
    //   직원이 야간을 켠 채 이 링크를 열었을 때만 토스트가 어둡게 뜬다.
    <div className="min-h-screen" data-theme="day" style={{ background: "#F8F9FC" }}>
      {/* Top Bar */}
      <header className="bg-white" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="max-w-[580px] mx-auto px-5 py-3 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--accent-warm), var(--chart-4))" }}
          >
            NK
          </div>
          <span className="text-sm font-bold" style={{ color: "#0F172A", letterSpacing: "-0.02em" }}>
            NK Academy
          </span>
          <span className="text-[10px]" style={{ color: "#94A3B8" }}>
            학습성향 진단
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[580px] mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
