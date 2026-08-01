// 강사용 A4 1장 시트 전용 CSS.
// 목표: 화면에서도 인쇄에서도 A4 한 장을 넘기지 않는다(2열 그리드, 폰트·여백 압축).
// 학부모 결과지(REPORT_PREMIUM_CSS)와 클래스가 겹치지 않도록 전부 .tsheet 아래에 둔다.

export const TEACHER_SHEET_CSS = `
.tsheet {
  --ts-line: #E2E6EC;
  --ts-navy: #172843;
  --ts-muted: #6B7686;
  --ts-gold: #A8843C;
  max-width: 210mm;
  margin: 0 auto;
  padding: 12mm 12mm 10mm;
  background: #fff;
  color: var(--ts-navy);
  font-size: 11px;
  line-height: 1.45;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.08);
  border-radius: 6px;
}

.tsheet__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--ts-navy);
}
.tsheet__head h1 { font-size: 16px; font-weight: 800; margin: 0; }
.tsheet__head h1 em {
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  color: var(--ts-gold);
  margin-left: 4px;
}
.tsheet__meta { font-size: 10.5px; color: var(--ts-muted); }

.tsheet__todo {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 8px 0;
  padding: 7px 10px;
  border: 1px solid var(--ts-gold);
  border-left: 3px solid var(--ts-gold);
  border-radius: 4px;
  background: #FDFAF3;
}
.tsheet__todo b { font-size: 10.5px; white-space: nowrap; color: var(--ts-gold); }
.tsheet__todo p { margin: 0; font-size: 12px; font-weight: 700; }

.tsheet__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tsheet__col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

.tsheet__box {
  border: 1px solid var(--ts-line);
  border-radius: 4px;
  padding: 7px 9px;
}
.tsheet__box h2 {
  margin: 0 0 5px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.tsheet__bars { list-style: none; margin: 0; padding: 0; }
.tsheet__bars li { display: flex; align-items: center; gap: 6px; padding: 1.5px 0; }
.tsheet__bar-label { width: 62px; flex: 0 0 auto; font-size: 10px; color: var(--ts-muted); }
.tsheet__bar {
  flex: 1 1 auto;
  height: 6px;
  border-radius: 3px;
  background: #EEF1F5;
  overflow: hidden;
}
.tsheet__bar b { display: block; height: 100%; border-radius: 3px; background: #94A3B8; }
.tsheet__bar b.is-high { background: #2F6B4F; }
.tsheet__bar b.is-mid { background: #A8843C; }
.tsheet__bar b.is-low { background: #B4553F; }
.tsheet__bar-num {
  width: 20px;
  flex: 0 0 auto;
  text-align: right;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tsheet__weak, .tsheet__talk { padding: 3px 0; }
.tsheet__weak + .tsheet__weak, .tsheet__talk + .tsheet__talk {
  border-top: 1px dashed var(--ts-line);
  margin-top: 3px;
}
.tsheet__weak > b, .tsheet__talk > b { font-size: 10.5px; font-weight: 800; }
.tsheet__weak p, .tsheet__talk p { margin: 2px 0 0; font-size: 10px; }
.tsheet__avoid span, .tsheet__do span, .tsheet__answer span {
  display: inline-block;
  min-width: 44px;
  margin-right: 4px;
  padding: 0 3px;
  border-radius: 2px;
  font-size: 9px;
  font-weight: 800;
  text-align: center;
}
.tsheet__avoid span { background: #FBEAE6; color: #9A4632; }
.tsheet__do span { background: #E6F0EA; color: #2F6B4F; }
.tsheet__answer span { background: #EEF1F5; color: var(--ts-muted); }
.tsheet__answer { color: var(--ts-muted); }

.tsheet__checks { list-style: none; margin: 0; padding: 0; }
.tsheet__checks li { display: flex; gap: 5px; padding: 2.5px 0; }
.tsheet__checks li + li { border-top: 1px dashed var(--ts-line); }
.tsheet__checkbox { font-size: 13px; line-height: 1.2; }
.tsheet__check-body { display: flex; flex-direction: column; min-width: 0; }
.tsheet__check-body b { font-size: 10.5px; font-weight: 800; }
.tsheet__check-body i { font-style: normal; font-size: 9.5px; color: var(--ts-muted); }
.tsheet__result { font-style: normal; font-size: 9.5px; font-weight: 800; margin-top: 1px; }
.tsheet__result.is-matched { color: #2F6B4F; }
.tsheet__result.is-differed { color: #B4553F; }
.tsheet__result.is-unobserved { color: var(--ts-muted); }

.tsheet__caution { margin-top: 8px; }
.tsheet__caution ul { margin: 0; padding-left: 14px; }
.tsheet__caution li { font-size: 10px; }

@media print {
  @page { size: A4 portrait; margin: 10mm; }
  .tsheet {
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    font-size: 10.5px;
  }
  .tsheet__box, .tsheet__todo, .tsheet__weak, .tsheet__talk, .tsheet__checks li {
    break-inside: avoid;
  }
  .tsheet__grid { gap: 6px; }
}
`;
