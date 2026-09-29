/** exam-score-summary.mjs 타입 선언 (exam-report-validate.d.mts 와 같은 방식). */
export interface ExamUnitLike {
  name?: unknown;
  me?: unknown;
}
export interface ExamUnitPercent {
  name: string;
  me: number;
}
export declare const WEAK_UNIT_MAX_PERCENT: number;
export declare const STRONG_UNIT_MIN_PERCENT: number;
export declare function pickWeakUnits(units: unknown, limit?: number): ExamUnitPercent[];
export declare function pickStrongUnits(units: unknown, limit?: number, exclude?: string[]): ExamUnitPercent[];
export declare function buildExamScoreSummary(units: unknown): string | null;
