// V2 결과 보고서 디자인 CSS (3차 다듬기: 타이포 한 단계 축소·카톡 전송용 모바일 문서).
// 화이트 본문 기반, 네이비·골드 포인트. 대형 타이포 대신 절제된 프리미엄(웨이트·여백·자간으로 계층).
// 학부모 공유본(parent-mode)은 좁은 모바일 문서 폭 + 컴팩트 상단 밴드(카카오 인앱 우선).
// 모든 규칙은 .rptv2-doc 스코프 하위에서만. 데이터·문구·점수 로직은 컴포넌트/서버에서 결정.

export const REPORT_PREMIUM_CSS = `
.rptv2-doc {
  --ink-950: #101722;
  --ink-900: #1b2a44;
  --ink-800: #24334a;
  --ink: #24334a;
  --panel: #ffffff;
  --paper: #ffffff;
  --ivory: #f7f6f2;
  --canvas: #eef0f2;
  --brass: #b0842f;
  --brass-dark: #8a6422;
  --brass-soft: #f5eede;
  --teal: #2d776a;
  --teal-soft: #e7f1ef;
  --coral: #a8433d;
  --coral-soft: #f8ebe8;
  --navy: #1b2a44;
  --navy-soft: #eaeef5;
  --blue: #355d79;
  --blue-soft: #eaf0f4;
  --text: #2f3947;
  --muted: #5b6673;
  --line: #e4e7ea;
  --line-strong: #cfd4d9;
  --rptv2-sans: var(--font-noto), "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
  background: var(--canvas);
  color: var(--ink-950);
  font-family: var(--rptv2-sans);
  font-size: 14.5px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
.rptv2-doc *, .rptv2-doc *::before, .rptv2-doc *::after { box-sizing: border-box; }
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
  min-height: 60px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  flex-wrap: wrap; padding: 8px 0;
}
.premium-brand { display: inline-flex; align-items: center; gap: 10px; }
.premium-brand__mark {
  width: 36px; height: 36px; display: grid; place-items: center;
  background: var(--navy); border-radius: 8px; color: #fff; font-size: 13px; font-weight: 800;
}
.premium-brand > span:last-child { display: grid; gap: 1px; }
.premium-brand strong { color: var(--navy); font-size: 13.5px; font-weight: 800; }
.premium-brand small { color: var(--muted); font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em; }
.report-v2-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.audience-switch { display: inline-flex; padding: 3px; background: #eef0f1; border-radius: 8px; }
.audience-switch button {
  min-height: 34px; padding: 6px 12px; background: transparent; border: 0; border-radius: 6px;
  color: var(--muted); font-size: 12.5px; font-weight: 800;
}
.audience-switch button.is-active { background: #fff; color: var(--navy); box-shadow: 0 1px 4px rgba(16,23,34,0.12); }
.report-command {
  min-height: 36px; padding: 6px 13px; display: inline-flex; align-items: center; gap: 7px;
  background: var(--navy); border: 1px solid var(--navy); border-radius: 8px;
  color: #fff; font-size: 12.5px; font-weight: 800;
}
.report-command span {
  padding: 3px 6px; background: var(--brass); border-radius: 4px;
  color: #fff; font-size: 10.5px; font-weight: 800; line-height: 1;
}
.report-command:hover { background: #16223a; border-color: #16223a; }
.report-share {
  min-height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid var(--line-strong); border-radius: 8px;
  color: var(--text); font-size: 12.5px; font-weight: 700;
}
.report-share:hover { border-color: var(--brass); color: var(--navy); }
.report-share:disabled { opacity: 0.5; cursor: not-allowed; }
.report-command:focus-visible, .report-share:focus-visible, .report-dock button:focus-visible {
  outline: 3px solid #d7b86f; outline-offset: 2px;
}

/* ── 문서 시트 ─────────────────────────────────────────────── */
.report-v2-wrap {
  width: min(210mm, calc(100% - 32px));
  margin: 20px auto 0; padding-bottom: 120px;
  background: var(--paper); border-radius: 12px;
  box-shadow: 0 10px 40px rgba(16,23,34,0.08);
}
/* 학부모 공유본(카톡 전송용): 좁은 모바일 문서 폭(데스크톱에선 중앙 문서 카드). */
.rptv2-doc.parent-mode .report-v2-wrap { width: min(660px, calc(100% - 24px)); }

/* ── 컴팩트 상단 밴드(학부모 전용 — 큰 표지 대체, 열자마자 내용 보이게) ── */
.report-v2-band { padding: 20px 22px 18px; background: var(--navy); border-radius: 12px 12px 0 0; color: #fff; }
.report-v2-band__brand { display: flex; align-items: center; gap: 8px; }
.report-v2-band__mark { width: 26px; height: 26px; flex: 0 0 26px; display: grid; place-items: center; background: rgba(255,255,255,0.14); border-radius: 6px; color: #e8cf9d; font-size: 11.5px; font-weight: 800; }
.report-v2-band__brand span { color: #aeb8c8; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.report-v2-band h1 { margin: 13px 0 0; color: #fff; font-size: 20px; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em; word-break: keep-all; }
.report-v2-band h1 em { color: #e8cf9d; font-style: normal; font-weight: 800; }
.report-v2-band__meta { margin-top: 7px; color: #c4cede; font-size: 12.5px; font-weight: 600; }
.report-evidence-strip { margin-top: 11px; display: flex; gap: 6px; flex-wrap: wrap; }
.report-evidence-strip span { padding: 4px 8px; border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; color: #dbe2ed; font-size: 10.5px; font-weight: 700; }
.report-v2-band__summary { margin: 13px 0 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.14); color: #d7deea; font-size: 13px; line-height: 1.62; word-break: keep-all; }

/* ── 학부모 종합 분석 구조(4차): 선별 인사이트 카드·과목 노트·지도 방향 ── */
.insight-cards { display: grid; gap: 10px; }
.insight-cards article { display: grid; grid-template-columns: 30px minmax(0,1fr); gap: 12px; padding: 16px 18px; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--teal); border-radius: 10px; }
.insight-cards.is-growth article { border-left-color: var(--coral); }
.insight-cards__idx { width: 30px; height: 30px; display: grid; place-items: center; background: var(--teal-soft); border-radius: 8px; color: var(--teal); font-size: 12.5px; font-weight: 800; }
.insight-cards.is-growth .insight-cards__idx { background: var(--coral-soft); color: var(--coral); }
.insight-cards article strong { display: block; color: var(--ink-950); font-size: 14px; font-weight: 800; }
.insight-cards article strong + p { margin-top: 4px; }
.insight-cards__head { display: flex; align-items: baseline; gap: 8px; }
.insight-cards__head + p { margin-top: 4px; }
.insight-cards__badge { margin-left: auto; display: inline-flex; align-items: baseline; gap: 6px; white-space: nowrap; }
.insight-cards__badge > b { color: var(--navy); font-size: 13.5px; font-weight: 800; }
.insight-cards article p { margin: 0; color: var(--text); font-size: 13px; line-height: 1.65; word-break: keep-all; }

.signal-solo { max-width: 460px; margin: 0 auto; }
.signal-solo .analysis-figure { padding: 22px; }

/* 항목별 분석 행: 항목명 + 점수·밴드 배지 + 슬림 막대 + 특징 해설 1~2문장 */
.analysis-rows { display: grid; gap: 8px; margin-top: 14px; }
.analysis-rows > article { padding: 14px 16px; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--line-strong); border-radius: 10px; }
.analysis-rows > article.is-high { border-left-color: var(--teal); }
.analysis-rows > article.is-mid { border-left-color: var(--blue); }
.analysis-rows > article.is-low { border-left-color: var(--coral); }
.analysis-rows header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.analysis-rows h4 { margin: 0; color: var(--ink-950); font-size: 13.5px; font-weight: 800; }
.analysis-rows__badge { display: inline-flex; align-items: baseline; gap: 8px; white-space: nowrap; }
.analysis-rows__score { color: var(--navy); font-size: 15px; font-weight: 800; }
.student-answer-cards header { flex-direction: column; align-items: stretch; }
.student-answer-cards .analysis-rows__badge { display: block; width: 100%; white-space: normal; }
.student-answer-cards .analysis-rows__score { display: block; width: 100%; margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--panel); font-size: 12.5px; line-height: 1.55; white-space: normal; word-break: keep-all; }
.report-expandable { margin-top: 12px; }
.report-expandable > summary { cursor: pointer; list-style: none; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--navy); font-size: 13px; font-weight: 800; }
.report-expandable > summary::-webkit-details-marker { display: none; }
.report-expandable > summary::after { content: "+"; float: right; color: var(--brass-dark); font-size: 16px; line-height: 1; }
.report-expandable[open] > summary::after { content: "−"; }
/* MBTI 배지 — 그래프·숫자와 비인접, 참고용임을 캡션으로 명시 */
.report-v2-band__mbti { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.mbti-pill { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--brass); color: var(--brass); background: transparent; font-size: 12.5px; font-weight: 800; letter-spacing: 0.08em; }
.mbti-caption { font-size: 11px; color: var(--muted); }

/* 지도 선호 스펙트럼 — 점수 카드와 시각 문법 분리(아이보리 + 좌측 골드 라인) */
.spectrum-card { padding: 16px 18px; border-radius: 12px; background: var(--ivory, #faf7f1); border-left: 3px solid var(--brass); }
.spectrum { display: grid; gap: 14px; }
.spectrum__row { display: grid; grid-template-columns: 74px minmax(0,1fr) 74px; align-items: center; gap: 10px; }
.spectrum__end { font-size: 11.5px; color: var(--muted); }
.spectrum__end:last-of-type { text-align: right; }
.spectrum__track { position: relative; display: block; height: 2px; background: #ddd5c6; border-radius: 2px; }
.spectrum__survey, .spectrum__mbti { position: absolute; top: 50%; width: 11px; height: 11px; margin-left: -5.5px; transform: translateY(-50%); }
.spectrum__survey { background: var(--navy); border-radius: 50%; }
.spectrum__mbti { background: transparent; border: 1.5px solid var(--brass); border-radius: 2px; rotate: 45deg; }
.spectrum__note { margin: 0; font-size: 11.5px; color: var(--muted); }
@media (max-width: 520px) { .spectrum__row { grid-template-columns: 62px minmax(0,1fr) 62px; gap: 7px; } .spectrum__end { font-size: 10.5px; } }

/* ⓪ 한 장 요약 — 정렬 수평 바(레이더 대체) */
.glance { display: grid; gap: 16px; }
.glance__type { margin: 0; font-size: 19px; line-height: 1.5; font-weight: 800; color: var(--navy); word-break: keep-all; }
.glance__priority { display: grid; gap: 5px; padding: 14px 16px; border-left: 3px solid var(--brass); border-radius: 10px; background: var(--ivory, #faf7f1); }
.glance__priority span { color: var(--brass-dark); font-size: 11.5px; font-weight: 800; }
.glance__priority strong { color: var(--ink-950); font-size: 14.5px; line-height: 1.55; word-break: keep-all; }
.glance__evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.glance__evidence-grid article { padding: 12px 13px; border: 1px solid var(--line); border-left: 3px solid var(--teal); border-radius: 10px; background: #fff; }
.glance__evidence-grid article.is-support { border-left-color: var(--coral); }
.glance__evidence-grid span { display: block; color: var(--teal); font-size: 10.5px; font-weight: 800; }
.glance__evidence-grid article.is-support span { color: var(--coral); }
.glance__evidence-grid p { margin: 6px 0 0; color: var(--text); font-size: 11.5px; line-height: 1.5; word-break: keep-all; }
.glance__evidence-grid strong { display: block; margin-top: 5px; color: var(--ink-950); font-size: 11.5px; }
.glance-bars { display: grid; gap: 9px; }
.glance-bars__row { display: grid; grid-template-columns: 108px minmax(0,1fr) auto; align-items: center; gap: 10px; }
.glance-bars__label { font-size: 13px; font-weight: 700; color: var(--ink); }
.glance-bars__track { display: block; height: 8px; border-radius: 999px; background: #eef1f3; overflow: hidden; }
.glance-bars__track b { display: block; height: 100%; border-radius: 999px; background: var(--blue); }
.glance-bars__track b.b-high { background: var(--teal); }
.glance-bars__track b.b-mid { background: var(--blue); }
.glance-bars__track b.b-low { background: var(--coral); }
.glance-bars__track b.b-none { background: #cfd6db; }
.glance-bars__meta { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.glance-bars__score { font-size: 12px; font-weight: 800; color: var(--muted); }
.glance__tags { display: grid; gap: 7px; }
.glance__chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; }
.glance__chips b { color: var(--muted); font-weight: 800; }
.glance__chip { padding: 3px 10px; border-radius: 999px; background: var(--teal-soft); color: var(--teal); font-weight: 800; }
.glance__todo { margin: 0; font-size: 12.5px; font-weight: 700; color: var(--coral); }
.glance__promise { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--panel); font-size: 12.5px; color: var(--muted); }
@media (max-width: 520px) { .glance__evidence-grid { grid-template-columns: 1fr; } .glance-bars__row { grid-template-columns: 88px minmax(0,1fr); } .glance-bars__meta { grid-column: 1 / -1; justify-content: flex-end; } }

.analysis-rows__band { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.analysis-rows__band.b-high { background: var(--teal-soft); color: var(--teal); }
.analysis-rows__band.b-mid { background: var(--navy-soft); color: var(--blue); }
.analysis-rows__band.b-low { background: var(--coral-soft); color: var(--coral); }
.analysis-rows__band.b-none { background: #eef1f3; color: var(--muted); }
.analysis-rows i { display: block; height: 6px; margin: 10px 0 0; overflow: hidden; background: #eceef0; border-radius: 999px; }
.analysis-rows i b { display: block; height: 100%; border-radius: 999px; background: var(--line-strong); }
.analysis-rows > article.is-high i b { background: var(--teal); }
.analysis-rows > article.is-mid i b { background: var(--blue); }
.analysis-rows > article.is-low i b { background: var(--coral); }
.analysis-rows p { margin: 9px 0 0; color: var(--text); font-size: 12.5px; line-height: 1.6; word-break: keep-all; }
.analysis-rows__evidence { margin-top: 10px; padding: 9px 10px; border-radius: 8px; background: var(--panel); }
.analysis-rows__evidence > b { display: block; margin-bottom: 5px; color: var(--navy); font-size: 11px; }
.analysis-rows__evidence ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.analysis-rows__evidence li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; color: var(--muted); font-size: 11.5px; line-height: 1.45; }
.analysis-rows__evidence li span { word-break: keep-all; }
.analysis-rows__evidence li strong { color: var(--ink-950); font-size: 11px; white-space: nowrap; }
@media (max-width: 520px) { .analysis-rows__evidence li { grid-template-columns: 1fr; gap: 2px; } .analysis-rows__evidence li strong { white-space: normal; } }

/* ③ 약점 카드: 실제 나타남(점수 근거) + NK 도움 2단 */
.weakness-cards { display: grid; gap: 8px; }
.weakness-note { margin: 0 0 2px; color: var(--muted); font-size: 12.5px; line-height: 1.5; }
.weakness-cards > article { padding: 15px 16px; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--coral); border-radius: 10px; }
.weakness-cards > article.is-high { border-left-color: var(--teal); }
.weakness-cards > article.is-mid { border-left-color: var(--blue); }
.weakness-cards > article.is-none { border-left-color: var(--line-strong); }
.weakness-cards header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.weakness-cards h4 { margin: 0; color: var(--ink-950); font-size: 13.5px; font-weight: 800; }
.weakness-cards__badge { display: inline-flex; align-items: baseline; gap: 8px; white-space: nowrap; }
.weakness-cards__badge > b { color: var(--navy); font-size: 14px; font-weight: 800; }
.weakness-cards .weak-manifest { margin: 9px 0 0; color: var(--text); font-size: 12.5px; line-height: 1.6; word-break: keep-all; }
.weakness-cards > article.is-none .weak-manifest { margin: 0; }
.weakness-cards .weak-help { margin: 8px 0 0; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12.5px; line-height: 1.55; word-break: keep-all; }
.weakness-cards .weak-help > b { margin-right: 5px; color: var(--brass-dark); font-weight: 800; }

.subject-notes { display: grid; gap: 12px; }
.subject-notes article { padding: 18px 20px; background: var(--ivory); border-radius: 12px; border-left: 4px solid var(--brass); }
.subject-notes article > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.subject-notes article > p { margin: 8px 0 0; color: var(--text); font-size: 13.5px; line-height: 1.75; word-break: keep-all; }

.plan-intro { padding: 20px 22px; background: var(--navy-soft); border-radius: 12px; border-left: 4px solid var(--navy); }
.plan-intro > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.plan-intro > p { margin: 8px 0 0; color: var(--text); font-size: 13.5px; line-height: 1.75; word-break: keep-all; }
.plan-intro > b { display: inline-block; margin-top: 10px; padding: 4px 11px; background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; color: var(--navy); font-size: 12px; font-weight: 800; }

.report-v2-genstamp { padding: 16px 40px 6px; color: var(--muted); font-size: 12px; font-weight: 600; text-align: right; }

/* ── 표지(상담자·다크 헤더) ────────────────────────────────── */
.report-v2-cover {
  position: relative; padding: 30px 40px 26px; overflow: hidden;
  background: var(--navy); border-radius: 12px 12px 0 0; color: #fff;
}
.cover-brand-line, .cover-footer {
  position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 16px;
  color: #aeb8c8; font-size: 12px; font-weight: 700; letter-spacing: 0.04em;
}
.cover-brand-line { padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.14); }
.cover-brand-line b { color: var(--brass-soft); }
.cover-layout {
  position: relative; z-index: 1; display: grid;
  grid-template-columns: minmax(0,1.25fr) minmax(280px,0.75fr); gap: 32px; align-items: center;
  padding: 22px 0;
}
.cover-copy > p { margin: 0 0 10px; color: var(--brass-soft); font-size: 12.5px; font-weight: 700; letter-spacing: 0.02em; }
.cover-copy h1 { margin: 0; color: #fff; font-size: 28px; font-weight: 800; line-height: 1.3; letter-spacing: -0.015em; word-break: keep-all; }
.cover-copy h1 em { color: #e8cf9d; font-style: normal; }
.cover-meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 6px 16px; color: #c4cede; font-size: 12.5px; font-weight: 600; }
.cover-meta span + span::before { margin-right: 16px; color: #55617a; content: "·"; }
.cover-verdict { padding: 20px; background: #fff; border-radius: 10px; color: var(--ink-950); }
.cover-verdict > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.cover-verdict strong, .cover-verdict b { display: block; }
.cover-verdict strong { margin-top: 8px; font-size: 18.5px; font-weight: 800; line-height: 1.32; }
.cover-verdict b { margin-top: 4px; color: var(--brass-dark); font-size: 13px; font-weight: 700; }
.cover-verdict p { margin: 11px 0 0; color: var(--text); font-size: 13px; line-height: 1.7; }
.cover-footer { padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.14); }

/* ── 섹션 + 번호 헤딩(화이트) ──────────────────────────────── */
.report-v2-section { padding: 36px 40px; border-bottom: 1px solid var(--line); scroll-margin-top: 76px; }
.luxury-section-heading { margin-bottom: 20px; }
.luxury-section-heading__row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
.luxury-section-heading__title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.luxury-section-heading__num {
  width: 30px; height: 30px; flex: 0 0 30px; display: grid; place-items: center;
  background: var(--navy); border-radius: 8px; color: #fff; font-size: 13px; font-weight: 800;
}
.luxury-section-heading h2 { margin: 0; color: var(--ink-950); font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
.luxury-section-heading__caption { margin: 11px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
.confidence-chip, .section-note, .fit-grade {
  padding: 5px 11px; border-radius: 999px; font-size: 12px; font-weight: 800; white-space: nowrap;
}
.confidence-chip { background: var(--teal-soft); color: var(--teal); }
.section-note { background: #eef1f3; color: var(--muted); }
.fit-grade { background: var(--brass-soft); color: var(--brass-dark); }

/* ── 핵심 지도 판정(다크 본문 패널) ─────────────────────────── */
.analysis-verdict { overflow: hidden; background: var(--navy); border-radius: 12px; color: #fff; }
.analysis-verdict__title { padding: 18px 22px 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.analysis-verdict__title > span { color: var(--brass-soft); font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.analysis-verdict__title > b {
  padding: 5px 10px; background: rgba(255,255,255,0.12); border-radius: 999px; color: #e8cf9d; font-size: 12px; font-weight: 700;
}
.analysis-verdict > h3 {
  max-width: 900px; margin: 13px 22px 0; font-size: 18.5px; font-weight: 800; line-height: 1.5; word-break: keep-all;
}
.analysis-verdict > h3 em { color: #e8cf9d; font-style: normal; }
.analysis-verdict__body { margin-top: 18px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); border-top: 1px solid rgba(255,255,255,0.12); }
.analysis-verdict__body p { margin: 0; padding: 16px 18px; color: #d7deea; font-size: 13.5px; line-height: 1.76; border-right: 1px solid rgba(255,255,255,0.12); word-break: keep-all; }
.analysis-verdict__body p:last-child { border-right: 0; }
.analysis-chain { margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); border-top: 1px solid rgba(255,255,255,0.12); }
.analysis-chain > div { padding: 15px 18px; border-right: 1px solid rgba(255,255,255,0.12); }
.analysis-chain > div:last-child { border-right: 0; }
.analysis-chain dt { color: var(--brass-soft); font-size: 12px; font-weight: 800; letter-spacing: 0.02em; }
.analysis-chain dd { margin: 6px 0 0; color: #fff; font-size: 12.5px; font-weight: 600; line-height: 1.55; }

/* ── 카드 공통(밝은 톤) ─────────────────────────────────────── */
.analysis-figure, .evidence-panel, .will-dossier, .coaching-dossier,
.personality-panel, .relation-panel, .legacy-list-panel, .gap-dossier, .roadmap-dossier,
.phone-feature, .teacher-brief, .consultation-context-dossier, .subject-v2-profile {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
}
.report-v2-section > * + * { margin-top: 14px; }

/* ── 시각 그리드(지도 방법 + 신호) ─────────────────────────── */
.analysis-visual-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.analysis-figure { padding: 20px; }
.analysis-figure figcaption { display: grid; gap: 4px; }
.analysis-figure figcaption span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.analysis-figure figcaption strong { color: var(--ink-950); font-size: 15px; font-weight: 700; }
.analysis-figure svg { width: 100%; height: auto; display: block; overflow: visible; margin-top: 8px; }
.analysis-figure > p { margin: 10px 0 0; padding: 12px 14px; background: var(--ivory); border-radius: 8px; color: var(--muted); font-size: 12.5px; line-height: 1.65; }
.analysis-figure > p strong { color: var(--ink-950); }

/* ── 교차 근거 ─────────────────────────────────────────────── */
.analysis-cross-evidence { padding: 20px; background: var(--ivory); border-radius: 12px; }
.analysis-cross-evidence > header h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink-950); }
.analysis-cross-evidence > div { margin-top: 14px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.analysis-cross-evidence article { padding: 14px; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
.analysis-cross-evidence article span { color: var(--blue); font-size: 12px; font-weight: 800; letter-spacing: 0.02em; }
.analysis-cross-evidence article p { margin: 6px 0 0; color: var(--text); font-size: 13px; line-height: 1.6; }

/* ── 핵심 지도 판정 요약 + 적합 인장 ───────────────────────── */
.executive-layout { display: grid; grid-template-columns: minmax(0,1.4fr) minmax(240px,0.6fr); gap: 14px; }
.executive-statement { padding: 24px; background: var(--ivory); border-radius: 12px; border-left: 4px solid var(--brass); }
.executive-statement > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.executive-statement h3 { margin: 10px 0 0; color: var(--ink-950); font-size: 17px; font-weight: 800; line-height: 1.5; word-break: keep-all; }
.executive-statement > p { margin: 12px 0 0; color: var(--text); font-size: 13.5px; line-height: 1.75; }
.executive-statement ul { margin: 14px 0 0; padding: 12px 0 0 18px; display: grid; gap: 6px; border-top: 1px solid var(--line-strong); color: var(--ink-800); font-size: 13px; font-weight: 600; }
.executive-statement__lead { font-weight: 600; color: var(--ink-900); }
.executive-statement__detail { margin: 14px 0 0; padding: 14px 0 0; border-top: 1px solid var(--line); display: grid; gap: 10px; }
.executive-statement__detail > summary { cursor: pointer; font-size: 13px; font-weight: 800; color: var(--blue); list-style: none; }
.executive-statement__detail > summary::-webkit-details-marker { display: none; }
.executive-statement__detail > summary::after { content: " ▾"; }
.executive-statement__detail[open] > summary::after { content: " ▴"; }
.executive-statement__detail p { margin: 0; color: var(--text); font-size: 13.5px; line-height: 1.78; word-break: keep-all; }
.summary-areas { margin: 16px 0 0; padding: 14px 0 0; border-top: 1px solid var(--line-strong); }
.summary-areas__title { display: block; color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.summary-areas__grid { margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.summary-areas__grid article { padding: 13px 14px; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--teal); border-radius: 10px; }
.summary-areas__grid article > span { color: var(--ink-950); font-size: 12.5px; font-weight: 800; }
.summary-areas__grid article > p { margin: 6px 0 0; color: var(--text); font-size: 12.5px; line-height: 1.62; word-break: keep-all; }
.fit-seal-panel { padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--navy-soft); border: 1px solid #d7deea; border-radius: 12px; text-align: center; }
.fit-seal-panel > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; }
.fit-seal { width: 96px; height: 96px; margin-top: 14px; display: grid; grid-template-columns: auto auto; place-content: center; align-items: end; border: 2px solid var(--brass); border-radius: 50%; }
.fit-seal strong { color: var(--navy); font-size: 28px; font-weight: 800; line-height: 1; }
.fit-seal small { padding-bottom: 3px; color: var(--muted); font-size: 12px; }
.fit-seal-panel h3 { margin: 13px 0 0; color: var(--navy); font-size: 14.5px; font-weight: 800; }
.fit-seal-panel p { margin: 8px 0 0; color: var(--text); font-size: 12.5px; line-height: 1.6; }

/* ── 핵심 신호 카드 ────────────────────────────────────────── */
.profile-signals { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.profile-signals article { padding: 15px; display: grid; grid-template-columns: minmax(0,1fr) auto; grid-template-rows: auto auto 1fr; gap: 3px 10px; background: #fff; border: 1px solid var(--line); border-top: 4px solid var(--teal); border-radius: 10px; }
.profile-signals article.is-caution { border-top-color: var(--coral); }
.profile-signals article > span { color: var(--muted); font-size: 12px; font-weight: 800; }
.profile-signals article > strong { color: var(--ink-950); font-size: 13px; font-weight: 800; }
.profile-signals article > b { grid-row: 1 / 3; grid-column: 2; color: var(--navy); font-size: 21px; font-weight: 800; }
.profile-signals article > p { grid-column: 1 / -1; margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }

/* ── 선생님 메모(밝은 카드) ────────────────────────────────── */
.teacher-brief { padding: 0; overflow: hidden; }
.teacher-brief__title { padding: 18px 22px; background: var(--ivory); border-bottom: 1px solid var(--line); }
.teacher-brief__title span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.teacher-brief__title h3 { margin: 6px 0 0; color: var(--ink-950); font-size: 15px; font-weight: 700; line-height: 1.5; }
.teacher-brief ol { margin: 0; padding: 8px 22px; list-style: none; }
.teacher-brief li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.teacher-brief li:last-child { border-bottom: 0; }
.teacher-brief li > span { flex: 0 0 auto; color: var(--brass-dark); font-size: 12.5px; font-weight: 800; }
.teacher-brief li p { margin: 0; color: var(--text); font-size: 13px; line-height: 1.6; }

/* ── 상담 배경(밝은 카드) ──────────────────────────────────── */
.consultation-context-dossier { overflow: hidden; }
.consultation-context-dossier > header { padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--ivory); border-bottom: 1px solid var(--line); }
.consultation-context-dossier > header h3 { margin: 0; color: var(--ink-950); font-size: 15px; font-weight: 700; }
.consultation-context-dossier > header > b { padding: 5px 10px; background: var(--blue-soft); border-radius: 999px; color: var(--blue); font-size: 11.5px; font-weight: 700; }
.context-meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); }
.context-meta-grid > div { padding: 14px 18px; display: grid; align-content: center; gap: 4px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.context-meta-grid > div:nth-child(3n) { border-right: 0; }
.context-meta-grid span { color: var(--muted); font-size: 12px; font-weight: 700; }
.context-meta-grid strong { color: var(--ink-950); font-size: 13px; font-weight: 700; line-height: 1.45; word-break: keep-all; }
.context-consult-questions { padding: 18px 22px; display: grid; grid-template-columns: minmax(240px,0.9fr) minmax(0,1.6fr); gap: 20px; align-items: center; background: var(--ivory); }
.context-consult-questions > div span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; }
.context-consult-questions > div strong { display: block; margin-top: 4px; color: var(--ink-950); font-size: 14px; font-weight: 700; line-height: 1.5; }
.context-consult-questions ol { margin: 0; padding: 0; display: grid; gap: 8px; list-style: none; }
.context-consult-questions li { display: grid; grid-template-columns: 26px minmax(0,1fr); gap: 8px; align-items: start; }
.context-consult-questions li b { color: var(--brass-dark); font-size: 12px; font-weight: 800; }
.context-consult-questions li p { margin: 0; color: var(--text); font-size: 12.5px; line-height: 1.55; }

/* ── 공용 패널 + 막대 ──────────────────────────────────────── */
.learning-panels, .will-guidance-grid, .personality-relation-grid, .strength-growth-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.evidence-panel, .will-dossier, .coaching-dossier, .personality-panel, .relation-panel, .legacy-list-panel { padding: 22px; }
.panel-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.panel-title > span { width: 100%; color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.panel-title h3 { margin: 0; color: var(--ink-950); font-size: 15.5px; font-weight: 700; }
.panel-title > b { color: var(--navy); font-size: 18px; font-weight: 800; }
.bullet-bars, .coaching-lines, .phone-bars { margin-top: 18px; display: grid; gap: 13px; }
.bullet-bars > div, .coaching-lines > div, .phone-bars > div { display: grid; grid-template-columns: minmax(96px, 40%) minmax(0,1fr) 34px; gap: 10px; align-items: center; }
.bullet-bars span, .coaching-lines span, .phone-bars span { color: var(--text); font-size: 12.5px; font-weight: 700; }
.bullet-bars i, .coaching-lines i, .phone-bars i { height: 8px; overflow: hidden; background: #eceef0; border-radius: 999px; }
.bullet-bars i b, .coaching-lines i b, .phone-bars i b { display: block; height: 100%; background: var(--teal); border-radius: 999px; }
.bullet-bars > div > strong, .coaching-lines > div > strong, .phone-bars > div > strong { color: var(--navy); font-size: 12.5px; font-weight: 800; text-align: right; }
/* 라벨 아래 한 줄 풀이(작은 회색 글씨). 3열 그리드에서 전체 너비로 줄바꿈. */
.bullet-bars > div > small, .coaching-lines > div > small, .phone-bars > div > small { grid-column: 1 / -1; margin-top: 1px; color: var(--muted); font-size: 12px; line-height: 1.4; }
.phone-bars > div > small { color: var(--muted); }
.bullet-bars .is-caution i b, .phone-bars .is-caution i b { background: var(--coral); }
.coaching-lines i b { background: var(--blue); }
.evidence-explain { margin: 18px 0 0; padding-top: 14px; border-top: 1px solid var(--line); color: var(--text); font-size: 13px; line-height: 1.7; }
.evidence-explain strong { margin-right: 5px; color: var(--ink-950); }

/* ── 의지×회복 / 코칭(밝은 인용) ───────────────────────────── */
.coaching-dossier blockquote { margin: 18px 0 0; padding: 16px; background: var(--ivory); border-left: 3px solid var(--brass); border-radius: 0 8px 8px 0; }
.coaching-dossier blockquote strong { color: var(--navy); font-size: 14px; font-weight: 800; }
.coaching-dossier blockquote p { margin: 6px 0 0; color: var(--text); font-size: 13px; line-height: 1.65; }
.will-dossier > p { margin: 18px 0 0; padding-top: 14px; border-top: 1px solid var(--line); color: var(--text); font-size: 13px; line-height: 1.7; }

/* ── 휴대폰(밝은 카드) ─────────────────────────────────────── */
.phone-feature { display: grid; grid-template-columns: 240px minmax(0,1fr); overflow: hidden; }
.phone-score-block { padding: 24px; display: flex; flex-direction: column; justify-content: center; background: var(--navy-soft); border-right: 1px solid var(--line); }
.phone-score-block > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; }
.phone-score-block > strong { margin-top: 8px; color: var(--navy); font-size: 34px; font-weight: 800; line-height: 1; }
.phone-score-block > b { margin-top: 8px; color: var(--ink-950); font-size: 13.5px; font-weight: 700; }
.phone-score-block > p { margin: 8px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.phone-analysis { padding: 22px; }
.phone-bars { margin-top: 0; }

/* ── 성격(MBTI)/친구(밝은) ─────────────────────────────────── */
.personality-panel > p { margin: 14px 0 0; color: var(--text); font-size: 13px; line-height: 1.75; }
.mbti-adjustment-panel { margin-top: 16px; background: var(--blue-soft); border-radius: 10px; overflow: hidden; }
.mbti-adjustment-panel > div { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #d4e0e8; }
.mbti-adjustment-panel > div span { color: var(--blue); font-size: 12px; font-weight: 800; letter-spacing: 0.02em; }
.mbti-adjustment-panel > div strong { color: var(--ink-950); font-size: 12.5px; font-weight: 700; }
.mbti-adjustment-panel dl { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }
.mbti-adjustment-panel dl > div { padding: 12px 14px; border-right: 1px solid #d4e0e8; border-bottom: 1px solid #d4e0e8; }
.mbti-adjustment-panel dl > div:nth-child(2n) { border-right: 0; }
.mbti-adjustment-panel dt { color: var(--text); font-size: 12.5px; font-weight: 700; }
.mbti-adjustment-panel dd { margin: 7px 0 0; display: grid; grid-template-columns: 1fr auto auto; gap: 7px; align-items: baseline; }
.mbti-adjustment-panel dd span { color: var(--muted); font-size: 12px; }
.mbti-adjustment-panel dd b { color: var(--brass-dark); font-size: 12px; font-weight: 700; }
.mbti-adjustment-panel dd strong { color: var(--blue); font-size: 14px; font-weight: 800; }
.mbti-adjustment-panel > p { margin: 0; padding: 11px 14px; color: var(--muted); font-size: 12px; line-height: 1.55; }
.personality-panel > small { display: block; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.55; }
.spectrum-list { margin-top: 18px; display: grid; gap: 16px; }
.spectrum-list > div { display: grid; grid-template-columns: 84px minmax(0,1fr) 84px; gap: 8px; align-items: center; }
.spectrum-list span { color: var(--muted); font-size: 12px; font-weight: 700; }
.spectrum-list span:last-child { text-align: right; }
.spectrum-list i { position: relative; height: 3px; background: var(--line-strong); border-radius: 999px; }
.spectrum-list i b { position: absolute; top: 50%; width: 14px; height: 14px; background: var(--brass); border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px var(--brass-dark); transform: translate(-50%, -50%); }
.relation-signals { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.relation-signals > div { padding: 14px; background: var(--teal-soft); border-radius: 10px; }
.relation-signals > div.is-caution { background: var(--coral-soft); }
.relation-signals span { color: var(--muted); font-size: 12px; font-weight: 800; }
.relation-signals strong { margin-top: 4px; display: block; color: var(--navy); font-size: 18px; font-weight: 800; }
.relation-signals p { margin: 5px 0 0; color: var(--text); font-size: 12px; line-height: 1.5; }
.relation-note { margin: 14px 0 0; padding-top: 13px; border-top: 1px solid var(--line); color: var(--text); font-size: 12.5px; line-height: 1.65; }
.relation-note strong { margin-right: 5px; color: var(--ink-950); }

/* ── NK 적합(밝은) ─────────────────────────────────────────── */
.fit-intro { padding: 24px; display: grid; grid-template-columns: minmax(0,1.1fr) minmax(240px,0.9fr); gap: 24px; align-items: center; background: var(--ivory); border-left: 4px solid var(--brass); border-radius: 12px; }
.fit-intro h3 { margin: 0; color: var(--ink-950); font-size: 15.5px; font-weight: 800; line-height: 1.55; word-break: keep-all; }
.fit-intro h3 em { color: var(--brass-dark); font-style: normal; }
.fit-intro p { margin: 0; color: var(--text); font-size: 13px; line-height: 1.75; }
.fit-feature-list { margin-top: 14px; display: grid; gap: 10px; }
.fit-feature-list article { padding: 18px 20px; display: grid; grid-template-columns: 200px 240px minmax(0,1fr); gap: 18px; align-items: center; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--brass); border-radius: 10px; }
.fit-feature-list article > div:first-child span { display: block; color: var(--muted); font-size: 12px; font-weight: 800; }
.fit-feature-list article > div:first-child strong { display: block; margin-top: 6px; color: var(--ink-950); font-size: 13.5px; font-weight: 800; }
.fit-feature-list article > p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.6; }
.dual-fit { display: grid; gap: 9px; }
.dual-fit p { margin: 0; display: grid; grid-template-columns: 60px 32px minmax(0,1fr); gap: 7px; align-items: center; color: var(--muted); font-size: 12px; font-weight: 700; }
.dual-fit p b { color: var(--navy); font-weight: 800; text-align: right; }
.dual-fit p i { height: 6px; overflow: hidden; background: #eceef0; border-radius: 999px; }
.dual-fit p em { display: block; height: 100%; background: var(--teal); border-radius: 999px; }
.dual-fit p:nth-child(2) em { background: var(--brass); }
.fit-consult-note { margin-top: 12px; padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; background: var(--brass-soft); border-radius: 10px; }
.fit-consult-note > div span { display: block; color: var(--brass-dark); font-size: 12px; font-weight: 800; }
.fit-consult-note > div strong { display: block; margin-top: 5px; color: var(--ink-950); font-size: 12.5px; font-weight: 700; }
.fit-consult-note > p { grid-column: 1 / -1; margin: 0; padding-top: 12px; border-top: 1px solid rgba(138,100,34,0.2); color: #6b542a; font-size: 12px; line-height: 1.6; }

/* ── 과목 전략(밝은) ───────────────────────────────────────── */
.subject-dossier { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
.subject-dossier__head { margin-bottom: 14px; }
.subject-dossier__head span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.subject-dossier__head h3 { margin: 4px 0 0; color: var(--ink-950); font-size: 15.5px; font-weight: 800; }
.subject-v2-profile { display: grid; grid-template-columns: 240px minmax(0,1fr); overflow: hidden; margin-bottom: 10px; }
.subject-v2-summary { padding: 22px; background: var(--navy-soft); border-right: 1px solid var(--line); }
.subject-v2-summary > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; }
.subject-v2-summary h4 { margin: 5px 0 14px; color: var(--ink-950); font-size: 15px; font-weight: 800; }
.subject-v2-summary > div { display: flex; align-items: end; gap: 4px; }
.subject-v2-summary > div strong { color: var(--navy); font-size: 30px; font-weight: 800; line-height: 1; }
.subject-v2-summary > div small { padding-bottom: 4px; color: var(--muted); font-size: 12px; }
.subject-v2-summary > p { margin: 9px 0 0; color: var(--text); font-size: 12.5px; line-height: 1.7; }
.subject-v2-details { padding: 20px; }
.subject-v2-metrics { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.subject-v2-metrics > div { padding: 14px; display: grid; grid-template-columns: minmax(0,1fr) auto; grid-template-rows: auto auto auto; gap: 5px 8px; background: var(--ivory); border-radius: 10px; }
.subject-v2-metrics span { color: var(--muted); font-size: 12px; font-weight: 800; }
.subject-v2-metrics strong { grid-row: 1 / 3; grid-column: 2; color: var(--navy); font-size: 18px; font-weight: 800; }
.subject-v2-metrics i { grid-column: 1 / -1; height: 8px; overflow: hidden; background: #eceef0; border-radius: 999px; }
.subject-v2-metrics i b { display: block; height: 100%; background: var(--teal); border-radius: 999px; }
.subject-v2-metrics .is-caution i b { background: var(--coral); }
.subject-v2-metrics p { grid-column: 1 / -1; margin: 3px 0 0; color: var(--muted); font-size: 12px; }
/* 과목 지표는 ScoreRow(위험축 반전 렌더)를 쓴다. ScoreRow가 인라인 스타일을 직접 들고 있어
   자손 선택자 없이 배치만 잡는다. */
.subject-v2-scorerows { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 4px 18px; }

/* ── 강점·개선(넘버 리스트) + 간극 + 로드맵 + 최종(밝은) ───── */
.legacy-list-panel ol { margin: 16px 0 0; padding: 0; list-style: none; }
.legacy-list-panel li { padding: 13px 0; display: flex; gap: 12px; border-bottom: 1px solid var(--line); }
.legacy-list-panel li:last-child { border-bottom: 0; }
.legacy-list-panel li > span { width: 24px; height: 24px; flex: 0 0 24px; display: grid; place-items: center; background: var(--teal-soft); border-radius: 50%; color: var(--teal); font-size: 12px; font-weight: 800; }
.growth-panel li > span { background: var(--coral-soft); color: var(--coral); }
.legacy-list-panel li p { margin: 0; color: var(--text); font-size: 13px; line-height: 1.65; }
.gap-dossier, .roadmap-dossier { padding: 22px; }
.gap-rows { margin-top: 16px; display: grid; gap: 10px; }
.gap-rows article { padding: 16px; display: grid; grid-template-columns: 180px 180px minmax(0,1fr); gap: 16px; align-items: center; background: var(--ivory); border-radius: 10px; }
.gap-rows article > div:first-child span { display: block; color: var(--brass-dark); font-size: 12px; font-weight: 800; }
.gap-rows article > div:first-child strong { display: block; margin-top: 4px; color: var(--ink-950); font-size: 12.5px; font-weight: 700; }
.gap-rows article > p { margin: 0; color: var(--text); font-size: 12.5px; line-height: 1.65; }
.gap-values { display: grid; grid-template-columns: 1fr 14px 1fr; gap: 5px; align-items: center; }
.gap-values p { margin: 0; padding: 8px; background: #fff; border-radius: 8px; color: var(--muted); font-size: 12px; text-align: center; }
.gap-values p b { margin-left: 3px; color: var(--navy); font-size: 13.5px; font-weight: 800; }
.gap-values i { height: 2px; background: var(--brass); }
.roadmap-line { margin-top: 16px; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.roadmap-line article { padding: 18px; background: #fff; border-right: 1px solid var(--line); }
.roadmap-line article:last-child { border-right: 0; }
.roadmap-line span { color: var(--brass-dark); font-size: 12px; font-weight: 800; }
.roadmap-line strong { margin-top: 8px; display: block; color: var(--ink-950); font-size: 13.5px; font-weight: 700; }
.roadmap-line p { margin: 8px 0 0; color: var(--text); font-size: 12.5px; line-height: 1.65; }
.roadmap-line small { margin-top: 12px; display: block; padding-top: 9px; border-top: 1px solid var(--line); color: var(--teal); font-size: 12px; font-weight: 800; }
.verify-line { margin-top: 12px; padding: 20px 22px; background: var(--ivory); border-left: 4px solid var(--brass); border-radius: 0 12px 12px 0; }
.verify-line > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; }
.verify-line ul { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.verify-line li { display: flex; gap: 10px; color: var(--text); font-size: 13px; line-height: 1.55; }
.verify-line li::before { content: "✓"; color: var(--teal); font-weight: 800; }
.transition-contract { margin-top: 14px; padding: 20px; background: #fbfaf7; border: 1px solid #e3ddcf; border-left: 4px solid var(--brass); border-radius: 0 12px 12px 0; }
.transition-contract > header span { color: var(--brass-dark); font-size: 11.5px; font-weight: 800; letter-spacing: 0.05em; }
.transition-contract > header h3 { margin: 5px 0 0; color: var(--navy); font-size: 15px; font-weight: 800; line-height: 1.45; }
.transition-contract > header p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.transition-contract__grid { margin-top: 14px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.transition-contract__grid article { padding: 14px; background: #fff; border: 1px solid var(--line); border-radius: 9px; }
.transition-contract__grid article > span { color: var(--brass-dark); font-size: 10.5px; font-weight: 800; }
.transition-contract__grid h4 { margin: 5px 0 0; color: var(--ink-950); font-size: 13px; font-weight: 800; line-height: 1.45; }
.transition-contract__grid p { margin: 7px 0 0; color: var(--text); font-size: 12px; line-height: 1.6; }
.transition-contract__grid small { display: block; margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.55; }
.transition-contract__grid small b { color: var(--teal); }
.final-guidance { margin-top: 12px; padding: 26px; background: var(--navy-soft); border-left: 4px solid var(--navy); border-radius: 0 12px 12px 0; }
.final-guidance > span { color: var(--brass-dark); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.final-guidance h3 { margin: 10px 0 0; color: var(--navy); font-size: 16.5px; font-weight: 800; line-height: 1.55; word-break: keep-all; }
.final-guidance p { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid #d7deea; color: var(--text); font-size: 13px; line-height: 1.8; word-break: keep-all; }
.report-v2-caution { padding: 22px 40px; display: grid; grid-template-columns: 90px minmax(0,1fr); gap: 18px; background: #f2f4f5; border-radius: 0 0 12px 12px; }
.report-v2-caution strong { color: var(--ink-950); font-size: 12.5px; font-weight: 800; }
.report-v2-caution p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }

/* ── 하단 고정 dock(얇은 다크 필) ──────────────────────────── */
.report-dock {
  position: fixed; z-index: 120; bottom: max(14px, env(safe-area-inset-bottom)); left: 50%;
  width: min(660px, calc(100% - 24px)); padding: 5px;
  /* 항목 수가 6~7개로 늘어 auto-fit으로 바꾼다(과목 섹션 유무에 따라 가변). */
  display: grid; grid-template-columns: repeat(auto-fit, minmax(0,1fr)); gap: 4px;
  background: rgba(20,30,50,0.96); border: 1px solid rgba(176,132,47,0.5); border-radius: 12px;
  box-shadow: 0 10px 30px rgba(16,23,34,0.28); backdrop-filter: blur(14px); transform: translateX(-50%);
}
.report-dock button { min-height: 46px; padding: 4px 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: transparent; border: 0; border-radius: 8px; color: #b3bccb; }
.report-dock button.is-active { background: #fff; color: var(--navy); }
.report-dock b { color: var(--brass-soft); font-size: 10.5px; font-weight: 800; }
.report-dock button.is-active b { color: var(--brass-dark); }
.report-dock span { font-size: 11.5px; font-weight: 800; white-space: nowrap; }

/* ── 모바일(카카오 인앱 우선, ≤760) ─────────────────────────── */
@media (max-width: 760px) {
  .rptv2-doc { font-size: 14.5px; }
  .report-v2-toolbar__inner { width: calc(100% - 24px); min-height: 54px; }
  .report-v2-toolbar .premium-brand small { display: none; }
  .report-v2-wrap, .rptv2-doc.parent-mode .report-v2-wrap { width: 100%; margin-top: 0; border-radius: 0; box-shadow: none; padding-bottom: 92px; }
  .report-v2-cover { padding: 22px 16px 18px; border-radius: 0; }
  .report-v2-band { padding: 18px 16px 15px; border-radius: 0; }
  .report-v2-band h1 { font-size: 19px; }
  .cover-layout { grid-template-columns: 1fr; gap: 18px; padding: 18px 0; }
  .cover-copy h1 { font-size: 23px; }
  .report-v2-section { padding: 26px 16px; }
  .luxury-section-heading h2 { font-size: 17px; }
  .executive-layout, .phone-feature, .fit-intro, .subject-v2-profile,
  .learning-panels, .will-guidance-grid, .personality-relation-grid, .strength-growth-grid,
  .analysis-verdict__body, .analysis-visual-grid, .analysis-cross-evidence > div,
  .context-consult-questions, .fit-consult-note { grid-template-columns: 1fr; }
  .analysis-verdict__body p { border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .analysis-verdict__body p:last-child { border-bottom: 0; }
  .analysis-chain, .context-meta-grid, .profile-signals, .summary-areas__grid { grid-template-columns: 1fr; }
  .analysis-chain > div { border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .context-meta-grid > div, .context-meta-grid > div:nth-child(3n) { border-right: 0; }
  .analysis-verdict > h3 { font-size: 17.5px; margin: 12px 16px 0; }
  .analysis-verdict__title { padding: 16px 16px 0; }
  .fit-feature-list article, .gap-rows article { grid-template-columns: 1fr; gap: 12px; }
  .mbti-adjustment-panel dl { grid-template-columns: 1fr; }
  .mbti-adjustment-panel dl > div { border-right: 0; }
  .subject-v2-metrics, .subject-v2-scorerows, .relation-signals { grid-template-columns: 1fr; }
  .roadmap-line { grid-template-columns: 1fr; }
  .transition-contract__grid { grid-template-columns: 1fr; }
  .roadmap-line article { border-right: 0; border-bottom: 1px solid var(--line); }
  .roadmap-line article:last-child { border-bottom: 0; }
  .phone-score-block { border-right: 0; border-bottom: 1px solid var(--line); }
  .spectrum-list > div { grid-template-columns: 70px minmax(0,1fr) 70px; }
  .report-v2-caution { grid-template-columns: 1fr; gap: 6px; padding: 20px 16px; }
  .report-v2-genstamp { padding: 14px 16px 2px; }
  .evidence-panel, .will-dossier, .coaching-dossier, .personality-panel, .relation-panel,
  .legacy-list-panel, .gap-dossier, .roadmap-dossier, .executive-statement, .fit-intro,
  .phone-analysis, .analysis-figure { padding: 16px; }
  .report-dock { left: 0; right: 0; bottom: 0; width: 100%; border-radius: 0; transform: none; padding: 5px 8px calc(5px + env(safe-area-inset-bottom)); }
}
@media (max-width: 400px) {
  .cover-copy h1 { font-size: 21px; }
  .report-v2-band h1 { font-size: 18px; }
  .luxury-section-heading__num { width: 28px; height: 28px; flex-basis: 28px; }
}

/* ── 인쇄(A4 세로 다중페이지) ─────────────────────────────── */
@media print {
  @page { size: A4 portrait; margin: 0; }
  @page { @bottom-right { content: counter(page); font-size: 9pt; color: #7c8794; } }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  .rptv2-doc { background: #fff !important; }
  .report-v2-toolbar, .report-dock, .rptv2-noprint { display: none !important; }
  .report-v2-wrap, .rptv2-doc.parent-mode .report-v2-wrap { width: 210mm; max-width: none; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }
  .report-v2-cover { border-radius: 0; padding: 16mm 16mm 12mm; }
  .report-v2-band { border-radius: 0; padding: 12mm 16mm; }
  .report-v2-section { padding: 14mm 14mm; }
  /* 현행 섹션에서 페이지를 나눈다(죽은 ID #sec-learning·#sec-life·#sec-fit·#sec-solution 제거). */
  #sec-strength, #sec-weakness, #sec-signals, #sec-plan { break-before: page; page-break-before: always; }
  .consultation-context-dossier { break-before: page; page-break-before: always; break-inside: avoid; page-break-inside: avoid; }
  .luxury-section-heading, .subject-dossier__head, .panel-title { break-after: avoid; page-break-after: avoid; }
  .summary-areas__grid article, .summary-areas__title, .executive-statement__detail p,
  .analysis-verdict, .analysis-figure, .analysis-cross-evidence, .executive-layout, .profile-signals,
  .teacher-brief, .consultation-context-dossier > header, .context-meta-grid, .context-consult-questions,
  .learning-panels, .will-guidance-grid, .phone-feature, .personality-relation-grid, .mbti-adjustment-panel,
  .fit-intro, .fit-consult-note, .strength-growth-grid, .roadmap-line, .final-guidance, .verify-line,
  .report-v2-caution, .evidence-panel, .will-dossier, .coaching-dossier, .personality-panel, .relation-panel,
  .legacy-list-panel, .fit-feature-list article, .gap-rows article, .roadmap-line article, .subject-v2-profile,
  .glance, .glance-bars__row, .insight-cards article, .weakness-cards > article, .analysis-rows > article,
  .subject-notes article, .plan-intro, .transition-contract, .transition-contract__grid article, .spectrum-card, .spectrum__row {
    break-inside: avoid; page-break-inside: avoid;
  }
  /* 접어 둔 총평은 인쇄물에서 항상 펼친다(종이에는 "더 보기"가 없다). */
  details.executive-statement__detail { display: block !important; }
  details.executive-statement__detail > summary { display: none !important; }
  details.executive-statement__detail > * { display: block !important; }
  details.report-expandable > summary { display: none !important; }
  details.report-expandable > * { display: block !important; }
  p, li, blockquote { orphans: 3; widows: 3; }
  svg { max-width: 100%; height: auto; shape-rendering: geometricPrecision; text-rendering: geometricPrecision; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}

/* ── 학부모 결과보고서 3판(v2.3) ─────────────────────────────────── */
.rptv2-doc .pr3-cover { background: #152033; color: #fff; padding: 22px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.rptv2-doc .pr3-cover__brand { display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 700; color: #aeb8c8; letter-spacing: 0.04em; }
.rptv2-doc .pr3-cover__brand em { margin-left: auto; font-style: normal; color: #8c99ac; }
.rptv2-doc .pr3-cover__mark { width: 26px; height: 26px; display: grid; place-items: center; background: rgba(255,255,255,0.14); border-radius: 6px; color: #e8cf9d; font-size: 11.5px; font-weight: 800; }
.rptv2-doc .pr3-cover h1 { margin: 4px 0 0; font-size: 22px; line-height: 1.3; letter-spacing: -0.02em; color: #fff; }
.rptv2-doc .pr3-cover__sub { margin: 0; color: #c4cede; font-size: 14px; font-weight: 700; }
.rptv2-doc .pr3-cover__info { margin: 6px 0 0; display: grid; grid-template-columns: 1fr; gap: 0; border-top: 1px solid rgba(255,255,255,0.12); }
.rptv2-doc .pr3-cover__info > div { display: grid; grid-template-columns: 78px minmax(0,1fr); gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.12); }
.rptv2-doc .pr3-cover__info dt { color: #8c99ac; font-size: 11px; font-weight: 700; }
.rptv2-doc .pr3-cover__info dd { margin: 0; color: #dbe2ed; font-size: 11.5px; }
.rptv2-doc .pr3-lead { margin: 0 0 6px; font-size: 13.5px; line-height: 1.72; color: var(--text); }
.rptv2-doc .pr3-lead b { color: #152033; }
.rptv2-doc .pr3-lead--navy { color: #152033; font-weight: 800; font-size: 15px; line-height: 1.55; }
.rptv2-doc .pr3-sub { margin: 0 0 14px; font-size: 13px; line-height: 1.72; color: var(--muted); }
.rptv2-doc .pr3-note { margin: 10px 0 0; font-size: 11.5px; line-height: 1.65; color: var(--muted); }
.rptv2-doc .pr3-h3 { margin: 16px 0 8px; font-size: 13.5px; font-weight: 800; color: #152033; }
.rptv2-doc .pr3-eyebrow { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: #b88a32; margin-bottom: 6px; }
.rptv2-doc .pr3-table { width: 100%; border-collapse: collapse; border: 1px solid var(--line-strong); font-size: 12.5px; }
.rptv2-doc .pr3-table th, .rptv2-doc .pr3-table td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.rptv2-doc .pr3-table thead th { background: #f4f6f6; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; color: var(--muted); }
.rptv2-doc .pr3-table td b { display: block; color: #152033; font-weight: 700; }
.rptv2-doc .pr3-table td span { display: block; margin-top: 3px; font-size: 11.5px; color: var(--muted); line-height: 1.6; }
.rptv2-doc .pr3-table td.is-good { color: var(--teal); font-weight: 700; white-space: nowrap; }
.rptv2-doc .pr3-table td.is-watch { color: #8a6422; font-weight: 700; white-space: nowrap; }
.rptv2-doc .pr3-table td.is-help { color: var(--coral); font-weight: 700; white-space: nowrap; }
.rptv2-doc .pr3-table--guidance th { width: 84px; background: #f4f6f6; font-size: 11px; color: var(--muted); font-weight: 700; }
.rptv2-doc .pr3-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.rptv2-doc .pr3-badge.is-good { background: var(--teal-soft); color: var(--teal); }
.rptv2-doc .pr3-badge.is-watch { background: #f3ead8; color: #8a6422; }
.rptv2-doc .pr3-badge.is-help { background: var(--coral-soft); color: var(--coral); }
.rptv2-doc .pr3-badge.is-none { background: #eef0f3; color: var(--muted); }
.rptv2-doc .pr3-badge.is-big { padding: 5px 14px; font-size: 13px; font-weight: 800; }
.rptv2-doc .pr3-zone { position: relative; display: grid; grid-template-columns: 62.5fr 12.5fr 25fr; height: 10px; }
.rptv2-doc .pr3-zone__help { background: var(--coral-soft); border-right: 1px solid #fff; }
.rptv2-doc .pr3-zone__watch { background: #f3ead8; border-right: 1px solid #fff; }
.rptv2-doc .pr3-zone__good { background: var(--teal-soft); }
.rptv2-doc .pr3-zone__marker { position: absolute; top: -4px; width: 3px; height: 18px; transform: translateX(-1.5px); }
.rptv2-doc .pr3-rows { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
.rptv2-doc .pr3-rows__row { display: flex; flex-direction: column; gap: 7px; }
.rptv2-doc .pr3-rows__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.rptv2-doc .pr3-rows__head h4 { margin: 0; font-size: 13px; color: #152033; }
.rptv2-doc .pr3-rows__divider { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: var(--muted); padding-top: 6px; border-top: 1px dashed var(--line); }
.rptv2-doc .pr3-legend { list-style: none; margin: 8px 0 0; padding: 9px 11px; background: #f4f6f6; display: flex; gap: 12px; font-size: 10.5px; font-weight: 700; color: var(--muted); }
.rptv2-doc .pr3-legend li { display: flex; align-items: center; gap: 5px; }
.rptv2-doc .pr3-legend i { width: 9px; height: 9px; display: inline-block; }
.rptv2-doc .pr3-svg { width: 100%; height: auto; display: block; margin: 4px 0; }
.rptv2-doc .pr3-verdict { display: flex; flex-direction: column; gap: 10px; padding: 16px 0 18px; border-bottom: 1px solid var(--line); }
.rptv2-doc .pr3-verdict:last-child { border-bottom: 0; }
.rptv2-doc .pr3-verdict__q { margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.6; }
.rptv2-doc .pr3-verdict__badge { align-self: flex-start; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 800; background: #eef0f3; color: var(--muted); }
.rptv2-doc .pr3-verdict__badge.is-good { background: var(--teal-soft); color: var(--teal); }
.rptv2-doc .pr3-verdict__badge.is-watch { background: #f3ead8; color: #8a6422; }
.rptv2-doc .pr3-verdict__badge.is-help { background: var(--coral-soft); color: var(--coral); }
.rptv2-doc .pr3-verdict__body { margin: 0; font-size: 13.5px; line-height: 1.72; color: var(--text); }
.rptv2-doc .pr3-verdict__direct { margin: 0; padding: 10px 12px; background: #f4f6f6; display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; }
.rptv2-doc .pr3-verdict__direct span { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; color: var(--muted); }
.rptv2-doc .pr3-verdict__direct b { color: #152033; }
.rptv2-doc .pr3-verdict__basis { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 11.5px; color: var(--muted); }
.rptv2-doc .pr3-verdict__basis span { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; width: 100%; }
.rptv2-doc .pr3-verdict__basis b { display: inline-flex; align-items: center; gap: 6px; color: #152033; font-weight: 700; }
.rptv2-doc .pr3-qs { display: flex; flex-direction: column; gap: 18px; }
.rptv2-doc .pr3-q { display: flex; flex-direction: column; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.rptv2-doc .pr3-q:last-child { border-bottom: 0; }
.rptv2-doc .pr3-q header { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; gap: 9px; align-items: start; }
.rptv2-doc .pr3-q__num { width: 22px; height: 22px; display: grid; place-items: center; background: #152033; color: #fff; font-size: 10.5px; font-weight: 700; border-radius: 3px; }
.rptv2-doc .pr3-q h4 { margin: 0; font-size: 14px; color: #152033; }
.rptv2-doc .pr3-q__question { margin: 2px 0 0; font-size: 11.5px; color: var(--muted); }
.rptv2-doc .pr3-q__answer { margin: 0; font-size: 14px; font-weight: 800; color: #152033; }
.rptv2-doc .pr3-q.is-help .pr3-q__answer { color: var(--coral); }
.rptv2-doc .pr3-q.is-watch .pr3-q__answer { color: #8a6422; }
.rptv2-doc .pr3-q.is-good .pr3-q__answer { color: var(--teal); }
.rptv2-doc .pr3-q__state { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--text); }
.rptv2-doc .pr3-q__direct { margin: 0; padding: 8px 11px; background: #f4f6f6; font-size: 12px; color: #152033; font-weight: 700; }
.rptv2-doc .pr3-q__help { margin: 0; display: grid; grid-template-columns: 62px minmax(0,1fr); gap: 9px; font-size: 12px; line-height: 1.62; color: var(--muted); }
.rptv2-doc .pr3-q__help span { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: #152033; white-space: nowrap; }
.rptv2-doc .pr3-chips-block { display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px; }
.rptv2-doc .pr3-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rptv2-doc .pr3-chips span { padding: 5px 11px; border-radius: 999px; background: #152033; color: #fff; font-size: 11.5px; font-weight: 700; }
.rptv2-doc .pr3-answers { margin: 0; display: flex; flex-direction: column; border: 1px solid var(--line-strong); }
.rptv2-doc .pr3-answers > div { padding: 11px 12px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.rptv2-doc .pr3-answers > div:last-child { border-bottom: 0; }
.rptv2-doc .pr3-answers dt { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--muted); }
.rptv2-doc .pr3-answers dd { margin: 0; font-size: 13px; line-height: 1.7; color: #152033; }
.rptv2-doc .pr3-subjects { display: flex; flex-direction: column; gap: 14px; }
.rptv2-doc .pr3-subjects article { display: flex; flex-direction: column; gap: 8px; }
.rptv2-doc .pr3-subjects header { display: flex; justify-content: space-between; align-items: baseline; }
.rptv2-doc .pr3-subjects h4 { margin: 0; font-size: 13.5px; color: #152033; }
.rptv2-doc .pr3-subjects p { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--text); }
.rptv2-doc .pr3-summary { display: flex; flex-direction: column; gap: 10px; }
.rptv2-doc .pr3-summary p { margin: 0; font-size: 13px; line-height: 1.78; color: var(--text); }
.rptv2-doc .pr3-summary__mbti { padding: 10px 12px; background: #f4f6f6; color: var(--muted) !important; font-size: 12.5px !important; }
.rptv2-doc .pr3-transition { margin-bottom: 14px; }
.rptv2-doc .pr3-transition ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rptv2-doc .pr3-transition li { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: baseline; padding: 8px 11px; background: #f4f6f6; font-size: 12px; }
.rptv2-doc .pr3-transition li b { color: #152033; }
.rptv2-doc .pr3-transition li span { color: var(--muted); font-size: 11.5px; }
.rptv2-doc .pr3-timeline__strip { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 2px; margin: 4px 0 10px; }
.rptv2-doc .pr3-timeline__strip span { padding: 6px 0; text-align: center; font-size: 10.5px; font-weight: 700; color: #fff; }
.rptv2-doc .pr3-timeline__strip .is-0 { background: #152033; }
.rptv2-doc .pr3-timeline__strip .is-1 { background: #b88a32; }
.rptv2-doc .pr3-timeline__strip .is-2 { background: #2d776a; }
.rptv2-doc .pr3-timeline__cards { display: flex; flex-direction: column; gap: 10px; }
.rptv2-doc .pr3-timeline__cards article { border: 1px solid var(--line-strong); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.rptv2-doc .pr3-timeline__cards article > b { font-size: 12.5px; color: #152033; }
.rptv2-doc .pr3-timeline__cards dl { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.rptv2-doc .pr3-timeline__cards dl > div { display: grid; grid-template-columns: 34px minmax(0,1fr); gap: 8px; font-size: 12px; line-height: 1.62; }
.rptv2-doc .pr3-timeline__cards dt { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: var(--muted); }
.rptv2-doc .pr3-timeline__cards dd { margin: 0; color: var(--text); display: flex; flex-direction: column; gap: 2px; }
.rptv2-doc .pr3-parent { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rptv2-doc .pr3-parent li { display: grid; grid-template-columns: 18px minmax(0,1fr); gap: 8px; padding: 13px 0; border-bottom: 1px solid var(--line); }
.rptv2-doc .pr3-parent__num { font-size: 11px; font-weight: 700; color: #b88a32; }
.rptv2-doc .pr3-parent li > div > p { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #152033; line-height: 1.62; }
.rptv2-doc .pr3-parent__opts { display: flex; flex-wrap: wrap; gap: 6px; }
.rptv2-doc .pr3-parent__opts span { padding: 5px 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: #fff; color: var(--muted); font-size: 11.5px; font-weight: 700; }
.rptv2-doc .pr3-parent__blank { display: grid !important; grid-template-columns: auto minmax(0,1fr); gap: 8px; align-items: end; margin: 8px 0 0 !important; font-weight: 400 !important; }
.rptv2-doc .pr3-parent__blank span, .rptv2-doc .pr3-parent__blanks span { font-size: 10px; font-weight: 700; color: #94a3b8; }
.rptv2-doc .pr3-parent__blank i, .rptv2-doc .pr3-parent__blanks i { display: block; height: 20px; border-bottom: 1px dashed #b0b8c2; }
.rptv2-doc .pr3-parent__blanks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rptv2-doc .pr3-parent__blanks p { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 6px; align-items: end; margin: 0; font-weight: 400; }
.rptv2-doc .pr3-parent__blanks em { font-style: normal; font-size: 11px; color: var(--muted); }
.rptv2-doc .pr3-dist__bar { display: flex; height: 14px; overflow: hidden; }
.rptv2-doc .pr3-dist__bar span { display: block; min-width: 2px; }
.rptv2-doc .pr3-dist__legend { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px; color: var(--muted); }
.rptv2-doc .pr3-dist__legend li { display: grid; grid-template-columns: 9px minmax(0,1fr) auto; gap: 6px; align-items: center; }
.rptv2-doc .pr3-dist__legend i { width: 9px; height: 9px; display: block; }
.rptv2-doc .pr3-dist__legend b { color: #152033; }
@media print { .rptv2-doc .pr3-cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;
