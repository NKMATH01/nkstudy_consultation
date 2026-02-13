"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  CalendarCheck,
  ClipboardList,
  Sparkles,
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
  { href: "/surveys", label: "설문 현황", icon: ClipboardList },
  { href: "/analyses", label: "성향분석 결과", icon: Sparkles },
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
  if (!currentTeacher.allowed_menus) return [];
  return items.filter((item) => currentTeacher.allowed_menus!.includes(item.href));
}

interface SidebarProps {
  currentTeacher?: CurrentTeacherInfo | null;
}

export function Sidebar({ currentTeacher }: SidebarProps) {
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
        (item.href !== "/" && pathname.startsWith(item.href));
      return (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-[7px] mb-0.5 transition-all duration-150"
          style={{
            fontSize: "13px",
            fontWeight: isActive ? 600 : 500,
            background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
            color: isActive ? "#ffffff" : "rgba(255,255,255,0.4)",
            borderLeft: isActive ? "2px solid #D4A853" : "2px solid transparent",
          }}
        >
          <item.icon className="h-[17px] w-[17px]" />
          {item.label}
        </Link>
      );
    });

  const divider = (
    <div className="my-3 mx-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
  );

  const sectionLabel = (label: string) => (
    <div className="px-3.5 mb-2" style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>
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
        className="hidden md:flex w-[224px] flex-col min-h-screen flex-shrink-0"
        style={{ background: "#0A0F1E" }}
      >
        {/* Logo */}
        <div className="px-5 py-6 pb-7 flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #D4A853, #B8892E)",
              boxShadow: "0 2px 8px rgba(212,168,83,0.3)",
            }}
          >
            NK
          </div>
          <div>
            <div className="text-sm font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
              NK Academy
            </div>
            <div className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
              상담관리 시스템
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5">
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
        <div className="px-2.5 pb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <Link
            href="/survey"
            target="_blank"
            className="flex items-center gap-2 w-full px-3.5 py-2 rounded-[7px] mt-2.5 transition-all"
            style={{
              fontSize: "11.5px",
              fontWeight: 500,
              background: "rgba(212,168,83,0.08)",
              color: "#F0D48A",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 설문 링크
          </Link>
          <Link
            href="/booking"
            target="_blank"
            className="flex items-center gap-2 w-full px-3.5 py-2 rounded-[7px] mt-1 transition-all"
            style={{
              fontSize: "11.5px",
              fontWeight: 500,
              background: "rgba(99,102,241,0.08)",
              color: "#A5B4FC",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 예약 링크
          </Link>
        </div>

        {/* User Info */}
        <div
          className="px-4 py-3.5 flex items-center gap-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-xs font-bold"
            style={{
              background: "rgba(212,168,83,0.12)",
              color: "#D4A853",
            }}
          >
            {avatarInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
              {displayName}
            </div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              {displayRole}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 flex cursor-pointer"
            style={{ color: "rgba(255,255,255,0.25)" }}
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
