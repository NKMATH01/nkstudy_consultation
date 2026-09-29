// 입학테스트 정밀 진단 리포트 알림톡 + 시험지 업로드 경로 규칙(순수 함수, 서버·클라이언트 공용).
// 템플릿 행은 20260929110000_exam_pdf_and_alimtalk.sql 에서 draft 로 들어간다.

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
