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
    <div className="min-h-screen" style={{ background: "#F8F9FC" }}>
      <header className="bg-white sticky top-0 z-50" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="max-w-[520px] mx-auto px-4 py-3 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, #D4A853, #B8892E)" }}
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
