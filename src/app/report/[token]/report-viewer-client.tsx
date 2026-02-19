"use client";

import { useEffect, useRef } from "react";

interface Props {
  reportHtml: string;
  reportType: string;
  name: string | null;
}

export function ReportViewer({ reportHtml, reportType, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reportLabel = reportType === "registration" ? "등록안내문" : "성향분석";

  useEffect(() => {
    if (!containerRef.current) return;

    // HTML에서 style과 body 내용 추출
    const styleMatches = reportHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    const styles = styleMatches ? styleMatches.join("") : "";

    const bodyMatch = reportHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch ? bodyMatch[1] : reportHtml;

    // 모바일 최적화 스타일 + 원본 스타일 + 본문 삽입
    containerRef.current.innerHTML = `
      <style>
        .report-content * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .report-content img {
          height: auto !important;
          max-width: 100% !important;
        }
        .report-content table {
          width: 100% !important;
          table-layout: fixed !important;
          word-break: break-word !important;
        }
        .report-content .page {
          width: 100% !important;
          min-height: auto !important;
          height: auto !important;
          padding: 16px !important;
          margin: 0 !important;
          page-break-after: none !important;
          break-after: auto !important;
          overflow: visible !important;
        }
        .report-content .page + .page {
          border-top: 1px solid #E5E7EB;
          margin-top: 24px !important;
          padding-top: 24px !important;
        }
        .report-content {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          color: #1f2937;
          line-height: 1.6;
          word-break: keep-all;
        }
        @media (max-width: 640px) {
          .report-content { font-size: 14px !important; }
          .report-content h1 { font-size: 20px !important; }
          .report-content h2 { font-size: 17px !important; }
          .report-content h3 { font-size: 15px !important; }
          .report-content td, .report-content th {
            padding: 6px 8px !important;
            font-size: 12px !important;
          }
        }
      </style>
      ${styles}
      ${content}
    `;
  }, [reportHtml]);

  return (
    <div className="min-h-dvh" style={{ background: "#F9FAFB" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-4 py-3 backdrop-blur-md"
        style={{ background: "rgba(15, 43, 91, 0.95)" }}
      >
        <h1 className="text-base font-bold text-white truncate">
          {name ? `${name} ${reportLabel}` : reportLabel}
        </h1>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
          NK EDUCATION
        </p>
      </header>

      {/* Report Content */}
      <main className="px-3 py-4">
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
        >
          <div ref={containerRef} className="report-content p-4" />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] pb-8 pt-2" style={{ color: "#D1D5DB" }}>
        NK EDUCATION | 이 보고서는 30일간 열람 가능합니다
      </footer>

      {/* Pretendard 폰트 로드 */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
      />
    </div>
  );
}
