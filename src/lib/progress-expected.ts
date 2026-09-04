/**
 * 예상 진도율 계산 (순수 함수)
 *
 * 진도 현황 화면의 "예상 %"는 시작일부터 마감일(target_end_date)까지의 경과 비율이다.
 * 시작일을 잘못 잡으면(예: 진도 행을 오래전에 만든 반) 경과 비율이 부풀려져 예상%가
 * 과대 계산된다. 그래서 시작일은 아래 우선순위로 고른다.
 *
 *   0) 강사 입력 시작일    — class_progress.main_started_on (강사가 직접 넣은 값, 최우선)
 *   1) 현재 교재의 시작일  — finished_on 이 없는(=진행 중인) 이력의 started_on
 *   2) 가장 최근 완료 교재 — finished_on 중 가장 늦은 날짜
 *   3) 진도 행 생성일      — progress.created_at (최후 폴백)
 *
 * 목표 진도율(target_percent)이 있으면 마감일에 100%가 아니라 목표%에 도달하도록
 * 스케일한다(경과비율 × 목표% / 100). 상한도 목표%.
 */

/** 교재 이력 중 계산에 필요한 필드만 (types/index.ts 의 TextbookHistory 부분집합) */
export interface TextbookHistoryInput {
  started_on: string | null;
  finished_on: string | null;
}

export interface ExpectedPercentInput {
  /** 목표 마감일 (YYYY-MM-DD). 없으면 계산 불가 */
  targetEndDate: string | null | undefined;
  /** 목표 진도율(%). 없으면 100 */
  targetPercent: number | null | undefined;
  /** 반의 교재 이력 (순서 무관) */
  history: TextbookHistoryInput[];
  /** 강사가 입력한 현재 교재 시작일. 있으면 최우선으로 쓴다 */
  mainStartedOn?: string | null;
  /** 진도 행 생성일 (최후 폴백) */
  progressCreatedAt: string | null | undefined;
  /** 기준 시각. 테스트에서 주입, 기본값은 현재 시각 */
  today?: Date | string | number;
}

/** 시작일을 어디서 가져왔는지 — 화면 안내 문구·디버깅용 */
export type ExpectedStartSource =
  | "main_started_on"
  | "current_textbook"
  | "recent_finished"
  | "progress_created";

export interface ExpectedPercentResult {
  /** 예상 진도율(%), 0 ~ 목표% */
  percent: number;
  /** 계산에 쓴 시작일 원본 문자열 */
  startDate: string;
  /** 시작일 출처 */
  source: ExpectedStartSource;
}

/** 유효한 Date 로 파싱되면 반환, 아니면 null */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 시작일 후보를 우선순위대로 고른다 */
function pickStart(
  history: TextbookHistoryInput[],
  progressCreatedAt: string | null | undefined,
  mainStartedOn?: string | null
): { raw: string; date: Date; source: ExpectedStartSource } | null {
  // 0) 강사가 직접 입력한 현재 교재 시작일 — 유효한 날짜면 무조건 최우선
  const entered = parseDate(mainStartedOn);
  if (entered && mainStartedOn) {
    return { raw: mainStartedOn, date: entered, source: "main_started_on" };
  }

  // 1) 현재 진행 중인 교재(finished_on 없음)의 started_on — 여러 개면 가장 늦은 시작일
  let current: { raw: string; date: Date } | null = null;
  // 2) 완료 교재 중 가장 늦은 finished_on
  let finished: { raw: string; date: Date } | null = null;

  for (const h of history ?? []) {
    if (!h.finished_on) {
      const d = parseDate(h.started_on);
      if (d && h.started_on && (!current || d.getTime() > current.date.getTime())) {
        current = { raw: h.started_on, date: d };
      }
      continue;
    }
    const d = parseDate(h.finished_on);
    if (d && (!finished || d.getTime() > finished.date.getTime())) {
      finished = { raw: h.finished_on, date: d };
    }
  }

  if (current) return { ...current, source: "current_textbook" };
  if (finished) return { ...finished, source: "recent_finished" };

  const created = parseDate(progressCreatedAt);
  if (created && progressCreatedAt) {
    return { raw: progressCreatedAt, date: created, source: "progress_created" };
  }
  return null;
}

/**
 * 예상 진도율을 계산한다. 계산 불가(마감일 없음·시작일 없음·시작일이 마감일 이후)면 null.
 */
export function computeExpectedPercent(input: ExpectedPercentInput): ExpectedPercentResult | null {
  const end = parseDate(input.targetEndDate);
  if (!end) return null;

  const start = pickStart(input.history, input.progressCreatedAt, input.mainStartedOn);
  if (!start) return null;

  const span = end.getTime() - start.date.getTime();
  if (span <= 0) return null; // 시작일이 마감일 이후이거나 같으면 계산 의미 없음

  const nowRaw = input.today ?? Date.now();
  const now = nowRaw instanceof Date ? nowRaw : new Date(nowRaw);
  if (Number.isNaN(now.getTime())) return null;

  const rawTarget = input.targetPercent;
  // 목표%가 없거나 이상값(0 이하·비수치)이면 100%로 본다
  const target = typeof rawTarget === "number" && Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : 100;

  // 경과 비율을 0~100 으로 캡한 뒤 목표%로 스케일 (기존 로직 유지)
  const elapsedRaw = ((now.getTime() - start.date.getTime()) / span) * 100;
  const elapsed = Math.max(0, Math.min(100, elapsedRaw));
  const percent = Math.round((elapsed * target) / 100);

  return { percent, startDate: start.raw, source: start.source };
}
