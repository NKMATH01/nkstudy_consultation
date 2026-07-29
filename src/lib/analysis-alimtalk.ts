export const ANALYSIS_RESULT_TEMPLATE_CODE = "analysis_result";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const orDash = (v: string): string => (v && v.trim() ? v : "-");

/** 검사일은 created_at(timestamptz) 기준이라 날짜 부분만 잘라 쓴다. */
function fmtDate(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}

/** V1 Analysis와 V2 프로필 화면 양쪽에서 쓸 수 있게 최소 필드만 받는다. */
export type AnalysisAlimtalkSource = {
  name: string;
  school: string | null;
  grade: string | null;
  created_at: string;
};

export function buildAnalysisResultVars(
  analysis: AnalysisAlimtalkSource,
  token: string,
): Record<string, string> {
  return {
    이름: orDash(analysis.name),
    학교: orDash(`${analysis.school ?? ""} ${analysis.grade ?? ""}`.trim()),
    검사일: orDash(fmtDate(analysis.created_at)),
    토큰: orDash(token),
  };
}
