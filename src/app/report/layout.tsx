export const metadata = {
  title: "NK 학습 보고서",
  description: "NK Academy 학습 보고서",
};

export default function ReportPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "#F8F9FC" }}>
      {/* 공개 보고서 인쇄 시 레이아웃 크롬을 제거해 A4 페이지만 출력한다(§13). */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print { .rpt-pub-header{display:none!important} .rpt-pub-main{max-width:none!important;margin:0!important;padding:0!important} }",
        }}
      />
      <header className="rpt-pub-header bg-white" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="max-w-[800px] mx-auto px-5 py-3 flex items-center gap-2.5">
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
            학습 보고서
          </span>
        </div>
      </header>

      <main className="rpt-pub-main max-w-[800px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
