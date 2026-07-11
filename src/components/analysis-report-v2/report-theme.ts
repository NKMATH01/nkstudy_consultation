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

// ── 핵심 축 한글 라벨 ────────────────────────────────────────────────────
export const CONSTRUCT_LABEL: Record<keyof CommonScores, string> = {
  learningAttitude: "학습 태도",
  homeworkReliability: "숙제 신뢰도",
  phoneBoundary: "휴대폰 자기조절",
  longTermPersistence: "장기 의지",
  shortTermRecovery: "단기 회복력",
  peerLearningResource: "또래 학습 자원",
  peerFocusBoundary: "또래 집중 경계",
  reflectiveProcessingNeed: "숙고 처리 선호",
  directFeedbackAcceptance: "직접 피드백 수용",
  relationshipSafetyNeed: "관계 안전 요구",
  autonomyNeed: "자율성 요구",
  structureNeed: "구조 요구",
  conscientiousness: "학습 성실성",
};

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
  if (!isNum(s)) return { color: C.faint, soft: "#EEF0F3", label: "정보 부족" };
  if (s >= 75) return { color: C.teal, soft: C.tealSoft, label: "안정적" };
  if (s >= 60) return { color: C.navy, soft: "#E7ECF5", label: "대체로 작동" };
  if (s >= 40) return { color: C.amber, soft: C.amberSoft, label: "변동 큼" };
  return { color: C.coral, soft: C.coralSoft, label: "초기 구조 필요" };
}

// ── 위험축 밴드(높을수록 주의 — 색·라벨 반전, §8.7.2) ─────────────────────
export function riskBand(s: Score): BandStyle {
  if (!isNum(s)) return { color: C.faint, soft: "#EEF0F3", label: "정보 부족" };
  if (s >= 60) return { color: C.coral, soft: C.coralSoft, label: "주의 신호" };
  if (s >= 40) return { color: C.amber, soft: C.amberSoft, label: "관찰 필요" };
  return { color: C.teal, soft: C.tealSoft, label: "부담 낮음" };
}

// ── 설명용 band 문구(§8.7.1) ─────────────────────────────────────────────
export function bandDescription(s: Score): string {
  if (!isNum(s)) return "정보 부족·상담 확인 필요";
  if (s >= 75) return "최근 행동에서 비교적 안정적으로 관찰됨";
  if (s >= 60) return "대체로 작동하나 조건의 영향을 받음";
  if (s >= 40) return "상황에 따른 변동이 큼";
  return "초기 구조와 짧은 확인 주기가 필요함";
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
