"use client";

// 코럴 라이트 스킨. 카테고리(상담 관리/학생 분석/퇴원생 관리/학생 관리) 탭은 헤더 중앙으로 옮겼고,
// 사이드바는 현재 경로가 속한 카테고리의 세부 메뉴만 보여준다.
// 메뉴 정의·권한 로직은 src/lib/menu-sectors.ts를 헤더와 공유한다(구성·이름·순서·링크 불변).

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  BookOpenCheck,
  ArrowLeftCircle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import type { CurrentTeacherInfo } from "@/types";
import {
  computeInitialSector,
  getVisibleSectors,
  type MenuItem,
} from "@/lib/menu-sectors";

const COLLAPSE_STORAGE_KEY = "nkc:sidebar-collapsed";

// 접기 상태를 모듈 스코프 외부 저장소로 둔다.
// useSyncExternalStore는 hydration 중에는 서버 스냅샷(false)을 쓰고 그 뒤 클라이언트
// 스냅샷으로 한 번 맞춰주므로, effect에서 setState 하지 않고도 mismatch가 나지 않는다.
let collapsedState = false;
let readFromStorage = false;
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(onStoreChange: () => void) {
  collapseListeners.add(onStoreChange);
  return () => {
    collapseListeners.delete(onStoreChange);
  };
}

function getCollapsedSnapshot(): boolean {
  // 최초 1회만 localStorage를 읽고 이후에는 캐시값을 돌려준다(스냅샷 안정성).
  if (!readFromStorage) {
    readFromStorage = true;
    try {
      collapsedState = window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등)면 펼침 기본값을 유지한다.
    }
  }
  return collapsedState;
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

function setCollapsedStore(next: boolean) {
  collapsedState = next;
  readFromStorage = true;
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // 저장 실패는 무시(이번 세션에만 적용).
  }
  collapseListeners.forEach((listener) => listener());
}

interface SidebarProps {
  currentTeacher?: CurrentTeacherInfo | null;
  inSheet?: boolean;
}

export function Sidebar({ currentTeacher, inSheet = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // 모바일 시트는 항상 펼침이다.
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const isCollapsed = collapsed && !inSheet;

  const toggleCollapsed = () => setCollapsedStore(!collapsed);

  // 현재 경로가 속한 카테고리의 메뉴만 렌더한다(카테고리 전환은 헤더 탭이 담당).
  const visibleSectors = getVisibleSectors(currentTeacher);
  const pathSectorName = computeInitialSector(pathname);
  const currentSector =
    visibleSectors.find((sector) => sector.name === pathSectorName) ?? visibleSectors[0];
  const activeItems = currentSector?.items ?? [];

  const progressActive = pathname.startsWith("/progress");

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
          title={item.label}
          className={`sidebar-item group relative mb-1 flex w-full items-center overflow-hidden rounded-xl transition-all duration-200 ${
            isCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3.5 py-2.5"
          } ${isActive ? "is-active" : "hover:translate-x-0.5"}`}
          style={{
            fontSize: "13px",
            fontWeight: isActive ? 800 : 600,
            background: isActive ? "#FFF3ED" : undefined,
            color: isActive ? "#C7521F" : "#8B8078",
            boxShadow: isActive && !isCollapsed ? "inset 3px 0 0 #F0653A" : "none",
          }}
        >
          <span
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
              isActive
                ? "text-white"
                : "text-[#8B8078] group-hover:scale-105 group-hover:bg-[#FFF3ED] group-hover:text-[#C7521F]"
            }`}
            style={{ background: isActive ? "#F0653A" : "#F8EEE8" }}
          >
            <item.icon className="h-[15px] w-[15px]" />
          </span>
          {!isCollapsed && (
            <span className="truncate transition-colors duration-200">{item.label}</span>
          )}
        </Link>
      );
    });

  const divider = <div className="mx-3 my-2.5 h-px" style={{ background: "#F0E4DD" }} />;

  const sectionLabel = (label: string) => (
    <div className="mb-2 flex items-center gap-1.5 px-3.5">
      <span className="h-1 w-1 rounded-full" style={{ background: "#F0653A" }} />
      <span className="uppercase" style={{ fontSize: "10px", fontWeight: 800, color: "#A59A90", letterSpacing: "0.14em" }}>
        {label}
      </span>
    </div>
  );

  // 사용자 표시 정보
  const displayName = currentTeacher?.name || "NK 원장";
  const displayRole = currentTeacher?.role === "admin" ? "총괄관리자" : currentTeacher?.role === "clinic" ? "클리닉" : "선생님";
  const avatarInitial = displayName[0] || "N";

  return (
    <aside
      className={
        inSheet
          ? "flex h-full w-full flex-shrink-0 flex-col border-r print:hidden"
          : `hidden h-full flex-shrink-0 flex-col border-r transition-[width] duration-200 md:flex print:hidden ${
              isCollapsed ? "w-[64px]" : "w-[246px]"
            }`
      }
      style={{ background: "#FFFFFF", borderColor: "#F0E4DD" }}
    >
      {/* 상단 — 업무보고 복귀 + 접기 토글 */}
      <div className={`flex items-center gap-1.5 pb-2 pt-3 ${isCollapsed ? "flex-col px-2" : "px-4"}`}>
        {!inSheet && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!isCollapsed}
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[#FFF3ED] hover:text-[#C7521F] ${
              isCollapsed ? "" : "order-2"
            }`}
            style={{ color: "#A59A90" }}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        )}
        <a
          href="https://nk-work-report.vercel.app"
          title="업무보고 프로그램으로 돌아가기"
          className={`group flex items-center rounded-xl transition-all hover:-translate-y-px ${
            isCollapsed ? "h-9 w-9 justify-center" : "min-w-0 flex-1 gap-2.5 px-3.5 py-2"
          }`}
          style={{ background: "#FFF3ED", boxShadow: "inset 0 0 0 1px #F6D9C8" }}
        >
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:-translate-x-0.5"
            style={{ background: "#FBE4D8", color: "#C7521F" }}
          >
            <ArrowLeftCircle className="h-[16px] w-[16px]" />
          </span>
          {!isCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-extrabold" style={{ color: "#C7521F" }}>
                업무보고 프로그램
              </span>
              <span className="block text-[9.5px] font-bold uppercase" style={{ color: "#A59A90", letterSpacing: "0.1em" }}>
                메인으로 돌아가기
              </span>
            </span>
          )}
        </a>
      </div>

      {/* Navigation — 현재 카테고리의 세부 메뉴. 길어지면 이 영역만 스크롤 */}
      <nav
        className={`min-h-0 flex-1 overflow-y-auto pb-2 ${isCollapsed ? "px-2" : "px-3"}`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#F0E4DD transparent" }}
      >
        {activeItems.length > 0 && (
          <>
            {!isCollapsed && sectionLabel(currentSector?.name ?? "")}
            {renderItems(activeItems)}
          </>
        )}

        {divider}

        {/* 진도 현황 — 권한 무관 항상 표시(같은 탭 이동). 코럴 CTA 스타일 */}
        <Link
          href="/progress"
          title="진도 현황"
          className={`group relative mb-1 flex w-full items-center overflow-hidden rounded-xl transition-all duration-200 ${
            isCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3.5 py-3.5"
          } ${progressActive ? "" : "hover:-translate-y-px hover:brightness-105"}`}
          style={{
            fontSize: "14px",
            fontWeight: 800,
            background: progressActive ? "#C7521F" : "#F0653A",
            color: "#FFFFFF",
            boxShadow: progressActive
              ? "inset 0 0 0 1.5px rgba(255,255,255,0.35), 0 8px 20px rgba(199,82,31,0.3)"
              : "0 8px 20px rgba(240,101,58,0.28)",
          }}
        >
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
            style={{ background: "rgba(255,255,255,0.22)", color: "#FFFFFF" }}
          >
            <BookOpenCheck className="h-[18px] w-[18px]" />
          </span>
          {!isCollapsed && <span className="truncate">진도 현황</span>}
        </Link>
      </nav>

      {/* Footer - 공개 링크 (접힘에서는 숨김) */}
      {!isCollapsed && (
        <div className="mx-3 grid grid-cols-3 gap-1.5 pb-3 pt-3" style={{ borderTop: "1px solid #F0E4DD" }}>
          <Link
            href="/survey"
            target="_blank"
            className="flex items-center justify-center rounded-full px-2 py-2 transition-all hover:-translate-y-px"
            style={{ fontSize: "10.5px", fontWeight: 800, background: "#FFF3ED", color: "#C7521F" }}
          >
            공개 설문
          </Link>
          <Link
            href="/booking"
            target="_blank"
            className="flex items-center justify-center rounded-full px-2 py-2 transition-all hover:-translate-y-px"
            style={{ fontSize: "10.5px", fontWeight: 800, background: "#E7F1F1", color: "#2D6A6A" }}
          >
            공개 예약
          </Link>
          <a
            href="https://nk-guide.vercel.app/t"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-full px-2 py-2 transition-all hover:-translate-y-px"
            style={{ fontSize: "10.5px", fontWeight: 800, background: "#E9EFF3", color: "#355D79" }}
          >
            학부모 안내
          </a>
        </div>
      )}

      {/* User Info — 최하단. 접힘에서는 로그아웃 아이콘만 남긴다. */}
      {isCollapsed ? (
        <div className="mb-2 flex justify-center px-2 pt-2" style={{ borderTop: "1px solid #F0E4DD" }}>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-[#FFF3ED] hover:text-[#C7521F]"
            style={{ color: "#A59A90" }}
            title={`로그아웃 (${displayName})`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mx-3 mb-2 rounded-2xl px-3 py-2" style={{ background: "#FFFBF9", boxShadow: "inset 0 0 0 1px #F0E4DD" }}>
          <div className="mb-1.5 flex items-center gap-2 border-b pb-1.5" style={{ borderColor: "#F0E4DD" }}>
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
              style={{ background: "#F0653A", boxShadow: "0 4px 10px rgba(240,101,58,0.24)" }}
            >
              NK
            </div>
            <span className="truncate text-[11px] font-black" style={{ color: "#3A342F", letterSpacing: "-0.01em" }}>
              NK Academy
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black"
                style={{ background: "#FFF3ED", color: "#C7521F", boxShadow: "inset 0 0 0 1px #F6D9C8" }}
              >
                {avatarInitial}
              </div>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: "#34D399", boxShadow: "0 0 0 2px #FFFFFF" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-bold" style={{ color: "#3A342F" }}>
                {displayName}
              </div>
              <div className="text-[10px] font-semibold" style={{ color: "#8B8078" }}>
                {displayRole}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-[#FFF3ED] hover:text-[#C7521F]"
              style={{ color: "#A59A90" }}
              title="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
