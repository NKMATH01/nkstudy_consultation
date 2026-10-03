// 입학테스트 정밀 진단 리포트 알림톡 + 시험지 업로드 경로 규칙 + 삭제 권한(순수 함수, 서버·클라이언트 공용).
// 템플릿 행은 20260929110000_exam_pdf_and_alimtalk.sql 에서 draft 로 들어간다.

import { selectSurveyConsultations, surveyConsultationMatchKind } from "@/lib/student-identity";

export const EXAM_REPORT_TEMPLATE_CODE = "exam_report";

/** 알림톡 발송 시 학부모 링크가 최소 이만큼은 열려 있도록 만료를 늘린다(본문 "14일간 열립니다"). */
export const EXAM_REPORT_LINK_DAYS = 14;

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const orDash = (v: string): string => (v && v.trim() ? v : "-");

/** exam_date(date, YYYY-MM-DD)를 "2026. 9. 28(월)" 로. 시간대 영향이 없도록 문자열에서 직접 읽는다. */
function fmtExamDate(value: string | null): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${y}. ${mo}. ${d}(${DAY_NAMES[day]})`;
}

export type ExamReportAlimtalkSource = {
  student_name: string;
  exam_date: string | null;
};

/** 알림톡 변수. 토큰이 없으면 리포트 버튼이 깨지므로 발송 준비 자체를 막는다(throw). */
export function buildExamReportVars(
  exam: ExamReportAlimtalkSource,
  token: string | null | undefined,
): Record<string, string> {
  const t = (token ?? "").trim();
  if (!t) throw new Error("리포트 링크(토큰)가 없습니다");
  return {
    이름: orDash(exam.student_name),
    시험일: orDash(fmtExamDate(exam.exam_date)),
    토큰: t,
  };
}

/**
 * expires_at = greatest(expires_at, now + days). 이미 더 길면 그대로, null(만료 없음)도 그대로.
 * 돌려주는 값이 입력과 같으면 UPDATE 할 필요가 없다.
 */
export function extendReportExpiry(
  currentExpiresAt: string | null,
  now: Date,
  days: number = EXAM_REPORT_LINK_DAYS,
): string | null {
  if (currentExpiresAt == null) return null;
  const target = now.getTime() + days * 24 * 60 * 60 * 1000;
  const current = new Date(currentExpiresAt).getTime();
  if (!Number.isNaN(current) && current >= target) return currentExpiresAt;
  return new Date(target).toISOString();
}

/** 발송을 막아야 하면 사유, 아니면 null. 회수(revoked)된 링크는 다시 살리지 않는다. */
export function reportTokenSendBlock(row: { revoked_at: string | null } | null): string | null {
  if (!row) return "리포트 링크를 찾을 수 없습니다";
  if (row.revoked_at) return "끊긴 리포트 링크라 보낼 수 없습니다. 분석지를 다시 올려 주세요.";
  return null;
}

/** 알림톡 미승인(draft·pending·rejected) 여부. 이때는 "카카오 심사 대기 중" 으로 안내한다. */
export function isExamTemplatePending(kakaoStatus: string | null | undefined): boolean {
  return kakaoStatus !== "approved";
}

// ─── 시험지 업로드 경로 ───────────────────────────────────────
export type ExamUploadKind = "paper" | "mathflex";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

/**
 * Storage 경로 `<examId>/<uuid>.<ext>` 검사. PDF 는 매쓰플랫 결과지에만 허용한다
 * (시험지는 문항별로 사진을 잘라 보기 때문에 사진만 받는다).
 */
export function isValidExamUploadPath(examId: string, path: string, kind: ExamUploadKind): boolean {
  const exts = kind === "mathflex" ? [...IMAGE_EXTENSIONS, "pdf"] : IMAGE_EXTENSIONS;
  const escapedId = examId.replace(/[^0-9a-f-]/gi, "");
  if (escapedId !== examId) return false;
  const pattern = new RegExp(`^${escapedId}/[0-9a-f-]{36}\\.(${exts.join("|")})$`, "i");
  return pattern.test(path);
}

// ─── 삭제 권한 ───────────────────────────────────────────────
/**
 * 입학테스트 분석 삭제는 원장(principal)·관리자(admin)만. 화면은 모든 강사에게 열려 있으므로
 * (check-permission ALWAYS_ALLOWED_PATHS) 지우기만 막는다. teachers.role 실측값 기준.
 * 역할을 모르면(null·빈 값·다른 값) 거부한다(fail-closed).
 */
export const EXAM_DELETE_ROLES = new Set(["principal", "admin"]);

export function canDeleteExam(role: string | null | undefined): boolean {
  return EXAM_DELETE_ROLES.has(role ?? "");
}

// ─── 입학테스트 진행 상태(작성 중 → 분석 요청됨 → 분석 중 → 완료 → 보냄) ─────
// draft 는 20261003100000_exam_analyses_draft_status.sql 에서 추가된다.
// exam-pull 은 pending 만 가져가므로, 작성 중(draft)인 시험은 원장님 PC 로 넘어가지 않는다.
export type ExamFlowStatus = "draft" | "pending" | "analyzing" | "done" | "sent";

export const EXAM_PAPER_MAX = 40;
export const EXAM_MATHFLEX_MAX = 2;
const ALREADY_REQUESTED = "이미 분석 요청됨";
const NEED_PAPER = "시험지를 먼저 올려 주세요";
const NEED_CONSULTATION = "상담을 먼저 연결하세요";
/** 분석이 끝난 시험에는 파일을 더 붙이지 않는다. 재시험은 /exams/new 한 화면 올리기로. */
export const EXAM_FINISHED_MESSAGE = "이미 분석이 끝난 시험입니다. 재시험은 '새 시험지 올리기'로 올려 주세요";

const isRequested = (s: ExamFlowStatus) => s === "pending" || s === "analyzing";
const isFinished = (s: ExamFlowStatus) => s === "done" || s === "sent";

export type ExamAddFilesDecision = { kind: "append" } | { kind: "blocked"; error: string };

/** 이 상태의 시험에 시험지·매쓰플랫 파일을 더 올릴 때. 작성 중(draft)에만 덧붙인다. */
export function decideExamAddFiles(status: ExamFlowStatus): ExamAddFilesDecision {
  if (status === "draft") return { kind: "append" };
  if (isRequested(status)) return { kind: "blocked", error: ALREADY_REQUESTED };
  if (isFinished(status)) return { kind: "blocked", error: EXAM_FINISHED_MESSAGE };
  return { kind: "blocked", error: "올릴 수 없는 상태입니다" };
}

export type ExamDraftDecision =
  | { kind: "reuse"; id: string }
  | { kind: "create" }
  | { kind: "blocked"; error: string };

/**
 * 상담 1건의 시험들(최신순)로 작성 중 시험을 고른다.
 * 작성 중이 있으면 그것. 가장 최근이 분석 요청됨·분석 중·완료·보냄이면 막는다(재시험은 한 화면 올리기로).
 * 시험이 없을 때만 새로 만든다.
 */
export function decideExamDraft(exams: { id: string; status: ExamFlowStatus }[]): ExamDraftDecision {
  const draft = exams.find((e) => e.status === "draft");
  if (draft) return { kind: "reuse", id: draft.id };
  if (exams.length > 0 && isRequested(exams[0].status)) return { kind: "blocked", error: ALREADY_REQUESTED };
  if (exams.length > 0 && isFinished(exams[0].status)) return { kind: "blocked", error: EXAM_FINISHED_MESSAGE };
  return { kind: "create" };
}

/** 분석 요청을 막아야 하면 사유, 아니면 null. 작성 중 + 시험지 1장 이상일 때만 요청할 수 있다. */
export function examRequestBlock(status: ExamFlowStatus, paperCount: number): string | null {
  if (isRequested(status)) return ALREADY_REQUESTED;
  if (isFinished(status)) return "이미 분석이 끝난 시험입니다";
  if (status !== "draft") return "요청할 수 없는 상태입니다";
  if (paperCount < 1) return NEED_PAPER;
  return null;
}

/** 이미 올린 개수 + 이번에 올리는 개수가 한도를 넘으면 사유. */
export function examFileLimitBlock(kind: ExamUploadKind, existing: number, adding: number): string | null {
  if (adding < 1) return "올릴 파일이 없습니다";
  const max = kind === "paper" ? EXAM_PAPER_MAX : EXAM_MATHFLEX_MAX;
  if (existing + adding > max) {
    return kind === "paper"
      ? `시험지 사진은 최대 ${max}장까지 올릴 수 있습니다`
      : `매쓰플랫 결과지는 최대 ${max}개까지 올릴 수 있습니다`;
  }
  return null;
}

export type ExamIconTone = "off" | "empty" | "filled" | "ready" | "requested" | "analyzing" | "done";

export interface ExamIconState {
  enabled: boolean;
  tone: ExamIconTone;
  title: string;
  action: "upload" | "request" | "open" | null;
}

export interface ExamFlowSnapshot {
  id: string;
  status: ExamFlowStatus;
  paperCount: number;
  mathflexCount: number;
}

/**
 * 설문 목록·입학테스트 목록의 아이콘 3개(시험지·매쓰플랫·분석 요청) 상태.
 * consultationCount: 이 행에 연결된 상담 수. 1건이 아니면 누구 시험인지 모르므로 셋 다 막는다.
 */
export function examFlowIcons(
  consultationCount: number,
  exam: ExamFlowSnapshot | null,
): { paper: ExamIconState; mathflex: ExamIconState; request: ExamIconState } {
  if (consultationCount !== 1) {
    const off: ExamIconState = { enabled: false, tone: "off", title: NEED_CONSULTATION, action: null };
    return { paper: off, mathflex: off, request: off };
  }

  const finishedTitle = exam?.status === "sent" ? "보냄 — 분석 결과 보기" : "분석 완료 — 결과 보기";
  const upload = (label: string, count: number, unit: string): ExamIconState => {
    if (!exam || exam.status === "draft") {
      return count > 0
        ? { enabled: true, tone: "filled", title: `${label} ${count}${unit} 올림 — 더 올리기`, action: "upload" }
        : { enabled: true, tone: "empty", title: `${label} 올리기`, action: "upload" };
    }
    if (isRequested(exam.status)) {
      return { enabled: false, tone: count > 0 ? "filled" : "empty", title: `${label} — ${ALREADY_REQUESTED}`, action: null };
    }
    // 완료·보냄: 결과 화면으로 간다(재시험은 /exams/new 한 화면 올리기로).
    return { enabled: true, tone: "done", title: finishedTitle, action: "open" };
  };

  const paper = upload("시험지", exam?.paperCount ?? 0, "장");
  const mathflex = upload("매쓰플랫", exam?.mathflexCount ?? 0, "개");

  let request: ExamIconState;
  if (!exam) {
    request = { enabled: false, tone: "empty", title: NEED_PAPER, action: null };
  } else if (exam.status === "draft") {
    request =
      exam.paperCount > 0
        ? { enabled: true, tone: "ready", title: "분석 요청", action: "request" }
        : { enabled: false, tone: "empty", title: NEED_PAPER, action: null };
  } else if (exam.status === "pending") {
    request = { enabled: false, tone: "requested", title: "분석 요청됨 — 원장님 분석 대기", action: null };
  } else if (exam.status === "analyzing") {
    request = { enabled: false, tone: "analyzing", title: "분석 중", action: null };
  } else {
    request = { enabled: true, tone: "done", title: finishedTitle, action: "open" };
  }
  return { paper, mathflex, request };
}

/** 입학테스트 목록 상태 칩. unregistered 는 설문 분석은 있는데 시험 행이 없는 학생(파생 행). */
export type ExamListChip = "unregistered" | ExamFlowStatus;

export const EXAM_STATUS_LABEL: Record<ExamListChip, string> = {
  unregistered: "미등록",
  draft: "작성 중",
  pending: "분석 요청됨",
  analyzing: "분석 중",
  done: "완료",
  sent: "보냄",
};

/** 상담마다 가장 최근 시험 하나(created_at 기준). 상담이 없는 시험은 뺀다. */
export function latestExamByConsultation<T extends { consultation_id: string | null; created_at: string }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!row.consultation_id) continue;
    const prev = map.get(row.consultation_id);
    if (!prev || new Date(row.created_at).getTime() > new Date(prev.created_at).getTime()) {
      map.set(row.consultation_id, row);
    }
  }
  return map;
}

export interface ExamCandidateConsultation {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  subject: string | null;
  analysis_id: string | null;
  consult_date: string | null;
}

/**
 * 입학테스트 목록의 "미등록" 파생 행(DB 행을 만들지 않는다).
 * 설문 분석(analysis_id)이 있고, 같은 분석에 묶인 어느 상담에도 시험 행이 없는 학생만.
 * 같은 분석의 상담이 여러 건(재상담)이면 가장 최근 상담 하나만 쓴다 — consultations 는 최신순으로 넘긴다.
 */
export function unregisteredExamConsultations<T extends ExamCandidateConsultation>(
  consultations: T[],
  examConsultationIds: Set<string>,
): T[] {
  const analysesWithExam = new Set<string>();
  for (const c of consultations) {
    if (c.analysis_id && examConsultationIds.has(c.id)) analysesWithExam.add(c.analysis_id);
  }
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of consultations) {
    if (!c.analysis_id || analysesWithExam.has(c.analysis_id) || seen.has(c.analysis_id)) continue;
    seen.add(c.analysis_id);
    out.push(c);
  }
  return out;
}

/**
 * 설문 행(재상담으로 상담 여러 건)에서 입학테스트 아이콘이 붙을 상담과 보여 줄 시험.
 * 매칭된 상담들 중 진행 중 시험(draft·pending·analyzing)이 있으면 가장 최근 것과 그 시험의 상담에 붙인다
 * — 같은 학생에게 작성 중 시험이 두 개 생기지 않게. 없으면 fallbackConsultationId(고른 날짜 또는 최신 상담)
 * + 매칭 상담 전체 중 가장 최근 시험.
 */
export function pickExamTarget<T extends ExamFlowSnapshot & { created_at: string }>(
  matchedConsultationIds: string[],
  examByConsultation: Record<string, T>,
  fallbackConsultationId: string,
): { consultationId: string; exam: T | null } {
  const time = (e: T) => new Date(e.created_at).getTime();
  let latest: { consultationId: string; exam: T } | null = null;
  let active: { consultationId: string; exam: T } | null = null;
  for (const id of matchedConsultationIds) {
    const exam = examByConsultation[id];
    if (!exam) continue;
    if (!latest || time(exam) > time(latest.exam)) latest = { consultationId: id, exam };
    if ((exam.status === "draft" || isRequested(exam.status)) && (!active || time(exam) > time(active.exam))) {
      active = { consultationId: id, exam };
    }
  }
  if (active) return active;
  return { consultationId: fallbackConsultationId, exam: latest?.exam ?? null };
}

/** 입학테스트 목록에서 "최근" 미등록으로 보는 기간(상담일 또는 설문일 기준). */
export const EXAM_RECENT_DAYS = 30;

/** YYYY-MM-DD 에서 days 일 전(UTC 기준 날짜 산술 — 날짜 문자열끼리만 비교한다). */
function daysBefore(today: string, days: number): string {
  const [y, m, d] = today.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

/**
 * 미등록 학생을 보여 주기 시작하는 날 — 입학테스트 분석을 처음 쓴 박서진 학생 시험일.
 * 그 전 학생은 시험지를 올린 적이 없는 시절이라 "미등록"으로 띄우면 목록만 길어진다(원장 지시 2026-10-03).
 */
export const EXAM_LIST_START_DATE = "2026-09-28";

/**
 * 입학테스트 목록 순서: 진행 중(작성 중·분석 요청됨·분석 중) → 최근 미등록 → 완료·보냄. 묶음마다 날짜 내림차순.
 * 미등록은 상담일·설문일 중 늦은 날 기준으로
 *  - startDate(박서진 시험일) 전이거나 날짜가 없으면 아예 빼고,
 *  - today - EXAM_RECENT_DAYS 이후(미래 포함)면 recent, 그보다 오래됐으면 older(접어 둔다).
 */
export function arrangeExamList<
  E extends { status: ExamFlowStatus; created_at: string },
  U extends { consult_date: string | null; survey_date: string | null },
>(
  exams: E[],
  unregistered: U[],
  today: string,
  days: number = EXAM_RECENT_DAYS,
  startDate: string = EXAM_LIST_START_DATE,
): { active: E[]; recent: U[]; older: U[]; finished: E[] } {
  const byCreated = (a: E, b: E) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const lastDate = (x: U): string => {
    const dates = [x.consult_date, x.survey_date].filter((v): v is string => !!v).map((v) => v.slice(0, 10));
    return dates.sort().at(-1) ?? "";
  };
  const byLast = (a: U, b: U) => lastDate(b).localeCompare(lastDate(a));
  const cutoff = daysBefore(today, days);

  const recent: U[] = [];
  const older: U[] = [];
  for (const u of unregistered) {
    const last = lastDate(u);
    if (!last || last < startDate) continue;
    (last >= cutoff ? recent : older).push(u);
  }

  return {
    active: exams.filter((e) => e.status === "draft" || isRequested(e.status)).sort(byCreated),
    recent: recent.sort(byLast),
    older: older.sort(byLast),
    finished: exams.filter((e) => isFinished(e.status)).sort(byCreated),
  };
}

// ─── 설문 기준 미등록 후보(설문하면 입학테스트 목록에 자동으로 이름이 나온다) ─────────────

export interface ExamSurveyCandidate {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  parent_phone: string | null;
  /** 설문의 분석 id(surveys.analysis_id 또는 analyses.survey_id 로 찾은 것). 없으면 null. */
  analysis_id: string | null;
  created_at: string;
  /** 같은 이름 설문이 여러 장이면 true — /surveys 와 같이 이름만으로는 짝짓지 않는다. */
  ambiguousName: boolean;
}

export interface ExamMatchConsultation extends ExamCandidateConsultation {
  parent_phone: string | null;
}

export interface UnregisteredExamCandidate {
  /** 행 key. 설문 기반은 설문 id, 상담 기반은 상담 id. */
  key: string;
  /** 아이콘이 붙을 상담. 강한 매칭이 아니면 null(아이콘 비활성 "상담을 먼저 연결하세요"). */
  consultation_id: string | null;
  analysis_id: string | null;
  name: string;
  school: string | null;
  grade: string | null;
  subject: string | null;
  consult_date: string | null;
  survey_date: string | null;
}

/** 시각(ISO)·날짜 문자열을 한국 날짜 YYYY-MM-DD 로. 날짜만 있으면 그대로. */
function kstDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return value.slice(0, 10);
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 설문(분석 있음, 시작일 이후)마다 /surveys 와 같은 규칙으로 상담을 짝짓는다.
 * - 강한 매칭(분석 id·학부모 번호): 매칭 상담 중 시험이 하나라도 있으면 뺀다(그 시험 행이 목록에 있다).
 *   없으면 최신 상담(consultations 는 consult_date 최신순으로 넘긴다)을 붙인다.
 * - 이름만·없음: 상담 없이 행만(아이콘 비활성).
 * 같은 상담(또는 같은 설문 분석)에 설문이 여러 장이면 최신 설문 1행.
 * coveredConsultationIds·coveredAnalysisIds 는 상담 기반 후보에서 같은 학생을 빼는 데 쓴다.
 */
export function surveyBasedUnregistered<S extends ExamSurveyCandidate, C extends ExamMatchConsultation>(
  surveys: S[],
  consultations: C[],
  examConsultationIds: Set<string>,
  hasAnalysis: (survey: S) => boolean = (survey) => !!survey.analysis_id,
  startDate: string = EXAM_LIST_START_DATE,
): { rows: UnregisteredExamCandidate[]; coveredConsultationIds: Set<string>; coveredAnalysisIds: Set<string> } {
  const coveredConsultationIds = new Set<string>();
  const coveredAnalysisIds = new Set<string>();
  const seen = new Set<string>();
  const rows: UnregisteredExamCandidate[] = [];
  const ordered = [...surveys].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const survey of ordered) {
    if (!hasAnalysis(survey) || kstDate(survey.created_at) < startDate) continue;
    const identity = { name: survey.name, parentPhone: survey.parent_phone, analysisId: survey.analysis_id };
    const options = { allowNameFallback: !survey.ambiguousName };
    const matched = selectSurveyConsultations(consultations, identity, options);
    const strong = matched.length > 0 && surveyConsultationMatchKind(consultations, identity, options) === "strong";
    if (survey.analysis_id) coveredAnalysisIds.add(survey.analysis_id);

    if (strong) {
      for (const c of matched) coveredConsultationIds.add(c.id);
      if (matched.some((c) => examConsultationIds.has(c.id))) continue;
      const latest = matched[0];
      if (seen.has(`c:${latest.id}`)) continue;
      seen.add(`c:${latest.id}`);
      rows.push({
        key: survey.id,
        consultation_id: latest.id,
        analysis_id: survey.analysis_id,
        name: survey.name || latest.name,
        school: survey.school ?? latest.school,
        grade: survey.grade ?? latest.grade,
        subject: latest.subject,
        consult_date: latest.consult_date,
        survey_date: survey.created_at,
      });
      continue;
    }

    const dedupeKey = survey.analysis_id ? `a:${survey.analysis_id}` : `s:${survey.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({
      key: survey.id,
      consultation_id: null,
      analysis_id: survey.analysis_id,
      name: survey.name,
      school: survey.school,
      grade: survey.grade,
      subject: null,
      consult_date: null,
      survey_date: survey.created_at,
    });
  }
  return { rows, coveredConsultationIds, coveredAnalysisIds };
}

/**
 * 설문 기반 후보를 먼저, 그다음 consultations.analysis_id 기반 후보 중 같은 상담·같은 분석(같은 학생)이 아닌 것만.
 */
export function mergeUnregisteredCandidates<
  A extends { consultation_id: string | null; analysis_id: string | null },
  B extends { consultation_id: string | null; analysis_id: string | null },
>(surveyRows: A[], analysisRows: B[], coveredConsultationIds: Set<string>, coveredAnalysisIds: Set<string> = new Set()): (A | B)[] {
  const consultationIds = new Set(coveredConsultationIds);
  const analysisIds = new Set(coveredAnalysisIds);
  for (const r of surveyRows) {
    if (r.consultation_id) consultationIds.add(r.consultation_id);
    if (r.analysis_id) analysisIds.add(r.analysis_id);
  }
  const rest = analysisRows.filter(
    (r) =>
      !(r.consultation_id && consultationIds.has(r.consultation_id)) &&
      !(r.analysis_id && analysisIds.has(r.analysis_id)),
  );
  return [...surveyRows, ...rest];
}
