"use client";

import { useState } from "react";
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
  ArrowLeftCircle,
  MessageSquareHeart,
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
  { href: "/drip-responses", label: "설문 피드백", icon: MessageSquareHeart },
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


type MenuItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; newTab?: boolean };

// 권한 설정과 무관하게 모든 강사에게 항상 표시되는 메뉴 (진도현황)
const ALWAYS_VISIBLE_MENUS = new Set(["/progress", "/drip-responses"]);

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

// 목차(섹터) 정의 — 각 섹터는 대표 아이콘 1개 + 소속 메뉴 아이템 배열로 구성.
// 학생 관리 섹터의 매칭 대상에는 adminOnlyItems 경로도 포함해, 관리자 전용 화면에서도
// 초기 섹터 계산이 학생 관리로 잡히도록 한다(권한 필터는 렌더 단계에서 별도로 수행).
const SECTOR_DEFS: { name: string; icon: React.ComponentType<{ className?: string }>; items: MenuItem[] }[] = [
  { name: "상담 관리", icon: Users, items: consultItems },
  { name: "학생 분석", icon: BarChart3, items: analysisItems },
  { name: "퇴원생 관리", icon: UserMinus, items: withdrawalItems },
  { name: "학생 관리", icon: GraduationCap, items: [...studentMgmtItems, ...adminOnlyItems] },
];

// 현재 경로가 속한 섹터명을 계산한다.
// - href === "/" 는 pathname === "/" 로만 매칭(루트 오탐 방지)
// - 그 외에는 pathname.startsWith(href) 로 매칭
// - 어느 섹터에도 속하지 않으면 기본값 "상담 관리"
function computeInitialSector(pathname: string): string {
  for (const sector of SECTOR_DEFS) {
    const matched = sector.items.some((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    );
    if (matched) return sector.name;
  }
  return "상담 관리";
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

  // 진도 현황(최상단 고정 버튼) 활성 여부
  const progressActive = pathname.startsWith("/progress");

  // 목차 섹터별 표시 아이템 — 권한 필터를 거친 결과. 학생 관리 섹터는 관리자면 adminOnlyItems도 포함.
  const sectors = [
    { name: "상담 관리", icon: Users, items: visibleConsult },
    { name: "학생 분석", icon: BarChart3, items: visibleAnalysis },
    { name: "퇴원생 관리", icon: UserMinus, items: visibleWithdrawal },
    {
      name: "학생 관리",
      icon: GraduationCap,
      items: isAdmin ? [...visibleStudentMgmt, ...adminOnlyItems] : visibleStudentMgmt,
    },
  ];
  // 항목이 0개인 섹터는 목차 버튼 자체를 렌더하지 않는다.
  const visibleSectors = sectors.filter((s) => s.items.length > 0);

  // 선택된 섹터 상태 — lazy initializer로 최초 1회만 현재 경로 기준 섹터를 계산.
  // 이후 pathname이 바뀌어도 useEffect로 동기화하지 않아 사용자가 고른 섹터를 유지한다.
  const [activeSector, setActiveSector] = useState<string>(() => computeInitialSector(pathname));

  // 현재 활성 섹터가 권한상 보이지 않으면 첫 번째 표시 섹터로 대체(버튼 하이라이트·본문 일치 유지).
  const currentSectorName = visibleSectors.some((s) => s.name === activeSector)
    ? activeSector
    : visibleSectors[0]?.name;
  const activeItems = visibleSectors.find((s) => s.name === currentSectorName)?.items ?? [];

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
          {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
    <div
      className="mx-3 my-4 h-px"
      style={{ background: "linear-gradient(90deg, transparent, rgba(233,196,106,0.18) 30%, rgba(255,255,255,0.08) 70%, transparent)" }}
    />
  );

  const sectionLabel = (label: string) => (
    <div className="mb-2 flex items-center gap-1.5 px-3.5">
      <span className="h-1 w-1 rounded-full" style={{ background: "rgba(233,196,106,0.6)" }} />
      <span className="uppercase" style={{ fontSize: "10px", fontWeight: 800, color: "rgba(212,168,83,0.55)", letterSpacing: "0.14em" }}>
        {label}
      </span>
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
            ? "flex h-full w-full flex-shrink-0 flex-col border-r"
            : "hidden h-full w-[246px] flex-shrink-0 flex-col border-r md:flex"
        }
        style={{
          background:
            "radial-gradient(circle at 50% -8%, rgba(233,196,106,0.16), transparent 32%), radial-gradient(circle at 0% 100%, rgba(30,58,110,0.35), transparent 42%), linear-gradient(180deg, #0E1627 0%, #0B1220 52%, #070C16 100%)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        {/* 메인 프로그램(업무보고) 복귀 버튼 */}
        <div className="px-4 pt-4">
          <a
            href="https://nk-work-report.vercel.app"
            className="group flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-all hover:-translate-y-px hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, rgba(233,196,106,0.2), rgba(184,138,68,0.1))",
              boxShadow: "inset 0 0 0 1px rgba(233,196,106,0.3), 0 6px 18px rgba(0,0,0,0.2)",
            }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:-translate-x-0.5"
              style={{ background: "rgba(233,196,106,0.22)", color: "#F2D488" }}
            >
              <ArrowLeftCircle className="h-[16px] w-[16px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-extrabold" style={{ color: "#F2D488" }}>
                업무보고 프로그램
              </span>
              <span className="block text-[9.5px] font-bold uppercase" style={{ color: "rgba(233,196,106,0.45)", letterSpacing: "0.1em" }}>
                메인으로 돌아가기
              </span>
            </span>
          </a>
        </div>

        {/* Logo */}
        <div className="px-4 pb-5 pt-3">
          <div
            className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 0 0 1px rgba(233,196,106,0.14), 0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-[#08111F]"
              style={{
                background: "linear-gradient(135deg, #F2D488 0%, #E9C46A 40%, #A97832 100%)",
                boxShadow: "0 8px 22px rgba(184,138,68,0.4), inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            >
              NK
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-black text-white" style={{ letterSpacing: "-0.02em" }}>
                NK Academy
              </div>
              <div
                className="text-[10px] font-bold uppercase"
                style={{ color: "rgba(233,196,106,0.55)", letterSpacing: "0.14em" }}
              >
                상담관리 시스템
              </div>
            </div>
          </div>
        </div>

        {/* Navigation — 메뉴가 화면보다 길어지면 이 영역만 스크롤 (상단 버튼·하단 로그아웃 고정) */}
        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(233,196,106,0.25) transparent" }}
        >
          {/* 진도 현황 — 최상단 고정 대형 버튼(권한 무관 항상 표시, 같은 탭 이동) */}
          <Link
            href="/progress"
            className={`group relative mb-1 flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-3.5 py-3.5 transition-all duration-200 ${
              progressActive ? "" : "hover:-translate-y-px hover:brightness-110"
            }`}
            style={{
              fontSize: "14px",
              fontWeight: 800,
              background: progressActive
                ? "linear-gradient(135deg, rgba(233,196,106,0.34), rgba(184,138,68,0.16))"
                : "linear-gradient(135deg, rgba(233,196,106,0.2), rgba(184,138,68,0.1))",
              color: progressActive ? "#F8E7BD" : "#F2D488",
              boxShadow: progressActive
                ? "inset 0 0 0 1.5px rgba(233,196,106,0.5), 0 10px 28px rgba(0,0,0,0.22)"
                : "inset 0 0 0 1px rgba(233,196,106,0.3), 0 6px 18px rgba(0,0,0,0.2)",
            }}
          >
            {progressActive && (
              <span
                className="absolute left-0 top-2.5 h-7 w-1 rounded-r-full"
                style={{ background: "linear-gradient(180deg, #E9C46A, #B88A44)", boxShadow: "0 0 10px rgba(233,196,106,0.5)" }}
              />
            )}
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
              style={{ background: "rgba(233,196,106,0.24)", color: "#F8E7BD" }}
            >
              <BookOpenCheck className="h-[18px] w-[18px]" />
            </span>
            <span className="truncate">진도 현황</span>
          </Link>

          {divider}

          {/* 목차 — 섹터 버튼(2열 그리드). 클릭 시 해당 섹터 메뉴만 아래에 표시(탭 방식) */}
          {sectionLabel("목차")}
          <div className="grid grid-cols-2 gap-1.5">
            {visibleSectors.map((sector) => {
              const active = sector.name === currentSectorName;
              return (
                <button
                  key={sector.name}
                  type="button"
                  onClick={() => setActiveSector(sector.name)}
                  className={`group flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-3 transition-all duration-200 ${
                    active ? "" : "hover:-translate-y-px hover:brightness-110"
                  }`}
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    background: active
                      ? "linear-gradient(135deg, rgba(184,138,68,0.3), rgba(255,255,255,0.06))"
                      : "rgba(255,255,255,0.04)",
                    color: active ? "#F8E7BD" : "rgba(226,232,240,0.6)",
                    boxShadow: active
                      ? "inset 0 0 0 1.5px rgba(184,138,68,0.4), 0 8px 20px rgba(0,0,0,0.2)"
                      : "inset 0 0 0 1px rgba(255,255,255,0.06)",
                  }}
                >
                  <sector.icon className="h-[15px] w-[15px] flex-shrink-0" />
                  <span className="truncate transition-colors duration-200 group-hover:text-slate-100">{sector.name}</span>
                </button>
              );
            })}
          </div>

          {/* 선택된 섹터의 메뉴만 렌더(기존 renderItems 스타일 유지) */}
          {activeItems.length > 0 && (
            <>
              {divider}
              {sectionLabel(currentSectorName ?? "")}
              {renderItems(activeItems)}
            </>
          )}

        </nav>

        {/* Footer - 공개 링크 */}
        <div
          className="mx-3 grid grid-cols-2 gap-1.5 pb-3 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Link
            href="/survey"
            target="_blank"
            className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 transition-all hover:-translate-y-px hover:brightness-110"
            style={{
              fontSize: "11px",
              fontWeight: 800,
              background: "linear-gradient(135deg, rgba(233,196,106,0.16), rgba(184,138,68,0.08))",
              color: "#E9C46A",
              boxShadow: "inset 0 0 0 1px rgba(233,196,106,0.2)",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 설문
          </Link>
          <Link
            href="/booking"
            target="_blank"
            className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 transition-all hover:-translate-y-px hover:brightness-110"
            style={{
              fontSize: "11px",
              fontWeight: 800,
              background: "linear-gradient(135deg, rgba(45,212,191,0.14), rgba(20,184,166,0.06))",
              color: "#8DDAD0",
              boxShadow: "inset 0 0 0 1px rgba(45,212,191,0.18)",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 예약
          </Link>
          <a
            href="https://nk-guide.vercel.app/t"
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 transition-all hover:-translate-y-px hover:brightness-110"
            style={{
              fontSize: "11px",
              fontWeight: 800,
              background: "linear-gradient(135deg, rgba(96,165,250,0.14), rgba(59,130,246,0.06))",
              color: "#93C5FD",
              boxShadow: "inset 0 0 0 1px rgba(96,165,250,0.18)",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            학부모 안내
          </a>
        </div>

        {/* User Info */}
        <div
          className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-3"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.22)",
          }}
        >
          <div className="relative">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black"
              style={{
                background: "linear-gradient(135deg, rgba(233,196,106,0.28), rgba(184,138,68,0.12))",
                color: "#F2D488",
                boxShadow: "inset 0 0 0 1px rgba(233,196,106,0.3)",
              }}
            >
              {avatarInitial}
            </div>
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
              style={{ background: "#34D399", boxShadow: "0 0 0 2px #0B1220" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs font-bold" style={{ color: "rgba(255,255,255,0.82)" }}>
              {displayName}
            </div>
            <div className="text-[10px] font-semibold" style={{ color: "rgba(233,196,106,0.45)" }}>
              {displayRole}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-red-300"
            style={{ color: "rgba(255,255,255,0.3)" }}
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
