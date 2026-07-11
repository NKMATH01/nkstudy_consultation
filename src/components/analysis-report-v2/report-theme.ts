// V2 결과 보고서 공용 디자인 토큰·라벨·밴드 헬퍼 (§12.5).
// 순수 상수/함수만 포함(JSX 없음). 상담자 화면·학부모 공유·PDF가 동일 값을 사용한다.

import type { CommonScores, Score } from "@/lib/assessment/v2/types";

// ── 색상(프로토타입 PRIVATE LEARNING DOSSIER 팔레트: 다크 네이비·브라스 골드) ──
// premium.css의 :root 토큰과 동일 계열. inline SVG·점수 막대가 CSS 패널과 어긋나지 않게 한다.
export const C = {
  navy: "#152033",
  navyDeep: "#101722",
  brass: "#b88a32",
  brassSoft: "#f3ead8",
  teal: "#2d776a",
  tealSoft: "#e6f1ee",
  coral: "#c95f55",
  coralSoft: "#f7e8e5",
  amber: "#8a6422",
  amberSoft: "#f3ead8",
  ink: "#334050",
  sub: "#586270",
  faint: "#94a3b8",
  line: "#dde1e3",
  cardBg: "#ffffff",
  pageBg: "#e8e9e6",
  panel: "#f4f6f6",
} as const;

// ── 핵심 축 한글 라벨(학부모·상담자가 바로 이해하는 쉬운 말) ──────────────
// 라벨은 여기 한 곳에서만 관리한다(리포트 전역에서 이 상수를 참조).
export const CONSTRUCT_LABEL: Record<keyof CommonScores, string> = {
  learningAttitude: "수업에 임하는 태도",
  homeworkReliability: "숙제를 해오는 힘",
  phoneBoundary: "휴대폰 조절력",
  longTermPersistence: "목표를 오래 붙드는 힘",
  shortTermRecovery: "흔들린 뒤 다시 시작하는 힘",
  peerLearningResource: "친구와 함께 공부하는 힘",
  peerFocusBoundary: "친구 사이에서 집중을 지키는 힘",
  reflectiveProcessingNeed: "혼자 차분히 정리하는 편",
  directFeedbackAcceptance: "직설적인 피드백을 받아들이는 힘",
  relationshipSafetyNeed: "편안한 관계가 필요한 정도",
  autonomyNeed: "스스로 정하고 싶은 정도",
  structureNeed: "정해진 틀을 선호하는 정도",
  conscientiousness: "성실하게 공부하는 힘",
};

// ── 지도 반응축(코칭) 쉬운 라벨 ─────────────────────────────────────────
export const COACHING_LABEL = {
  challenge: "직설적인 피드백을 받아들이는 힘",
  safety: "편안한 관계가 필요한 정도",
  autonomy: "스스로 정하고 싶은 정도",
  structure: "정해진 틀을 선호하는 정도",
} as const;

export function isNum(s: Score): s is number {
  return typeof s === "number";
}

export function scoreText(s: Score): string {
  // §8.1 일관된 반올림: 소수 첫째 자리로 고정 표기(75 → "75.0점").
  return isNum(s) ? `${s.toFixed(1)}점` : "정보 부족";
}

// ── 정방향 밴드(높을수록 좋음) 색·라벨 ───────────────────────────────────
export interface BandStyle {
  color: string;
  soft: string;
  label: string;
}

export function positiveBand(s: Score): BandStyle {
  if (!isNum(s)) return { color: C.faint, soft: "#EEF0F3", label: "확인 필요" };
  if (s >= 75) return { color: C.teal, soft: C.tealSoft, label: "안정적" };
  if (s >= 60) return { color: C.navy, soft: "#E7ECF5", label: "대체로 잘 됨" };
  if (s >= 40) return { color: C.amber, soft: C.amberSoft, label: "들쭉날쭉" };
  return { color: C.coral, soft: C.coralSoft, label: "먼저 도와줄 부분" };
}

// ── 위험축 밴드(높을수록 주의 — 색·라벨 반전, §8.7.2) ─────────────────────
export function riskBand(s: Score): BandStyle {
  if (!isNum(s)) return { color: C.faint, soft: "#EEF0F3", label: "확인 필요" };
  if (s >= 60) return { color: C.coral, soft: C.coralSoft, label: "지켜볼 부분" };
  if (s >= 40) return { color: C.amber, soft: C.amberSoft, label: "가끔 흔들림" };
  return { color: C.teal, soft: C.tealSoft, label: "괜찮음" };
}

// ── 설명용 band 문구(§8.7.1) ─────────────────────────────────────────────
export function bandDescription(s: Score): string {
  if (!isNum(s)) return "응답이 부족해 상담에서 확인이 필요해요";
  if (s >= 75) return "최근 4주 동안 꾸준히 잘 하고 있어요";
  if (s >= 60) return "대체로 잘 되지만 상황을 조금 타요";
  if (s >= 40) return "상황에 따라 들쭉날쭉해요";
  return "처음에 옆에서 도와주면 좋아요";
}

export function pct(s: Score): number {
  return isNum(s) ? Math.max(0, Math.min(100, s)) : 0;
}

// ── 하단 고정 메뉴(§12.4) ────────────────────────────────────────────────
export interface DockItem {
  id: string;
  label: string;
}
export const DOCK_ITEMS: DockItem[] = [
  { id: "sec-summary", label: "요약" },
  { id: "sec-learning", label: "학습" },
  { id: "sec-life", label: "생활·관계" },
  { id: "sec-fit", label: "NK 적합" },
  { id: "sec-solution", label: "솔루션" },
];

export const SUBJECT_LABEL: Record<string, string> = {
  math: "수학",
  english: "영어",
  both: "수학+영어",
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
