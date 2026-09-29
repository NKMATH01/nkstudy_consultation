import type { ReactNode } from "react";
import { parseExamReportV1, type ExamReportV1 } from "./types";

/**
 * 수학 정밀 진단 리포트(입학테스트 답안 분석) — 학부모 공개 화면(서버 컴포넌트).
 * 승인 디자인: nk-entrance-test-analysis.html 을 그대로 옮김.
 *
 * ★ 보안: 데이터는 학생 시험지 사진에서 읽어낸 것이라 신뢰할 수 없다.
 *   모든 값은 React 텍스트로만 그린다. dangerouslySetInnerHTML·innerHTML 금지.
 *   아래 <style> 의 내용은 이 파일에 고정된 상수(EXAM_REPORT_CSS)뿐이다.
 */

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Gothic+A1:wght@700;800;900&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

// 클래스는 전부 xr- 접두사: Tailwind 유틸리티(.grid 등)와 충돌 방지.
const EXAM_REPORT_CSS = `
.xr{
  --paper:#f1efeb; --surface:#ffffff; --sunken:#f7f6f3; --edge:#e3e0da; --rule:#eeece7;
  --navy:#152033; --navy-soft:#e9edf3;
  --ink:#1a2333; --body:#4b5462; --sub:#6b7480; --faint:#a2a8b1;
  --brass:#9a7326; --brass-lite:#f5efe1;
  --teal:#20655a; --teal-lite:#e2efeb;
  --coral:#b04c42; --coral-lite:#faeae7;
  --shadow:0 1px 2px rgba(21,32,51,.06),0 10px 28px rgba(21,32,51,.07);
  counter-reset:xr-sec;
  background:var(--paper);color:var(--body);
  font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  font-size:14.5px;line-height:1.78;word-break:keep-all;overflow-wrap:anywhere;
  -webkit-font-smoothing:antialiased;
  max-width:700px;margin:0 auto;padding:0 0 44px;overflow-x:hidden
}
.xr *{box-sizing:border-box}
.xr .xr-m{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
.xr h1,.xr h2,.xr h3{margin:0;font-family:"Gothic A1","Noto Sans KR",sans-serif;font-weight:800;letter-spacing:-.022em;color:var(--ink)}
.xr p{margin:0}

.xr .xr-cover{position:relative;overflow:hidden;background:var(--surface);margin:12px 12px 0;
  border-radius:12px;box-shadow:var(--shadow);padding:22px 20px 20px}
.xr .xr-cover::before{content:"";position:absolute;inset:8px;border:1px solid var(--rule);border-radius:8px;
  pointer-events:none}
.xr .xr-cover__rule{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 12px;
  padding-bottom:14px;border-bottom:1px solid var(--rule)}
.xr .xr-cover__brand{display:flex;align-items:center;gap:9px}
.xr .xr-cover__nk{width:27px;height:27px;display:grid;place-items:center;border-radius:7px;
  background:var(--navy);color:#fff;font-size:11px;font-weight:800}
.xr .xr-kicker{font-size:10px;font-weight:600;letter-spacing:.16em;color:var(--brass)}
.xr .xr-stamp{position:absolute;right:20px;top:64px;width:68px;height:68px;border-radius:50%;
  border:1.5px solid var(--brass);transform:rotate(-12deg);display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:var(--brass);
  font-family:"Gothic A1","Noto Sans KR",sans-serif;font-weight:800;font-size:9.5px;line-height:1.3;
  text-align:center;letter-spacing:.02em;pointer-events:none}
.xr .xr-stamp::before{content:"";position:absolute;inset:4px;border:1px dashed var(--brass);border-radius:50%}
.xr .xr-cover__title{padding-right:76px;margin-top:18px}
.xr .xr-cover__who{color:var(--sub);font-size:15px;font-weight:700;line-height:1.4}
.xr .xr-cover h1{margin-top:4px;font-size:28px;font-weight:900;line-height:1.22}
.xr .xr-cover__meta{margin-top:9px;color:var(--sub);font-size:12.5px;line-height:1.7}

.xr .xr-score{margin-top:20px;padding-top:18px;border-top:1px solid var(--rule);
  display:flex;align-items:center;gap:18px}
.xr .xr-gauge{flex:none;width:88px;height:88px;display:block}
.xr .xr-gauge__track{fill:none;stroke:var(--navy-soft);stroke-width:7}
.xr .xr-gauge__val{fill:none;stroke:var(--navy);stroke-width:7;stroke-linecap:round}
.xr .xr-gauge__raw{fill:var(--navy);font-family:"IBM Plex Mono",monospace;font-size:24px;font-weight:600}
.xr .xr-gauge__max{fill:var(--sub);font-family:"IBM Plex Mono",monospace;font-size:9.5px}
.xr .xr-score__side{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.xr .xr-grade{display:flex;align-items:baseline;gap:8px}
.xr .xr-grade b{font-size:10px;font-weight:600;color:var(--sub)}
.xr .xr-grade span{color:var(--navy);font-size:26px;font-weight:500;line-height:1}
.xr .xr-tally{display:flex;flex-wrap:wrap;gap:6px}
.xr .xr-chip{background:var(--sunken);border:1px solid var(--rule);border-radius:99px;padding:3px 10px;
  font-size:11.5px;line-height:1.5;color:var(--body);white-space:nowrap}
.xr .xr-chip em{font-style:normal;color:var(--navy);font-weight:600}

.xr .xr-sec{background:var(--surface);margin:12px 12px 0;border-radius:12px;box-shadow:var(--shadow);
  padding:22px 20px;display:flex;flex-direction:column;gap:17px;counter-increment:xr-sec}
.xr .xr-eyebrow{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:600;
  letter-spacing:.15em;color:var(--sub)}
.xr .xr-eyebrow::before{content:counter(xr-sec,decimal-leading-zero);font-family:"IBM Plex Mono",monospace;
  font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--navy)}
.xr .xr-eyebrow::after{content:"";flex:1;height:1px;background:var(--rule)}
.xr h2{font-size:19px;line-height:1.38}
.xr h3{font-size:14.5px}
.xr .xr-lede{color:var(--sub);font-size:13.5px;line-height:1.75}
.xr .xr-lede strong{color:var(--ink);font-weight:700}

.xr .xr-op{display:flex;flex-direction:column;gap:13px}
.xr .xr-op p{font-size:14.5px;line-height:1.85;color:var(--body)}
.xr .xr-op strong{color:var(--ink);font-weight:700}
.xr .xr-op__first{padding:2px 0 2px 15px;border-left:2px solid var(--brass)}

.xr .xr-chart{width:100%;height:auto;display:block;overflow:visible}
.xr .xr-chart .xr-gridline{stroke:var(--rule);stroke-width:1}
.xr .xr-chart .xr-axis{fill:var(--faint);font-size:11px;font-family:"Noto Sans KR",sans-serif}
.xr .xr-chart .xr-axisnum{font-family:"IBM Plex Mono",monospace}
.xr .xr-chart .xr-val{font-family:"IBM Plex Mono",monospace;font-size:11.5px;font-weight:600}
.xr .xr-chart .xr-nat{fill:none;stroke:#b6bcc4;stroke-width:1.6;stroke-dasharray:4 3}
.xr .xr-chart .xr-me{fill:none;stroke:var(--coral);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
.xr .xr-chart .xr-dot{fill:#fff;stroke:var(--coral);stroke-width:2.4}
.xr .xr-chart .xr-dot--up{stroke:var(--teal)}
.xr .xr-chart .xr-gap{fill:var(--coral);opacity:.08}
.xr .xr-chart .xr-gapup{fill:var(--teal);opacity:.11}
.xr .xr-keys{display:flex;flex-wrap:wrap;gap:16px;font-size:11.5px;color:var(--sub)}
.xr .xr-keys span{display:flex;align-items:center;gap:6px}
.xr .xr-keys hr{width:17px;height:0;margin:0;border:0;border-top:2.6px solid var(--coral)}
.xr .xr-keys hr.xr-d{border-top:1.6px dashed #b6bcc4}

.xr .xr-note{background:var(--sunken);border-radius:4px;padding:13px 15px;font-size:13px;
  line-height:1.75;color:var(--sub);white-space:pre-line}
.xr .xr-note strong{color:var(--ink);font-weight:700}

.xr .xr-units{display:flex;flex-direction:column;gap:2px}
.xr .xr-u{display:grid;grid-template-columns:112px minmax(0,1fr) 76px;gap:12px;align-items:center;
  padding:11px 0;border-top:1px solid var(--rule)}
.xr .xr-u:first-child{border-top:0}
.xr .xr-u__n{font-size:12.5px;color:var(--ink);font-weight:500;line-height:1.4;min-width:0}
.xr .xr-u__cells{display:flex;gap:3px;flex-wrap:wrap;min-width:0}
.xr .xr-u__cells i{width:15px;height:15px;border-radius:3px;display:block}
.xr .xr-cell-o{background:var(--teal)}
.xr .xr-cell-x{background:var(--coral-lite);border:1px solid #ddb0a9}
.xr .xr-u__p{text-align:right;font-family:"IBM Plex Mono",monospace;line-height:1.45}
.xr .xr-u__p b{display:block;font-size:13px;font-weight:600}
.xr .xr-u__p s{display:block;font-size:10.5px;color:var(--faint);text-decoration:none}
.xr .xr-u__head{display:grid;grid-template-columns:112px minmax(0,1fr) 76px;gap:12px;
  font-size:10px;font-weight:600;letter-spacing:.1em;color:var(--faint);padding-bottom:3px}
.xr .xr-u__head span{white-space:nowrap}
.xr .xr-u__head span:last-child{text-align:right}

.xr .xr-picks{display:flex;flex-direction:column;gap:11px}
.xr .xr-pick{border:1px solid var(--edge);border-radius:4px;overflow:hidden;background:var(--surface)}
.xr .xr-pick__h{display:flex;flex-wrap:wrap;align-items:center;gap:11px;padding:12px 15px;background:var(--sunken);
  border-bottom:1px solid var(--rule)}
.xr .xr-pick__no{font-family:"IBM Plex Mono",monospace;font-size:15px;font-weight:600;color:var(--navy)}
.xr .xr-pick__t{flex:1;min-width:0;font-size:12.5px;color:var(--ink);font-weight:700;line-height:1.4}
.xr .xr-pick__avg{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--faint);white-space:nowrap}
.xr .xr-pill{font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;white-space:nowrap}
.xr .xr-pill-o{background:var(--teal-lite);color:var(--teal)}
.xr .xr-pill-x{background:var(--coral-lite);color:var(--coral)}
.xr .xr-pick__b{padding:14px 15px;display:flex;flex-direction:column;gap:9px}
.xr .xr-hand{font-family:"IBM Plex Mono",monospace;font-size:11.5px;line-height:1.7;color:var(--sub);
  background:var(--sunken);border-left:2px solid var(--edge);border-radius:0 3px 3px 0;
  padding:9px 12px;white-space:pre-wrap;overflow-x:auto;overflow-wrap:normal;word-break:normal}
.xr .xr-hand em{font-style:normal;color:var(--coral);font-weight:600}
.xr .xr-hand b{color:var(--teal);font-weight:600}
.xr .xr-pick__b p{font-size:13px;line-height:1.75;color:var(--sub)}
.xr .xr-pick__b strong{color:var(--ink);font-weight:700}

.xr .xr-why{display:flex;flex-direction:column;gap:10px}
.xr .xr-why article{display:grid;grid-template-columns:auto minmax(0,1fr);gap:13px;padding:15px;
  border:1px solid var(--edge);border-radius:4px;align-items:start;background:var(--surface)}
.xr .xr-why__mark{width:4px;align-self:stretch;border-radius:99px}
.xr .xr-why h3{font-size:14px;margin-bottom:4px}
.xr .xr-why p{font-size:13px;line-height:1.75;color:var(--sub)}
.xr .xr-why strong{color:var(--ink);font-weight:700}
.xr .xr-why .xr-tag{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;margin-bottom:5px}

.xr .xr-rx{display:flex;flex-direction:column}
.xr .xr-rx article{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px;padding:15px 0;
  border-top:1px solid var(--rule)}
.xr .xr-rx article:first-child{border-top:0;padding-top:4px}
.xr .xr-rx__n{width:26px;height:26px;display:grid;place-items:center;border-radius:5px;
  background:var(--navy-soft);color:var(--navy);font-family:"IBM Plex Mono",monospace;
  font-size:11.5px;font-weight:600}
.xr .xr-rx__title{display:block;color:var(--ink);font-size:14px;font-weight:700;margin-bottom:2px}
.xr .xr-rx p{font-size:13px;line-height:1.75;color:var(--sub)}
.xr .xr-rx p strong{color:var(--ink);font-weight:700}

.xr .xr-foot{padding:22px 26px 0;display:flex;flex-direction:column;gap:8px}
.xr .xr-foot p{color:var(--sub);font-size:11.5px;line-height:1.8}
.xr .xr-foot .xr-sig{color:var(--faint);font-size:10.5px;letter-spacing:.04em}

.xr .xr-fail{background:var(--surface);margin:12px 12px 0;border-radius:12px;box-shadow:var(--shadow);
  padding:40px 26px;text-align:center}
.xr .xr-fail h1{font-size:19px}
.xr .xr-fail p{margin-top:10px;color:var(--sub);font-size:13px}

@media (min-width:521px){
  .xr .xr-cover{margin:16px 16px 0;padding:28px 26px 24px}
  .xr .xr-sec{margin:16px 16px 0;padding:26px 26px 28px}
  .xr .xr-fail{margin:16px 16px 0}
}
/* 휴대폰: 차트(viewBox 폭 620)는 화면에서 약 0.41~0.74배로 줄어든다.
   글자를 viewBox 단위로 키워 실제 화면 10.5px 이상이 되게 한다(360px 폭에서 약 11px). */
@media (max-width:520px){
  .xr .xr-u,.xr .xr-u__head{grid-template-columns:96px minmax(0,1fr) 54px;gap:9px}
  .xr .xr-u__head{letter-spacing:.02em}
  .xr .xr-chart .xr-axisnum{display:none} /* 각 점에 값 라벨이 있어 y축 숫자는 숨김(첫 점 라벨과 겹침 방지) */
  .xr .xr-chart .xr-axis{font-size:23px}
  .xr .xr-chart .xr-val{font-size:24px}
  .xr .xr-chart .xr-lvl{transform:translateY(8px)}
}
@media (max-width:380px){
  .xr .xr-chart .xr-axis{font-size:26px}
  .xr .xr-chart .xr-val{font-size:27px}
  .xr .xr-chart .xr-lvl{transform:translateY(11px)}
}
`;

// ── 강조 표기 → React 요소 (HTML 해석 없음) ─────────────────
/** 일반 문장: **굵게** → <strong> */
function inline(text: string): ReactNode[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/** 손풀이: **맞은 부분** → <b>(초록), !!틀린 부분!! → <em>(빨강) */
function handInline(text: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|!!.+?!!)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <b key={i}>{part.slice(2, -2)}</b>;
    }
    if (part.length > 4 && part.startsWith("!!") && part.endsWith("!!")) {
      return <em key={i}>{part.slice(2, -2)}</em>;
    }
    return part;
  });
}

// ── 작은 도우미 ────────────────────────────────────────
const pct = (v: number) => `${Math.round(v)}%`;
const fmtDate = (d: string) => d.trim().replace(/-/g, ".");
const pad2 = (no: number | string) => (typeof no === "number" ? String(no).padStart(2, "0") : no);
const COUNT_WORD = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
const countWord = (n: number) => (COUNT_WORD[n] ? `${COUNT_WORD[n]} ` : `${n}`);

const TEAL = "#20655a";
const CORAL = "#b04c42";

type Tone = ExamReportV1["causes"][number]["tone"];
const CAUSE_TONE: Record<Tone, { label: string; color: string }> = {
  deep: { label: "가장 깊은 벽", color: "var(--coral)" },
  costly: { label: "아까운 실점", color: "var(--brass)" },
  procedure: { label: "절차 불안정", color: "var(--coral)" },
};

// ── 난이도 절벽 차트 (학생 실선 + 전국 점선 + 그 사이 색칠) ─────
const X0 = 60;
const X1 = 604;
const Y_TOP = 30; // 100%
const Y_BOTTOM = 190; // 0%
const yOf = (v: number) => Y_BOTTOM - (Math.max(0, Math.min(100, v)) / 100) * (Y_BOTTOM - Y_TOP);

type Pt = { x: number; y: number };
const pt = (p: Pt) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
const linePath = (ps: Pt[]) => ps.map((p, i) => `${i === 0 ? "M" : "L"}${pt(p)}`).join(" ");

function DifficultyChart({ rows }: { rows: ExamReportV1["difficulty"] }) {
  const n = rows.length;
  const xs = rows.map((_, i) => (n === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (n - 1)));
  const me: Pt[] = rows.map((r, i) => ({ x: xs[i], y: yOf(r.me) }));
  const nat: Pt[] = rows.map((r, i) => ({ x: xs[i], y: yOf(r.national) }));

  // 구간마다 색칠. 두 선이 교차하면 교점에서 둘로 나눈다(위=초록, 아래=빨강).
  const fills: { cls: string; points: string }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const d0 = rows[i].me - rows[i].national;
    const d1 = rows[i + 1].me - rows[i + 1].national;
    if (d0 === 0 && d1 === 0) continue;
    if (d0 * d1 >= 0) {
      fills.push({
        cls: d0 + d1 > 0 ? "xr-gapup" : "xr-gap",
        points: [me[i], me[i + 1], nat[i + 1], nat[i]].map(pt).join(" "),
      });
    } else {
      const t = d0 / (d0 - d1);
      const cross: Pt = {
        x: me[i].x + t * (me[i + 1].x - me[i].x),
        y: me[i].y + t * (me[i + 1].y - me[i].y),
      };
      fills.push({ cls: d0 > 0 ? "xr-gapup" : "xr-gap", points: [me[i], cross, nat[i]].map(pt).join(" ") });
      fills.push({
        cls: d1 > 0 ? "xr-gapup" : "xr-gap",
        points: [cross, me[i + 1], nat[i + 1]].map(pt).join(" "),
      });
    }
  }

  // 마지막 칸 글자는 오른쪽 끝에서 잘리지 않게 안쪽으로(원본 디자인과 같은 보정).
  const isLast = (i: number) => n > 1 && i === n - 1;

  return (
    <svg className="xr-chart" viewBox="0 0 620 226" role="img" aria-label="난이도별 정답률 — 학생과 전국 평균 비교">
      {[30, 70, 110, 150, 190].map((y) => (
        <line key={y} className="xr-gridline" x1={44} y1={y} x2={604} y2={y} />
      ))}
      <text className="xr-axis xr-axisnum" x={36} y={34} textAnchor="end">
        100
      </text>
      <text className="xr-axis xr-axisnum" x={36} y={114} textAnchor="end">
        50
      </text>
      <text className="xr-axis xr-axisnum" x={36} y={194} textAnchor="end">
        0
      </text>

      {fills.map((f, i) => (
        <polygon key={i} className={f.cls} points={f.points} />
      ))}

      {n > 1 && <path className="xr-nat" d={linePath(nat)} />}
      {n > 1 && <path className="xr-me" d={linePath(me)} />}

      {rows.map((r, i) => (
        <circle
          key={`d${i}`}
          className={r.me >= r.national ? "xr-dot xr-dot--up" : "xr-dot"}
          cx={me[i].x}
          cy={me[i].y}
          r={5}
        />
      ))}

      {rows.map((r, i) => (
        <text
          key={`v${i}`}
          className="xr-val"
          x={isLast(i) ? me[i].x - 12 : me[i].x}
          y={me[i].y - 9}
          textAnchor="middle"
          fill={r.me >= r.national ? TEAL : CORAL}
        >
          {pct(r.me)}
        </text>
      ))}

      {rows.map((r, i) => (
        <text key={`l${i}`} className="xr-axis xr-lvl" x={isLast(i) ? xs[i] - 8 : xs[i]} y={212} textAnchor="middle">
          {r.level}
        </text>
      ))}
    </svg>
  );
}

// ── 본문 ─────────────────────────────────────────────
function Unavailable() {
  return (
    <div className="xr-fail">
      <h1>분석지를 불러올 수 없습니다</h1>
      <p>링크를 보내 드린 선생님께 문의해 주세요.</p>
    </div>
  );
}

function Report({ r }: { r: ExamReportV1 }) {
  const date = fmtDate(r.exam.date);
  const who = [r.student.school, r.student.grade != null ? String(r.student.grade) : undefined]
    .filter(Boolean)
    .join(" ");
  const meta = [who, r.exam.title, r.exam.totalQuestions ? `${r.exam.totalQuestions}문항` : undefined]
    .filter(Boolean)
    .join(" · ");
  const subject = r.exam.subject?.trim() || "수학";
  const year = r.exam.date.match(/\d{4}/)?.[0];
  const sig = ["NK EDUCATION", `${subject} 정밀 진단 리포트`, date].filter(Boolean).join(" · ");

  // 점수 게이지: 반지름 36 원 둘레 중 raw/max 만큼 칠한다(0~1 로 제한).
  const GAUGE_R = 36;
  const circ = 2 * Math.PI * GAUGE_R;
  const ratio = r.score.max > 0 ? Math.max(0, Math.min(1, r.score.raw / r.score.max)) : 0;

  return (
    <>
      {/* 표지 */}
      <div className="xr-cover">
        <div className="xr-cover__rule">
          <div className="xr-cover__brand">
            <span className="xr-cover__nk">NK</span>
            <span className="xr-kicker">DIAGNOSTIC REPORT</span>
          </div>
          <span className="xr-kicker xr-m" style={{ color: "var(--faint)" }}>
            {date}
          </span>
        </div>

        <div className="xr-stamp" aria-hidden="true">
          <span>NK</span>
          <span>정밀진단</span>
          {year && <span>{year}</span>}
        </div>

        <div className="xr-cover__title">
          <p className="xr-cover__who">{r.student.name} 학생</p>
          <h1>
            {subject} 정밀
            <br />
            진단 리포트
          </h1>
          {meta && <p className="xr-cover__meta">{meta}</p>}
        </div>

        <div className="xr-score">
          <svg
            className="xr-gauge"
            viewBox="0 0 88 88"
            width={88}
            height={88}
            role="img"
            aria-label={`점수 ${r.score.raw}점 / ${r.score.max}점`}
          >
            <circle className="xr-gauge__track" cx={44} cy={44} r={GAUGE_R} />
            {ratio > 0 && (
              <circle
                className="xr-gauge__val"
                cx={44}
                cy={44}
                r={GAUGE_R}
                strokeDasharray={`${(ratio * circ).toFixed(2)} ${circ.toFixed(2)}`}
                transform="rotate(-90 44 44)"
              />
            )}
            <text className="xr-gauge__raw" x={44} y={50} textAnchor="middle">
              {r.score.raw}
            </text>
            <text className="xr-gauge__max" x={44} y={64} textAnchor="middle">
              / {r.score.max}
            </text>
          </svg>
          <div className="xr-score__side">
            {r.score.grade != null && (
              <div className="xr-grade">
                <b>등급</b>
                <span className="xr-m">{r.score.grade}</span>
              </div>
            )}
            <div className="xr-tally">
              <span className="xr-chip">
                정답 <em className="xr-m">{r.tally.correct}</em>
              </span>
              <span className="xr-chip">
                풀이 쓰고 오답 <em className="xr-m">{r.tally.wrongWithWork}</em>
              </span>
              <span className="xr-chip">
                답만 쓰거나 손 놓음 <em className="xr-m">{r.tally.blank}</em>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 종합 소견 */}
      {r.summary.length > 0 && (
        <section className="xr-sec">
          <span className="xr-eyebrow">종합 소견</span>
          <h2>한눈에 보는 결과</h2>
          <div className="xr-op">
            {r.summary.map((para, i) =>
              i === 0 ? (
                <div key={i} className="xr-op__first">
                  <p>{inline(para)}</p>
                </div>
              ) : (
                <p key={i}>{inline(para)}</p>
              )
            )}
          </div>
        </section>
      )}

      {/* 난이도 */}
      {r.difficulty.length > 0 && (
        <section className="xr-sec">
          <span className="xr-eyebrow">난이도별 정답률</span>
          <h2>절벽이 어디 있는지</h2>
          <DifficultyChart rows={r.difficulty} />
          <div className="xr-keys">
            <span>
              <hr />
              {r.student.name} 학생
            </span>
            <span>
              <hr className="xr-d" />
              전국 평균
            </span>
          </div>
          {r.difficultyNote?.trim() && <div className="xr-note">{inline(r.difficultyNote)}</div>}
        </section>
      )}

      {/* 단원 */}
      {r.units.length > 0 && (
        <section className="xr-sec">
          <span className="xr-eyebrow">단원별 정답률</span>
          <h2>어느 단원에서 잃었나</h2>
          <p className="xr-lede">
            네모 하나가 문항 하나입니다. <span style={{ color: "var(--teal)", fontWeight: 700 }}>채운 것</span>이
            정답, <span style={{ color: "var(--coral)", fontWeight: 700 }}>빈 것</span>이 오답입니다.
          </p>

          <div className="xr-u__head">
            <span>단원</span>
            <span>문항</span>
            <span>학생 / 전국</span>
          </div>
          <div className="xr-units">
            {r.units.map((u, i) => (
              <div key={i} className="xr-u">
                <span className="xr-u__n">{u.name}</span>
                <span className="xr-u__cells">
                  {u.cells.map((c, j) => (
                    <i key={j} className={c === "o" ? "xr-cell-o" : "xr-cell-x"} />
                  ))}
                </span>
                <span className="xr-u__p">
                  <b style={{ color: u.me >= u.national ? "var(--teal)" : "var(--coral)" }}>{pct(u.me)}</b>
                  <s>전국 {pct(u.national)}</s>
                </span>
              </div>
            ))}
          </div>
          {r.unitsNote?.trim() && <div className="xr-note">{inline(r.unitsNote)}</div>}
          <p className="xr-lede" style={{ fontSize: 12 }}>
            전국 수치는 매스플렉 결과지의 문항별 전체 평균 정답률을 단원별로 묶어 계산한 값입니다.
          </p>
        </section>
      )}

      {/* 손풀이 */}
      {r.picks.length > 0 && (
        <section className="xr-sec">
          <span className="xr-eyebrow">손풀이 · 중요 {r.picks.length}문항</span>
          <h2>결과지가 못 보는 것</h2>
          <p className="xr-lede">
            매스플렉은 맞았는지 틀렸는지를 알려줍니다. 여기서는 <strong>어디까지 갔다가 어디서 멈췄는지</strong>를
            봅니다. {r.exam.totalQuestions ? `${r.exam.totalQuestions}문항 중 ` : ""}판단에 결정적인{" "}
            {r.picks.length}문항을 골랐습니다.
          </p>

          <div className="xr-picks">
            {r.picks.map((p, i) => (
              <div key={i} className="xr-pick">
                <div className="xr-pick__h">
                  <span className="xr-pick__no">{pad2(p.no)}</span>
                  <span className="xr-pick__t">{p.topic}</span>
                  <span className={p.verdict === "o" ? "xr-pill xr-pill-o" : "xr-pill xr-pill-x"}>
                    {p.verdict === "o" ? "정답" : "오답"}
                  </span>
                  {p.nationalAvg != null && <span className="xr-pick__avg">전체 {pct(p.nationalAvg)}</span>}
                </div>
                <div className="xr-pick__b">
                  {p.hand && <div className="xr-hand">{handInline(p.hand)}</div>}
                  {p.read && <p>{inline(p.read)}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 틀린 이유 */}
      {r.causes.length > 0 && (
        <section className="xr-sec">
          <span className="xr-eyebrow">틀린 이유</span>
          <h2>{r.causesTitle?.trim() ? inline(r.causesTitle) : `${countWord(r.causes.length)}가지로 모입니다`}</h2>
          <div className="xr-why">
            {r.causes.map((c, i) => {
              const tone = CAUSE_TONE[c.tone];
              return (
                <article key={i}>
                  <span className="xr-why__mark" style={{ background: tone.color }} />
                  <div>
                    <span className="xr-tag" style={{ color: tone.color }}>
                      {tone.label} · {c.count}문항
                    </span>
                    <h3>{c.title}</h3>
                    <p>{inline(c.body)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 처방 */}
      {r.plan.length > 0 && (
        <section className="xr-sec">
          <span className="xr-eyebrow">NK 가 먼저 할 것</span>
          <div className="xr-rx">
            {r.plan.map((s, i) => (
              <article key={i}>
                <span className="xr-rx__n">{i + 1}</span>
                <div>
                  <span className="xr-rx__title">{s.title}</span>
                  <p>{inline(s.body)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="xr-foot">
        <p>
          <b style={{ color: "var(--sub)" }}>이 분석지에 대하여</b> — 매스플렉 진단 결과(점수·등급·단원별
          정답률·문항별 채점)에, 실제 답안지의 풀이 흔적·중단 지점·계산 습관을 더해 정리한 것입니다. 한 번의
          시험이므로 당일 컨디션의 영향이 있을 수 있으며, 등원 후 실제 수업에서 다시 확인합니다.
        </p>
        <p className="xr-sig xr-m">{sig}</p>
      </div>
    </>
  );
}

/**
 * data: report_tokens.report_html 을 JSON.parse 한 값(파싱 실패면 null).
 * 여기서 zod 로 검증하고, 깨졌으면 안내 화면을 그린다(빈 화면·크래시 없음).
 */
export function ExamReport({ data }: { data: unknown }) {
  const report = parseExamReportV1(data);
  return (
    <div className="xr">
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <style>{EXAM_REPORT_CSS}</style>
      {report ? <Report r={report} /> : <Unavailable />}
    </div>
  );
}
