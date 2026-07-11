// 코럴 리디자인 — GNB 카테고리·사이드바 세부 메뉴·카테고리별 서브 액센트 매핑 (1단계).
// 이름은 전부 [자리표시자]이며 이후 단계에서 실제 이름으로 교체한다.
// 데이터/이름 교체가 쉽도록 타입을 명시하고, 색은 여기 한 곳에서만 관리한다.

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  Inbox,
  LayoutGrid,
  Settings2,
  UserCog,
  Users,
} from "lucide-react";

// ── 카테고리(상단 GNB 큰 메뉴) ───────────────────────────────────────────────
export type CategoryId = "cat1" | "cat2" | "cat3";

export interface Category {
  id: CategoryId;
  /** [카테고리N] 자리표시자 — 실제 이름으로 교체 예정 */
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: Category[] = [
  { id: "cat1", label: "[카테고리1]", icon: LayoutGrid },
  { id: "cat2", label: "[카테고리2]", icon: Users },
  { id: "cat3", label: "[카테고리3]", icon: ClipboardList },
];

// ── 사이드바 세부 메뉴(카테고리별 세트) ──────────────────────────────────────
export interface SidebarSubItem {
  id: string;
  /** [하위 항목N] 자리표시자 */
  label: string;
}

export interface SidebarMenu {
  id: string;
  /** [세부메뉴X] 자리표시자 */
  label: string;
  icon: LucideIcon;
  /** 하위 항목이 있으면 chevron으로 접기/펼치기 */
  children?: SidebarSubItem[];
}

/** 카테고리 → 사이드바 메뉴 세트. 카테고리 전환 시 이 세트를 통째로 교체한다. */
export const SIDEBAR_MENUS: Record<CategoryId, SidebarMenu[]> = {
  cat1: [
    {
      id: "cat1-a",
      label: "[세부메뉴A]",
      icon: LayoutGrid,
      children: [
        { id: "cat1-a-1", label: "[하위 항목 1]" },
        { id: "cat1-a-2", label: "[하위 항목 2]" },
      ],
    },
    { id: "cat1-b", label: "[세부메뉴B]", icon: FileText },
    { id: "cat1-c", label: "[세부메뉴C]", icon: BarChart3 },
  ],
  cat2: [
    {
      id: "cat2-a",
      label: "[세부메뉴A]",
      icon: Inbox,
      children: [
        { id: "cat2-a-1", label: "[하위 항목 1]" },
        { id: "cat2-a-2", label: "[하위 항목 2]" },
        { id: "cat2-a-3", label: "[하위 항목 3]" },
      ],
    },
    { id: "cat2-b", label: "[세부메뉴B]", icon: Users },
    { id: "cat2-c", label: "[세부메뉴C]", icon: CalendarDays },
  ],
  cat3: [
    { id: "cat3-a", label: "[세부메뉴A]", icon: ClipboardList },
    {
      id: "cat3-b",
      label: "[세부메뉴B]",
      icon: UserCog,
      children: [
        { id: "cat3-b-1", label: "[하위 항목 1]" },
        { id: "cat3-b-2", label: "[하위 항목 2]" },
      ],
    },
    { id: "cat3-c", label: "[세부메뉴C]", icon: Settings2 },
  ],
};

// ── 카테고리별 서브 액센트(적용 3곳: 요약 숫자·사이드바 선택 3px 라인·목록 뱃지) ──
// 코럴은 카테고리와 무관하게 불변. 서브 액센트만 카테고리에 따라 바뀐다.
export interface CategoryAccent {
  /** 사람이 읽는 이름 */
  name: string;
  /** 강조 컬러(요약 숫자·사이드바 선택 왼쪽 3px 라인) */
  color: string;
  /** 연한 틴트 배경(목록 뱃지 배경) */
  soft: string;
  /** 틴트 배경 위 진한 텍스트(뱃지 텍스트) */
  text: string;
}

export const CATEGORY_ACCENT: Record<CategoryId, CategoryAccent> = {
  cat1: { name: "틸", color: "#2D6A6A", soft: "#E7F1F1", text: "#245757" },
  cat2: { name: "블루베리", color: "#3F5E9E", soft: "#EAEFF8", text: "#324B80" },
  cat3: { name: "플럼", color: "#8A4A6B", soft: "#F5EAF0", text: "#6F3B55" },
};

// ── 코럴(불변) — 로고·활성 pill·CTA 전용. 정식 토큰은 2단계 @theme에서 등록. ──
export const CORAL = {
  base: "#F0653A",
  deep: "#C7521F",
  soft: "#FFF3ED",
} as const;

/** GNB 우측 알림 아이콘(자리표시자 배지 수). */
export const NOTIFICATION_ICON = Bell;
