import type { Withdrawal } from "@/types";
import { groupWithdrawalEvents, eventMonth } from "@/lib/withdrawal-insight/events";
import { detectSignals, SIGNAL_LABEL, SIGNAL_TOPICS } from "@/lib/withdrawal-insight/signals";

// ─── 날짜 파싱 ────────────────────────────────────────────────────────────────

/** 퇴원일 문자열에서 연/월을 추출한다. 단축형("2.15")은 연도를 알 수 없으므로 year=null. */
export function parseWithdrawalYearMonth(
  dateStr: string | null | undefined
): { year: number | null; month: number | null } {
  if (!dateStr) return { year: null, month: null };
  const fullMatch = dateStr.match(/(\d{4})[.\-/](\d{1,2})/);
  if (fullMatch) return { year: parseInt(fullMatch[1]), month: parseInt(fullMatch[2]) };
  const shortMatch = dateStr.match(/^(\d{1,2})[.\-/]/);
  if (shortMatch) {
    const m = parseInt(shortMatch[1]);
    if (m >= 1 && m <= 12) return { year: null, month: m };
  }
  return { year: null, month: null };
}

export function getMonthFromDate(dateStr: string | null | undefined): number | null {
  return parseWithdrawalYearMonth(dateStr).month;
}

/** 연도 정보가 없거나 currentYear와 일치하면 true. 월 탭 수집/필터 매칭에 사용. */
export function isCurrentYearMonth(
  dateStr: string | null | undefined,
  currentYear: number
): boolean {
  const { year, month } = parseWithdrawalYearMonth(dateStr);
  if (month === null) return false;
  return year === null || year === currentYear;
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type DiagnosisType =
  | "reason-concentration"
  // teacher-rate 탐지기는 봉인됐다. 과거 저장·테스트 픽스처 호환을 위해 타입만 남긴다.
  | "teacher-rate"
  | "early-withdrawal"
  | "monthly-spike"
  | "grade-concentration"
  | "topic-persistence"
  | "data-quality";

export interface Diagnosis {
  type: DiagnosisType;
  score: number;
  severity: "심각" | "주의" | "관찰";
  title: string;
  evidence: string;
  metric: number;
  metricUnit: string;
  detail?: string;
  /** 정렬 동점 시 비교용 영향 인원 */
  affected?: number;
}

export interface Prescription {
  diagnosisType: DiagnosisType;
  title: string;
  actions: string[];
}

export interface DataQualityReport {
  total: number;
  missingReasonCount: number;
  missingReasonPct: number;
  missingDurationCount: number;
  missingComebackCount: number;
}

export interface DiagnoseInput {
  /** 월 + 과목 필터 적용분 */
  filtered: Withdrawal[];
  /** 과목 필터만 적용 (월별 급증 탐지용) */
  allSubjectFiltered: Withdrawal[];
  activeMonth: number | null;
  monthlyBaseTotal?: Record<number, number>;
  monthlyBaseByTeacher?: Record<number, Record<string, number>>;
  teacherStudentCounts?: Record<string, number>;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

export const EARLY_MONTHS = 3;

/** duration_months 유효 상한 (10년 초과는 비정상 데이터) */
const MAX_VALID_DURATION = 120;

/** 진단 목록에 남기는 최소 점수 */
const MIN_SCORE = 15;

/** 히어로 카드로 노출하는 최소 점수 */
const HERO_MIN_SCORE = 40;

const MISSING_LABEL = "미입력";

// ─── 공통 유틸 ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scale(v: number, t0: number, t1: number): number {
  if (t1 === t0) return v >= t1 ? 100 : 0;
  return clamp(((v - t0) / (t1 - t0)) * 100, 0, 100);
}

/** 표본이 작을수록 점수를 감쇠시킨다. */
function confidence(n: number, nFull: number): number {
  if (nFull <= 0) return 1;
  return Math.min(1, n / nFull);
}

function toScore(raw: number, conf: number): number {
  return Math.round(raw * conf);
}

function severityOf(score: number): Diagnosis["severity"] {
  if (score >= 70) return "심각";
  if (score >= 40) return "주의";
  return "관찰";
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function hasReason(w: Withdrawal): boolean {
  return !!w.reason_category && w.reason_category !== MISSING_LABEL;
}

function validDuration(w: Withdrawal): boolean {
  return w.duration_months != null && w.duration_months > 0 && w.duration_months <= MAX_VALID_DURATION;
}

function countBy<T>(items: T[], key: (item: T) => string | null): Record<string, number> {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const k = key(item);
    if (!k) return;
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

function topEntry(map: Record<string, number>): { name: string; count: number } | null {
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  return { name: sorted[0][0], count: sorted[0][1] };
}

// ─── 데이터 품질 ──────────────────────────────────────────────────────────────

export function computeDataQuality(filtered: Withdrawal[]): DataQualityReport {
  const total = filtered.length;
  const missingReasonCount = filtered.filter((w) => !hasReason(w)).length;
  const missingDurationCount = filtered.filter((w) => !validDuration(w)).length;
  const missingComebackCount = filtered.filter((w) => !w.comeback_possibility).length;
  return {
    total,
    missingReasonCount,
    missingReasonPct: total > 0 ? round1((missingReasonCount / total) * 100) : 0,
    missingDurationCount,
    missingComebackCount,
  };
}

// ─── 개별 탐지기 ──────────────────────────────────────────────────────────────

function detectReasonConcentration(filtered: Withdrawal[]): Diagnosis | null {
  const withReason = filtered.filter(hasReason);
  const top = topEntry(countBy(withReason, (w) => w.reason_category));
  if (withReason.length < 5 || !top || top.count < 3) return null;

  const pct = round1((top.count / withReason.length) * 100);
  const score = toScore(scale(pct, 25, 65), confidence(withReason.length, 10));
  return {
    type: "reason-concentration",
    score,
    severity: severityOf(score),
    title: `'${top.name}' 사유 편중`,
    evidence: `사유 입력 ${withReason.length}건 중 ${top.count}건 (${pct.toFixed(1)}%)`,
    metric: pct,
    metricUnit: "%",
    detail: top.name,
    affected: top.count,
  };
}

// [봉인] 강사 실명 퇴원율 탐지기는 제거했다. 분자(퇴원 건)와 분모(재원수)가 모두
// 파손된 상태(중복행·다과목 중복귀속·기간 불일치)라 여기서 나온 실명 퇴원율·심각 등급이
// 존재하지 않는 사실로 읽혔다. 개인 결과지표는 에피소드 원장이 갖춰진 뒤 재설계한다.
// 나머지 5개 탐지기(사유 집중·조기 퇴원·월별 급증·학년 집중·데이터 품질)는 그대로 둔다.
/**
 * 자유서술 주제가 여러 달에 걸쳐 반복되는지 본다.
 * reason_category 1위 한 칸("성적 부진")만 보면 원인이 한 덩어리로 뭉쳐 보이는데,
 * 원문에는 숙제 양·합반 적응·윈터스쿨 이동처럼 서로 다른 주제가 함께 지속되고 있다.
 * detectReasonConcentration(사유 편중)과 병기해 둘 다 남긴다.
 */
function detectTopicPersistence(filtered: Withdrawal[]): Diagnosis | null {
  const events = groupWithdrawalEvents(filtered);
  if (events.length < 5) return null;

  const monthsAll = new Set<number>();
  events.forEach((e) => {
    const m = eventMonth(e);
    if (m) monthsAll.add(m);
  });
  if (monthsAll.size < 3) return null;

  const ranked = SIGNAL_TOPICS.map((topic) => {
    const months = new Set<number>();
    let count = 0;
    for (const e of events) {
      if (!detectSignals(e.row).topics.includes(topic)) continue;
      count += 1;
      const m = eventMonth(e);
      if (m) months.add(m);
    }
    return { topic, months: months.size, count };
  })
    .filter((t) => t.months >= 3)
    .sort((a, b) => b.months - a.months || b.count - a.count);

  if (ranked.length === 0) return null;

  // 지속 개월 비중을 점수로 쓴다. 사람 단위 비율이 아니라 기간 커버리지다.
  const coverage = round1((ranked[0].months / monthsAll.size) * 100);
  const score = toScore(scale(coverage, 40, 90), confidence(events.length, 20));
  const top3 = ranked.slice(0, 3);
  return {
    type: "topic-persistence",
    score,
    severity: severityOf(score),
    title: "여러 달 이어지는 원인 주제",
    evidence: `사건 ${events.length}건 · ${top3
      .map((t) => `${SIGNAL_LABEL[t.topic]} ${t.months}/${monthsAll.size}개월(${t.count}건)`)
      .join(" · ")}`,
    metric: coverage,
    metricUnit: "%",
    detail: SIGNAL_LABEL[ranked[0].topic],
    affected: ranked[0].count,
  };
}

function detectEarlyWithdrawal(filtered: Withdrawal[]): Diagnosis | null {
  const valid = filtered.filter(validDuration);
  const early = valid.filter((w) => (w.duration_months as number) <= EARLY_MONTHS);
  if (valid.length < 5 || early.length < 2) return null;

  const pct = round1((early.length / valid.length) * 100);
  const score = toScore(scale(pct, 20, 60), confidence(valid.length, 10));
  return {
    type: "early-withdrawal",
    score,
    severity: severityOf(score),
    title: "조기 퇴원 비중 높음",
    evidence: `재원기간 확인 ${valid.length}건 중 재원 3개월 이하 ${early.length}건 (${pct.toFixed(1)}%)`,
    metric: pct,
    metricUnit: "%",
    affected: early.length,
  };
}

function detectMonthlySpike(input: DiagnoseInput): Diagnosis | null {
  const { allSubjectFiltered, activeMonth } = input;
  const byMonth: Record<number, number> = {};
  allSubjectFiltered.forEach((w) => {
    const m = getMonthFromDate(w.withdrawal_date);
    if (m) byMonth[m] = (byMonth[m] || 0) + 1;
  });

  const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  if (months.length < 3) return null;

  const targetMonth = activeMonth !== null ? activeMonth : months[months.length - 1];
  const targetCount = byMonth[targetMonth] || 0;
  if (targetCount < 3) return null;

  const others = months.filter((m) => m !== targetMonth);
  if (others.length === 0) return null;
  const otherAvg = others.reduce((s, m) => s + byMonth[m], 0) / others.length;
  if (otherAvg <= 0) return null;

  const ratio = targetCount / otherAvg;
  const score = toScore(scale(ratio, 1.3, 2.5), confidence(months.length, 4));
  return {
    type: "monthly-spike",
    score,
    severity: severityOf(score),
    title: `${targetMonth}월 퇴원 급증`,
    evidence: `${targetMonth}월 ${targetCount}건으로 나머지 달 평균 ${otherAvg.toFixed(1)}건의 ${ratio.toFixed(1)}배`,
    metric: round1(ratio),
    metricUnit: "배",
    detail: String(targetMonth),
    affected: targetCount,
  };
}

function detectGradeConcentration(filtered: Withdrawal[]): Diagnosis | null {
  const withGrade = filtered.filter((w) => !!w.grade);
  const top = topEntry(countBy(withGrade, (w) => w.grade));
  if (withGrade.length < 5 || !top || top.count < 3) return null;

  const pct = round1((top.count / withGrade.length) * 100);
  const score = toScore(scale(pct, 40, 70), confidence(withGrade.length, 10));
  return {
    type: "grade-concentration",
    score,
    severity: severityOf(score),
    title: `${top.name} 학년 집중 퇴원`,
    evidence: `학년 입력 ${withGrade.length}건 중 ${top.count}건 (${pct.toFixed(1)}%)`,
    metric: pct,
    metricUnit: "%",
    detail: top.name,
    affected: top.count,
  };
}

/**
 * 데이터 품질 신호. 조직 단위 사실만 담고 실명은 넣지 않는다.
 * 사유 미입력 외에 "강사 귀속 불가(분모 미연결)"와 "회고 미작성"을 함께 보고한다 —
 * 강사별 퇴원율을 다시 만들려면 먼저 이 연결부터 복구해야 하기 때문이다.
 */
function detectDataQuality(input: DiagnoseInput): Diagnosis | null {
  const { filtered, activeMonth, monthlyBaseByTeacher, teacherStudentCounts } = input;
  const report = computeDataQuality(filtered);
  if (report.total < 5) return null;

  const baseByTeacher =
    activeMonth !== null && monthlyBaseByTeacher?.[activeMonth]
      ? monthlyBaseByTeacher[activeMonth]
      : teacherStudentCounts;

  // 담당이 비었거나, 재원 분모에 그 담당이 없으면 강사 단위 집계에 쓸 수 없다.
  const unlinkedTeacherCount = filtered.filter((w) => {
    const name = w.teacher?.trim();
    if (!name) return true;
    return !baseByTeacher || !baseByTeacher[name];
  }).length;

  const missingRetrospectiveCount = filtered.filter(
    (w) => !w.retrospective?.completed_at,
  ).length;

  const facts: string[] = [];
  if (report.missingReasonCount > 0) {
    facts.push(
      `사유 미입력 ${report.missingReasonCount}건 (${report.missingReasonPct.toFixed(1)}%)`,
    );
  }
  if (unlinkedTeacherCount > 0) {
    facts.push(`강사 귀속 불가 ${unlinkedTeacherCount}건 (분모 미연결)`);
  }
  if (missingRetrospectiveCount > 0) {
    facts.push(`회고 미작성 ${missingRetrospectiveCount}건`);
  }
  if (facts.length === 0) return null;

  const score = toScore(scale(report.missingReasonPct, 20, 60), 1);
  return {
    type: "data-quality",
    score,
    severity: severityOf(score),
    title: "퇴원 기록 품질 점검 필요",
    evidence: `전체 ${report.total}건 중 ${facts.join(" · ")}`,
    metric: report.missingReasonPct,
    metricUnit: "%",
    affected: report.missingReasonCount,
  };
}
// ─── 진단 ─────────────────────────────────────────────────────────────────────

export function diagnoseWithdrawals(input: DiagnoseInput): Diagnosis[] {
  const { filtered } = input;
  const candidates: Array<Diagnosis | null> = [
    detectReasonConcentration(filtered),
    detectTopicPersistence(filtered),
    detectEarlyWithdrawal(filtered),
    detectMonthlySpike(input),
    detectGradeConcentration(filtered),
    detectDataQuality(input),
  ];

  return candidates
    .filter((d): d is Diagnosis => d !== null)
    // data-quality는 발동 시 점수와 무관하게 목록에 남긴다.
    .filter((d) => d.type === "data-quality" || d.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || (b.affected || 0) - (a.affected || 0));
}

export function pickHeroDiagnoses(diagnoses: Diagnosis[]): Diagnosis[] {
  return diagnoses
    .filter((d) => d.score >= HERO_MIN_SCORE)
    .sort((a, b) => b.score - a.score || (b.affected || 0) - (a.affected || 0))
    .slice(0, 3);
}

// ─── 처방 ─────────────────────────────────────────────────────────────────────

export const REASON_ACTION_MAP: Record<string, string[]> = {
  "성적 부진": [
    "취약 단원 진단 후 보충·클리닉 연계",
    "시험 후 1주 내 성적 상담 정례화",
    "월간 성적 변화 리포트 학부모 발송",
  ],
  "학습 의지 및 태도": [
    "담당 강사 주 1회 동기부여 면담",
    "단기 목표 설정으로 성취 경험 만들기",
    "태도 변화 조짐 시 조기 학부모 공유",
  ],
  "학습량 부담": [
    "과제량 단계별 조정 옵션 운영",
    "레벨 재진단 후 반 이동 검토",
    "학습 스케줄 조정 상담",
  ],
  "학습 관리 및 시스템": [
    "주간 학습관리 리포트 발송 체계화",
    "결석·과제 미제출 즉시 알림",
    "커리큘럼 로드맵 입회 시 사전 안내",
  ],
  "수업 내용 및 방식": [
    "수업 난이도·진도 만족도 설문 실시",
    "원장 수업 참관 후 피드백",
    "반 편성 적합성 재점검",
  ],
  "강사 역량 및 소통": [
    "강사별 학생·학부모 만족도 조사",
    "상담·소통 스크립트 교육",
    "반복 시 담당 교체 프로세스 가동",
  ],
  "타 학원/과외로 이동": [
    "퇴원 전 원장 최종 상담 필수화",
    "경쟁 학원 대비 차별점 자료 상담 활용",
    "이탈 사유 심층 인터뷰 기록",
  ],
  "친구 문제": [
    "반 배정 시 교우 관계 사전 확인",
    "필요 시 반 이동 유연 대응",
  ],
  "스케줄 변동": [
    "시간대 대안 반 제시",
    "보강·온라인 병행 옵션 안내",
  ],
  "개인 사유": [
    "복귀 가능성 상·중상 학생 재등록 관리 명단 편성",
    "퇴원 후 정기 안부 연락",
  ],
  "기타": [
    "상담 기록 재검토 후 사유 재분류",
    "사유 불명 건 심층 파악",
  ],
};

export const SIGNAL_ACTION_MAP: Partial<Record<DiagnosisType, string[]>> = {
  "early-withdrawal": [
    "신입생 첫 90일 온보딩 케어 강화 (온보딩 체크리스트 운영 점검)",
    "입회 2주·1개월·3개월 정기 상담",
    "초기 레벨 미스매치 여부 조기 점검",
  ],
  "topic-persistence": [
    "지속 주제별로 최근 사건 원문을 묶어 읽고 공통 장면 정리",
    "주제별 담당 부서(반 배치·과제량·상담 주기) 지정 후 2주 뒤 재확인",
  ],
  "monthly-spike": [
    "급증 월의 계기(시험 직후·방학·경쟁학원 이벤트) 원인 점검",
    "해당 시기 집중 상담 주간 운영",
  ],
  "grade-concentration": [
    "해당 학년 커리큘럼·반 편성 점검",
    "해당 학년 대상 설명회·간담회 개최",
  ],
  "data-quality": [
    "퇴원 등록 시 사유 입력 운영 원칙 공지",
    "미입력 건 소급 보완 (목록 필터 활용)",
  ],
};

const MAX_ACTIONS_PER_CARD = 4;

function actionsFor(diagnosis: Diagnosis, topReasonName?: string): string[] {
  if (diagnosis.type === "reason-concentration") {
    const reason = topReasonName || diagnosis.detail;
    return reason ? REASON_ACTION_MAP[reason] || REASON_ACTION_MAP["기타"] : [];
  }
  // 실명 치환 처방은 없다(강사 결과지표 봉인).
  return SIGNAL_ACTION_MAP[diagnosis.type] || [];
}

export function buildPrescriptions(
  diagnoses: Diagnosis[],
  topReasonName?: string
): Prescription[] {
  const seen = new Set<string>();
  const cards: Prescription[] = [];

  diagnoses.forEach((diagnosis) => {
    const actions: string[] = [];
    actionsFor(diagnosis, topReasonName).forEach((action) => {
      if (actions.length >= MAX_ACTIONS_PER_CARD || seen.has(action)) return;
      seen.add(action);
      actions.push(action);
    });
    if (actions.length === 0) return;
    cards.push({ diagnosisType: diagnosis.type, title: diagnosis.title, actions });
  });

  return cards;
}
