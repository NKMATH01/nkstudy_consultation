"use client";

// A4 세로 페이지 프레임 + 인쇄 CSS + PDF 저장 버튼 + 하단 고정 메뉴 (§12.4, §13).
// - 화면: 각 .report-page를 A4 크기로 쌓고 회색 간격·그림자로 미리보기.
// - 인쇄: @page A4 portrait, 그림자·툴바·하단 메뉴 제거, 카드 단위 break-inside:avoid.
//   내용이 넘치면 브라우저 native pagination으로 다음 물리 페이지에 이어진다(자르기·축소 없음, §13.2).

import { useEffect, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { C, DOCK_ITEMS, formatDate } from "./report-theme";

export const REPORT_PRINT_CSS = `
.rptv2-root { background: ${C.pageBg}; padding: 22px 12px 110px; }
.rptv2-pages { display: flex; flex-direction: column; align-items: center; gap: 22px; }
.report-page {
  width: min(210mm, 100%);
  max-width: 100%;
  min-height: 297mm;
  background: #fff;
  color: ${C.ink};
  padding: 15mm 14mm;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 10px 30px rgba(15,43,91,0.10);
  border-radius: 2px;
  font-size: 13.5px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.rptv2-page-body > * + * { margin-top: 18px; }
@media (max-width: 900px) {
  .rptv2-root { padding: 14px 10px 108px; }
  .report-page { min-height: auto; padding: 18px 16px; }
}
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; }
  .rptv2-root { background: #fff !important; padding: 0 !important; }
  .rptv2-pages { gap: 0 !important; }
  .rptv2-toolbar, .rptv2-dock, .rptv2-noprint { display: none !important; }
  .report-page {
    width: 210mm !important;
    min-height: 297mm;
    box-shadow: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
    break-after: page;
    page-break-after: always;
  }
  .report-page:last-child { break-after: auto; page-break-after: auto; }
  .rpt-card { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

export function ReportPage({
  id,
  children,
  cover = false,
}: {
  id?: string;
  children: ReactNode;
  cover?: boolean;
}) {
  return (
    <section
      id={id}
      className="report-page"
      style={cover ? { display: "flex", flexDirection: "column" } : undefined}
    >
      <div className="rptv2-page-body">{children}</div>
    </section>
  );
}

/** 상단 툴바: audience 표시/토글 슬롯 + PDF 저장 버튼(화면 전용). */
export function ReportToolbar({
  studentName,
  right,
  left,
}: {
  studentName: string;
  right?: ReactNode;
  left?: ReactNode;
}) {
  const handlePdf = () => {
    const prev = document.title;
    const filename = `NK_학습운영프로필_${studentName || "학생"}_${formatDate(
      new Date().toISOString()
    )}`;
    document.title = filename;
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    const doPrint = () => window.print();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => setTimeout(doPrint, 60));
    } else {
      setTimeout(doPrint, 60);
    }
  };

  return (
    <div
      className="rptv2-toolbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{left}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {right}
        <button
          type="button"
          onClick={handlePdf}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: C.navy,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Printer size={15} />
          PDF 저장
        </button>
      </div>
    </div>
  );
}

/** 하단 고정 5메뉴(§12.4). 스크롤 위치로 현재 영역 강조. 인쇄에서 숨김. */
export function BottomDock() {
  const [active, setActive] = useState(DOCK_ITEMS[0].id);

  useEffect(() => {
    const els = DOCK_ITEMS.map((d) => document.getElementById(d.id)).filter(
      (e): e is HTMLElement => !!e
    );
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id;
          setActive((prev) => (prev === id ? prev : id));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav
      className="rptv2-dock"
      aria-label="보고서 섹션 이동"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        display: "flex",
        justifyContent: "center",
        gap: 4,
        padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
        background: "rgba(255,255,255,0.96)",
        borderTop: `1px solid ${C.line}`,
        boxShadow: "0 -2px 12px rgba(15,43,91,0.08)",
      }}
    >
      {DOCK_ITEMS.map((d) => {
        const on = active === d.id;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => go(d.id)}
            style={{
              flex: "1 1 0",
              maxWidth: 130,
              minHeight: 44,
              border: "none",
              background: on ? C.navy : "transparent",
              color: on ? "#fff" : C.sub,
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background .15s",
            }}
          >
            {d.label}
          </button>
        );
      })}
    </nav>
  );
}
