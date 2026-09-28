/** exam-report-validate.mjs 타입 선언 (src/lib/sso/sso-v2.d.mts 와 같은 방식). */
export declare function validateExamReportV1(
  input: unknown
): { ok: true } | { ok: false; errors: string[] };
