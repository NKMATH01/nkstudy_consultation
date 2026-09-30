/**
 * 단원 순서표(catalog.ts)에서 과목·단원 위치를 찾는 순수 함수들 (서버·클라이언트 공용).
 *
 *  - normalizeCurriculumName : 이름 정규화(공백·기호 제거, Ⅰ/I→1, 중2(상)→중2-1, "(1)" 꼬리 제거)
 *  - detectSubjectCandidates : 교재·과정 이름 → 과목 후보(같은 이름의 2015/2022 는 둘 다)
 *  - locateInSubject         : (대단원, 소단원) → 과목 안 위치
 *  - locateRecord            : 반 기록(교재·과정·대단원·소단원) → 과목 + 위치
 *  - locateNameInTrack       : 약점 단원 이름 → 과목 안 위치(같은 과정의 다른 과목 이름도 흡수)
 *
 * 추측 금지: 후보가 둘 이상인데 가를 근거가 없으면 null.
 */

import { CURRICULUM_CATALOG, type CatalogSubject, type CurriculumYear } from "./catalog";

export interface UnitLocation {
  subjectId: string;
  majorIndex: number;
  /** 소단원을 못 찾고 대단원만 찾았으면 null */
  minorIndex: number | null;
  /** 과목 안 소단원 순번(0부터). 대단원만 찾았으면 null */
  order: number | null;
  major: string;
  minor: string | null;
  /** `${track}:${정규화한 소단원 이름}` — 같은 과정끼리 비교용 */
  key: string | null;
  /** 찾은 근거의 세기(클수록 확실) — 과목 후보 고를 때만 쓴다 */
  strength: number;
}

export interface LocatedRecord {
  subject: CatalogSubject;
  location: UnitLocation | null;
  via: "textbook" | "course" | "major" | "units";
}

export interface LocateOptions {
  /** 같은 이름 과목(2015/2022)이 모두 맞을 때 고를 쪽. 기본 2022(현행). */
  preferCurriculum?: CurriculumYear;
}

// ───────────────────────────── 정규화 ─────────────────────────────

/** 비교 전 단계: 소문자·NFKC, 중2(상)→중2-1, (1)(2) 꼬리 제거, 로마숫자→숫자. 공백·하이픈은 남긴다. */
function prepare(name: string): string {
  let t = name.normalize("NFKC").toLowerCase();
  t = t.replace(/(\d)\s*\(\s*상\s*\)/g, "$1-1").replace(/(\d)\s*\(\s*하\s*\)/g, "$1-2");
  t = t.replace(/\(\s*\d+\s*\)/g, " ");
  // NFKC 뒤 Ⅰ·Ⅱ·Ⅲ 은 i·ii·iii — 한글·공백 바로 뒤에 오는 것만 숫자로 바꾼다("axis" 같은 영문은 그대로).
  t = t.replace(/(?<=^|[가-힣\s])(iii|ii|i)(?![a-z])/g, (r) => String(r.length));
  return t;
}

/** 이름 비교 키: 한글·영문·숫자만 남긴다. */
export function normalizeCurriculumName(name: string): string {
  return prepare(name).replace(/[^0-9a-z가-힣]/g, "");
}

function aliasKeys(subject: CatalogSubject): string[] {
  return [subject.label, ...subject.aliases].map(normalizeCurriculumName).filter(Boolean);
}

// ───────────────────────────── 과목 판별 ─────────────────────────────

const byLevel = (level: CatalogSubject["level"]) => CURRICULUM_CATALOG.filter((s) => s.level === level);

/**
 * 교재·과정 이름 → 과목 후보.
 *  1) 학기 표기가 있으면 고등으로 절대 판정하지 않는다(2026-09-30 되돌림 반영):
 *     초 접두사 또는 4~6학년 N-M → 초등, 1~3학년 N-M(중등·중학·중N·(상)(하) 포함) → 중학교.
 *     예) "쎈 수학 1-1" → 중1-1, "개념쎈 수학 2-1" → 중2-1, "쎈 중3(상)" → 중3-1
 *  2) 중등·중학·중1~3 표기만 있고 학기를 모르면 후보 없음(고등으로 새지 않게).
 *  3) 고등 과목 이름(가장 긴 별칭이 이긴다: "공통수학2" > "수학2")
 */
export function detectSubjectCandidates(name: string | null | undefined): CatalogSubject[] {
  if (!name || !name.trim()) return [];
  const compact = prepare(name).replace(/\s+/g, "");

  const term = compact.match(/(초등?|중등?|중학)?(?:수학)?(?<![0-9])([1-6])-([12])(?!\d)/);
  if (term) {
    const [, prefix, grade, sem] = term;
    const elementary = prefix?.startsWith("초") || Number(grade) >= 4;
    if (elementary) return byLevel("elementary").filter((s) => s.track === `초${grade}-${sem}`);
    return byLevel("middle").filter((s) => s.track === `중${grade}-${sem}`);
  }
  if (/중등|중학|중[1-3]/.test(compact)) return [];

  const norm = normalizeCurriculumName(name);
  let bestLen = 0;
  let best: CatalogSubject[] = [];
  for (const s of byLevel("high")) {
    const len = Math.max(0, ...aliasKeys(s).filter((k) => norm.includes(k)).map((k) => k.length));
    if (len === 0) continue;
    if (len > bestLen) {
      bestLen = len;
      best = [s];
    } else if (len === bestLen) {
      best.push(s);
    }
  }
  return best;
}

/** 후보 중 하나: 하나뿐이면 그것, 여럿이면 선호 교육과정, 그래도 여럿이면 첫 번째(같은 과정끼리만 해당). */
function preferOne(cands: CatalogSubject[], opts?: LocateOptions): CatalogSubject | null {
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  const pref = opts?.preferCurriculum ?? "2022";
  return cands.find((s) => s.curriculum === pref) ?? cands[0];
}

/** 이름 → 과목 하나(없으면 null). 같은 이름 과목이 2015/2022 둘 다면 선호 교육과정. */
export function detectSubject(name: string | null | undefined, opts?: LocateOptions): CatalogSubject | null {
  return preferOne(detectSubjectCandidates(name), opts);
}

// ───────────────────────────── 과목 안 위치 ─────────────────────────────

interface MinorHit {
  majorIndex: number;
  minorIndex: number;
  exact: boolean;
}

function findMinors(subject: CatalogSubject, text: string): MinorHit[] {
  const key = normalizeCurriculumName(text);
  if (!key) return [];
  const exact: MinorHit[] = [];
  const alias: MinorHit[] = [];
  subject.units.forEach((u, majorIndex) => {
    u.minors.forEach((mn, minorIndex) => {
      if (normalizeCurriculumName(mn.name) === key) exact.push({ majorIndex, minorIndex, exact: true });
      else if (mn.aliases.some((a) => normalizeCurriculumName(a) === key)) alias.push({ majorIndex, minorIndex, exact: false });
    });
  });
  return exact.length ? exact : alias;
}

function findMajors(subject: CatalogSubject, text: string): number[] {
  const key = normalizeCurriculumName(text);
  if (!key) return [];
  const out: number[] = [];
  subject.units.forEach((u, i) => {
    if ([u.major, ...(u.aliases ?? [])].some((n) => normalizeCurriculumName(n) === key)) out.push(i);
  });
  return out;
}

function minorOrder(subject: CatalogSubject, majorIndex: number, minorIndex: number): number {
  let order = 0;
  for (let i = 0; i < majorIndex; i++) order += subject.units[i].minors.length;
  return order + minorIndex;
}

/** 단원 키 — 같은 과정(track)의 같은 소단원이면 같은 값 */
export function unitKey(subject: CatalogSubject, minorName: string): string {
  return `${subject.track}:${normalizeCurriculumName(minorName)}`;
}

/**
 * (대단원, 소단원) 또는 세부 이름 하나(minor 로 넘김) → 과목 안 위치.
 *  소단원 이름·별칭 → 대단원 칸의 값을 소단원으로 → 대단원만 순서로 찾는다.
 *  같은 이름이 여러 곳이면 대단원으로 가르고, 그래도 여럿이면 null.
 */
export function locateInSubject(
  subject: CatalogSubject,
  unit: { major?: string | null; minor?: string | null }
): UnitLocation | null {
  const majorHits = unit.major ? findMajors(subject, unit.major) : [];
  const attempts: [string | null | undefined, number][] = [
    [unit.minor, 4],
    [unit.major, 2],
  ];
  for (const [text, base] of attempts) {
    if (!text) continue;
    let hits = findMinors(subject, text);
    if (hits.length > 1 && majorHits.length) {
      const narrowed = hits.filter((h) => majorHits.includes(h.majorIndex));
      if (narrowed.length) hits = narrowed;
    }
    if (hits.length > 1) return null;
    if (hits.length === 1) {
      const h = hits[0];
      const major = subject.units[h.majorIndex];
      const minor = major.minors[h.minorIndex];
      return {
        subjectId: subject.id,
        majorIndex: h.majorIndex,
        minorIndex: h.minorIndex,
        order: minorOrder(subject, h.majorIndex, h.minorIndex),
        major: major.major,
        minor: minor.name,
        key: unitKey(subject, minor.name),
        strength: base - (h.exact ? 0 : 1) + (majorHits.includes(h.majorIndex) ? 0.5 : 0),
      };
    }
  }
  if (majorHits.length === 1) {
    const i = majorHits[0];
    return {
      subjectId: subject.id,
      majorIndex: i,
      minorIndex: null,
      order: null,
      major: subject.units[i].major,
      minor: null,
      key: null,
      strength: 1,
    };
  }
  return null;
}

/**
 * 약점 단원 이름 하나 → 과목 안 위치(소단원까지 찾았을 때만).
 * 이 과목에서 못 찾으면 같은 과정(track)의 다른 과목 이름으로 찾아 이 과목 소단원으로 옮긴다.
 *   예) 대수 과목에서 "지수"(수학Ⅰ 이름) → 대수 "지수와 로그"
 */
export function locateNameInTrack(subject: CatalogSubject, name: string): UnitLocation | null {
  const own = locateInSubject(subject, { minor: name });
  if (own && own.minorIndex != null) return own;
  for (const other of CURRICULUM_CATALOG) {
    if (other.id === subject.id || other.track !== subject.track) continue;
    const loc = locateInSubject(other, { minor: name });
    if (!loc?.minor) continue;
    const mapped = locateInSubject(subject, { minor: loc.minor });
    if (mapped && mapped.minorIndex != null) return mapped;
  }
  return null;
}

// ───────────────────────────── 반 기록 → 과목 + 위치 ─────────────────────────────

export interface ClassUnitRecord {
  textbook?: string | null;
  /** class_curriculum_progress 과정 이름(공수1·미적분1 …) */
  courses?: (string | null | undefined)[];
  major?: string | null;
  minor?: string | null;
}

function bestByLocation(
  cands: CatalogSubject[],
  unit: { major?: string | null; minor?: string | null },
  opts?: LocateOptions
): { subject: CatalogSubject; location: UnitLocation | null } | null {
  if (cands.length === 0) return null;
  const scored = cands.map((subject) => ({ subject, location: locateInSubject(subject, unit) }));
  const top = Math.max(...scored.map((s) => s.location?.strength ?? 0));
  const tied = scored.filter((s) => (s.location?.strength ?? 0) === top);
  const pick = preferOne(
    tied.map((t) => t.subject),
    opts
  );
  return tied.find((t) => t.subject === pick) ?? null;
}

/**
 * 반 기록 → 과목 + 위치.
 *  과목은 교재 이름 → 과정 이름 → 대단원 칸(예: "수학Ⅰ") 순서로 찾고,
 *  이름으로 못 찾으면 단원 이름만으로 전 과목을 뒤진다(같은 과정끼리 동점일 때만 선호 교육과정, 다른 과정끼리 동점이면 null).
 */
export function locateRecord(record: ClassUnitRecord, opts?: LocateOptions): LocatedRecord | null {
  const unit = { major: record.major, minor: record.minor };
  const sources: [string | null | undefined, LocatedRecord["via"]][] = [
    [record.textbook, "textbook"],
    ...(record.courses ?? []).map((c): [string | null | undefined, LocatedRecord["via"]] => [c, "course"]),
    [record.major, "major"],
  ];
  for (const [name, via] of sources) {
    const found = bestByLocation(detectSubjectCandidates(name), unit, opts);
    if (found) return { ...found, via };
  }

  if (!record.major && !record.minor) return null;
  const scored = CURRICULUM_CATALOG.map((subject) => ({ subject, location: locateInSubject(subject, unit) })).filter(
    (s): s is { subject: CatalogSubject; location: UnitLocation } => s.location != null
  );
  if (scored.length === 0) return null;
  const top = Math.max(...scored.map((s) => s.location.strength));
  const tied = scored.filter((s) => s.location.strength === top);
  if (new Set(tied.map((t) => t.subject.track)).size > 1) return null;
  const pick = preferOne(
    tied.map((t) => t.subject),
    opts
  );
  const hit = tied.find((t) => t.subject === pick);
  return hit ? { ...hit, via: "units" } : null;
}
