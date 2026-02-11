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
    <div className="min-h-screen" style={{ background: "#F8F9FC" }}>
      {/* Top Bar */}
      <header className="bg-white" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="max-w-[580px] mx-auto px-5 py-3 flex items-center gap-2.5">
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
            학습성향 진단
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[580px] mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
