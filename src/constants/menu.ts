// 코럴 리디자인 — GNB 카테고리·사이드바 세부 메뉴·카테고리별 서브 액센트 매핑.
// 실제 메뉴 이름(기존 사이드바 기준)으로 확정. href는 운영 이전 시 사용할 메타로 저장(미리보기에선 링크 미동작).
// 아이콘은 기존 사이드바와 동일 계열 lucide 아이콘 재사용.

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  MessageSquareHeart,
  Shield,
  Sparkles,
  UserCog,
  UserMinus,
  Users,
} from "lucide-react";

// ── 로고/브랜드 ─────────────────────────────────────────────────────────────
export const ACADEMY = {
  initial: "NK",
  name: "NK Academy",
  subtitle: "상담관리 시스템",
} as const;

// ── 카테고리(상단 GNB 큰 메뉴) ───────────────────────────────────────────────
export type CategoryId = "cat1" | "cat2" | "cat3";

export interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: Category[] = [
  { id: "cat1", label: "상담 관리", icon: Home },
  { id: "cat2", label: "학생 분석", icon: Sparkles },
  { id: "cat3", label: "학생 관리", icon: GraduationCap },
];

// ── 사이드바 세부 메뉴(카테고리별 세트) ──────────────────────────────────────
export interface SidebarSubItem {
  id: string;
  label: string;
  /** 운영 이전 시 사용할 라우트(미리보기에선 미동작) */
  href: string;
  icon?: LucideIcon;
}

export interface SidebarMenu {
  id: string;
  label: string;
  icon: LucideIcon;
  /** 하위 항목이 없는 단일 메뉴의 라우트. 그룹 메뉴는 children으로 대체. */
  href?: string;
  /** 하위 항목이 있으면 chevron으로 접기/펼치기 */
  children?: SidebarSubItem[];
}

/** 카테고리 → 사이드바 메뉴 세트. 카테고리 전환 시 이 세트를 통째로 교체한다. */
export const SIDEBAR_MENUS: Record<CategoryId, SidebarMenu[]> = {
  // 상담 관리(틸)
  cat1: [
    { id: "cat1-home", label: "상담 및 등록 현황", href: "/", icon: Home },
    { id: "cat1-consult", label: "상담 관리", href: "/consultations", icon: Users },
    { id: "cat1-bookings", label: "예약 현황판", href: "/bookings", icon: CalendarCheck },
  ],
  // 학생 분석(블루베리)
  cat2: [
    { id: "cat2-surveys", label: "설문/분석", href: "/surveys", icon: ClipboardList },
    { id: "cat2-drip", label: "설문 피드백", href: "/drip-responses", icon: MessageSquareHeart },
    { id: "cat2-analyses", label: "성향분석 결과", href: "/analyses", icon: Sparkles },
    { id: "cat2-onboarding", label: "등록 관리", href: "/onboarding", icon: FileText },
    { id: "cat2-progress", label: "진도 현황", href: "/progress", icon: BookOpenCheck },
  ],
  // 학생 관리(플럼)
  cat3: [
    { id: "cat3-students", label: "학생 관리", href: "/settings/students", icon: GraduationCap },
    { id: "cat3-classes", label: "반 관리", href: "/settings/classes", icon: BookOpen },
    { id: "cat3-teachers", label: "선생님 관리", href: "/settings/teachers", icon: UserCog },
    { id: "cat3-permissions", label: "선생님 권한", href: "/settings/permissions", icon: Shield },
    {
      id: "cat3-withdrawals",
      label: "퇴원생 관리",
      icon: UserMinus,
      children: [
        { id: "cat3-withdrawals-list", label: "퇴원생 현황", href: "/withdrawals", icon: UserMinus },
        { id: "cat3-withdrawals-dash", label: "퇴원생 분석", href: "/withdrawals/dashboard", icon: BarChart3 },
      ],
    },
  ],
};

// ── 카테고리별 서브 액센트(적용 3곳: 요약 숫자·사이드바 선택 3px 라인·목록 뱃지) ──
// 코럴은 카테고리와 무관하게 불변. 서브 액센트만 카테고리에 따라 바뀐다.
export interface CategoryAccent {
  name: string;
  color: string;
  soft: string;
  text: string;
}

export const CATEGORY_ACCENT: Record<CategoryId, CategoryAccent> = {
  cat1: { name: "틸", color: "#2D6A6A", soft: "#E7F1F1", text: "#245757" },
  cat2: { name: "블루베리", color: "#3F5E9E", soft: "#EAEFF8", text: "#324B80" },
  cat3: { name: "플럼", color: "#8A4A6B", soft: "#F5EAF0", text: "#6F3B55" },
};

// ── 코럴(불변) — 로고·활성 pill·CTA 전용. 정식 토큰은 design-preview coral-theme.css. ──
export const CORAL = {
  base: "#F0653A",
  deep: "#C7521F",
  soft: "#FFF3ED",
} as const;

/** GNB 우측 알림 아이콘. */
export const NOTIFICATION_ICON = Bell;
