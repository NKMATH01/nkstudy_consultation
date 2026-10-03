// 학부모 질문지 8문항 — 테스트 예약 알림톡(consult_confirm_v3) 버튼으로 받는다.
// 원본: src/components/analysis-report-v2/parent-report.tsx PARENT_QUESTIONS(종이 결과지용).
// 그 파일은 나중에 여기서 import 하도록 바꾼다. 문항을 고치면 저장된 answers 해석도 같이 본다.
//
// 차이: 2번 "이 결과지가 파악한 학생 모습이 …같으신가요?" 는 결과지를 받기 전에 묻는 질문지라 맞지 않아
//       "학부모님이 보시는 학생의 공부 모습을 한 줄로 적어 주세요"(자유서술)로 바꿨다.

import { z } from "zod";

export const PARENT_QUESTIONNAIRE_TEXT_MAX = 300;
export const PARENT_QUESTIONNAIRE_VERSION = 1;

export const Q1_OPTIONS = ["원한다", "적당히", "부담 없이"] as const;
export const Q3_OPTIONS = ["매주", "2주에 한 번", "한 달에 한 번", "필요할 때만"] as const;
export const Q4_OPTIONS = ["그렇다", "반반이다", "아니다"] as const;
export const Q5_OPTIONS = ["그렇다", "아직 정하지 않았다", "다른 목표가 있다"] as const;
export const Q5_OTHER_OPTION = "다른 목표가 있다";
export const Q7_OPTIONS = ["강하게 밀어 주기", "다독여 주기", "학부모와 먼저 상의"] as const;

export type ParentQuestion =
  | {
      no: number;
      key: "q1" | "q3" | "q4" | "q5" | "q7";
      kind: "choice";
      q: string;
      options: readonly string[];
      /** 이 선택지를 고르면 덧붙여 적을 칸을 연다 */
      other?: { when: string; key: "q5_other"; label: string };
    }
  | { no: number; key: "q2" | "q8"; kind: "text"; q: string; placeholder: string }
  | {
      no: number;
      key: "q6";
      kind: "scores";
      q: string;
      fields: readonly { key: "q6_math" | "q6_english"; label: string }[];
    };

export const PARENT_QUESTIONNAIRE_QUESTIONS: readonly ParentQuestion[] = [
  {
    no: 1,
    key: "q1",
    kind: "choice",
    q: "학생에게 강한 학습(철저한 관리, 많은 숙제)을 원하시나요?",
    options: Q1_OPTIONS,
  },
  {
    no: 2,
    key: "q2",
    kind: "text",
    q: "학부모님이 보시는 학생의 공부 모습을 한 줄로 적어 주세요",
    placeholder: "예) 숙제는 꼬박꼬박 하지만 틀린 문제를 다시 보지 않아요",
  },
  {
    no: 3,
    key: "q3",
    kind: "choice",
    q: "학원에서 연락을 얼마나 자주 받고 싶으신가요?",
    options: Q3_OPTIONS,
  },
  {
    no: 4,
    key: "q4",
    kind: "choice",
    q: "공부 문제에서 학생이 원하는 대로 따라가 주시는 편인가요?",
    options: Q4_OPTIONS,
  },
  {
    no: 5,
    key: "q5",
    kind: "choice",
    q: "좋은 대학 진학이 목표인가요?",
    options: Q5_OPTIONS,
    other: { when: Q5_OTHER_OPTION, key: "q5_other", label: "다른 목표" },
  },
  {
    no: 6,
    key: "q6",
    kind: "scores",
    q: "이번 시험의 목표 점수는 몇 점인가요?",
    fields: [
      { key: "q6_math", label: "수학" },
      { key: "q6_english", label: "영어" },
    ],
  },
  {
    no: 7,
    key: "q7",
    kind: "choice",
    q: "학생이 힘들어할 때 학원이 어떻게 해 주길 원하시나요?",
    options: Q7_OPTIONS,
  },
  {
    no: 8,
    key: "q8",
    kind: "text",
    q: "학원에 특별히 바라는 점이 있으신가요?",
    placeholder: "자유롭게 적어 주세요",
  },
];

// ── 검증 ────────────────────────────────────────────────────────────────

const choice = <T extends readonly [string, ...string[]]>(options: T) =>
  z.enum(options, { error: "선택하지 않은 문항이 있습니다" });

/** 자유서술: trim, 빈 칸은 undefined, 300자 이하 */
const freeText = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || undefined : v ?? undefined),
  z
    .string()
    .max(PARENT_QUESTIONNAIRE_TEXT_MAX, `${PARENT_QUESTIONNAIRE_TEXT_MAX}자 이내로 적어 주세요`)
    .optional(),
);

/** 목표 점수: 0~100 정수, 비워도 된다. 입력칸 문자열("85")도 받는다. */
const targetScore = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "string") {
      const t = v.trim();
      if (!t) return undefined;
      return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
    }
    return v;
  },
  z
    .number({ error: "목표 점수는 숫자로 적어 주세요" })
    .int("목표 점수는 정수로 적어 주세요")
    .min(0, "목표 점수는 0~100 사이로 적어 주세요")
    .max(100, "목표 점수는 0~100 사이로 적어 주세요")
    .optional(),
);

export const parentQuestionnaireAnswersSchema = z
  .object({
    q1: choice(Q1_OPTIONS),
    q2: freeText,
    q3: choice(Q3_OPTIONS),
    q4: choice(Q4_OPTIONS),
    q5: choice(Q5_OPTIONS),
    q5_other: freeText,
    q6_math: targetScore,
    q6_english: targetScore,
    q7: choice(Q7_OPTIONS),
    q8: freeText,
  })
  .transform((a) => ({
    ...a,
    q5_other: a.q5 === Q5_OTHER_OPTION ? a.q5_other : undefined,
  }));

export type ParentQuestionnaireAnswers = z.output<typeof parentQuestionnaireAnswersSchema>;

// ── 토큰 상태 ────────────────────────────────────────────────────────────

export type QuestionnaireTokenState = "not_found" | "revoked" | "answered" | "expired" | "open";

export type QuestionnaireTokenRow = {
  expires_at: string | null;
  answered_at: string | null;
  revoked_at: string | null;
};

/**
 * 공개 화면에서 보여 줄 상태. 순서: 없음 → 회수 → 이미 답함 → 만료 → 열림.
 * 이미 답한 경우는 기한이 지나도 "감사합니다" 쪽이 학부모에게 더 정확하다.
 */
export function getQuestionnaireTokenState(
  row: QuestionnaireTokenRow | null | undefined,
  now: Date = new Date(),
): QuestionnaireTokenState {
  if (!row) return "not_found";
  if (row.revoked_at) return "revoked";
  if (row.answered_at) return "answered";
  if (!row.expires_at) return "expired";
  const expires = new Date(row.expires_at).getTime();
  if (Number.isNaN(expires) || expires <= now.getTime()) return "expired";
  return "open";
}

/** DB 기본값 encode(gen_random_bytes(16),'hex') 와 같은 모양(32자리 소문자 hex)만 조회한다. */
export function isQuestionnaireTokenFormat(token: string): boolean {
  return /^[0-9a-f]{32}$/.test(token);
}
