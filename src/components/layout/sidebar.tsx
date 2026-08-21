"use client";

// NK 네이비·브라스 체계.
//
// ★ 사이드바는 '이 프로그램의 메뉴'만 담는다 (대표 지시, 2026-08-21).
//   카테고리 4개(상담 관리·학생 분석·퇴원생 관리·학생 관리)와 그 세부 메뉴가 전부 여기
//   접이식 섹션으로 들어온다. 전에는 카테고리 탭이 헤더 중앙에 있어서 한 카테고리의 메뉴만
//   보였고, 다른 카테고리로 가려면 위를 한 번 거쳐야 했다.
//   NK 프로그램 전환은 반대로 상단 GNB 로 올라갔다(layout/nk-gnb 참고) — 바깥으로 나가는
//   길과 안에서 도는 길을 한 기둥에 섞지 않는다.
//
// 메뉴 정의·권한 로직은 src/lib/menu-sectors.ts 단일 출처다(구성·이름·순서·링크 불변).

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  BookOpenCheck,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import type { CurrentTeacherInfo } from "@/types";
import {
  ALL_SECTOR_IDS,
  computeInitialSector,
  getVisibleSectors,
  type MenuItem,
} from "@/lib/menu-sectors";
import { SIDEBAR_OPEN_KEY } from "@/constants/nk-programs";

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

/*
  사이드 섹션 아코디언 — 접기 상태와 같은 방식의 외부 저장소다.

  ★ 저장값이 없을 때만 기본값을 쓴다. 한 번 접어 둔 것을 화면을 옮길 때마다 되돌리면
    접는 기능이 있으나 마나가 된다.
  ★ 기본값은 '전부 펼침'이다. 카테고리 4개가 여기로 내려온 마당에 기본이 접힘이면
    첫 화면에서 메뉴가 하나도 안 보인다.
*/
const DEFAULT_OPEN_SECTIONS = ALL_SECTOR_IDS;

let openSectionsRaw: string | null = null;
let openSectionsRead = false;
const openListeners = new Set<() => void>();

function subscribeOpenSections(onStoreChange: () => void) {
  openListeners.add(onStoreChange);
  return () => {
    openListeners.delete(onStoreChange);
  };
}

function getOpenSectionsSnapshot(): string | null {
  if (!openSectionsRead) {
    openSectionsRead = true;
    try {
      openSectionsRaw = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등)면 기본값을 유지한다.
    }
  }
  return openSectionsRaw;
}

function getOpenSectionsServerSnapshot(): string | null {
  return null;
}

function setOpenSections(next: Set<string>) {
  openSectionsRaw = JSON.stringify([...next]);
  openSectionsRead = true;
  try {
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, openSectionsRaw);
  } catch {
    // 저장 실패는 무시(이번 세션에만 적용).
  }
  openListeners.forEach((listener) => listener());
}

function parseOpenSections(raw: string | null): Set<string> {
  if (!raw) return new Set(DEFAULT_OPEN_SECTIONS);
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(DEFAULT_OPEN_SECTIONS);
  }
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

  const openSections = parseOpenSections(
    useSyncExternalStore(
      subscribeOpenSections,
      getOpenSectionsSnapshot,
      getOpenSectionsServerSnapshot,
    ),
  );
  const toggleSection = (id: string) => {
    const next = new Set(openSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenSections(next);
  };
  // 권한을 통과한 카테고리 전부를 렌더한다. 지금 보고 있는 화면이 어느 카테고리에
  // 속하는지는 섹션 머리에 표시해 둔다 — 스크롤로 밀려도 자기 위치를 잃지 않게.
  const visibleSectors = getVisibleSectors(currentTeacher);
  const pathSectorName = computeInitialSector(pathname);

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
          className={`sidebar-item group relative mb-1 flex w-full items-center overflow-hidden rounded-lg ${
            isCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3.5 py-2.5"
          } ${
            isActive
              ? "is-active bg-nk-navy-soft text-nk-navy shadow-[inset_3px_0_0_rgb(var(--wr-navy))]"
              : "text-nk-ink-sub"
          }`}
          style={{ fontSize: "13px", fontWeight: isActive ? 700 : 600 }}
        >
          <span
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
              isActive
                ? "bg-nk-navy text-nk-navy-ink"
                : "bg-nk-sunken text-nk-ink-hint group-hover:bg-nk-navy-soft group-hover:text-nk-navy"
            }`}
          >
            <item.icon className="h-[15px] w-[15px]" />
          </span>
          {!isCollapsed && (
            <span className="truncate transition-colors duration-200">{item.label}</span>
          )}
        </Link>
      );
    });

  const divider = <div className="mx-3 my-2.5 h-px bg-nk-line-soft" />;

  // 섹션 머리 — 누르면 접히고 펴진다. 접혀 있을 때만 안쪽 사정을 힌트로 알린다.
  // 지금 보고 있는 화면이 속한 카테고리는 잉크를 올려 둔다(접어 놨을 때 특히 필요하다).
  const sectionHead = (
    id: string,
    label: string,
    open: boolean,
    hint?: string,
    active = false,
  ) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      aria-expanded={open}
      className="mb-2 flex w-full items-center gap-1.5 rounded-md px-3.5 py-1 text-left transition-colors hover:bg-nk-navy-soft"
    >
      <ChevronDown
        className={`h-3 w-3 flex-shrink-0 transition-transform ${
          active ? "text-nk-navy" : "text-nk-ink-hint"
        } ${open ? "" : "-rotate-90"}`}
      />
      <span
        className={`flex-1 truncate uppercase ${active ? "text-nk-navy" : "text-nk-ink-hint"}`}
        style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em" }}
      >
        {label}
      </span>
      {!open && hint ? (
        <span className="max-w-[86px] truncate text-[10px] font-semibold text-nk-ink-sub">
          {hint}
        </span>
      ) : null}
    </button>
  );

  // 사용자 표시 정보
  const displayName = currentTeacher?.name || "NK 원장";
  const displayRole = currentTeacher?.role === "admin" ? "총괄관리자" : currentTeacher?.role === "clinic" ? "클리닉" : "선생님";
  const avatarInitial = displayName[0] || "N";

  return (
    <aside
      className={
        inSheet
          ? "flex h-full w-full flex-shrink-0 flex-col border-r border-nk-line bg-nk-surface print:hidden"
          : `hidden h-full flex-shrink-0 flex-col border-r border-nk-line bg-nk-surface transition-[width] duration-200 md:flex print:hidden ${
              isCollapsed ? "w-[64px]" : "w-[246px]"
            }`
      }
    >
      {/* 상단 — 접기 토글.
          업무보고 복귀 링크는 공통 GNB 의 프로그램 전환 줄로 옮겼다(같은 링크를 두 곳에 두지 않는다). */}
      {!inSheet && (
        <div className="flex items-center justify-end px-3 pb-2 pt-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!isCollapsed}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-nk-ink-hint transition-colors hover:bg-nk-navy-soft hover:text-nk-navy"
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Navigation — 이 프로그램의 카테고리 전부. 길어지면 이 영역만 스크롤 */}
      <nav
        className={`min-h-0 flex-1 overflow-y-auto pb-2 ${isCollapsed ? "px-2" : "px-3"} ${inSheet ? "pt-3" : ""}`}
        style={{ scrollbarWidth: "thin" }}
      >
        {/* ── 카테고리 4개 ────────────────────────────────────────────────
            아이콘 폭으로 접어 둔 상태에서는 섹션 머리를 넣을 자리가 없으므로
            머리를 감추고 메뉴 아이콘만 카테고리 순서대로 이어 붙인다.
            그때는 접힘 상태와 무관하게 전부 보여 준다 — 아이콘만 남은 줄에서
            무엇이 접혀 있는지 알 길이 없으면 메뉴가 사라진 것으로 보인다. */}
        {visibleSectors.map((sector, index) => {
          const open = openSections.has(sector.id);
          const active = sector.name === pathSectorName;
          return (
            <div key={sector.id}>
              {index > 0 && divider}
              {!isCollapsed &&
                sectionHead(sector.id, sector.name, open, `${sector.items.length}개`, active)}
              {(open || isCollapsed) && renderItems(sector.items)}
            </div>
          );
        })}

        {divider}

        {/* 진도 현황 — 권한 무관 항상 표시(같은 탭 이동). 사이드바의 유일한 주 액션이라
            네이비 단색으로 채운다. 지금 보고 있을 때는 안쪽 테두리로 표시한다. */}
        <Link
          href="/progress"
          title="진도 현황"
          className={`group relative mb-1 flex w-full items-center overflow-hidden rounded-lg bg-nk-navy text-nk-navy-ink transition-colors ${
            isCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3.5 py-3.5"
          } ${
            progressActive
              ? "shadow-[inset_0_0_0_2px_rgb(var(--wr-navy-ink)_/_0.55)]"
              : "hover:bg-nk-navy-strong"
          }`}
          style={{ fontSize: "14px", fontWeight: 700 }}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-nk-navy-ink/20 text-nk-navy-ink">
            <BookOpenCheck className="h-[18px] w-[18px]" />
          </span>
          {!isCollapsed && <span className="truncate">진도 현황</span>}
        </Link>
      </nav>

      {/* Footer - 공개 링크 (접힘에서는 숨김) */}
      {!isCollapsed && (
        <div className="mx-3 grid grid-cols-3 gap-1.5 border-t border-nk-line-soft pb-3 pt-3">
          {/* 학부모가 보는 세 화면. 새 탭으로 열리는 바깥 링크라 사이드바 메뉴와 달리
              테두리만 있는 중립 칩으로 두어 '지금 있는 자리'와 헷갈리지 않게 한다. */}
          <Link
            href="/survey"
            target="_blank"
            className="flex items-center justify-center rounded-md border border-nk-line bg-nk-sunken px-2 py-2 text-nk-ink-sub transition-colors hover:border-nk-navy hover:text-nk-navy"
            style={{ fontSize: "10.5px", fontWeight: 700 }}
          >
            공개 설문
          </Link>
          <Link
            href="/booking"
            target="_blank"
            className="flex items-center justify-center rounded-md border border-nk-line bg-nk-sunken px-2 py-2 text-nk-ink-sub transition-colors hover:border-nk-navy hover:text-nk-navy"
            style={{ fontSize: "10.5px", fontWeight: 700 }}
          >
            공개 예약
          </Link>
          <a
            href="https://nk-guide.vercel.app/t"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-md border border-nk-line bg-nk-sunken px-2 py-2 text-nk-ink-sub transition-colors hover:border-nk-navy hover:text-nk-navy"
            style={{ fontSize: "10.5px", fontWeight: 700 }}
          >
            학부모 안내
          </a>
        </div>
      )}

      {/* User Info — 최하단. 접힘에서는 로그아웃 아이콘만 남긴다. */}
      {isCollapsed ? (
        <div className="mb-2 flex justify-center border-t border-nk-line-soft px-2 pt-2">
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-nk-ink-hint transition-colors hover:bg-nk-navy-soft hover:text-nk-navy"
            title={`로그아웃 (${displayName})`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mx-3 mb-2 rounded-lg border border-nk-line bg-nk-sunken px-3 py-2">
          <div className="mb-1.5 flex items-center gap-2 border-b border-nk-line-soft pb-1.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-nk-navy text-[10px] font-bold text-nk-navy-ink">
              NK
            </div>
            <span className="truncate text-[11px] font-bold text-nk-ink" style={{ letterSpacing: "-0.01em" }}>
              NK Academy
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md bg-nk-navy-soft text-xs font-bold text-nk-navy"
            >
              {avatarInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-bold text-nk-ink">{displayName}</div>
              <div className="text-[10px] font-semibold text-nk-ink-sub">{displayRole}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex cursor-pointer rounded-md p-1.5 text-nk-ink-hint transition-colors hover:bg-nk-navy-soft hover:text-nk-navy"
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
