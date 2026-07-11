// 코럴 리디자인 5단계 — 미리보기용 mock 데이터 + 데이터 접근 추상화.
// 컴포넌트는 getListItems / getSummary 두 함수만 사용한다.
// ★ API 교체 지점: 실제 서비스에서는 이 두 함수 내부만 fetch("/api/...") 등으로 바꾸면 되고,
//   반환 타입(ListItem / Summary)만 유지하면 UI는 그대로 동작한다.

import { CATEGORIES, type CategoryId } from "@/constants/menu";

export type Grade = "초" | "중" | "고";
export type Status = "대기" | "진행" | "완료";

export interface ListItem {
  id: string;
  grade: Grade;
  title: string;
  /** 부제목 2줄(‘/’로 구분된 자리표시자) */
  subtitle: string;
  /** YYYY-MM-DD */
  date: string;
  isNew: boolean;
  status: Status;
}

export interface Summary {
  total: number;
  thisWeek: number;
  waiting: number;
  done: number;
}

// ── 임시 mock 생성(카테고리별 10건, 서로 다른 세트) ─────────────────────────
const TODAY = new Date("2026-07-11T00:00:00Z");
const GRADES: Grade[] = ["초", "중", "고"];
const STATUSES: Status[] = ["대기", "진행", "완료"];

function isoMinusDays(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(TODAY.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildItems(catLabel: string, seed: number): ListItem[] {
  return Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return {
      id: `${seed}-${n}`,
      grade: GRADES[(i + seed) % GRADES.length],
      title: `${catLabel} 목록 제목 ${String(n).padStart(2, "0")}`,
      subtitle: "부제목 첫째 줄 자리표시자입니다. / 부제목 둘째 줄 자리표시자입니다.",
      date: isoMinusDays(i * 2 + (seed % 2)),
      isNew: i < 2, // 최근 2건만 NEW
      status: STATUSES[(i * 2 + seed) % STATUSES.length],
    };
  });
}

// 카테고리별로 다른 세트(제목·학년·상태 분포가 달라짐).
const MOCK_BY_CATEGORY: Record<CategoryId, ListItem[]> = {
  cat1: buildItems(CATEGORIES[0].label, 0),
  cat2: buildItems(CATEGORIES[1].label, 1),
  cat3: buildItems(CATEGORIES[2].label, 2),
};

/** ★ API 교체 지점 — 목록 조회. 실제 서비스에선 서버/DB 조회로 대체. */
export function getListItems(categoryId: CategoryId): ListItem[] {
  return MOCK_BY_CATEGORY[categoryId];
}

/** ★ API 교체 지점 — 요약 수치(목록에서 파생). 실제 서비스에선 서버 집계로 대체 가능. */
export function getSummary(categoryId: CategoryId): Summary {
  const items = MOCK_BY_CATEGORY[categoryId];
  const weekAgo = new Date(TODAY);
  weekAgo.setUTCDate(TODAY.getUTCDate() - 7);
  return {
    total: items.length,
    thisWeek: items.filter((i) => new Date(i.date) >= weekAgo).length,
    waiting: items.filter((i) => i.status === "대기").length,
    done: items.filter((i) => i.status === "완료").length,
  };
}
