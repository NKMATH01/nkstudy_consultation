// V2 결과 보고서 공용 프리미티브·데이터 시각화(inline SVG) (§12.5).
// 상담자/학부모/PDF가 동일 컴포넌트를 사용해 화면마다 다른 표현이 나오지 않게 한다.
// SVG에는 title/desc/aria-labelledby를 넣는다. 훅이 없어 서버·클라이언트 양쪽에서 렌더된다.

import type { ReactNode } from "react";
import type { AxisScore, Score } from "@/lib/assessment/v2/types";
import {
  C,
  bandDescription,
  isNum,
  pct,
  positiveBand,
  riskBand,
  scoreText,
  type BandStyle,
} from "./report-theme";

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="rpt-card"
      style={{
        background: C.cardBg,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "14px 16px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  index,
  title,
  sub,
}: {
  index?: number | string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="rpt-sec" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {index !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.brass,
              letterSpacing: "0.06em",
            }}
          >
            {typeof index === "number" ? String(index).padStart(2, "0") : index}
          </span>
        )}
        <span style={{ width: 3, height: 15, background: C.navy, borderRadius: 2 }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: 0 }}>
          {title}
        </h2>
      </div>
      {sub && (
        <p style={{ fontSize: 12, color: C.sub, margin: "5px 0 0 11px" }}>{sub}</p>
      )}
    </div>
  );
}

export function BandChip({ band }: { band: BandStyle }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: band.color,
        background: band.soft,
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {band.label}
    </span>
  );
}

/** 정방향/위험축 공용 점수 막대. reverse=true면 색·라벨을 반전한다(§8.7.2). */
export function ScoreRow({
  label,
  score,
  reverse = false,
  note,
}: {
  label: string;
  score: Score;
  reverse?: boolean;
  note?: string;
}) {
  const band = reverse ? riskBand(score) : positiveBand(score);
  const width = pct(score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: band.color }}>
            {scoreText(score)}
          </span>
          <BandChip band={band} />
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "#EEF0F3",
          borderRadius: 999,
          overflow: "hidden",
          border: isNum(score) ? "none" : `1px dashed ${C.line}`,
        }}
      >
        {isNum(score) && (
          <div
            style={{
              height: "100%",
              width: `${width}%`,
              background: band.color,
              borderRadius: 999,
            }}
          />
        )}
      </div>
      <p style={{ fontSize: 12, color: C.sub, margin: "5px 0 0" }}>
        {note ?? bandDescription(score)}
      </p>
    </div>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 13.5,
        lineHeight: 1.72,
        color: C.ink,
        margin: "0 0 8px",
        wordBreak: "keep-all",
      }}
    >
      {children}
    </p>
  );
}

export function BulletList({
  items,
  color = C.navy,
}: {
  items: string[];
  color?: string;
}) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((t, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: C.ink,
            marginBottom: 6,
            wordBreak: "keep-all",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: color,
              marginTop: 7,
              flexShrink: 0,
            }}
          />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function InfoNote({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "caution" | "info";
}) {
  const map = {
    neutral: { bg: C.panel, bar: C.faint, fg: C.sub },
    caution: { bg: C.amberSoft, bar: C.amber, fg: "#8A5A15" },
    info: { bg: "#EAF1FB", bar: C.navy, fg: C.navy },
  } as const;
  const s = map[tone];
  return (
    <div
      style={{
        background: s.bg,
        borderLeft: `3px solid ${s.bar}`,
        borderRadius: 6,
        padding: "9px 12px",
        fontSize: 12.5,
        lineHeight: 1.6,
        color: s.fg,
        wordBreak: "keep-all",
      }}
    >
      {children}
    </div>
  );
}

// ── 지도 좌표 SVG(직접 피드백 수용 × 관계 안전 요구) ──────────────────────
export function CoachingCoordinate({
  challenge,
  safety,
  coachingType,
}: {
  challenge: Score;
  safety: Score;
  coachingType: string;
}) {
  const size = 260;
  const pad = 34;
  const inner = size - pad * 2;
  const cx = pad + (pct(challenge) / 100) * inner;
  const cy = size - pad - (pct(safety) / 100) * inner;
  const known = isNum(challenge) && isNum(safety);
  const titleId = "coord-title";
  const descId = "coord-desc";
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: 300, display: "block", margin: "0 auto" }}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>지도 좌표: 직접 피드백 수용 × 관계 안전 요구</title>
      <desc id={descId}>
        가로축은 직접 피드백 수용({scoreText(challenge)}), 세로축은 관계 안전 요구(
        {scoreText(safety)})이며 현재 판정은 {coachingType}입니다.
      </desc>
      {/* 사분면 배경 */}
      <rect x={pad} y={pad} width={inner} height={inner} fill="#FAFBFC" stroke={C.line} />
      <line x1={pad + inner / 2} y1={pad} x2={pad + inner / 2} y2={size - pad} stroke={C.line} strokeDasharray="4 4" />
      <line x1={pad} y1={pad + inner / 2} x2={size - pad} y2={pad + inner / 2} stroke={C.line} strokeDasharray="4 4" />
      {/* 사분면 라벨 */}
      <text x={pad + inner * 0.72} y={pad + 16} fontSize="9" fill={C.faint}>따뜻한 도전형</text>
      <text x={pad + 4} y={pad + 16} fontSize="9" fill={C.faint}>안전 기반 점진형</text>
      <text x={pad + inner * 0.72} y={size - pad - 6} fontSize="9" fill={C.faint}>직접 도전형</text>
      <text x={pad + 4} y={size - pad - 6} fontSize="9" fill={C.faint}>구조 관찰형</text>
      {/* 축 이름 */}
      <text x={size / 2} y={size - 8} fontSize="10" fill={C.sub} textAnchor="middle">직접 피드백 수용 →</text>
      <text x={12} y={size / 2} fontSize="10" fill={C.sub} textAnchor="middle" transform={`rotate(-90 12 ${size / 2})`}>관계 안전 요구 →</text>
      {/* 현재 위치 */}
      {known ? (
        <>
          <circle cx={cx} cy={cy} r={9} fill={C.brass} opacity={0.25} />
          <circle cx={cx} cy={cy} r={5} fill={C.brass} stroke="#fff" strokeWidth={1.5} />
        </>
      ) : (
        <text x={size / 2} y={size / 2} fontSize="10" fill={C.faint} textAnchor="middle">
          정보 부족
        </text>
      )}
    </svg>
  );
}

// ── 6 핵심 신호 레이더(hexagon) ──────────────────────────────────────────
export interface RadarAxis {
  label: string;
  score: Score;
}
export function CoreSignalsRadar({ axes }: { axes: RadarAxis[] }) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 96;
  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => [
    cx + Math.cos(angle(i)) * r,
    cy + Math.sin(angle(i)) * r,
  ];
  const grid = [0.25, 0.5, 0.75, 1];
  const valuePts = axes
    .map((a, i) => point(i, (pct(a.score) / 100) * R))
    .map((p) => p.join(","))
    .join(" ");
  const titleId = "radar-title";
  const descId = "radar-desc";
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: 320, display: "block", margin: "0 auto" }}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>6개 핵심 행동 신호 레이더</title>
      <desc id={descId}>
        {axes.map((a) => `${a.label} ${scoreText(a.score)}`).join(", ")}. 바깥쪽일수록 높은 점수입니다.
      </desc>
      {grid.map((g, gi) => (
        <polygon
          key={gi}
          points={axes.map((_, i) => point(i, R * g).join(",")).join(" ")}
          fill="none"
          stroke={C.line}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} />;
      })}
      <polygon points={valuePts} fill={C.navy} fillOpacity={0.16} stroke={C.navy} strokeWidth={1.5} />
      {axes.map((a, i) => {
        const [x, y] = point(i, R + 20);
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize="9.5"
            fill={C.sub}
            textAnchor={x > cx + 4 ? "start" : x < cx - 4 ? "end" : "middle"}
            dominantBaseline="middle"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── MBTI 보조축(원점수/조정/최종) ────────────────────────────────────────
export function MbtiAxisTable({
  rows,
}: {
  rows: { label: string; axis: AxisScore; poles: string }[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12.5,
          minWidth: 420,
        }}
      >
        <thead>
          <tr style={{ background: C.panel, color: C.sub }}>
            <th style={thStyle}>지도 선호축</th>
            <th style={thStyle}>원점수</th>
            <th style={thStyle}>MBTI 조정</th>
            <th style={thStyle}>최종</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600, color: C.ink }}>{r.label}</div>
                <div style={{ fontSize: 11, color: C.faint }}>{r.poles}</div>
                {r.axis.lowEvidence && (
                  <div style={{ fontSize: 11, color: C.amber }}>행동 관찰 근거 없음(설계값)</div>
                )}
              </td>
              <td style={tdNum}>{scoreText(r.axis.raw)}</td>
              <td style={tdNum}>
                {r.axis.delta === null ? "-" : `${r.axis.delta > 0 ? "+" : ""}${r.axis.delta}`}
              </td>
              <td style={{ ...tdNum, fontWeight: 800, color: C.navy }}>
                {scoreText(r.axis.final)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 10px",
  fontSize: 11.5,
  fontWeight: 700,
};
const tdStyle: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
const tdNum: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "right",
  color: C.ink,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

// ── NK 적합 영역(선호/준비도) ────────────────────────────────────────────
export function NkAreaRow({
  label,
  preference,
  readiness,
  featureFit,
}: {
  label: string;
  preference: number | null;
  readiness: number | null;
  featureFit: number | null;
}) {
  const cell = (v: number | null) => (v === null ? "-" : `${v}`);
  const gap =
    preference !== null && readiness !== null ? Math.abs(preference - readiness) : null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
        gap: 8,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: `1px solid ${C.line}`,
        fontSize: 12.5,
      }}
    >
      <span style={{ fontWeight: 600, color: C.ink }}>{label}</span>
      <span style={{ textAlign: "right", color: C.navy }}>선호 {cell(preference)}</span>
      <span style={{ textAlign: "right", color: C.teal }}>준비 {cell(readiness)}</span>
      <span style={{ textAlign: "right", color: gap !== null && gap >= 20 ? C.coral : C.sub }}>
        적합 {cell(featureFit)}
      </span>
    </div>
  );
}
