"use client";

// 코럴 리디자인 5단계 — mock 데이터·데이터 로직 분리·인터랙션 마무리(미리보기 전용).
// 데이터는 src/lib/design-preview/data.ts의 getListItems/getSummary로만 접근(API 교체 지점).
// 인터랙션: 카테고리 전환 · 사이드바 메뉴 선택(목록 헤더 반영) · 학년 필터 · 실시간 검색 · 빈 결과 안내.

import { useMemo, useState, type CSSProperties } from "react";
import { Bell, ChevronDown, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_ACCENT,
  SIDEBAR_MENUS,
  type CategoryId,
} from "@/constants/menu";
import { getListItems, getSummary } from "@/lib/design-preview/data";

const GRADE_FILTERS = ["전체", "초", "중", "고"] as const;
type GradeFilter = (typeof GRADE_FILTERS)[number];

export function DesignPreviewShell() {
  const [activeCat, setActiveCat] = useState<CategoryId>("cat1");
  const [activeMenu, setActiveMenu] = useState<string>("cat1-a-1");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "cat1-a": true });
  const [activeFilter, setActiveFilter] = useState<GradeFilter>("전체");
  const [search, setSearch] = useState("");

  const accent = CATEGORY_ACCENT[activeCat];
  const menus = SIDEBAR_MENUS[activeCat];

  // 선택 메뉴 라벨(목록 헤더에 반영).
  const activeMenuLabel = useMemo(() => {
    for (const m of menus) {
      if (m.id === activeMenu) return m.label;
      const child = m.children?.find((s) => s.id === activeMenu);
      if (child) return child.label;
    }
    return menus[0]?.label ?? "";
  }, [menus, activeMenu]);

  // 데이터 접근은 함수로만(★ API 교체 지점). 필터·검색은 클라이언트에서 파생.
  const summary = getSummary(activeCat);
  const items = useMemo(() => {
    const q = search.trim();
    return getListItems(activeCat).filter((it) => {
      if (activeFilter !== "전체" && it.grade !== activeFilter) return false;
      if (q && !it.title.includes(q) && !it.subtitle.includes(q)) return false;
      return true;
    });
  }, [activeCat, activeFilter, search]);

  const summaryCards: { label: string; value: number; attention?: boolean }[] = [
    { label: "전체", value: summary.total },
    { label: "이번 주", value: summary.thisWeek },
    { label: "대기 중", value: summary.waiting, attention: true },
    { label: "완료", value: summary.done },
  ];

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const switchCategory = (id: CategoryId) => {
    setActiveCat(id);
    const first = SIDEBAR_MENUS[id][0];
    setActiveMenu(first.children?.[0]?.id ?? first.id);
    setExpanded(first.children ? { [first.id]: true } : {});
    setActiveFilter("전체");
    setSearch("");
  };

  const accentVars = {
    "--accent": accent.color,
    "--accent-soft": accent.soft,
    "--accent-text": accent.text,
  } as CSSProperties;

  const selectedStyle = {
    background: "var(--coral-soft)",
    color: "var(--coral-deep)",
    boxShadow: "inset 3px 0 0 var(--accent)",
  } as const;
  const subtleText = { color: "var(--text-sub)" } as const;
  const badgeStyle = { background: "var(--accent-soft)", color: "var(--accent-text)" } as const;

  return (
    <div className="coral-shell" style={accentVars}>
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
                  style={on ? { background: "var(--coral-soft)", color: "var(--coral-deep)" } : subtleText}
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
          <div className="h-9 w-9 rounded-full" style={{ background: "var(--coral-soft)" }} aria-label="사용자" />
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
                    className="accent-anim flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--row-hover)]"
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
                            className="accent-anim rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[var(--row-hover)]"
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

        {/* ── 메인 콘텐츠 ───────────────────────────────────────────── */}
        <main className="flex-1 p-6">
          {/* 현황 요약 카드 */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-sm"
              >
                <p className="text-[13px]" style={subtleText}>
                  {card.label}
                </p>
                <p
                  className="accent-anim mt-2 text-[28px] font-semibold leading-none"
                  style={{ color: card.attention ? "var(--coral)" : "var(--accent)" }}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </section>

          {/* 필터 바 */}
          <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full bg-[var(--line-soft)] p-1">
              {GRADE_FILTERS.map((f) => {
                const on = activeFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveFilter(f)}
                    className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
                    style={on ? { background: "var(--coral-soft)", color: "var(--coral-deep)" } : subtleText}
                  >
                    {f}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-4 py-2">
                <Search className="h-4 w-4" style={{ color: "var(--text-hint)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="제목·부제 검색"
                  className="w-40 bg-transparent text-sm outline-none placeholder:text-[var(--text-hint)]"
                />
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
                style={{ background: "var(--coral)" }}
              >
                <Plus className="h-4 w-4" />
                만들기
              </button>
            </div>
          </section>

          {/* 목록 헤더(선택 메뉴 + 건수) */}
          <div className="mt-6 mb-2 flex items-baseline gap-2 px-1">
            <span className="text-[15px] font-semibold">{activeMenuLabel}</span>
            <span className="text-[13px]" style={subtleText}>
              {items.length}건
            </span>
          </div>

          {/* 목록 카드 */}
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-sm">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--row-hover)]"
                style={idx > 0 ? { borderTop: "1px solid var(--line-soft)" } : undefined}
              >
                <span
                  className="accent-anim grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
                  style={badgeStyle}
                >
                  {item.grade}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-medium">{item.title}</p>
                    {item.isNew && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: "#E7F1F1", color: "var(--teal)" }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[13px]" style={subtleText}>
                    {item.subtitle}
                  </p>
                </div>

                <span className="hidden shrink-0 text-[13px] sm:block" style={{ color: "var(--text-hint)" }}>
                  {item.date}
                </span>

                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--line-soft)]"
                  style={subtleText}
                  aria-label="더보기"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            ))}

            {items.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium">검색 결과가 없어요</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--text-hint)" }}>
                  다른 학년 필터나 검색어로 다시 시도해 보세요.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
