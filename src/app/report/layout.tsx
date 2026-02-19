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
      <header className="bg-white" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="max-w-[800px] mx-auto px-5 py-3 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, #D4A853, #B8892E)" }}
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

      <main className="max-w-[800px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
