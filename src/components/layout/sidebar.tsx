"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ExternalLink,
  LogOut,
  Shield,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import type { CurrentTeacherInfo } from "@/types";

const consultItems = [
  { href: "/", label: "상담 및 등록 현황", icon: Home },
  { href: "/consultations", label: "상담 관리", icon: Users },
  { href: "/bookings", label: "예약 현황판", icon: CalendarCheck },
];

const analysisItems = [
  { href: "/surveys", label: "설문/분석", icon: ClipboardList },
  { href: "/onboarding", label: "등록 관리", icon: FileText },
];

const withdrawalItems = [
  { href: "/withdrawals", label: "퇴원생 현황", icon: UserMinus },
  { href: "/withdrawals/dashboard", label: "퇴원생 분석", icon: BarChart3 },
];

const studentMgmtItems = [
  { href: "/settings/students", label: "학생 관리", icon: GraduationCap },
  { href: "/settings/classes", label: "반 관리", icon: BookOpen },
  { href: "/settings/teachers", label: "선생님 관리", icon: UserCog },
];

const adminOnlyItems = [
  { href: "/settings/permissions", label: "선생님 권한", icon: Shield },
];


type MenuItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function filterMenuItems(
  items: MenuItem[],
  currentTeacher: CurrentTeacherInfo | null | undefined,
): MenuItem[] {
  if (!currentTeacher) return items; // 정보 없으면 전체 표시 (레거시)
  if (currentTeacher.role === "admin") return items;
  if (!currentTeacher.allowed_menus || currentTeacher.allowed_menus.length === 0) return items; // 권한 미설정 시 전체 표시
  return items.filter((item) => currentTeacher.allowed_menus!.includes(item.href));
}

interface SidebarProps {
  currentTeacher?: CurrentTeacherInfo | null;
  inSheet?: boolean;
}

export function Sidebar({ currentTeacher, inSheet = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = currentTeacher?.role === "admin";

  const visibleConsult = filterMenuItems(consultItems, currentTeacher);
  const visibleAnalysis = filterMenuItems(analysisItems, currentTeacher);
  const visibleWithdrawal = filterMenuItems(withdrawalItems, currentTeacher);
  const visibleStudentMgmt = filterMenuItems(studentMgmtItems, currentTeacher);

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    router.push("/login");
  };

  const renderItems = (items: MenuItem[]) =>
    items.map((item) => {
      const isActive =
        pathname === item.href ||
        (item.href !== "/" && item.href !== "/withdrawals" && pathname.startsWith(item.href));
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`sidebar-item group relative mb-1 flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-3.5 py-2.5 text-[13px] transition ${
            isActive
              ? "bg-sidebar-accent font-extrabold text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(168,213,226,0.65),0_10px_24px_rgba(94,147,172,0.12)]"
              : "font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          }`}
        >
          {isActive && <span className="absolute left-0 top-2 h-6 w-1 rounded-r-full bg-sidebar-primary" />}
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-white/70 text-sidebar-foreground group-hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-[15px] w-[15px]" />
          </span>
          <span className="truncate">{item.label}</span>
        </Link>
      );
    });

  const divider = <div className="mx-3 my-4 border-t border-sidebar-border" />;

  const sectionLabel = (label: string) => (
    <div className="mb-2 px-3.5 text-[10px] font-extrabold uppercase text-sidebar-primary/70 tracking-[0.12em]">
      {label}
    </div>
  );

  // 사용자 표시 정보
  const displayName = currentTeacher?.name || "NK 원장";
  const displayRole = currentTeacher?.role === "admin" ? "총괄관리자" : currentTeacher?.role === "clinic" ? "클리닉" : "선생님";
  const avatarInitial = displayName[0] || "N";

  return (
    <>
      <aside
        className={
          inSheet
            ? "flex min-h-full w-full flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
            : "hidden min-h-screen w-[246px] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
        }
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pb-7 pt-6">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_12px_28px_rgba(94,147,172,0.22)]"
          >
            NK
          </div>
          <div>
            <div className="text-[15px] font-black text-sidebar-foreground">
              NK Academy
            </div>
            <div className="text-[10.5px] font-semibold text-sidebar-foreground/55">
              상담관리 시스템
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          {/* 상담 관리 */}
          {visibleConsult.length > 0 && renderItems(visibleConsult)}

          {/* 학생 분석 */}
          {visibleAnalysis.length > 0 && (
            <>
              {divider}
              {sectionLabel("학생 분석")}
              {renderItems(visibleAnalysis)}
            </>
          )}

          {/* 퇴원생 관리 */}
          {visibleWithdrawal.length > 0 && (
            <>
              {divider}
              {sectionLabel("퇴원생 관리")}
              {renderItems(visibleWithdrawal)}
            </>
          )}

          {/* 학생 관리 */}
          {(visibleStudentMgmt.length > 0 || isAdmin) && (
            <>
              {divider}
              {sectionLabel("학생 관리")}
              {renderItems(visibleStudentMgmt)}
              {isAdmin && renderItems(adminOnlyItems)}
            </>
          )}

        </nav>

        {/* Footer - 공개 링크 */}
        <div className="border-t border-sidebar-border px-3 pb-3 pt-2">
          <Link
            href="/survey"
            target="_blank"
            className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-[11.5px] font-extrabold text-accent-foreground shadow-[inset_0_0_0_1px_rgba(242,167,179,0.24)] transition-all hover:-translate-y-px"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 설문 링크
          </Link>
          <Link
            href="/booking"
            target="_blank"
            className="mt-1.5 flex w-full items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5 text-[11.5px] font-extrabold text-secondary-foreground shadow-[inset_0_0_0_1px_rgba(143,201,168,0.22)] transition-all hover:-translate-y-px"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 예약 링크
          </Link>
        </div>

        {/* User Info */}
        <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl bg-white/70 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(227,237,241,0.95)]">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-xs font-black text-sidebar-accent-foreground"
          >
            {avatarInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-sidebar-foreground/80">
              {displayName}
            </div>
            <div className="text-[10px] text-sidebar-foreground/45">
              {displayRole}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex cursor-pointer p-1 text-sidebar-foreground/45 transition hover:text-sidebar-accent-foreground"
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
