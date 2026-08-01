// 첫 14일 확인 루프의 공유 정의. 순수 함수만 둔다(강사용 시트와 온보딩 다이얼로그가 함께 쓴다).
//
// 왜 3행 고정인가: 학생마다 확인 문장이 다르면 강사가 매번 새 기준을 읽어야 하고,
// 쌓인 결과를 학생 간에 비교할 수도 없다. 행은 고정하고, 그 학생의 확인 계획 문장은
// 보조문구로만 붙인다. 매핑에 실패하면 보조문구를 비우고 3행 구조는 그대로 둔다.

/** 확인 결과. 강사 평가가 아니라 "설문 예측이 맞았는지"의 채점이다. */
export type First14Result = "matched" | "differed" | "unobserved";

export const FIRST14_RESULT_LABEL: Record<First14Result, string> = {
  matched: "일치",
  differed: "달랐음",
  unobserved: "못 봄",
};

export interface First14Row {
  /** 1-based. DB의 item_index와 같다. */
  index: 1 | 2 | 3;
  title: string;
  /** 고정 행이 무엇을 보는지 설명하는 기본 문장(보조문구가 없을 때 쓴다). */
  fallback: string;
  /** 그 학생의 확인 계획 문장을 이 행에 붙일지 판단하는 키워드. */
  keywords: string[];
}

export const FIRST14_ROWS: readonly First14Row[] = [
  {
    index: 1,
    title: "수업 진입",
    fallback: "수업 시작 때 바로 자리에 앉아 교재를 펴는지",
    keywords: ["시작", "휴대폰", "착석", "진입", "집중"],
  },
  {
    index: 2,
    title: "숙제 기한",
    fallback: "숙제를 기한 안에 제출하는지",
    keywords: ["숙제", "제출", "기한", "분량", "과제"],
  },
  {
    index: 3,
    title: "재시작",
    fallback: "막히거나 틀린 뒤 다시 시작하기까지 걸리는 시간",
    keywords: ["오답", "막힘", "막혔", "다시", "재시작", "회복"],
  },
] as const;

export interface First14RowView extends First14Row {
  /** 그 학생의 확인 계획에서 뽑은 보조문구. 매핑 실패 시 null. */
  hint: string | null;
}

/**
 * verificationPlan14Days 문장들을 고정 3행에 배분한다.
 * 한 문장은 한 행에만 붙인다 — 같은 문장이 두 행에 보이면 다른 걸 보라는 뜻으로 읽힌다.
 *
 * 행 순서대로 먼저 걸리는 문장을 집으면 "시작" 같은 넓은 키워드가 다른 행의 문장을
 * 가로챈다("숙제 시작 시각…"이 수업 진입 행으로 가는 식). 그래서 (행, 문장) 조합의
 * 키워드 적중 수를 모두 센 뒤 가장 잘 맞는 짝부터 확정한다.
 */
export function mapPlanToRows(plan: string[] | null | undefined): First14RowView[] {
  const available = (plan ?? []).map((s) => s.trim()).filter(Boolean);

  const pairs: { row: number; sentence: number; hits: number }[] = [];
  FIRST14_ROWS.forEach((row, rowIdx) => {
    available.forEach((sentence, sentenceIdx) => {
      const hits = row.keywords.filter((k) => sentence.includes(k)).length;
      if (hits > 0) pairs.push({ row: rowIdx, sentence: sentenceIdx, hits });
    });
  });

  // 적중 수 내림차순, 동점이면 행·문장 순서로 고정해 결과가 항상 같게 만든다.
  pairs.sort(
    (a, b) => b.hits - a.hits || a.row - b.row || a.sentence - b.sentence,
  );

  const assigned = new Map<number, number>();
  const usedSentences = new Set<number>();
  for (const pair of pairs) {
    if (assigned.has(pair.row) || usedSentences.has(pair.sentence)) continue;
    assigned.set(pair.row, pair.sentence);
    usedSentences.add(pair.sentence);
  }

  return FIRST14_ROWS.map((row, rowIdx) => {
    const sentenceIdx = assigned.get(rowIdx);
    return { ...row, hint: sentenceIdx === undefined ? null : available[sentenceIdx] };
  });
}

/** 저장에 남길 문장. 강사가 실제로 본 문구를 그대로 기록한다. */
export function first14ItemText(row: First14RowView): string {
  return row.hint ?? row.fallback;
}

/** 등록일로부터 14일이 지났는지. 등록일이 없으면 판단하지 않는다. */
export function isFirst14Due(
  registrationDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!registrationDate) return false;
  const start = new Date(registrationDate);
  if (Number.isNaN(start.getTime())) return false;
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return days >= 14;
}
