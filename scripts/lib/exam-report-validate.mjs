/**
 * exam_v1 분석지 JSON 검증 — 로컬 스크립트(exam-push.mjs)용.
 *
 * ★ 단일 진실원은 `src/components/exam-report/types.ts` 의 zod 스키마다.
 *   이 파일은 그것을 순수 JS 로 옮긴 것이고, 둘이 어긋나면
 *   `src/lib/__tests__/exam-report-validate.test.ts` 가 실패한다.
 *   한쪽만 고치지 마라 — 어긋나면 "올릴 때는 통과했는데 학부모 화면에서는
 *   불러올 수 없습니다" 가 되고, 그때는 작업 폴더가 이미 지워진 뒤다.
 *
 * 반환: { ok: true } | { ok: false, errors: string[] }
 */

const TONES = ["deep", "costly", "procedure"];
const CELLS = ["o", "x"];
const VERDICTS = ["o", "x"];

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isInt = (v) => isNum(v) && Number.isInteger(v);
/** zod: z.union([z.number(), z.string().min(1)]) */
const isNumOrText = (v) => isNum(v) || (isStr(v) && v.length >= 1);

export function validateExamReportV1(input) {
  const e = [];
  const at = (p, msg) => e.push(`${p} ${msg}`);

  if (!isObj(input)) return { ok: false, errors: ["최상위가 객체가 아닙니다"] };

  // version
  if (input.version !== "exam_v1") at("version", '는 "exam_v1" 이어야 합니다');

  // student
  if (!isObj(input.student)) at("student", "는 객체여야 합니다");
  else {
    if (!isStr(input.student.name) || input.student.name.length < 1)
      at("student.name", "는 1글자 이상 문자열이어야 합니다");
    if (input.student.school !== undefined && !isStr(input.student.school))
      at("student.school", "는 문자열이어야 합니다");
    if (input.student.grade !== undefined && !isNumOrText(input.student.grade))
      at("student.grade", "는 숫자이거나 1글자 이상 문자열이어야 합니다");
  }

  // exam
  if (!isObj(input.exam)) at("exam", "은 객체여야 합니다");
  else {
    if (!isStr(input.exam.title) || input.exam.title.length < 1)
      at("exam.title", "은 1글자 이상 문자열이어야 합니다");
    if (!isStr(input.exam.date) || input.exam.date.length < 1)
      at("exam.date", "는 1글자 이상 문자열이어야 합니다");
    if (input.exam.subject !== undefined && !isStr(input.exam.subject))
      at("exam.subject", "는 문자열이어야 합니다");
    if (
      input.exam.totalQuestions !== undefined &&
      (!isInt(input.exam.totalQuestions) || input.exam.totalQuestions <= 0)
    )
      at("exam.totalQuestions", "는 1 이상의 정수여야 합니다");
  }

  // score
  if (!isObj(input.score)) at("score", "는 객체여야 합니다");
  else {
    if (!isNum(input.score.raw) || input.score.raw < 0) at("score.raw", "는 0 이상 숫자여야 합니다");
    if (!isNum(input.score.max) || input.score.max <= 0) at("score.max", "는 0 보다 큰 숫자여야 합니다");
    if (input.score.grade !== undefined && !isNumOrText(input.score.grade))
      at("score.grade", "는 숫자이거나 1글자 이상 문자열이어야 합니다");
  }

  // tally — 필수. zod 에서 optional 이 아니다.
  if (!isObj(input.tally)) at("tally", "는 객체여야 합니다(필수)");
  else {
    for (const k of ["correct", "wrongWithWork", "blank"]) {
      if (!isInt(input.tally[k]) || input.tally[k] < 0) at(`tally.${k}`, "는 0 이상 정수여야 합니다");
    }
  }

  // 퍼센트 공통 검사
  const pct = (v, p) => {
    if (!isNum(v) || v < 0 || v > 100) at(p, "는 0~100 숫자여야 합니다");
  };

  // difficulty
  if (!Array.isArray(input.difficulty)) at("difficulty", "는 배열이어야 합니다");
  else
    input.difficulty.forEach((d, i) => {
      const p = `difficulty[${i}]`;
      if (!isObj(d)) return at(p, "는 객체여야 합니다");
      if (!isStr(d.level) || d.level.length < 1) at(`${p}.level`, "은 1글자 이상 문자열이어야 합니다");
      pct(d.me, `${p}.me`);
      pct(d.national, `${p}.national`);
    });

  // units
  if (!Array.isArray(input.units)) at("units", "는 배열이어야 합니다");
  else
    input.units.forEach((u, i) => {
      const p = `units[${i}]`;
      if (!isObj(u)) return at(p, "는 객체여야 합니다");
      if (!isStr(u.name) || u.name.length < 1) at(`${p}.name`, "은 1글자 이상 문자열이어야 합니다");
      if (!Array.isArray(u.cells)) at(`${p}.cells`, "는 배열이어야 합니다");
      else
        u.cells.forEach((c, j) => {
          if (!CELLS.includes(c)) at(`${p}.cells[${j}]`, '는 "o" 또는 "x" 여야 합니다');
        });
      pct(u.me, `${p}.me`);
      pct(u.national, `${p}.national`);
    });

  // summary
  if (!Array.isArray(input.summary)) at("summary", "는 배열이어야 합니다");
  else
    input.summary.forEach((s, i) => {
      if (!isStr(s)) at(`summary[${i}]`, "는 문자열이어야 합니다");
    });

  // 선택 문자열 3개
  for (const k of ["difficultyNote", "unitsNote", "causesTitle"]) {
    if (input[k] !== undefined && !isStr(input[k])) at(k, "는 문자열이어야 합니다");
  }

  // picks
  if (!Array.isArray(input.picks)) at("picks", "는 배열이어야 합니다");
  else
    input.picks.forEach((q, i) => {
      const p = `picks[${i}]`;
      if (!isObj(q)) return at(p, "는 객체여야 합니다");
      if (!isNumOrText(q.no)) at(`${p}.no`, "는 숫자이거나 1글자 이상 문자열이어야 합니다");
      if (!isStr(q.topic) || q.topic.length < 1) at(`${p}.topic`, "은 1글자 이상 문자열이어야 합니다");
      if (!VERDICTS.includes(q.verdict)) at(`${p}.verdict`, '는 "o" 또는 "x" 여야 합니다');
      if (q.nationalAvg !== undefined) pct(q.nationalAvg, `${p}.nationalAvg`);
      if (q.hand !== undefined && !isStr(q.hand)) at(`${p}.hand`, "는 문자열이어야 합니다");
      if (!isStr(q.read)) at(`${p}.read`, "는 문자열이어야 합니다");
    });

  // causes
  if (!Array.isArray(input.causes)) at("causes", "는 배열이어야 합니다");
  else
    input.causes.forEach((c, i) => {
      const p = `causes[${i}]`;
      if (!isObj(c)) return at(p, "는 객체여야 합니다");
      if (!TONES.includes(c.tone)) at(`${p}.tone`, '는 "deep"·"costly"·"procedure" 중 하나여야 합니다');
      if (!isInt(c.count) || c.count < 0) at(`${p}.count`, "는 0 이상 정수여야 합니다");
      if (!isStr(c.title) || c.title.length < 1) at(`${p}.title`, "은 1글자 이상 문자열이어야 합니다");
      if (!isStr(c.body)) at(`${p}.body`, "는 문자열이어야 합니다");
    });

  // plan
  if (!Array.isArray(input.plan)) at("plan", "은 배열이어야 합니다");
  else
    input.plan.forEach((x, i) => {
      const p = `plan[${i}]`;
      if (!isObj(x)) return at(p, "는 객체여야 합니다");
      if (!isStr(x.title) || x.title.length < 1) at(`${p}.title`, "은 1글자 이상 문자열이어야 합니다");
      if (!isStr(x.body)) at(`${p}.body`, "는 문자열이어야 합니다");
    });

  return e.length ? { ok: false, errors: e } : { ok: true };
}
