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
      className="sticky top-0 z-10 flex h-[64px] flex-shrink-0 items-center justify-between border-b px-4 md:px-7 print:hidden"
      style={{
        background: "rgba(255,251,249,0.88)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderColor: "#F0E4DD",
      }}
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
          <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm" style={{ borderColor: "#F0E4DD" }}>
            <TitleIcon className="h-4.5 w-4.5" style={{ color: "#C7521F" }} />
          </span>
          <div>
            <h2
              className="text-[17px] font-black"
              style={{ color: "#3A342F", letterSpacing: "-0.025em" }}
            >
              {title}
            </h2>
            <p className="text-[11px] font-semibold" style={{ color: "#A59A90" }}>NK Academy Operations</p>
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
          <div className="flex flex-shrink-0 items-center gap-1 rounded-full p-1" style={{ background: "#FFF3ED" }}>
            {sectors.map((sector) => {
              const active = sector.name === activeSectorName;
              return (
                <button
                  key={sector.name}
                  type="button"
                  onClick={() => router.push(sector.items[0].href)}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-all duration-200 ${
                    active ? "" : "hover:-translate-y-px"
                  }`}
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 800,
                    background: active ? "#F0653A" : "transparent",
                    color: active ? "#FFFFFF" : "#8B8078",
                    boxShadow: active ? "0 4px 12px rgba(240,101,58,0.28)" : "none",
                  }}
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
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "#A59A90" }}
          />
          <input
            type="text"
            placeholder="검색..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="rounded-full py-2 pl-9 pr-4 text-xs font-medium shadow-sm transition-all duration-200 focus:w-[300px] focus:border-[#F0653A] focus:ring-2 focus:ring-[#F0653A]/12"
            style={{
              width: "240px",
              background: "#FFFFFF",
              border: "1px solid #E4D3C8",
              color: "#3A342F",
              outline: "none",
            }}
          />
        </div>
        {/* Bell */}
        <div className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border bg-white shadow-sm" style={{ color: "#8B8078", borderColor: "#F0E4DD" }}>
          <Bell className="h-[18px] w-[18px]" />
          <div
            className="absolute right-2 top-2 h-2 w-2 rounded-full"
            style={{ background: "#F0653A", border: "2px solid #FFFFFF" }}
          />
        </div>
      </div>
    </header>
  );
}
