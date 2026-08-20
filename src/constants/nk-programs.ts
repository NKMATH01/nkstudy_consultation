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
 * ★ 상단바가 아니라 사이드바에 둔다 (대표 지시, 2026-08-20).
 *   프로그램이 8개로 늘면서 상단 알약 줄이 화면에서 가장 눈에 띄는 요소가 됐다.
 *   훑고 지나가는 링크지 매번 볼 정보가 아니라, 사이드바 맨 위 접이식 섹션으로 내렸다.
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
  url: string;
  Icon: LucideIcon;
}

export const NK_PROGRAMS: NkProgram[] = [
  { id: "work-report", label: "업무보고", url: "https://nk-work-report.vercel.app", Icon: ClipboardCheck },
  { id: "bogang", label: "보강관리", url: "https://nk-bogang.vercel.app", Icon: BookPlus },
  { id: "lms", label: "학습 관리", url: "https://nk-academy.vercel.app", Icon: GraduationCap },
  { id: "homework", label: "숙제 관리", url: "https://nkhomework.vercel.app", Icon: NotebookPen },
  { id: "counseling", label: "학생 상담", url: "https://nk-counseling-management.vercel.app", Icon: HeartHandshake },
  { id: "consult", label: "등록·퇴원", url: "https://nkstudy-consultation.vercel.app", Icon: DoorOpen },
  { id: "survey", label: "설문조사", url: "https://nk-survey.vercel.app", Icon: ClipboardPen },
  { id: "clinic", label: "클리닉 강사 관리", url: "https://gangsa-clinic.vercel.app", Icon: Stethoscope },
];

/** 이 앱이 어느 프로그램인지. 다른 앱에 이식할 때 이 한 줄만 바꾼다. */
export const CURRENT_PROGRAM_ID = "consult";

/** 주소가 정해진 것만. (빈 값은 아직 준비 중인 프로그램) */
export const VISIBLE_NK_PROGRAMS = NK_PROGRAMS.filter((p) => p.url.trim().length > 0);

export const CURRENT_PROGRAM =
  NK_PROGRAMS.find((p) => p.id === CURRENT_PROGRAM_ID) ?? NK_PROGRAMS[0];

/** 사이드바 섹션 접힘 상태 저장 키 — 전 프로그램 공통. */
export const SIDEBAR_OPEN_KEY = "nk:sidebar-open-sections";
