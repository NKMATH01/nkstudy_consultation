"use client";

// 코럴 리디자인 2단계 — 디자인 시스템(토큰·Pretendard) 적용 뼈대(미리보기 전용).
// 색은 .coral-shell 스코프 CSS 변수(var(--...)), 폰트는 layout의 Pretendard. 카테고리 서브 액센트만
// JS 상수(CATEGORY_ACCENT)로 inline. 공통 규칙: pill 버튼, 얇은 라인, 여백·배경 위주 구분.
// 서브 액센트 전환 로직·메인 콘텐츠는 이후 단계. 여기선 시스템 적용 결과만 확인.

import { useState } from "react";
import { Bell, ChevronDown, ChevronRight } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_ACCENT,
  SIDEBAR_MENUS,
  type CategoryId,
} from "@/constants/menu";

export function DesignPreviewShell() {
  const [activeCat, setActiveCat] = useState<CategoryId>("cat1");
  const [activeMenu, setActiveMenu] = useState<string>("cat1-a-1");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "cat1-a": true });

  const accent = CATEGORY_ACCENT[activeCat];
  const menus = SIDEBAR_MENUS[activeCat];
  const activeCategoryLabel = CATEGORIES.find((c) => c.id === activeCat)?.label;

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const switchCategory = (id: CategoryId) => {
    setActiveCat(id);
    const first = SIDEBAR_MENUS[id][0];
    setActiveMenu(first.children?.[0]?.id ?? first.id);
    setExpanded(first.children ? { [first.id]: true } : {});
  };

  // 선택 메뉴: 연코럴 배경 + 진코럴 텍스트 + 왼쪽 3px 카테고리 서브 액센트 라인.
  const selectedStyle = {
    background: "var(--coral-soft)",
    color: "var(--coral-deep)",
    boxShadow: `inset 3px 0 0 ${accent.color}`,
  } as const;
  const subtleText = { color: "var(--text-sub)" } as const;

  return (
    <div className="coral-shell">
      {/* ── 상단 고정 GNB ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--bg-card)] px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--coral)" }}
            >
              NK
            </div>
            <span className="text-[15px] font-semibold">[학원 이름]</span>
          </div>

          <nav className="flex items-center gap-1">
            {CATEGORIES.map((c) => {
              const on = c.id === activeCat;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => switchCategory(c.id)}
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={
                    on
                      ? { background: "var(--coral-soft)", color: "var(--coral-deep)" }
                      : subtleText
                  }
                >
                  <Icon className="h-4 w-4" />
                  {c.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[var(--row-hover)]"
            style={subtleText}
            aria-label="알림"
          >
            <Bell className="h-5 w-5" />
          </button>
          <div
            className="h-9 w-9 rounded-full"
            style={{ background: "var(--coral-soft)" }}
            aria-label="사용자"
          />
        </div>
      </header>

      <div className="flex">
        {/* ── 좌측 사이드바(200px) ──────────────────────────────────── */}
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-[200px] shrink-0 border-r border-[var(--line)] bg-[var(--bg-card)] p-3">
          <nav className="flex flex-col gap-0.5">
            {menus.map((m) => {
              const hasChildren = !!m.children?.length;
              const isOpen = expanded[m.id] ?? false;
              const on = activeMenu === m.id;
              const Icon = m.icon;
              return (
                <div key={m.id}>
                  <button
                    type="button"
                    onClick={() => (hasChildren ? toggle(m.id) : setActiveMenu(m.id))}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]"
                    style={on ? selectedStyle : subtleText}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate text-left">{m.label}</span>
                    {hasChildren &&
                      (isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      ))}
                  </button>

                  {hasChildren && isOpen && (
                    <div className="mt-0.5 flex flex-col gap-0.5 pl-9">
                      {m.children!.map((s) => {
                        const son = activeMenu === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setActiveMenu(s.id)}
                            className="rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--row-hover)]"
                            style={son ? selectedStyle : subtleText}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ── 메인(빈 placeholder — 3단계에서 구현) ─────────────────── */}
        <main className="flex-1 p-6">
          <div className="grid min-h-[420px] place-items-center rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 text-center shadow-sm">
            <div>
              <p className="text-sm font-medium" style={{ color: accent.color }}>
                {activeCategoryLabel} · 서브 액센트 {accent.name}
              </p>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-hint)" }}>
                메인 콘텐츠 영역 — 3단계에서 구현 (요약 카드 · 필터 바 · 목록)
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
