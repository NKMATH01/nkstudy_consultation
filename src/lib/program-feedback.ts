// 오류·개선 제안 — 업무보고 의견함으로 보내는 클라이언트 계약.
//
// ★ 왜 이 앱에 저장하지 않는가
//   제보를 받아 고치는 사람은 한 명이다. 프로그램마다 따로 쌓으면 그 사람이 8군데를
//   돌며 봐야 하고, 결국 아무 데도 안 보게 된다. 수집처는 업무보고 한 곳이다.
//
// ★ 계정을 요구하지 않는다
//   이 앱 사용자는 업무보고 계정이 없다. 중앙 API 는 오리진 화이트리스트와 호출 빈도
//   제한으로 막고, 작성자는 이름 문자열로만 받는다.
//
// 서버 구현: 18.NK업무보고 프로그램 app/api/program-feedback/**

/** 업무보고(중앙 수집처). CORS 화이트리스트에 이 앱 도메인이 등록돼 있다. */
const FEEDBACK_API_BASE = "https://nk-work-report.vercel.app";

/** 이 프로그램의 슬러그. 업무보고 쪽 CHECK 목록과 한 벌로 맞춘다. */
export const PROGRAM_SLUG = "consult";
export const PROGRAM_LABEL = "등록·퇴원";

/** 대표가 나눈 두 갈래. 처리 경로가 달라 프롬프트도 갈라진다. */
export type FeedbackKind = "ERROR" | "IMPROVE";

export const KIND_LABELS: Record<FeedbackKind, string> = {
  ERROR: "프로그램 오류",
  IMPROVE: "개선 제안",
};

export type Severity = "LOW" | "MEDIUM" | "HIGH";

export const SEVERITY_LABELS: Record<Severity, string> = {
  HIGH: "높음 · 일을 못 한다",
  MEDIUM: "보통 · 우회하면 된다",
  LOW: "낮음 · 불편하다",
};

/** 인터뷰 대화 한 줄. user = 제보자, assistant = AI 의 되물음. */
export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
}

/** 서버가 돌려주는 세 가지. retry 는 형식이 깨져 한 번 더 보내야 하는 경우다. */
export type InterviewReply =
  | { type: "question"; question: string }
  | {
      type: "summary";
      title: string;
      summary: string;
      detail: string;
      severity: Severity | null;
    }
  | { type: "retry" };

// ── 상한 ───────────────────────────────────────────────────────────
// 서버(lib/program-feedback/interview.ts)와 같은 값이어야 한다. 화면이 더 느슨하면
// 사용자가 다 쓴 뒤에 400 을 받는다.

/** AI 가 되물을 수 있는 최대 횟수. 채우면 다음 호출은 무조건 정리다. */
export const MAX_QUESTION_TURNS = 3;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_REPORTER_NAME_LENGTH = 40;
export const MAX_TITLE_LENGTH = 60;
export const MAX_SUMMARY_LENGTH = 600;
export const MAX_DETAIL_LENGTH = 4000;

/** 서버가 준 error 문구를 그대로 보여 준다. 없으면 일반 문구. */
async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 대화 이력을 통째로 보내고 다음 되물음 또는 정리를 받는다.
 * 무상태 API 라 이력은 화면이 들고 다닌다.
 */
export async function requestInterview(
  kind: FeedbackKind,
  messages: InterviewMessage[],
): Promise<InterviewReply> {
  const response = await fetch(`${FEEDBACK_API_BASE}/api/program-feedback/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ program: PROGRAM_SLUG, kind, messages }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "접수 도우미를 부르지 못했습니다."));
  }

  const data = await response.json();

  if (data?.type === "question" && typeof data.question === "string") {
    return { type: "question", question: data.question };
  }

  if (data?.type === "summary") {
    const severity = data.severity;
    return {
      type: "summary",
      title: String(data.title ?? ""),
      summary: String(data.summary ?? ""),
      detail: String(data.detail ?? ""),
      severity:
        severity === "LOW" || severity === "MEDIUM" || severity === "HIGH" ? severity : null,
    };
  }

  return { type: "retry" };
}

/** 정리 확인이 끝난 의견을 업무보고 의견함에 넣는다. */
export async function submitFeedback(input: {
  kind: FeedbackKind;
  reporterName: string;
  title: string;
  summary: string;
  detail: string;
  severity: Severity | null;
  transcript: InterviewMessage[];
}): Promise<void> {
  const response = await fetch(`${FEEDBACK_API_BASE}/api/program-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      program: PROGRAM_SLUG,
      kind: input.kind,
      reporter_name: input.reporterName,
      title: input.title,
      summary: input.summary,
      detail: input.detail,
      severity: input.severity,
      transcript: input.transcript,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "제출에 실패했습니다."));
  }
}
