"use client";

import { useState } from "react";
import {
  Menu,
  Search,
  Bell,
  Home,
  Users,
  ClipboardList,
  Sparkles,
  FileText,
  Settings,
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

const pageTitles: Record<string, { label: string; icon: LucideIcon }> = {
  "/": { label: "대시보드", icon: Home },
  "/consultations": { label: "상담 관리", icon: Users },
  "/surveys": { label: "설문 현황", icon: ClipboardList },
  "/analyses": { label: "AI 분석", icon: Sparkles },
  "/registrations": { label: "등록 안내", icon: FileText },
  "/settings": { label: "설정", icon: Settings },
};

export function Header() {
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState("");

  const titleEntry = Object.entries(pageTitles).find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  );
  const title = titleEntry?.[1].label || "대시보드";

  return (
    <header
      className="flex h-12 items-center justify-between px-4 md:px-7 flex-shrink-0"
      style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
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
            <Sidebar />
          </SheetContent>
        </Sheet>
        <h2
          className="text-base font-bold"
          style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "#94A3B8" }}
          />
          <input
            type="text"
            placeholder="검색..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-full text-xs"
            style={{
              width: "220px",
              background: "#F8FAFC",
              border: "1.5px solid #E2E8F0",
              color: "#1E293B",
              outline: "none",
            }}
          />
        </div>
        {/* Bell */}
        <div className="relative cursor-pointer" style={{ color: "#64748B" }}>
          <Bell className="h-[18px] w-[18px]" />
          <div
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#E11D48", border: "2px solid #FFFFFF" }}
          />
        </div>
      </div>
    </header>
  );
}
