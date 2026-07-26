/** 퇴원 건별 구조화 회고. withdrawals.retrospective JSONB에 그대로 저장된다. */
export interface WithdrawalRetrospective {
  /** ① 첫 징후는 언제, 무엇이었나 */
  first_sign: string;
  /** ② 우리가 시도한 개입 */
  our_attempts: string;
  /** ③ 시간을 돌린다면 다르게 할 것 */
  do_differently: string;
  /** ④ 시스템적으로 바꿀 것 하나 */
  system_change: string;
  /** 배움 한 줄 */
  lesson: string;
  manager_comment: string;
  author: string;
  completed_at: string | null;
}

export const EMPTY_RETROSPECTIVE: WithdrawalRetrospective = {
  first_sign: "",
  our_attempts: "",
  do_differently: "",
  system_change: "",
  lesson: "",
  manager_comment: "",
  author: "",
  completed_at: null,
};

/** 완료 판정에 쓰이는 필수 항목 (원장 코멘트·작성자는 제외) */
const REQUIRED_FIELDS = [
  "first_sign",
  "our_attempts",
  "do_differently",
  "system_change",
  "lesson",
] as const;

/** 내용이 있으면 "작성 중"으로 보는 항목 (작성자는 자동 채움이라 제외) */
const CONTENT_FIELDS = [...REQUIRED_FIELDS, "manager_comment"] as const;

export type RetrospectiveStatus = "none" | "draft" | "complete";

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** DB JSONB 값을 방어적으로 파싱한다. 컬럼이 없거나 형식이 깨져도 null을 돌려준다. */
export function parseRetrospective(raw: unknown): WithdrawalRetrospective | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const source = raw as Record<string, unknown>;
  return {
    first_sign: toText(source.first_sign),
    our_attempts: toText(source.our_attempts),
    do_differently: toText(source.do_differently),
    system_change: toText(source.system_change),
    lesson: toText(source.lesson),
    manager_comment: toText(source.manager_comment),
    author: toText(source.author),
    completed_at: typeof source.completed_at === "string" ? source.completed_at : null,
  };
}

export function isRetrospectiveComplete(
  retrospective: WithdrawalRetrospective | null | undefined
): boolean {
  if (!retrospective) return false;
  return REQUIRED_FIELDS.every((field) => retrospective[field].trim() !== "");
}

export function retrospectiveStatus(
  retrospective: WithdrawalRetrospective | null | undefined
): RetrospectiveStatus {
  if (!retrospective) return "none";
  if (isRetrospectiveComplete(retrospective)) return "complete";
  const hasContent = CONTENT_FIELDS.some((field) => retrospective[field].trim() !== "");
  return hasContent ? "draft" : "none";
}

export function computeRetrospectiveRate(
  withdrawals: Array<{ retrospective: WithdrawalRetrospective | null }>
): { total: number; completed: number; rate: number } {
  const total = withdrawals.length;
  const completed = withdrawals.filter((w) => isRetrospectiveComplete(w.retrospective)).length;
  const rate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  return { total, completed, rate };
}
