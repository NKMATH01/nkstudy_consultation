/**
 * 입학테스트 → 등록 화면 도우미 (순수 함수만, 서버·클라이언트 공용).
 *
 *  1) EntranceExam                — getLatestExamForConsultation(src/lib/actions/exam-lookup.ts) 반환 계약(D9)
 *  2) pickTestScoreDefaults       — 등록 폼 test_score·test_note 기본값(D8: 상담 값 우선, 빈칸일 때만 시험값)
 *  3) examReportTarget            — 분석·설문 화면의 "입학테스트 평가서" 버튼 목적지(R5)
 *  4) rankClassesForStudent       — 반 배정 도우미 순위(D11: 신호 3개만)
 */

import { pickWeakUnits } from "../../scripts/lib/exam-score-summary.mjs";

// ───────────────────────────── 1) 공유 계약 ─────────────────────────────

export type EntranceExamStatus = "pending" | "analyzing" | "done" | "sent";

export interface EntranceExamUnit {
  name: string;
  me: number;
  national: number | null;
}

export interface EntranceExam {
  id: string;
  status: EntranceExamStatus;
  examTitle: string;
  examDate: string | null;
  subject: string | null;
  reportToken: string | null;
  /** 토큰이 있고, 만료·회수되지 않았을 때만 true */
  tokenUsable: boolean;
  score: { raw: number; max: number; grade: string | null } | null;
  scoreSummary: string | null;
  units: EntranceExamUnit[] | null;
}

// ───────────────────────────── 2) 등록 폼 기본값 ─────────────────────────────

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** "2026-09-28" → "09.28" (형식이 다르면 null) */
function shortDate(value: string | null): string | null {
  const m = (value ?? "").match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}` : null;
}

/** "5" → "5등급", "5등급" → 그대로 */
function gradeLabel(grade: string | null): string | null {
  const g = (grade ?? "").trim();
  if (!g) return null;
  return /등급$/.test(g) ? g : `${g}등급`;
}

/** 시험 → "35/100 · 5등급 (미적분1 입학테스트 09.28)". 점수가 없으면 null. */
export function formatExamTestScore(exam: EntranceExam | null | undefined): string | null {
  if (!exam?.score) return null;
  const head = [`${fmtNum(exam.score.raw)}/${fmtNum(exam.score.max)}`, gradeLabel(exam.score.grade)]
    .filter(Boolean)
    .join(" · ");
  const tail = [exam.examTitle.trim(), shortDate(exam.examDate)].filter(Boolean).join(" ");
  return tail ? `${head} (${tail})` : head;
}

export interface TestScoreDefaults {
  testScore: string;
  testNote: string;
  /** 입학테스트에서 채운 칸 — "입학테스트에서 불러옴" 표시용 */
  fromExam: { testScore: boolean; testNote: boolean };
}

/**
 * 상담 값이 있으면 그대로 쓰고, 빈칸일 때만 입학테스트 값으로 채운다(D8).
 */
export function pickTestScoreDefaults(
  consultationTestScore: string | null | undefined,
  exam: EntranceExam | null | undefined,
  consultationTestNote?: string | null
): TestScoreDefaults {
  const score = (consultationTestScore ?? "").trim();
  const note = (consultationTestNote ?? "").trim();
  const examScore = score ? null : formatExamTestScore(exam);
  const examNote = note ? null : exam?.scoreSummary?.trim() || null;
  return {
    testScore: score || examScore || "",
    testNote: note || examNote || "",
    fromExam: { testScore: Boolean(examScore), testNote: Boolean(examNote) },
  };
}

// ───────────────────────────── 3) 평가서 버튼 ─────────────────────────────

export type ExamReportTarget =
  | { kind: "report"; href: string; newTab: true; label: string }
  | { kind: "exam"; href: string; newTab: false; label: string }
  | { kind: "upload"; href: string; newTab: false; label: string };

/**
 * done/sent 이고 토큰을 쓸 수 있으면 → 학부모용 분석지(/report/{token}, 새 탭)
 * 그 밖에 시험이 있으면(분석 대기·토큰 만료/회수) → 입학테스트 상세(/exams/{id})
 * 시험이 없으면 → 상담이 있을 때만 "입학테스트 올리기"(/exams/new?consultation={id}), 없으면 null(숨김)
 */
export function examReportTarget(
  exam: EntranceExam | null | undefined,
  consultationId: string | null | undefined
): ExamReportTarget | null {
  if (exam) {
    const finished = exam.status === "done" || exam.status === "sent";
    if (finished && exam.reportToken && exam.tokenUsable) {
      return {
        kind: "report",
        href: `/report/${encodeURIComponent(exam.reportToken)}`,
        newTab: true,
        label: "입학테스트 평가서",
      };
    }
    return {
      kind: "exam",
      href: `/exams/${encodeURIComponent(exam.id)}`,
      newTab: false,
      label: finished ? "입학테스트 평가서" : "입학테스트 (분석 대기)",
    };
  }
  if (consultationId) {
    return {
      kind: "upload",
      href: `/exams/new?consultation=${encodeURIComponent(consultationId)}`,
      newTab: false,
      label: "입학테스트 올리기",
    };
  }
  return null;
}

// ───────────────────────────── 4) 반 배정 도우미 ─────────────────────────────

/**
 * 반 이름 접두사 → 학년. 접두사가 없으면 고3.
 * ★ src/lib/actions/class-recommendation.ts:42 gradeFromClassName 과 같은 규칙이다.
 *   그 파일은 "use server" 라 동기 함수를 export 할 수 없어 여기 그대로 옮겼다. 한쪽만 고치지 말 것.
 */
export function gradeFromClassName(className: string): string {
  const match = className.trimStart().match(/^(초|중|고)\s*([1-6])/);
  if (!match) return "고3";
  return `${match[1]}${match[2]}`;
}

/** 점수 비율(%) → 상/중/하 — class-recommendation.ts testScoreLevel 과 같은 기준(80/50). */
export function testScoreLevel(percent: number): "상" | "중" | "하" {
  if (percent >= 80) return "상";
  if (percent >= 50) return "중";
  return "하";
}

const LEVEL_ORDER: Record<string, number> = { 상: 2, 중: 1, 하: 0 };

/** 단원 이름 비교용: 공백·기호 제거, 소문자 */
export function normalizeUnitName(name: string): string {
  // 한글·영문·숫자만 남긴다(공백·괄호·가운뎃점·로마숫자 기호 등 제거).
  return name.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");
}

/** 부분 일치를 허용하는 짧은 쪽 최소 길이(정규화 후 글자 수). "도함수"(3)처럼 짧은 이름은 완전 일치만. */
const MIN_PARTIAL_MATCH_LENGTH = 4;

/** 어절 경계 뒤에서 시작하게 만드는 조사 — "함수의 극한", "극한과 연속", "도형와…" */
const BOUNDARY_PARTICLES = new Set(["의", "과", "와"]);

/**
 * 원문을 정규화하면서 "어절 경계"가 되는 정규화 위치를 모은다.
 * 경계: 맨 앞 · 공백·기호가 빠진 자리 뒤 · 조사(의·과·와) 뒤.
 */
function normalizeWithBoundaries(name: string): { text: string; boundaries: Set<number> } {
  let text = "";
  const boundaries = new Set<number>([0]);
  for (const ch of name.toLowerCase()) {
    const kept = normalizeUnitName(ch);
    if (!kept) {
      boundaries.add(text.length);
      continue;
    }
    text += kept;
    if (BOUNDARY_PARTICLES.has(ch)) boundaries.add(text.length);
  }
  return { text, boundaries };
}

/**
 * 단원 이름 일치(추측 없음).
 *  - 공백·기호 제거 후 완전히 같으면 일치.
 *  - 아니면 짧은 쪽이 4글자 이상이고, 긴 쪽의 어절 경계에서 시작할 때만 일치.
 *    "함수의 극한" = "함수의 극한과 연속" / "함수" ≠ "이차함수" / "도함수" ≠ "도함수의 활용"
 */
export function unitNamesMatch(a: string, b: string): boolean {
  const x = normalizeUnitName(a);
  const y = normalizeUnitName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [shortNorm, longRaw] = x.length < y.length ? [x, b] : y.length < x.length ? [y, a] : [null, null];
  if (!shortNorm || longRaw == null || shortNorm.length < MIN_PARTIAL_MATCH_LENGTH) return false;
  const long = normalizeWithBoundaries(longRaw);
  for (const pos of long.boundaries) {
    if (long.text.startsWith(shortNorm, pos)) return true;
  }
  return false;
}

export interface PlacementClass {
  classId: string;
  className: string;
  teacherName: string | null;
  classDays: string | null;
  classTime: string | null;
  studentCount: number;
  abilityLevel: string | null;
  classPace: string | null;
  mainTextbook: string | null;
  currentMajorUnit: string | null;
  currentMinorUnit: string | null;
  /** 교재 실제 진도(%) — current_page / main_total_pages */
  actualPercent: number | null;
  /** 교재 예상 진도(%) — computeExpectedPercent */
  expectedPercent: number | null;
  /** class_curriculum_progress status='완료' 단원 */
  passedUnits: string[];
  /** class_curriculum_progress status='진행중' 단원 */
  ongoingUnits: string[];
}

export type LevelFit = "일치" | "근접" | "차이" | "확인 필요";
export type WeakUnitStatus = "지나감" | "배우는 중" | "확인 필요";

export interface WeakUnitCheck {
  unit: string;
  me: number;
  status: WeakUnitStatus;
  /** 매칭된 반 단원 이름(확인 필요면 null) */
  matchedWith: string | null;
}

export interface RankedClass extends PlacementClass {
  score: number;
  studentLevel: "상" | "중" | "하" | null;
  levelFit: LevelFit;
  weakChecks: WeakUnitCheck[];
  /** 이미 지나간 단원 중 학생 약점 수(따라잡기 필요) */
  passedWeakCount: number;
}

export interface PlacementStudent {
  grade: string | null | undefined;
}

export interface PlacementExam {
  score: { raw: number; max: number } | null;
  units: { name: string; me: number }[] | null;
}

function normalizeGrade(grade: string | null | undefined): string | null {
  const g = (grade ?? "").replace(/\s+/g, "");
  return g ? g : null;
}

function levelFit(student: string | null, cls: string | null): { fit: LevelFit; points: number } {
  if (!student || !cls || !(cls in LEVEL_ORDER)) return { fit: "확인 필요", points: 0 };
  const diff = Math.abs(LEVEL_ORDER[student] - LEVEL_ORDER[cls]);
  if (diff === 0) return { fit: "일치", points: 3 };
  if (diff === 1) return { fit: "근접", points: 1 };
  return { fit: "차이", points: 0 };
}

function checkWeakUnit(unit: { name: string; me: number }, cls: PlacementClass): WeakUnitCheck {
  const passed = cls.passedUnits.find((p) => unitNamesMatch(unit.name, p));
  if (passed) return { unit: unit.name, me: unit.me, status: "지나감", matchedWith: passed };
  const current = [cls.currentMajorUnit, cls.currentMinorUnit, ...cls.ongoingUnits]
    .filter((u): u is string => Boolean(u))
    .find((u) => unitNamesMatch(unit.name, u));
  if (current) return { unit: unit.name, me: unit.me, status: "배우는 중", matchedWith: current };
  return { unit: unit.name, me: unit.me, status: "확인 필요", matchedWith: null };
}

/**
 * 반 순위. 신호는 3개뿐(D11).
 *  ① 학년 — 반 이름 학년이 학생 학년과 다르면 제외(학생 학년이 없으면 빈 목록)
 *  ② 점수대 ↔ class_progress.ability_level — 일치 +3, 한 단계 차이 +1
 *  ③ 이미 지나간 단원 ∩ 학생 약점 — 1개당 −1
 * 요일·학생 수·담당·진도 % 는 표시만 하고 순위에 쓰지 않는다. 동점이면 반 이름 순.
 */
export function rankClassesForStudent(
  student: PlacementStudent,
  exam: PlacementExam | null | undefined,
  classes: PlacementClass[]
): RankedClass[] {
  const grade = normalizeGrade(student.grade);
  if (!grade || classes.length === 0) return [];

  const percent =
    exam?.score && exam.score.max > 0 ? (exam.score.raw / exam.score.max) * 100 : null;
  const studentLevel = percent == null ? null : testScoreLevel(percent);
  const weak = pickWeakUnits(exam?.units ?? []);

  return classes
    .filter((c) => gradeFromClassName(c.className) === grade)
    .map((c) => {
      const { fit, points } = levelFit(studentLevel, c.abilityLevel);
      const weakChecks = weak.map((u) => checkWeakUnit(u, c));
      const passedWeakCount = weakChecks.filter((w) => w.status === "지나감").length;
      return {
        ...c,
        score: points - passedWeakCount,
        studentLevel,
        levelFit: fit,
        weakChecks,
        passedWeakCount,
      };
    })
    .sort((a, b) => b.score - a.score || a.className.localeCompare(b.className, "ko"));
}
