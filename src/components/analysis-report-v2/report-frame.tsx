"use client";

// V2 결과 보고서 프리미엄 프레임(프로토타입 PRIVATE LEARNING DOSSIER 셸).
// - 화면: 연속 문서(.report-v2-wrap) 위에 다크 표지 + 넘버 섹션들.
// - 인쇄/PDF: report-premium-css.ts의 @media print가 A4 세로 다중페이지로 분할한다
//   (표지=1p, sec-learning·life·fit·solution 앞에서 페이지 분할, 다크 배경 print-color-adjust 유지).
// 데이터·문구는 counselor/parent 리포트가 결정하고 이 파일은 레이아웃 껍데기만 제공한다.

import { useEffect, useState, type ReactNode } from "react";
import { DOCK_ITEMS, formatDate } from "./report-theme";
import { REPORT_PREMIUM_CSS } from "./report-premium-css";

export { REPORT_PREMIUM_CSS };

/** 문서 시트. 표지+섹션을 감싼다(프로토타입 .report-v2-wrap). */
export function ReportSheet({ children }: { children: ReactNode }) {
  return <div className="report-v2-wrap">{children}</div>;
}

/** 다크 표지(프로토타입 .report-v2-cover). */
export function ReportCover({
  eyebrow,
  brandCode,
  kicker,
  name,
  titleEm,
  meta,
  verdictLabel,
  verdictType,
  verdictSubtype,
  verdictNote,
  footerLeft,
  footerRight,
}: {
  eyebrow: string;
  brandCode: string;
  kicker: string;
  name: string;
  titleEm: string;
  meta: string[];
  verdictLabel: string;
  verdictType: string;
  verdictSubtype?: string;
  verdictNote: string;
  footerLeft: string;
  footerRight: string;
}) {
  return (
    <section className="report-v2-cover" id="sec-cover">
      <div className="cover-brand-line">
        <span>{eyebrow}</span>
        <b>{brandCode}</b>
      </div>
      <div className="cover-layout">
        <div className="cover-copy">
          <p>{kicker}</p>
          <h1>
            {name}
            <br />
            <em>{titleEm}</em>
          </h1>
          <div className="cover-meta">
            {meta.filter(Boolean).map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        </div>
        <aside className="cover-verdict">
          <span>{verdictLabel}</span>
          <strong>{verdictType}</strong>
          {verdictSubtype && <b>{verdictSubtype}</b>}
          <p>{verdictNote}</p>
        </aside>
      </div>
      <div className="cover-footer">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </section>
  );
}

/** 넘버 섹션 래퍼(.report-v2-section + .luxury-section-heading).
 * 영문 eyebrow 대신 제목 아래 한국어 안내 캡션을 둔다(쉬운말·모바일 우선). */
export function ReportSection({
  id,
  index,
  title,
  caption,
  aside,
  children,
}: {
  id?: string;
  index: string;
  title: string;
  caption?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="report-v2-section" id={id}>
      <header className="luxury-section-heading">
        <div className="luxury-section-heading__row">
          <div className="luxury-section-heading__title">
            <span className="luxury-section-heading__num">{index}</span>
            <h2>{title}</h2>
          </div>
          {aside}
        </div>
        {caption && <p className="luxury-section-heading__caption">{caption}</p>}
      </header>
      {children}
    </section>
  );
}

/** 상단 툴바(프로토타입 .report-v2-toolbar): 브랜드 + audience 스위치 + 공유 + PDF 저장. */
export function ReportToolbar({
  studentName,
  audienceSlot,
  shareSlot,
}: {
  studentName: string;
  audienceSlot?: ReactNode;
  shareSlot?: ReactNode;
}) {
  const handlePdf = () => {
    const prev = document.title;
    document.title = `NK_학습운영프로필_${studentName || "학생"}_${formatDate(
      new Date().toISOString()
    )}`;
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
    <header className="report-v2-toolbar">
      <div className="report-v2-toolbar__inner">
        <span className="premium-brand">
          <span className="premium-brand__mark">NK</span>
          <span>
            <strong>NK EDUCATION</strong>
            <small>학습 성향 분석 보고서</small>
          </span>
        </span>
        <div className="report-v2-actions rptv2-noprint">
          {audienceSlot}
          {shareSlot}
          <button type="button" className="report-command" onClick={handlePdf} aria-label="A4 PDF로 저장">
            <span aria-hidden="true">PDF</span>
            저장
          </button>
        </div>
      </div>
    </header>
  );
}

/** 하단 고정 5메뉴(프로토타입 .report-dock). 스크롤 위치로 현재 영역 강조. 인쇄 숨김. */
export function ReportDock() {
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
    <nav className="report-dock rptv2-noprint" aria-label="보고서 섹션 이동">
      {DOCK_ITEMS.map((d, idx) => (
        <button
          key={d.id}
          type="button"
          className={active === d.id ? "is-active" : undefined}
          onClick={() => go(d.id)}
        >
          <b>{String(idx + 1).padStart(2, "0")}</b>
          <span>{d.label}</span>
        </button>
      ))}
    </nav>
  );
}
