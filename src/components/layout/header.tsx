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
import { usePathname, useRouter } from "next/navigation";
import type { CurrentTeacherInfo } from "@/types";
import { computeInitialSector, getVisibleSectors } from "@/lib/menu-sectors";

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

export function Header({ currentTeacher }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");

  const titleEntry = Object.entries(pageTitles).find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  );
  const title = titleEntry?.[1].label || "대시보드";
  const TitleIcon = titleEntry?.[1].icon || Home;

  // 카테고리 탭 — 권한 필터를 거친 카테고리만. 클릭하면 그 카테고리의 첫 메뉴로 이동한다.
  const sectors = getVisibleSectors(currentTeacher);
  const activeSectorName = computeInitialSector(pathname);

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

      {/* 카테고리 탭 — 화면 중앙. 좁은 화면에서는 가로 스크롤로 넘긴다. */}
      {sectors.length > 0 && (
        <nav
          aria-label="카테고리"
          className="mx-3 flex min-w-0 flex-1 justify-center overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {/* 지금 보고 있는 카테고리는 네이비로 채워 뒤집는다 — 글자 굵기 차이만으로는
              옅은 바탕 위에서 활성/비활성이 둘 다 묻힌다. */}
          <div className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-nk-sunken p-1">
            {sectors.map((sector) => {
              const active = sector.name === activeSectorName;
              return (
                <button
                  key={sector.name}
                  type="button"
                  onClick={() => router.push(sector.items[0].href)}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-nk-navy text-nk-navy-ink"
                      : "text-nk-ink-sub hover:bg-nk-navy-soft hover:text-nk-navy"
                  }`}
                  style={{ fontSize: "12.5px", fontWeight: 700 }}
                >
                  <sector.icon className="h-[14px] w-[14px] flex-shrink-0" />
                  {sector.name}
                </button>
              );
            })}
          </div>
        </nav>
      )}

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
