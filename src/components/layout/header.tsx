"use client";

import { useState } from "react";
import {
  Menu,
  Search,
  Bell,
  Home,
  Users,
  CalendarCheck,
  ClipboardList,
  Sparkles,
  FileText,
  GraduationCap,
  BookOpen,
  UserCog,
  Shield,
  BookOpenCheck,
  MessageSquareHeart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { usePathname } from "next/navigation";
import type { CurrentTeacherInfo } from "@/types";

const pageTitles: Record<string, { label: string; icon: LucideIcon }> = {
  "/": { label: "대시보드", icon: Home },
  "/consultations": { label: "상담 관리", icon: Users },
  "/bookings": { label: "예약 현황판", icon: CalendarCheck },
  "/surveys": { label: "설문 현황", icon: ClipboardList },
  "/drip-responses": { label: "설문 피드백", icon: MessageSquareHeart },
  "/analyses": { label: "성향분석 결과", icon: Sparkles },
  "/registrations": { label: "등록 안내", icon: FileText },
  "/progress": { label: "진도 현황", icon: BookOpenCheck },
  "/settings/students": { label: "학생 관리", icon: GraduationCap },
  "/settings/classes": { label: "반 관리", icon: BookOpen },
  "/settings/teachers": { label: "선생님 관리", icon: UserCog },
  "/settings/permissions": { label: "선생님 권한", icon: Shield },
};

interface HeaderProps {
  currentTeacher?: CurrentTeacherInfo | null;
}

/*
  페이지 머리 — 지금 보고 있는 화면의 이름과 검색·알림만 둔다.

  ★ 카테고리 탭(상담 관리·학생 분석·퇴원생 관리·학생 관리)은 사이드바로 내려갔다
    (대표 지시, 2026-08-21). 여기 있던 시절에는 카테고리는 위, 그 세부 메뉴는 왼쪽으로
    갈라져 있어서 메뉴 하나를 찾는 데 두 군데를 봐야 했다.
*/
export function Header({ currentTeacher }: HeaderProps) {
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState("");

  const titleEntry = Object.entries(pageTitles).find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  );
  const title = titleEntry?.[1].label || "대시보드";
  const TitleIcon = titleEntry?.[1].icon || Home;

  return (
    <header
      className="sticky top-0 z-10 flex h-[64px] flex-shrink-0 items-center justify-between border-b border-nk-line bg-nk-surface px-4 md:px-7 print:hidden"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[224px] p-0">
            <SheetTitle className="sr-only">네비게이션 메뉴</SheetTitle>
            <Sidebar inSheet currentTeacher={currentTeacher} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-nk-navy-soft text-nk-navy">
            <TitleIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-nk-ink" style={{ letterSpacing: "-0.025em" }}>
              {title}
            </h2>
            <p className="text-[11px] font-semibold text-nk-ink-hint">NK Academy Operations</p>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-nk-ink-hint" />
          <input
            type="text"
            placeholder="검색..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-[240px] rounded-md border border-nk-line bg-nk-surface py-2 pl-9 pr-4 text-xs font-medium text-nk-ink outline-none transition-all duration-200 focus:w-[300px] focus:border-nk-navy focus:ring-2 focus:ring-nk-navy/25"
          />
        </div>
        {/* Bell */}
        <div className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-nk-line bg-nk-surface text-nk-ink-sub">
          <Bell className="h-[18px] w-[18px]" />
          <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-nk-late ring-2 ring-nk-surface" />
        </div>
      </div>
    </header>
  );
}
