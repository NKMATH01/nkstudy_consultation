"use client";

// 코럴 리디자인 3단계 — 메인 콘텐츠(요약 카드 · 필터 바 · 목록)까지 포함한 미리보기.
// 색은 .coral-shell 스코프 CSS 변수, 폰트는 Pretendard. 서브 액센트(틸/블루베리/플럼)는 CATEGORY_ACCENT.
// 데이터는 이 단계에선 하드코딩 임시 배열(본격 mock 10건·데이터 로직 분리는 5단계).

import { useState } from "react";
import { Bell, ChevronDown, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_ACCENT,
  SIDEBAR_MENUS,
  type CategoryId,
} from "@/constants/menu";

// ── 임시 데이터(3단계 전용, 5단계에서 mock/데이터 로직으로 분리) ──────────────
const SUMMARY_CARDS: { label: string; value: number; attention?: boolean }[] = [
  { label: "전체 OO", value: 128 },
  { label: "이번 주 OO", value: 12 },
  { label: "대기 중 OO", value: 5, attention: true },
  { label: "완료 OO", value: 111 },
];

const GRADE_FILTERS = ["전체", "초", "중", "고"] as const;
type GradeFilter = (typeof GRADE_FILTERS)[number];

interface ListItem {
  id: string;
  grade: "초" | "중" | "고";
  title: string;
  isNew?: boolean;
  subtitle: string;
  date: string;
}

const SAMPLE_ITEMS: ListItem[] = [
  { id: "1", grade: "중", title: "[목록 제목 자리표시자 1]", isNew: true, subtitle: "부제목 첫째 줄 자리표시자입니다. / 부제목 둘째 줄 자리표시자입니다.", date: "2026-07-11" },
  { id: "2", grade: "고", title: "[목록 제목 자리표시자 2]", subtitle: "부제목 첫째 줄 자리표시자입니다. / 부제목 둘째 줄 자리표시자입니다.", date: "2026-07-10" },
  { id: "3", grade: "초", title: "[목록 제목 자리표시자 3]", isNew: true, subtitle: "부제목 첫째 줄 자리표시자입니다. / 부제목 둘째 줄 자리표시자입니다.", date: "2026-07-09" },
  { id: "4", grade: "중", title: "[목록 제목 자리표시자 4]", subtitle: "부제목 첫째 줄 자리표시자입니다. / 부제목 둘째 줄 자리표시자입니다.", date: "2026-07-08" },
  { id: "5", grade: "고", title: "[목록 제목 자리표시자 5]", subtitle: "부제목 첫째 줄 자리표시자입니다. / 부제목 둘째 줄 자리표시자입니다.", date: "2026-07-07" },
];

export function DesignPreviewShell() {
  const [activeCat, setActiveCat] = useState<CategoryId>("cat1");
  const [activeMenu, setActiveMenu] = useState<string>("cat1-a-1");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "cat1-a": true });
  const [activeFilter, setActiveFilter] = useState<GradeFilter>("전체");

  const accent = CATEGORY_ACCENT[activeCat];
  const menus = SIDEBAR_MENUS[activeCat];

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const switchCategory = (id: CategoryId) => {
    setActiveCat(id);
    const first = SIDEBAR_MENUS[id][0];
    setActiveMenu(first.children?.[0]?.id ?? first.id);
    setExpanded(first.children ? { [first.id]: true } : {});
  };

  const items =
    activeFilter === "전체" ? SAMPLE_ITEMS : SAMPLE_ITEMS.filter((i) => i.grade === activeFilter);

  const selectedStyle = {
    background: "var(--coral-soft)",
    color: "var(--coral-deep)",
    boxShadow: `inset 3px 0 0 ${accent.color}`,
  } as const;
  const subtleText = { color: "var(--text-sub)" } as const;
  // 학년 뱃지: 현재 카테고리 서브 액센트 틴트(연 배경 + 진 텍스트).
  const badgeStyle = { background: accent.soft, color: accent.text } as const;

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

        {/* ── 메인 콘텐츠 ───────────────────────────────────────────── */}
        <main className="flex-1 p-6">
          {/* 현황 요약 카드 */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SUMMARY_CARDS.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-sm"
              >
                <p className="text-[13px]" style={subtleText}>
                  {card.label}
                </p>
                <p
                  className="mt-2 text-[28px] font-semibold leading-none"
                  style={{ color: card.attention ? "var(--coral)" : "var(--text-main)" }}
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
                  placeholder="검색"
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

          {/* 목록 카드 */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-sm">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--row-hover)]"
                style={idx > 0 ? { borderTop: "1px solid var(--line-soft)" } : undefined}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
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
              <div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--text-hint)" }}>
                해당 학년의 항목이 없습니다.
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
