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
      className="sticky top-0 z-10 flex h-[64px] flex-shrink-0 items-center justify-between border-b px-4 md:px-7 print:hidden"
      style={{
        background: "rgba(255,251,249,0.88)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderColor: "#F0E4DD",
      }}
    >
      <div className="flex items-center gap-3">
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

      <div className="flex items-center gap-3">
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
