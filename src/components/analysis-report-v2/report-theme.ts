// V2 결과 보고서 공용 디자인 토큰·라벨·등급 헬퍼.
// 순수 상수/함수만 포함(JSX 없음). 상담자 화면·학부모 공유·PDF·강사 시트가 동일 값을 사용한다.
//
// v2.3: 공통 척도 아홉 개(결과지 질문 1:1)와 등급 세 단계(잘 되고 있음 ≥75 / 지켜볼 것 ≥62.5 / 먼저 도울 것).

import type { CommonScores, Score } from "@/lib/assessment/v2/types";
import { GRADE_LABEL, gradeOf } from "@/lib/assessment/v2/scoring";

// ── 색상(다크 네이비·브라스 골드) ─────────────────────────────────────────
export const C = {
  navy: "#152033",
  navyDeep: "#101722",
  brass: "#b88a32",
  brassSoft: "#f3ead8",
  teal: "#2d776a",
  tealSoft: "#e6f1ee",
  coral: "#a8433d",
  coralSoft: "#f8ebe8",
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

// ── 척도 한글 라벨(한 곳에서만 관리) ─────────────────────────────────────
export const CONSTRUCT_LABEL: Record<keyof CommonScores, string> = {
  learningAttitude: "학습 태도",
  homeworkReliability: "숙제 태도",
  goalClarity: "목표 의식",
  shortTermRecovery: "단기 회복력",
  managementAcceptance: "관리 수용",
  coachingResponse: "지도 방식 반응",
  questionInitiative: "질문 성향",
  phoneBoundary: "공부 중 휴대폰 조절",
  peerFocusBoundary: "친구와 있을 때 조절",
};

/** 결과지가 답하는 질문(사용자 원문). 04 질문별 해석의 부제로 쓴다. */
export const CONSTRUCT_QUESTION: Record<keyof CommonScores, string> = {
  learningAttitude: "공부를 얼마나 열심히 하는가?",
  homeworkReliability: "숙제를 열심히 하는가?",
  goalClarity: "구체적인 목표가 있는가?",
  shortTermRecovery: "강사가 힘들게 시켜도 따라올 것인가?",
  managementAcceptance: "철저한 관리를 버틸 수 있는가?",
  coachingResponse: "강하게 밀어도 되는가, 다독여야 하는가?",
  questionInitiative: "활기차게 질문하는 스타일인가, 아닌가?",
  phoneBoundary: "휴대폰 때문에 공부를 제대로 못 하는가?",
  peerFocusBoundary: "친구 때문에 공부를 제대로 못 하는가?",
};

/** 라벨 아래 작은 회색 풀이. */
export const CONSTRUCT_GLOSS: Record<keyof CommonScores, string> = {
  learningAttitude: "수업 중 표시·복습·스스로 공부하는 시간처럼 열심히 하는 정도",
  homeworkReliability: "답을 베끼지 않고 스스로 풀어 기한 안에 내는 정도",
  goalClarity: "목표 점수와 이번 주 계획을 스스로 말할 수 있는 정도",
  shortTermRecovery: "낮은 점수·힘든 과제 뒤에도 다시 시작하고 끝까지 하는 힘",
  managementAcceptance: "남아서 하기·매주 시험·매일 확인 같은 관리를 받아들이는 정도",
  coachingResponse: "세게 지적받아도 더 열심히 하고 기분이 오래 상하지 않는 정도",
  questionInitiative: "모르면 바로 손을 들고, 수업 중 소리 내어 답하는 정도",
  phoneBoundary: "공부할 때 휴대폰을 치우고 시간을 정해 지키는 정도",
  peerFocusBoundary: "친구가 옆에 있어도 할 일을 먼저 끝내는 정도",
};

/** 과목 보조 척도 라벨(프롬프트·상담자 화면용). */
export const SUBJECT_CONSTRUCT_LABEL: Record<string, string> = {
  mathStrategy: "수학 공부 방식",
  mathNoveltyAvoidance: "수학 낯선 유형 회피",
  mathTestInterference: "수학 시험 긴장",
  englishStrategy: "영어 공부 방식",
  englishReadingAvoidance: "영어 긴 지문 회피",
  englishTestInterference: "영어 시험 긴장",
  coachingChoice: "고른 선생님",
};

export function isNum(s: Score): s is number {
  return typeof s === "number";
}

export function scoreText(s: Score): string {
  // §8.1 일관된 반올림: 소수 첫째 자리로 고정 표기(75 → "75.0점"). 학부모 결과지에는 쓰지 않는다.
  return isNum(s) ? `${s.toFixed(1)}점` : "정보 부족";
}

// ── 등급 색·라벨 ─────────────────────────────────────────────────────────
export interface BandStyle {
  color: string;
  soft: string;
  label: string;
}

/** 정방향 척도(높을수록 잘 되고 있음)의 등급 색·라벨. */
export function positiveBand(s: Score): BandStyle {
  const grade = gradeOf(s);
  if (!grade) return { color: C.faint, soft: "#EEF0F3", label: "정보 부족" };
  if (grade === "good") return { color: C.teal, soft: C.tealSoft, label: GRADE_LABEL.good };
  if (grade === "watch") return { color: C.brass, soft: C.brassSoft, label: GRADE_LABEL.watch };
  return { color: C.coral, soft: C.coralSoft, label: GRADE_LABEL.help };
}

/** 위험축(높을수록 주의 — 과목 보조 신호)의 색·라벨. */
export function riskBand(s: Score): BandStyle {
  if (!isNum(s)) return { color: C.faint, soft: "#EEF0F3", label: "정보 부족" };
  if (s >= 62.5) return { color: C.coral, soft: C.coralSoft, label: "지켜볼 부분" };
  if (s >= 37.5) return { color: C.brass, soft: C.brassSoft, label: "가끔 흔들림" };
  return { color: C.teal, soft: C.tealSoft, label: "괜찮음" };
}

/** 설명용 등급 문구. */
export function bandDescription(s: Score): string {
  const grade = gradeOf(s);
  if (!grade) return "응답이 부족해 상담에서 확인이 필요합니다";
  if (grade === "good") return "이번 응답에서 잘 되고 있다고 나타났습니다";
  if (grade === "watch") return "대체로 되지만 지켜볼 것으로 나타났습니다";
  return "먼저 도울 것으로 나타났습니다";
}

export function pct(s: Score): number {
  return isNum(s) ? Math.max(0, Math.min(100, s)) : 0;
}

// ── 하단 고정 메뉴 ────────────────────────────────────────────────────────
export interface DockItem {
  id: string;
  label: string;
  index: string;
}
/** 학부모 결과지 3판 섹션에 맞춘 네 곳. */
export const DOCK_ITEMS: DockItem[] = [
  { id: "sec-verdict", label: "판단", index: "02" },
  { id: "sec-profile", label: "프로파일", index: "03" },
  { id: "sec-questions", label: "질문별", index: "04" },
  { id: "sec-plan", label: "12주", index: "09" },
];

/** 모바일 하단 메뉴는 핵심 네 곳만 제공하고, 나머지는 본문 스크롤로 읽는다. */
export function dockItemsFor(_hasSubject: boolean): DockItem[] {
  return DOCK_ITEMS;
}

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
