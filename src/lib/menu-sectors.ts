// 사이드바·헤더가 함께 쓰는 메뉴 카테고리(섹터) 정의.
// 카테고리 탭은 헤더 중앙에, 선택된 카테고리의 세부 메뉴는 사이드바에 렌더한다.
// 두 화면이 같은 정의를 봐야 하므로 여기서만 관리한다(메뉴 구성·이름·순서·권한 규칙 불변).
//
// NOTE: src/constants/menu.ts는 코럴 리디자인 미리보기용 자리표시자로, 카테고리 구성이
// 다르고(3분류) 어디서도 import되지 않는다. 운영 메뉴는 이 파일이 단일 출처다.

import {
  Home,
  Users,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  BookOpen,
  UserCog,
  UserMinus,
  BarChart3,
  Shield,
  BookOpenCheck,
  MessageSquareHeart,
} from "lucide-react";
import type { CurrentTeacherInfo } from "@/types";

export type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  newTab?: boolean;
};

export const consultItems: MenuItem[] = [
  { href: "/", label: "상담 및 등록 현황", icon: Home },
  { href: "/consultations", label: "상담 관리", icon: Users },
  { href: "/bookings", label: "예약 현황판", icon: CalendarCheck },
];

export const analysisItems: MenuItem[] = [
  { href: "/surveys", label: "설문/분석", icon: ClipboardList },
  { href: "/drip-responses", label: "설문 피드백", icon: MessageSquareHeart },
  { href: "/onboarding", label: "등록 관리", icon: FileText },
];

export const withdrawalItems: MenuItem[] = [
  { href: "/withdrawals", label: "퇴원생 현황", icon: UserMinus },
  { href: "/withdrawals/dashboard", label: "퇴원생 분석", icon: BarChart3 },
  { href: "/withdrawals/review", label: "월간 반성 리포트", icon: BookOpenCheck },
  { href: "/withdrawals/teachers", label: "강사 러닝 뷰", icon: GraduationCap },
];

export const studentMgmtItems: MenuItem[] = [
  { href: "/settings/students", label: "학생 관리", icon: GraduationCap },
  { href: "/settings/classes", label: "반 관리", icon: BookOpen },
  { href: "/settings/teachers", label: "선생님 관리", icon: UserCog },
];

export const adminOnlyItems: MenuItem[] = [
  { href: "/settings/permissions", label: "선생님 권한", icon: Shield },
];

// 권한 설정과 무관하게 모든 강사에게 항상 표시되는 메뉴 (진도현황)
export const ALWAYS_VISIBLE_MENUS = new Set(["/progress", "/drip-responses"]);

export function filterMenuItems(
  items: MenuItem[],
  currentTeacher: CurrentTeacherInfo | null | undefined,
): MenuItem[] {
  if (!currentTeacher) return items; // 정보 없으면 전체 표시 (레거시)
  if (currentTeacher.role === "admin") return items;
  if (!currentTeacher.allowed_menus || currentTeacher.allowed_menus.length === 0) return items; // 권한 미설정 시 전체 표시
  return items.filter(
    (item) => ALWAYS_VISIBLE_MENUS.has(item.href) || currentTeacher.allowed_menus!.includes(item.href),
  );
}

// 카테고리(섹터) 정의 — 각 섹터는 대표 아이콘 1개 + 소속 메뉴 아이템 배열로 구성.
// 학생 관리 섹터의 매칭 대상에는 adminOnlyItems 경로도 포함해, 관리자 전용 화면에서도
// 카테고리 계산이 학생 관리로 잡히도록 한다(권한 필터는 렌더 단계에서 별도로 수행).
export const SECTOR_DEFS: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}[] = [
  { name: "상담 관리", icon: Users, items: consultItems },
  { name: "학생 분석", icon: BarChart3, items: analysisItems },
  { name: "퇴원생 관리", icon: UserMinus, items: withdrawalItems },
  { name: "학생 관리", icon: GraduationCap, items: [...studentMgmtItems, ...adminOnlyItems] },
];

// 현재 경로가 속한 카테고리명을 계산한다.
// - href === "/" 는 pathname === "/" 로만 매칭(루트 오탐 방지)
// - 그 외에는 pathname.startsWith(href) 로 매칭
// - 어느 카테고리에도 속하지 않으면 기본값 "상담 관리"
export function computeInitialSector(pathname: string): string {
  for (const sector of SECTOR_DEFS) {
    const matched = sector.items.some((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    );
    if (matched) return sector.name;
  }
  return "상담 관리";
}

/** 권한 필터를 거친 카테고리 목록. 표시할 메뉴가 0개인 카테고리는 제외한다. */
export function getVisibleSectors(currentTeacher: CurrentTeacherInfo | null | undefined) {
  const isAdmin = currentTeacher?.role === "admin";
  const visibleStudentMgmt = filterMenuItems(studentMgmtItems, currentTeacher);

  return [
    { name: "상담 관리", icon: Users, items: filterMenuItems(consultItems, currentTeacher) },
    { name: "학생 분석", icon: BarChart3, items: filterMenuItems(analysisItems, currentTeacher) },
    { name: "퇴원생 관리", icon: UserMinus, items: filterMenuItems(withdrawalItems, currentTeacher) },
    {
      name: "학생 관리",
      icon: GraduationCap,
      items: isAdmin ? [...visibleStudentMgmt, ...adminOnlyItems] : visibleStudentMgmt,
    },
  ].filter((sector) => sector.items.length > 0);
}
