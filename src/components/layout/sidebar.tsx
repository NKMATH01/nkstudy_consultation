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
  BookOpenCheck,
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
  { href: "/progress", label: "진도 현황", icon: BookOpenCheck },
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

// 권한 설정과 무관하게 모든 강사에게 항상 표시되는 메뉴 (진도현황)
const ALWAYS_VISIBLE_MENUS = new Set(["/progress"]);

function filterMenuItems(
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
          className={`sidebar-item group relative mb-1 flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-3.5 py-2.5 transition-all duration-200 ${
            isActive ? "" : "hover:translate-x-0.5 hover:bg-white/[0.05]"
          }`}
          style={{
            fontSize: "13px",
            fontWeight: isActive ? 800 : 550,
            background: isActive ? "linear-gradient(135deg, rgba(184,138,68,0.26), rgba(255,255,255,0.06))" : undefined,
            color: isActive ? "#F8E7BD" : "rgba(226,232,240,0.66)",
            boxShadow: isActive ? "inset 0 0 0 1px rgba(184,138,68,0.24), 0 10px 28px rgba(0,0,0,0.2)" : "none",
          }}
        >
          {isActive && (
            <span
              className="absolute left-0 top-2 h-6 w-1 rounded-r-full"
              style={{ background: "linear-gradient(180deg, #E9C46A, #B88A44)", boxShadow: "0 0 10px rgba(233,196,106,0.5)" }}
            />
          )}
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ${
              isActive
                ? "bg-[#B88A44] text-[#0B1020] shadow-[0_4px_12px_rgba(184,138,68,0.35)]"
                : "bg-white/[0.04] text-slate-300 group-hover:scale-105 group-hover:bg-white/[0.09] group-hover:text-slate-100"
            }`}
          >
            <item.icon className="h-[15px] w-[15px]" />
          </span>
          <span className="truncate transition-colors duration-200 group-hover:text-slate-100">{item.label}</span>
        </Link>
      );
    });

  const divider = (
    <div className="mx-3 my-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
  );

  const sectionLabel = (label: string) => (
    <div className="mb-2 px-3.5 uppercase" style={{ fontSize: "10px", fontWeight: 800, color: "rgba(212,168,83,0.48)", letterSpacing: "0.12em" }}>
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
            ? "flex min-h-full w-full flex-shrink-0 flex-col border-r"
            : "hidden min-h-screen w-[246px] flex-shrink-0 flex-col border-r md:flex"
        }
        style={{
          background: "radial-gradient(circle at 22% 0%, rgba(184,138,68,0.15), transparent 30%), linear-gradient(180deg, #111827 0%, #0E1524 48%, #090E18 100%)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pb-7 pt-6">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-[#08111F]"
            style={{
              background: "linear-gradient(135deg, #E9C46A, #A97832)",
              boxShadow: "0 12px 28px rgba(184,138,68,0.28)",
            }}
          >
            NK
          </div>
          <div>
            <div className="text-[15px] font-black text-white" style={{ letterSpacing: "-0.02em" }}>
              NK Academy
            </div>
            <div className="text-[10.5px] font-semibold" style={{ color: "rgba(226,232,240,0.46)" }}>
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
        <div className="px-3 pb-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Link
            href="/survey"
            target="_blank"
            className="mt-2.5 flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 transition-all hover:-translate-y-px"
            style={{
              fontSize: "11.5px",
              fontWeight: 800,
              background: "rgba(184,138,68,0.13)",
              color: "#E9C46A",
              boxShadow: "inset 0 0 0 1px rgba(184,138,68,0.16)",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 설문 링크
          </Link>
          <Link
            href="/booking"
            target="_blank"
            className="mt-1.5 flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 transition-all hover:-translate-y-px"
            style={{
              fontSize: "11.5px",
              fontWeight: 800,
              background: "rgba(20,184,166,0.11)",
              color: "#8DDAD0",
              boxShadow: "inset 0 0 0 1px rgba(45,212,191,0.13)",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 예약 링크
          </Link>
        </div>

        {/* User Info */}
        <div
          className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-3"
          style={{ background: "rgba(255,255,255,0.055)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black"
            style={{
              background: "rgba(184,138,68,0.17)",
              color: "#E9C46A",
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
