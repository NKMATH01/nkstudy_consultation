// V2 결과 보고서 프리미엄 디자인 CSS (프로토타입 PRIVATE LEARNING DOSSIER 재현).
// docs/prototypes/2026-07-10-learning-profile-v2/premium.css의 result 계열을 포팅.
// 모든 규칙은 .rptv2-doc 스코프 하위에서만 적용되어 앱 전역에 누출되지 않는다.
// 색/서식 토큰만 담당하고 데이터·문구·점수 로직은 컴포넌트에서 결정한다(§12.5).
// 서체: 시스템 세리프 스택 + (있으면) next/font Noto Serif KR 변수. 새 외부 의존 없음.

export const REPORT_PREMIUM_CSS = `
.rptv2-doc {
  --ink-950: #101722;
  --ink-900: #152033;
  --ink-800: #24334a;
  --ink-700: #34445a;
  --paper: #ffffff;
  --ivory: #f7f5ef;
  --canvas: #e8e9e6;
  --brass: #b88a32;
  --brass-dark: #8a6422;
  --brass-soft: #f3ead8;
  --teal: #2d776a;
  --teal-soft: #e6f1ee;
  --coral: #c95f55;
  --coral-soft: #f7e8e5;
  --blue: #355d79;
  --blue-soft: #e9eff3;
  --text: #334050;
  --muted: #586270;
  --line: #dde1e3;
  --line-strong: #c8ced2;
  --rptv2-sans: var(--font-noto), "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;
  --rptv2-serif: var(--font-noto-serif), "Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", Batang, Georgia, serif;
  --rptv2-shadow: 0 16px 44px rgba(16, 23, 34, 0.08);
  background: var(--canvas);
  color: var(--ink-950);
  font-family: var(--rptv2-sans);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.rptv2-doc *, .rptv2-doc *::before, .rptv2-doc *::after { box-sizing: border-box; }
/* :where()로 리셋 특이도를 0으로 낮춰, .report-command 등 컴포넌트 색상이 항상 이긴다
   (그렇지 않으면 다크 툴바 색을 상속해 "저장" 텍스트가 어둡게 묻힌다). */
:where(.rptv2-doc) button { color: inherit; font: inherit; cursor: pointer; }
:where(.rptv2-doc) a { color: inherit; text-decoration: none; }
.rptv2-doc .counselor-only { display: block; }
.rptv2-doc.parent-mode .counselor-only { display: none; }

/* ── 상단 툴바 ─────────────────────────────────────────────── */
.report-v2-toolbar {
  position: sticky; z-index: 80; top: 0;
  background: rgba(255,255,255,0.97);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(18px);
}
.report-v2-toolbar__inner {
  width: min(210mm, calc(100% - 40px));
  min-height: 70px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  flex-wrap: wrap;
}
.premium-brand { display: inline-flex; align-items: center; gap: 12px; }
.premium-brand__mark {
  width: 39px; height: 39px; display: grid; place-items: center;
  background: var(--ink-900); border: 1px solid var(--brass); border-radius: 4px;
  color: #fff; font-family: Georgia, serif; font-size: 14px; font-weight: 800;
}
.premium-brand > span:last-child { display: grid; gap: 1px; }
.premium-brand strong { color: var(--ink-900); font-family: Georgia, var(--rptv2-serif); font-size: 13px; font-weight: 800; }
.premium-brand small { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: 0.04em; }
.report-v2-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.audience-switch, .subject-v2-tabs {
  display: inline-flex; padding: 3px; background: #edf0f1; border-radius: 4px;
}
.audience-switch button, .subject-v2-tabs button {
  min-height: 34px; padding: 7px 12px; background: transparent; border: 0; border-radius: 3px;
  color: var(--muted); font-size: 12px; font-weight: 900;
}
.audience-switch button.is-active, .subject-v2-tabs button.is-active {
  background: #fff; color: var(--ink-900); box-shadow: 0 2px 6px rgba(16,23,34,0.09);
}
.report-command {
  min-height: 40px; padding: 7px 13px 7px 8px; display: inline-flex; align-items: center; gap: 8px;
  background: var(--ink-900); border: 1px solid var(--ink-900); border-radius: 4px;
  color: #fff; font-size: 12px; font-weight: 900;
}
.report-command span {
  min-width: 34px; padding: 4px 5px; background: var(--brass); border-radius: 2px;
  color: var(--ink-950); font-family: Georgia, serif; font-size: 10px; line-height: 1; text-align: center;
}
.report-command:hover { background: var(--brass-dark); border-color: var(--brass-dark); }
.report-share {
  min-height: 40px; padding: 7px 12px; display: inline-flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid var(--line-strong); border-radius: 4px;
  color: var(--text); font-size: 12px; font-weight: 800;
}
.report-share:hover { border-color: var(--brass); color: var(--ink-900); }
.report-share:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 문서 시트 ─────────────────────────────────────────────── */
.report-v2-wrap {
  width: min(210mm, calc(100% - 40px));
  margin: 28px auto 0; padding-bottom: 120px;
  background: var(--paper); box-shadow: 0 22px 70px rgba(16,23,34,0.1);
}

/* ── 표지 ─────────────────────────────────────────────────── */
.report-v2-cover {
  position: relative; min-height: 470px; padding: 42px 56px 32px; overflow: hidden;
  background: var(--ink-900); border-bottom: 7px solid var(--brass); color: #fff;
}
.report-v2-cover::before, .report-v2-cover::after { position: absolute; content: ""; pointer-events: none; }
.report-v2-cover::before {
  top: 92px; right: -90px; width: 410px; height: 250px;
  border: 1px solid rgba(184,138,50,0.22); transform: rotate(-12deg);
}
.report-v2-cover::after { right: 70px; bottom: 73px; width: 200px; height: 1px; background: rgba(184,138,50,0.45); }
.cover-brand-line, .cover-footer {
  position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 20px;
  color: #9eabbd; font-family: Georgia, serif; font-size: 12px; font-weight: 800;
}
.cover-brand-line { padding-bottom: 15px; border-bottom: 1px solid #2b3a4f; }
.cover-brand-line b { color: var(--brass); }
.cover-layout {
  position: relative; z-index: 1; min-height: 335px; display: grid;
  grid-template-columns: minmax(0,1.3fr) minmax(300px,0.7fr); gap: 54px; align-items: center;
}
.cover-copy > p { margin: 0 0 12px; color: var(--brass); font-size: 12px; font-weight: 800; }
.cover-copy h1 { margin: 0; color: #fff; font-family: var(--rptv2-serif); font-size: 42px; font-weight: 700; line-height: 1.32; word-break: keep-all; }
.cover-copy h1 em { color: #d8c19a; font-style: normal; }
.cover-meta { margin-top: 29px; display: flex; flex-wrap: wrap; gap: 8px 18px; color: #b9c4d2; font-size: 12px; font-weight: 700; }
.cover-meta span + span::before { margin-right: 18px; color: #506076; content: "/"; }
.cover-verdict { padding: 26px; background: #fff; border-top: 4px solid var(--brass); border-radius: 5px; color: var(--ink-950); }
.cover-verdict > span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.cover-verdict strong, .cover-verdict b { display: block; }
.cover-verdict strong { margin-top: 9px; font-family: var(--rptv2-serif); font-size: 25px; font-weight: 700; }
.cover-verdict b { margin-top: 3px; color: var(--brass-dark); font-size: 13px; }
.cover-verdict p { margin: 15px 0 0; color: var(--text); font-size: 12px; line-height: 1.75; }
.cover-footer { padding-top: 15px; border-top: 1px solid #2b3a4f; }

/* ── 섹션 + 넘버 헤딩 ──────────────────────────────────────── */
.report-v2-section { padding: 62px 58px; border-bottom: 1px solid var(--line); scroll-margin-top: 86px; }
.luxury-section-heading {
  margin-bottom: 30px; display: flex; align-items: flex-start; justify-content: space-between; gap: 26px;
}
.luxury-section-heading > div {
  display: grid; grid-template-columns: 34px minmax(0,1fr); grid-template-rows: auto auto;
  column-gap: 12px; align-items: center;
}
.luxury-section-heading > div > span {
  grid-row: 1 / 3; width: 34px; height: 34px; display: grid; place-items: center;
  background: var(--ink-900); border-radius: 3px; color: #fff; font-family: Georgia, serif; font-size: 12px; font-weight: 900;
}
.luxury-section-heading p, .luxury-section-heading h2 { margin: 0; }
.luxury-section-heading p { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; letter-spacing: 0.04em; }
.luxury-section-heading h2 { color: var(--ink-950); font-family: var(--rptv2-serif); font-size: 24px; font-weight: 700; }
.confidence-chip, .section-note, .fit-grade {
  padding: 6px 9px; border-radius: 3px; font-size: 12px; font-weight: 900; white-space: nowrap;
}
.confidence-chip { background: var(--teal-soft); color: var(--teal); }
.section-note { background: #eef1f3; color: var(--muted); }
.fit-grade { background: var(--brass-soft); color: var(--brass-dark); }

/* ── CORE INTERPRETATION 다크 판정 패널 ─────────────────────── */
.analysis-verdict { overflow: hidden; background: var(--ink-900); border-top: 4px solid var(--brass); color: #fff; }
.analysis-verdict__title { padding: 22px 28px 0; display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
.analysis-verdict__title > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.analysis-verdict__title > b {
  padding: 6px 9px; background: rgba(184,138,50,0.15); border: 1px solid rgba(184,138,50,0.48);
  border-radius: 3px; color: #e4c37d; font-size: 12px;
}
.analysis-verdict > h3 {
  max-width: 900px; margin: 14px 28px 0; font-family: var(--rptv2-serif); font-size: 28px; font-weight: 700;
  line-height: 1.55; word-break: keep-all;
}
.analysis-verdict > h3 em { color: #e4c37d; font-style: normal; }
.analysis-verdict__body { margin-top: 24px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); border-top: 1px solid #304056; border-bottom: 1px solid #304056; }
.analysis-verdict__body p { margin: 0; padding: 22px; color: #d2dae4; font-size: 13px; line-height: 1.82; border-right: 1px solid #304056; word-break: keep-all; }
.analysis-verdict__body p:last-child { border-right: 0; }
.analysis-chain { margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); }
.analysis-chain > div { min-height: 84px; padding: 17px 20px; border-right: 1px solid #304056; }
.analysis-chain > div:last-child { border-right: 0; }
.analysis-chain dt { color: var(--brass); font-size: 12px; font-weight: 900; }
.analysis-chain dd { margin: 5px 0 0; color: #fff; font-size: 12px; font-weight: 800; line-height: 1.5; }

/* ── 시각 그리드 (지도맵 + 신호) ───────────────────────────── */
.analysis-visual-grid { margin-top: 15px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 15px; }
.analysis-figure { min-width: 0; margin: 0; padding: 22px; background: #fff; border: 1px solid var(--line-strong); border-radius: 5px; }
.analysis-figure figcaption { display: grid; gap: 3px; }
.analysis-figure figcaption span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.analysis-figure figcaption strong { color: var(--ink-900); font-family: var(--rptv2-serif); font-size: 17px; }
.analysis-figure svg { width: 100%; height: auto; display: block; overflow: visible; margin-top: 8px; }
.analysis-figure > p { min-height: 55px; margin: 10px 0 0; padding: 12px 14px; background: var(--ivory); border-left: 2px solid var(--brass); color: var(--muted); font-size: 12px; line-height: 1.65; }
.analysis-figure > p strong { color: var(--ink-900); }

/* ── 교차 근거 ─────────────────────────────────────────────── */
.analysis-cross-evidence { margin-top: 15px; padding: 24px; background: var(--ivory); border-left: 3px solid var(--brass); }
.analysis-cross-evidence > header span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.analysis-cross-evidence > header h3 { margin: 3px 0 0; font-family: var(--rptv2-serif); font-size: 17px; }
.analysis-cross-evidence > div { margin-top: 15px; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 1px; background: var(--line); }
.analysis-cross-evidence article { min-height: 88px; padding: 14px; background: #fff; }
.analysis-cross-evidence article span { color: var(--blue); font-size: 12px; font-weight: 900; }
.analysis-cross-evidence article p, .analysis-cross-evidence > p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.analysis-cross-evidence > p { margin-top: 14px; }
.analysis-cross-evidence > p strong { margin-right: 7px; color: var(--ink-900); }

/* ── 핵심 지도 판정 + 적합 인장 ────────────────────────────── */
.executive-layout { margin-top: 22px; display: grid; grid-template-columns: minmax(0,1.35fr) minmax(250px,0.65fr); gap: 14px; }
.executive-statement { padding: 30px; background: var(--ivory); border-left: 4px solid var(--brass); }
.executive-statement > span { color: var(--brass-dark); font-size: 12px; font-weight: 900; }
.executive-statement h3 { margin: 10px 0 0; color: var(--ink-950); font-family: var(--rptv2-serif); font-size: 22px; font-weight: 700; line-height: 1.6; word-break: keep-all; }
.executive-statement > p { margin: 14px 0 0; color: var(--text); font-size: 12px; line-height: 1.75; }
.executive-statement ul { margin: 18px 0 0; padding: 15px 0 0 17px; display: grid; gap: 5px; border-top: 1px solid var(--line-strong); color: var(--ink-800); font-size: 12px; font-weight: 700; }
.fit-seal-panel { padding: 27px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--ink-900); border-top: 4px solid var(--brass); color: #fff; text-align: center; }
.fit-seal-panel > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.fit-seal { width: 105px; height: 105px; margin-top: 15px; display: grid; grid-template-columns: auto auto; place-content: center; align-items: end; border: 1px solid var(--brass); border-radius: 50%; box-shadow: inset 0 0 0 7px #202d41; }
.fit-seal strong { font-family: Georgia, serif; font-size: 32px; line-height: 1; }
.fit-seal small { padding-bottom: 3px; color: #aeb9c8; font-size: 12px; }
.fit-seal-panel h3 { margin: 14px 0 0; color: #fff; font-size: 14px; font-weight: 900; }
.fit-seal-panel p { margin: 8px 0 0; color: #c4cedb; font-size: 12px; line-height: 1.65; }

/* ── 핵심 신호 카드 ────────────────────────────────────────── */
.profile-signals { margin-top: 16px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.profile-signals article { min-height: 118px; padding: 16px; display: grid; grid-template-columns: minmax(0,1fr) auto; grid-template-rows: auto auto 1fr; gap: 3px 10px; background: #fff; border: 1px solid var(--line); border-top: 3px solid var(--teal); border-radius: 4px; }
.profile-signals article.is-caution { border-top-color: var(--coral); }
.profile-signals article > span { color: var(--muted); font-size: 12px; font-weight: 900; }
.profile-signals article > strong { color: var(--ink-900); font-size: 13px; font-weight: 900; }
.profile-signals article > b { grid-row: 1 / 3; grid-column: 2; color: var(--ink-900); font-family: Georgia, serif; font-size: 22px; }
.profile-signals article > p { grid-column: 1 / -1; margin: 7px 0 0; color: var(--muted); font-size: 12px; }

/* ── 교사 브리핑(다크) ─────────────────────────────────────── */
.teacher-brief { margin-top: 16px; display: grid; grid-template-columns: 210px minmax(0,1fr); background: var(--ink-900); color: #fff; }
.teacher-brief__title { padding: 25px; border-right: 1px solid #2d3c51; }
.teacher-brief__title span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.teacher-brief__title h3 { margin: 8px 0 0; font-family: var(--rptv2-serif); font-size: 17px; font-weight: 700; line-height: 1.55; }
.teacher-brief ol { margin: 0; padding: 15px 24px; list-style: none; }
.teacher-brief li { min-height: 48px; display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #2a394d; }
.teacher-brief li:last-child { border-bottom: 0; }
.teacher-brief li > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; flex: 0 0 auto; }
.teacher-brief li p { margin: 0; color: #c5cfdb; font-size: 12px; line-height: 1.5; }
.teacher-brief li strong { margin-right: 5px; color: #fff; font-size: 12px; }

/* ── 상담 배경 도시에(counselor-only) ──────────────────────── */
.consultation-context-dossier { margin-top: 30px; overflow: hidden; background: #fff; border: 1px solid var(--line-strong); border-top: 3px solid var(--brass); border-radius: 5px; }
.consultation-context-dossier > header { min-height: 76px; padding: 18px 23px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--line); }
.consultation-context-dossier > header span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.consultation-context-dossier > header h3 { margin: 3px 0 0; font-family: var(--rptv2-serif); font-size: 18px; }
.consultation-context-dossier > header > b { padding: 7px 9px; background: var(--blue-soft); border-radius: 3px; color: var(--blue); font-size: 12px; }
.context-meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); border-bottom: 1px solid var(--line); }
.context-meta-grid > div { min-height: 75px; padding: 15px 17px; display: grid; align-content: center; gap: 4px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.context-meta-grid > div:nth-child(4n) { border-right: 0; }
.context-meta-grid span { color: var(--muted); font-size: 12px; font-weight: 800; }
.context-meta-grid strong { color: var(--ink-900); font-size: 13px; line-height: 1.45; word-break: keep-all; }
.context-consult-questions { padding: 19px 22px; display: grid; grid-template-columns: minmax(260px,0.9fr) minmax(0,1.6fr); gap: 24px; align-items: center; background: var(--ink-900); color: #fff; }
.context-consult-questions > div { display: grid; gap: 5px; }
.context-consult-questions > div span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.context-consult-questions > div strong { font-family: var(--rptv2-serif); font-size: 15px; line-height: 1.55; }
.context-consult-questions ol { margin: 0; padding: 0; display: grid; gap: 8px; list-style: none; }
.context-consult-questions li { display: grid; grid-template-columns: 30px minmax(0,1fr); gap: 8px; align-items: start; }
.context-consult-questions li b { color: var(--brass); font-family: Georgia, serif; font-size: 12px; }
.context-consult-questions li p { margin: 0; color: #d2dae4; font-size: 12px; line-height: 1.5; }

/* ── 공용 패널 + 막대 ──────────────────────────────────────── */
.learning-panels, .will-guidance-grid, .personality-relation-grid, .strength-growth-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.will-guidance-grid, .personality-relation-grid { margin-top: 12px; }
.evidence-panel, .will-dossier, .coaching-dossier, .personality-panel, .relation-panel, .legacy-list-panel { min-width: 0; padding: 25px; background: #fff; border: 1px solid var(--line); border-radius: 5px; }
.panel-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.panel-title > span { width: 100%; color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.panel-title h3 { margin: 0; color: var(--ink-950); font-family: var(--rptv2-serif); font-size: 17px; font-weight: 700; }
.panel-title > b { color: var(--ink-900); font-family: Georgia, serif; font-size: 19px; }
.bullet-bars, .coaching-lines, .phone-bars { margin-top: 23px; display: grid; gap: 14px; }
.bullet-bars > div, .coaching-lines > div, .phone-bars > div { display: grid; grid-template-columns: 92px minmax(0,1fr) 30px; gap: 9px; align-items: center; }
.bullet-bars span, .coaching-lines span, .phone-bars span { color: var(--text); font-size: 12px; font-weight: 800; }
.bullet-bars i, .coaching-lines i, .phone-bars i { height: 6px; overflow: hidden; background: #e7eaeb; border-radius: 1px; }
.bullet-bars i b, .coaching-lines i b, .phone-bars i b { display: block; height: 100%; background: var(--teal); }
.bullet-bars > div > strong, .coaching-lines > div > strong, .phone-bars > div > strong { color: var(--ink-900); font-family: Georgia, serif; font-size: 12px; text-align: right; }
.bullet-bars .is-caution i b, .phone-bars .is-caution i b { background: var(--coral); }
.evidence-explain { margin: 22px 0 0; padding-top: 15px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.75; }
.evidence-explain strong { margin-right: 5px; color: var(--ink-900); }
.evidence-tags { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 5px; }
.evidence-tags span { padding: 4px 6px; background: var(--blue-soft); border-radius: 3px; color: var(--blue); font-size: 12px; font-weight: 800; }

/* ── 의지×회복 / 코칭 ──────────────────────────────────────── */
.coaching-lines i b { background: var(--blue); }
.coaching-dossier blockquote { margin: 22px 0 0; padding: 17px; background: var(--ink-900); border-left: 3px solid var(--brass); color: #fff; }
.coaching-dossier blockquote strong { font-family: var(--rptv2-serif); font-size: 14px; }
.coaching-dossier blockquote p { margin: 6px 0 0; color: #c5cfdb; font-size: 12px; line-height: 1.65; }
.will-dossier > p { margin: 22px 0 0; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.7; }

/* ── 휴대폰 다크 피처 ──────────────────────────────────────── */
.phone-feature { display: grid; grid-template-columns: 245px minmax(0,1fr); background: var(--ink-900); color: #fff; }
.phone-score-block { padding: 30px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #2d3c51; }
.phone-score-block > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.phone-score-block > strong { margin-top: 10px; font-family: Georgia, serif; font-size: 48px; line-height: 1; }
.phone-score-block > b { margin-top: 9px; color: #fff; font-size: 13px; }
.phone-score-block > p { margin: 9px 0 0; color: #aeb9c8; font-size: 12px; line-height: 1.55; }
.phone-analysis { padding: 26px; display: grid; grid-template-columns: minmax(0,1fr); gap: 22px; }
.phone-bars { margin-top: 0; }
.phone-bars span, .phone-bars strong { color: #d6dde7; }
.phone-bars i { background: #344257; }

/* ── 성격/MBTI/친구 ───────────────────────────────────────── */
.personality-panel > p { margin: 17px 0 0; color: var(--text); font-size: 12px; line-height: 1.75; }
.mbti-adjustment-panel { margin-top: 18px; background: var(--blue-soft); border-top: 2px solid var(--blue); border-bottom: 1px solid #c8d7e0; }
.mbti-adjustment-panel > div { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #c8d7e0; }
.mbti-adjustment-panel > div span { color: var(--blue); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.mbti-adjustment-panel > div strong { color: var(--ink-900); font-size: 12px; }
.mbti-adjustment-panel dl { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }
.mbti-adjustment-panel dl > div { min-width: 0; padding: 12px 14px; border-right: 1px solid #c8d7e0; border-bottom: 1px solid #c8d7e0; }
.mbti-adjustment-panel dl > div:nth-child(2n) { border-right: 0; }
.mbti-adjustment-panel dt { color: var(--text); font-size: 12px; font-weight: 850; }
.mbti-adjustment-panel dd { margin: 7px 0 0; display: grid; grid-template-columns: 1fr auto auto; gap: 7px; align-items: baseline; }
.mbti-adjustment-panel dd span { color: var(--muted); font-size: 12px; }
.mbti-adjustment-panel dd b { color: var(--brass-dark); font-size: 12px; }
.mbti-adjustment-panel dd strong { color: var(--blue); font-family: Georgia, serif; font-size: 15px; }
.mbti-adjustment-panel > p { margin: 0; padding: 11px 14px; color: var(--muted); font-size: 12px; line-height: 1.55; }
.personality-panel > small { display: block; margin-top: 17px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.5; }
.relation-signals { margin-top: 20px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
.relation-signals > div { min-height: 102px; padding: 13px; background: var(--teal-soft); border-top: 2px solid var(--teal); border-radius: 3px; }
.relation-signals > div.is-caution { background: var(--coral-soft); border-top-color: var(--coral); }
.relation-signals span { color: var(--muted); font-size: 12px; font-weight: 900; }
.relation-signals strong { margin-top: 4px; display: block; color: var(--ink-900); font-family: Georgia, serif; font-size: 18px; }
.relation-signals p { margin: 5px 0 0; color: var(--text); font-size: 12px; line-height: 1.5; }
.relation-note { margin: 15px 0 0; padding-top: 13px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.65; }
.relation-note strong { margin-right: 5px; color: var(--ink-900); }

/* ── NK 적합 ───────────────────────────────────────────────── */
.fit-intro { padding: 28px 30px; display: grid; grid-template-columns: minmax(0,1.1fr) minmax(260px,0.9fr); gap: 36px; align-items: center; background: var(--ink-900); border-top: 4px solid var(--brass); color: #fff; }
.fit-intro h3 { margin: 0; font-family: var(--rptv2-serif); font-size: 18px; font-weight: 700; line-height: 1.65; word-break: keep-all; }
.fit-intro h3 em { color: #dac7a6; font-style: normal; }
.fit-intro p { margin: 0; color: #c6d0dc; font-size: 12px; line-height: 1.75; }
.fit-feature-list { margin-top: 12px; display: grid; gap: 8px; }
.fit-feature-list article { min-height: 116px; padding: 18px 20px; display: grid; grid-template-columns: 210px 250px minmax(0,1fr); gap: 20px; align-items: center; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--brass); border-radius: 4px; }
.fit-feature-list article > div:first-child span, .fit-feature-list article > div:first-child strong { display: block; }
.fit-feature-list article > div:first-child span { color: var(--muted); font-size: 12px; font-weight: 900; }
.fit-feature-list article > div:first-child strong { margin-top: 7px; color: var(--ink-900); font-size: 13px; font-weight: 900; }
.fit-feature-list article > p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.65; }
.dual-fit { display: grid; gap: 9px; }
.dual-fit p { margin: 0; display: grid; grid-template-columns: 54px 30px minmax(0,1fr); gap: 7px; align-items: center; color: var(--muted); font-size: 12px; font-weight: 800; }
.dual-fit p b { color: var(--ink-900); font-family: Georgia, serif; text-align: right; }
.dual-fit p i { height: 5px; overflow: hidden; background: #e7eaeb; }
.dual-fit p em { display: block; height: 100%; background: var(--teal); }
.dual-fit p:nth-child(2) em { background: var(--brass); }
.fit-consult-note { margin-top: 12px; padding: 20px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; background: var(--brass-soft); border-top: 2px solid var(--brass); }
.fit-consult-note > div span, .fit-consult-note > div strong { display: block; }
.fit-consult-note > div span { color: var(--brass-dark); font-size: 12px; font-weight: 900; }
.fit-consult-note > div strong { margin-top: 5px; color: var(--ink-900); font-size: 12px; }
.fit-consult-note > p { grid-column: 1 / -1; margin: 0; padding-top: 12px; border-top: 1px solid rgba(138,100,34,0.18); color: #6b542a; font-size: 12px; line-height: 1.6; }

/* ── 과목 전략 ─────────────────────────────────────────────── */
.subject-dossier { margin-top: 30px; padding-top: 28px; border-top: 1px solid var(--line-strong); }
.subject-dossier__head { margin-bottom: 16px; display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.subject-dossier__head span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.subject-dossier__head h3 { margin: 4px 0 0; color: var(--ink-950); font-family: var(--rptv2-serif); font-size: 19px; font-weight: 700; }
.subject-v2-profile { display: grid; grid-template-columns: 270px minmax(0,1fr); gap: 0; border: 1px solid var(--line); margin-bottom: 10px; }
.subject-v2-summary { padding: 27px; background: var(--ink-900); color: #fff; }
.subject-v2-summary > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.subject-v2-summary h4 { margin: 6px 0 17px; font-family: var(--rptv2-serif); font-size: 18px; font-weight: 700; }
.subject-v2-summary > div { display: flex; align-items: end; gap: 4px; }
.subject-v2-summary > div strong { font-family: Georgia, serif; font-size: 43px; line-height: 1; }
.subject-v2-summary > div small { padding-bottom: 4px; color: #aeb9c8; font-size: 12px; }
.subject-v2-summary > p { margin: 9px 0 0; color: #c4cedb; font-size: 12px; line-height: 1.7; }
.subject-v2-details { padding: 24px; }
.subject-v2-metrics { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.subject-v2-metrics > div { min-height: 84px; padding: 13px; display: grid; grid-template-columns: minmax(0,1fr) auto; grid-template-rows: auto auto auto; gap: 4px 8px; background: #f4f6f6; border-radius: 3px; }
.subject-v2-metrics span { color: var(--muted); font-size: 12px; font-weight: 900; }
.subject-v2-metrics strong { grid-row: 1 / 3; grid-column: 2; color: var(--ink-900); font-family: Georgia, serif; font-size: 18px; }
.subject-v2-metrics i { grid-column: 1 / -1; height: 6px; overflow: hidden; background: #e7eaeb; border-radius: 1px; }
.subject-v2-metrics i b { display: block; height: 100%; background: var(--teal); }
.subject-v2-metrics .is-caution i b { background: var(--coral); }
.subject-v2-metrics p { grid-column: 1 / -1; margin: 3px 0 0; color: var(--muted); font-size: 12px; }

/* ── 강점·개선(넘버 리스트) + 간극 + 로드맵 + 최종 ─────────── */
.legacy-list-panel ol { margin: 22px 0 0; padding: 0; list-style: none; }
.legacy-list-panel li { padding: 15px 0; display: flex; gap: 12px; border-bottom: 1px solid var(--line); }
.legacy-list-panel li:last-child { border-bottom: 0; }
.legacy-list-panel li > span { width: 24px; height: 24px; flex: 0 0 24px; display: grid; place-items: center; background: var(--teal-soft); border-radius: 50%; color: var(--teal); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.growth-panel li > span { background: var(--coral-soft); color: var(--coral); }
.legacy-list-panel li strong { color: var(--ink-900); font-size: 12px; }
.legacy-list-panel li p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.65; }
.gap-dossier, .roadmap-dossier { margin-top: 12px; padding: 25px; background: #fff; border: 1px solid var(--line); border-radius: 5px; }
.gap-rows { margin-top: 20px; display: grid; gap: 8px; }
.gap-rows article { padding: 16px; display: grid; grid-template-columns: 190px 190px minmax(0,1fr); gap: 17px; align-items: center; background: var(--ivory); border-left: 3px solid var(--brass); }
.gap-rows article > div:first-child span, .gap-rows article > div:first-child strong { display: block; }
.gap-rows article > div:first-child span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.gap-rows article > div:first-child strong { margin-top: 4px; color: var(--ink-900); font-size: 12px; }
.gap-rows article > p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.65; }
.gap-values { display: grid; grid-template-columns: 1fr 14px 1fr; gap: 5px; align-items: center; }
.gap-values p { margin: 0; padding: 7px; background: #fff; color: var(--muted); font-size: 12px; text-align: center; }
.gap-values p b { margin-left: 3px; color: var(--ink-900); font-family: Georgia, serif; font-size: 13px; }
.gap-values i { height: 1px; background: var(--brass); }
.roadmap-line { position: relative; margin-top: 24px; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0; border: 1px solid var(--line); }
.roadmap-line article { min-height: 175px; padding: 20px; background: #fff; border-right: 1px solid var(--line); }
.roadmap-line article:last-child { border-right: 0; }
.roadmap-line span { color: var(--brass-dark); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.roadmap-line strong { margin-top: 8px; display: block; color: var(--ink-900); font-size: 13px; }
.roadmap-line p { margin: 8px 0 0; color: var(--muted); font-size: 12px; line-height: 1.65; }
.roadmap-line small { margin-top: 14px; display: block; padding-top: 9px; border-top: 1px solid var(--line); color: var(--teal); font-size: 12px; font-weight: 900; }
.verify-line { margin-top: 12px; padding: 20px 24px; background: var(--ink-900); border-top: 3px solid var(--brass); color: #fff; }
.verify-line > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.verify-line ul { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.verify-line li { display: flex; gap: 10px; color: #d2dae4; font-size: 12px; line-height: 1.5; }
.verify-line li::before { content: "•"; color: var(--brass); }
.final-guidance { margin-top: 12px; padding: 34px; background: var(--ink-900); border-top: 5px solid var(--brass); color: #fff; }
.final-guidance > span { color: var(--brass); font-family: Georgia, serif; font-size: 12px; font-weight: 900; }
.final-guidance h3 { max-width: 800px; margin: 12px 0 0; font-family: var(--rptv2-serif); font-size: 21px; font-weight: 700; line-height: 1.6; word-break: keep-all; }
.final-guidance p { max-width: 840px; margin: 15px 0 0; padding-top: 15px; border-top: 1px solid #314158; color: #c5cfdb; font-size: 12px; line-height: 1.8; word-break: keep-all; }
.report-v2-caution { padding: 24px 58px; display: grid; grid-template-columns: 100px minmax(0,1fr); gap: 20px; background: #ecefed; }
.report-v2-caution strong { color: var(--ink-900); font-size: 12px; }
.report-v2-caution p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }

/* ── 하단 고정 dock(다크 필) ───────────────────────────────── */
.report-dock {
  position: fixed; z-index: 120; bottom: max(18px, env(safe-area-inset-bottom)); left: 50%;
  width: min(700px, calc(100% - 32px)); min-height: 66px; padding: 7px;
  display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 4px;
  background: rgba(16,23,34,0.97); border: 1px solid rgba(184,138,50,0.55); border-radius: 6px;
  box-shadow: 0 15px 38px rgba(16,23,34,0.23); backdrop-filter: blur(18px); transform: translateX(-50%);
}
.report-dock button { min-height: 50px; padding: 5px 8px; display: flex; align-items: center; justify-content: center; gap: 7px; background: transparent; border: 1px solid transparent; border-radius: 3px; color: #9facbd; }
.report-dock button.is-active { background: #fff; border-color: #fff; color: var(--ink-900); }
.report-dock b { color: var(--brass); font-family: Georgia, serif; font-size: 12px; }
.report-dock button.is-active b { color: var(--brass-dark); }
.report-dock span { font-size: 12px; font-weight: 900; white-space: nowrap; }

/* ── 반응형(≤900) ─────────────────────────────────────────── */
@media (max-width: 900px) {
  .report-v2-cover { padding: 30px 22px 24px; min-height: auto; }
  .cover-layout { grid-template-columns: 1fr; gap: 26px; min-height: auto; }
  .cover-copy h1 { font-size: 30px; }
  .report-v2-section { padding: 40px 20px; }
  .executive-layout, .phone-feature, .fit-intro, .subject-v2-profile,
  .learning-panels, .will-guidance-grid, .personality-relation-grid, .strength-growth-grid,
  .analysis-verdict__body, .analysis-visual-grid, .context-consult-questions { grid-template-columns: 1fr; }
  .analysis-verdict__body p { border-right: 0; border-bottom: 1px solid #304056; }
  .analysis-chain { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .profile-signals, .context-meta-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .analysis-cross-evidence > div { grid-template-columns: 1fr; }
  .teacher-brief { grid-template-columns: 1fr; }
  .teacher-brief__title { border-right: 0; border-bottom: 1px solid #2d3c51; }
  .phone-score-block { border-right: 0; border-bottom: 1px solid #2d3c51; }
  .fit-feature-list article, .gap-rows article { grid-template-columns: 1fr; gap: 14px; }
  .mbti-adjustment-panel dl { grid-template-columns: 1fr; }
  .subject-v2-metrics { grid-template-columns: 1fr; }
  .roadmap-line { grid-template-columns: 1fr; }
  .roadmap-line article { border-right: 0; border-bottom: 1px solid var(--line); }
  .report-v2-caution { grid-template-columns: 1fr; gap: 6px; padding: 20px; }
}
@media (max-width: 420px) {
  .report-v2-toolbar .premium-brand > span:last-child { display: none; }
  .cover-copy h1 { font-size: 26px; }
  .profile-signals { grid-template-columns: 1fr; }
  .report-dock { right: 0; bottom: 0; left: 0; width: 100%; border-radius: 0; transform: none; padding: 6px 7px calc(6px + env(safe-area-inset-bottom)); }
  .report-dock button { flex-direction: column; gap: 2px; min-height: 46px; }
}

/* ── 인쇄(A4 세로 다중페이지) ─────────────────────────────── */
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  .rptv2-doc { background: #fff !important; }
  .report-v2-toolbar, .report-dock, .rptv2-noprint { display: none !important; }
  .report-v2-wrap { width: 210mm; max-width: none; margin: 0; padding: 0; box-shadow: none; }
  .report-v2-cover { width: 210mm; height: 297mm; min-height: 297mm; padding: 14mm 16mm 12mm; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
  .cover-layout { min-height: 0; flex: 1; }
  .report-v2-section { padding: 14mm 13mm; }
  #sec-learning, #sec-life, #sec-fit, #sec-solution { break-before: page; page-break-before: always; }
  .consultation-context-dossier { overflow: visible; break-before: page; page-break-before: always; break-inside: avoid; page-break-inside: avoid; }
  .analysis-verdict__body, .analysis-visual-grid, .executive-layout, .learning-panels,
  .will-guidance-grid, .personality-relation-grid, .strength-growth-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .profile-signals { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .context-meta-grid { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .phone-feature { grid-template-columns: 58mm minmax(0,1fr); }
  .fit-feature-list article { grid-template-columns: 39mm 44mm minmax(0,1fr); }
  .subject-v2-profile { grid-template-columns: 62mm minmax(0,1fr); }
  .gap-rows article { grid-template-columns: 40mm 42mm minmax(0,1fr); }
  .roadmap-line { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .luxury-section-heading, .subject-dossier__head, .panel-title { break-after: avoid; page-break-after: avoid; }
  .analysis-verdict, .analysis-visual-grid, .analysis-cross-evidence, .executive-layout,
  .profile-signals, .teacher-brief, .consultation-context-dossier > header, .context-meta-grid,
  .context-consult-questions, .learning-panels, .will-guidance-grid, .phone-feature,
  .personality-relation-grid, .mbti-adjustment-panel, .fit-intro, .fit-consult-note,
  .strength-growth-grid, .roadmap-line, .final-guidance, .verify-line, .report-v2-caution, .analysis-figure,
  .evidence-panel, .will-dossier, .coaching-dossier, .personality-panel, .relation-panel,
  .legacy-list-panel, .fit-feature-list article, .gap-rows article, .roadmap-line article {
    break-inside: avoid; page-break-inside: avoid;
  }
  p, li, blockquote { orphans: 3; widows: 3; }
  svg { max-width: 100%; height: auto; shape-rendering: geometricPrecision; text-rendering: geometricPrecision; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;
