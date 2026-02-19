"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadHtmlAsPdf } from "@/lib/pdf";

interface Props {
  reportHtml: string;
  reportType: string;
  name: string | null;
}

export function ReportViewer({ reportHtml, reportType, name }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const reportLabel = reportType === "registration" ? "등록안내문" : "성향분석";
  const filename = `${name || "보고서"}_${reportLabel}.pdf`;

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      await downloadHtmlAsPdf(reportHtml, filename);
    } catch {
      alert("PDF 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    const height = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = `${Math.max(height + 40, 600)}px`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {name && (
            <h1 className="text-lg font-bold" style={{ color: "#1F2937" }}>
              {name} {reportLabel}
            </h1>
          )}
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            NK EDUCATION
          </p>
        </div>
        <button
          onClick={handlePdfDownload}
          disabled={pdfLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #0F2B5B, #1E40AF)" }}
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          PDF 다운로드
        </button>
      </div>

      {/* Report iframe */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)" }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={reportHtml}
          onLoad={handleIframeLoad}
          className="w-full border-0"
          style={{ minHeight: "600px" }}
          title={`${name || ""} ${reportLabel}`}
        />
      </div>

      {/* Footer */}
      <p className="text-center text-xs py-4" style={{ color: "#D1D5DB" }}>
        NK EDUCATION | 이 보고서는 30일간 열람 가능합니다
      </p>
    </div>
  );
}
