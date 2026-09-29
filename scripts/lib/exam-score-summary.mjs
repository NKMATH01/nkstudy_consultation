/**
 * 입학테스트 단원 요약 한 줄 — exam-push.mjs(저장할 때)와 앱(exam-lookup.ts, 칸이 비었을 때 즉석 계산)이 함께 쓴다.
 * 한 곳에서만 규칙을 정해 두 결과가 어긋나지 않게 한다(exam-report-validate.mjs 와 같은 방식).
 *
 * 예) "약점: 접선의 방정식 12%·함수의 연속 25% · 강점: 도함수 100%"
 *
 * 규칙
 *  - 약점: 정답률(me)이 WEAK_UNIT_MAX_PERCENT 미만인 단원 중 낮은 순 최대 2개.
 *  - 강점: 정답률이 STRONG_UNIT_MIN_PERCENT 이상인 단원 중 가장 높은 1개(약점과 겹치지 않음).
 *  - 같은 정답률이면 분석지에 적힌 순서를 따른다.
 *  - 둘 다 없으면 null.
 */

export const WEAK_UNIT_MAX_PERCENT = 50;
export const STRONG_UNIT_MIN_PERCENT = 70;

const isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);

/** {name, me} 형태만 남긴다(이름이 비었거나 정답률이 숫자가 아니면 버림). */
function cleanUnits(units) {
  if (!Array.isArray(units)) return [];
  const out = [];
  units.forEach((u, index) => {
    if (!u || typeof u !== "object") return;
    const name = typeof u.name === "string" ? u.name.trim() : "";
    if (!name || !isFiniteNum(u.me)) return;
    out.push({ name, me: u.me, index });
  });
  return out;
}

/** 약점 단원(정답률 낮은 순). limit 을 주지 않으면 전부. */
export function pickWeakUnits(units, limit) {
  const list = cleanUnits(units)
    .filter((u) => u.me < WEAK_UNIT_MAX_PERCENT)
    .sort((a, b) => a.me - b.me || a.index - b.index)
    .map(({ name, me }) => ({ name, me }));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

/** 강점 단원(정답률 높은 순). 약점 이름은 제외. */
export function pickStrongUnits(units, limit, exclude = []) {
  const skip = new Set(exclude);
  const list = cleanUnits(units)
    .filter((u) => u.me >= STRONG_UNIT_MIN_PERCENT && !skip.has(u.name))
    .sort((a, b) => b.me - a.me || a.index - b.index)
    .map(({ name, me }) => ({ name, me }));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

const pct = (n) => `${Math.round(n)}%`;

/** 약점 2개·강점 1개 요약 문자열. 쓸 내용이 없으면 null. */
export function buildExamScoreSummary(units) {
  const weak = pickWeakUnits(units, 2);
  const strong = pickStrongUnits(units, 1, weak.map((u) => u.name));
  const parts = [];
  if (weak.length) parts.push(`약점: ${weak.map((u) => `${u.name} ${pct(u.me)}`).join("·")}`);
  if (strong.length) parts.push(`강점: ${strong.map((u) => `${u.name} ${pct(u.me)}`).join("·")}`);
  return parts.length ? parts.join(" · ") : null;
}
