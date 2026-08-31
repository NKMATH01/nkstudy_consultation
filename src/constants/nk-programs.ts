import type { LucideIcon } from "lucide-react";
import {
  BookPlus,
  ClipboardCheck,
  ClipboardPen,
  DoorOpen,
  GraduationCap,
  HeartHandshake,
  NotebookPen,
  Stethoscope,
} from "lucide-react";

/**
 * NK 학원 프로그램 목록 — 모든 프로그램이 공유하는 전환 메뉴의 원본.
 * 기준 구현: 18.NK업무보고 프로그램/constants/nk-programs.ts
 *
 * ★ 상단바(GNB) 가운데에 둔다 (대표 지시, 2026-08-21).
 *   2026-08-20 에 사이드바로 내렸다가 되돌렸다. 프로그램 전환은 모든 NK 앱이 공유하는
 *   바깥 이동 수단이고, 사이드바는 '지금 이 프로그램의 메뉴'만 담는다 — 둘을 한 기둥에
 *   섞으니 어디까지가 이 앱인지 읽히지 않았다.
 *
 * ★ 순서를 프로그램마다 바꾸지 마라.
 *   순서가 다르면 옮겨 다닐 때마다 눈으로 다시 찾아야 한다.
 *
 * ★ url 이 빈 문자열이면 렌더하지 않는다.
 *   주소가 정해지기 전에 눌러 빈 페이지로 떨어지는 것보다 안 보이는 편이 낫다.
 */
export interface NkProgram {
  /** 활성 판정용 고유 id. 각 앱은 자기 id 를 CURRENT_PROGRAM_ID 로 지정한다. */
  id: string;
  label: string;
  /**
   * 상단 탭에서 쓰는 축약 라벨 — 8개가 한 줄에 들어가야 하기 때문이다.
   * 지금 보고 있는 프로그램만 풀네임(label)으로 내고, 나머지는 이 값으로 낸다.
   * 툴팁(title)에는 항상 풀네임이 들어가므로 뜻이 사라지지는 않는다.
   */
  short: string;
  url: string;
  Icon: LucideIcon;
}

export const NK_PROGRAMS: NkProgram[] = [
  { id: "work-report", label: "업무보고", short: "업무보고", url: "https://nk-work-report.vercel.app", Icon: ClipboardCheck },
  { id: "bogang", label: "보강관리", short: "보강", url: "https://nk-bogang.vercel.app", Icon: BookPlus },
  { id: "lms", label: "학습 관리", short: "학습", url: "https://nk-academy.vercel.app", Icon: GraduationCap },
  { id: "homework", label: "숙제 관리", short: "숙제", url: "https://nkhomework.vercel.app", Icon: NotebookPen },
  { id: "counseling", label: "학생 상담", short: "상담", url: "https://nk-counseling-management.vercel.app", Icon: HeartHandshake },
  { id: "consult", label: "등록·퇴원", short: "등록·퇴원", url: "https://nkstudy-consultation.vercel.app", Icon: DoorOpen },
  { id: "survey", label: "설문조사", short: "설문", url: "https://nk-survey.vercel.app", Icon: ClipboardPen },
  { id: "clinic", label: "클리닉 강사 관리", short: "클리닉", url: "https://gangsa-clinic.vercel.app", Icon: Stethoscope },
];

/** 이 앱이 어느 프로그램인지. 다른 앱에 이식할 때 이 한 줄만 바꾼다. */
export const CURRENT_PROGRAM_ID = "consult";

/** 주소가 정해진 것만. (빈 값은 아직 준비 중인 프로그램) */
export const VISIBLE_NK_PROGRAMS = NK_PROGRAMS.filter((p) => p.url.trim().length > 0);

export const CURRENT_PROGRAM =
  NK_PROGRAMS.find((p) => p.id === CURRENT_PROGRAM_ID) ?? NK_PROGRAMS[0];

/**
 * 전환 링크 툴팁 문구 — "학생 상담으로 이동".
 *
 * 받침이 있으면 '으로', 없으면 '로'다(받침 ㄹ 은 예외로 '로').
 * 이걸 안 가리고 `${label}으로` 로 붙이면 "학습 관리으로 이동", "설문조사으로 이동"이 된다.
 * (업무보고 constants/nk-programs.ts 의 programMoveHint 와 같은 규칙이다.)
 */
export function programMoveHint(label: string): string {
  const code = label.charCodeAt(label.length - 1);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  // 종성 인덱스: 0 = 받침 없음, 8 = ㄹ
  const jongseong = isHangulSyllable ? (code - 0xac00) % 28 : 0;
  const particle = !isHangulSyllable || jongseong === 0 || jongseong === 8 ? "로" : "으로";
  return `${label}${particle} 이동`;
}

/**
 * 사이드바 섹션 접힘 상태 저장 키 — 전 프로그램 공통.
 *
 * ★ v3 로 올렸다 (2026-08-21). v2 에 저장된 집합에는 없어진 'nk-programs' 섹션과
 *   그때 유일하게 열려 있던 카테고리 하나만 들어 있다. 그 값을 그대로 읽으면 새로 생긴
 *   카테고리 섹션들이 전부 접힌 채 열려 사이드바가 비어 보인다.
 */
export const SIDEBAR_OPEN_KEY = "nk:sidebar-open-sections-v3";
