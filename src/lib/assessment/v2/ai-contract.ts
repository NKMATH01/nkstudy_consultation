// AI 해석 출력 계약 (§11).
// AI는 해석 JSON만 생성한다. 숫자 점수는 서버가 계산하며 이 계약에는 점수 필드가 없다.
// .strict()로 계약에 없는 필드(예: AI가 몰래 넣은 "scores")를 거부한다.

import { z } from "zod";
import type { SubjectSelection } from "./types";

const nonEmpty = z.string().trim().min(1);

const roadmapItemSchema = z
  .object({
    weeks: nonEmpty,
    focus: nonEmpty,
    actions: z.array(nonEmpty).min(1),
  })
  .strict();

/**
 * §11 필수 필드 계약.
 * mathStrategy/englishStrategy는 과목 선택에 따라 필수이거나 null이다.
 * 계약은 nullable로 통일하고, 과목-필드 일치는 validateAiInterpretation에서 강제한다.
 */
export const AiInterpretationSchema = z
  .object({
    studentType: nonEmpty,
    detailedSummary: nonEmpty,
    coreObservation: nonEmpty,
    operatingCause: nonEmpty,
    recommendedCoaching: nonEmpty,
    verificationPlan14Days: z.array(nonEmpty).min(1),
    teacherBrief: z.array(nonEmpty).min(1),
    strengths: z.array(nonEmpty).min(1),
    growthAreas: z.array(nonEmpty).min(1),
    crossEvidence: z.array(nonEmpty),
    nkFitInterpretation: nonEmpty,
    // 과목 선택에 따라 필수/null. 계약은 null 허용으로 통일한다.
    mathStrategy: z.string().trim().min(1).nullable(),
    englishStrategy: z.string().trim().min(1).nullable(),
    roadmap12Weeks: z.array(roadmapItemSchema).min(1),
    parentSummary: nonEmpty,
    cautions: z.array(nonEmpty),
  })
  .strict();

export type AiInterpretation = z.infer<typeof AiInterpretationSchema>;

export type ValidateResult =
  | { ok: true; data: AiInterpretation }
  | {
      ok: false;
      reason: "schema" | "subject" | "numeric" | "studentType" | "detailedSummary";
      detail: string;
    };

/**
 * AI가 서버 점수를 숫자로 재생성/조작하려 했는지 감지한다.
 * 계약에 점수 필드가 없으므로, 원 응답에 score 계열 키가 있으면 조작으로 간주해 거부한다.
 */
export function containsNumericScoreClaim(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const banned = [
    "scores",
    "score",
    "scoreProfile",
    "scoreComments",
    "common",
    "nkFit",
    "mbtiAxes",
  ];
  return banned.some((k) => k in (raw as Record<string, unknown>));
}

/**
 * studentType에 들어가면 안 되는 표현.
 * 내부 분류명·영문 키·내부 코드가 학부모 화면 첫 줄에 그대로 나가던 문제를 막는다.
 * 학생 실명은 별도 인자로 받아 검사한다(토큰 치환 전이라 {{학생}}은 허용).
 */
const STUDENT_TYPE_BANNED = [
  "혼합 반응",
  "관찰형",
  "자기주도형",
  "타입",
  "상황문항",
  "NKFit",
  "nkFit",
  "construct",
  "evidence",
  "역채점",
  "위험축",
  "선호축",
];

/** 영문 키·내부 코드(learningAttitude, M9 등)가 섞였는지. */
const LATIN_KEY_RE = /[A-Za-z]{4,}|\b[A-Z]{1,2}\d{1,2}\b/;

export function findStudentTypeViolation(
  studentType: string,
  studentName?: string | null,
): string | null {
  const text = studentType ?? "";
  for (const banned of STUDENT_TYPE_BANNED) {
    if (text.includes(banned)) return `금지 표현 "${banned}" 포함`;
  }
  if (LATIN_KEY_RE.test(text)) return "영문 키·내부 코드 포함";
  const name = studentName?.trim();
  if (name && name.length >= 2 && text.includes(name)) return "학생 실명 포함";
  return null;
}

/**
 * 자세한 총평에 들어가면 안 되는 "점수 모양" 표기.
 *
 * 숫자를 통째로 막지는 않는다. "첫 2주", "오답 1개", "10분" 같은 표현은 총평에서
 * 자연스럽고 필요하다. 거부는 곧 규칙 기반 fallback으로 떨어진다는 뜻이라
 * 오탐 하나가 그 학생의 결과지 품질을 통째로 떨어뜨린다.
 * 그래서 점수로만 읽히는 형태(점·/5·%·소수·문항 평균)만 잡는다.
 */
const SCORE_SHAPE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\d+(\.\d+)?\s*점/, label: "점수 표기" },
  { re: /\d+(\.\d+)?\s*\/\s*5/, label: "5점 만점 표기" },
  { re: /\d+(\.\d+)?\s*%/, label: "백분율" },
  { re: /\d+\.\d+/, label: "소수 점수" },
  { re: /\d+\s*문항\s*평균/, label: "문항 평균 표기" },
];

/** 총평에 점수가 섞였는지. 위반이면 사유, 없으면 null. */
export function findDetailedSummaryViolation(text: string): string | null {
  const value = text ?? "";
  for (const { re, label } of SCORE_SHAPE_PATTERNS) {
    const hit = value.match(re);
    if (hit) return `${label} "${hit[0]}" 포함`;
  }
  return null;
}

/**
 * AI 출력 검증.
 * 1) 숫자 점수 조작 필드가 있으면 거부(서버 점수가 유일한 진실).
 * 2) Zod strict 스키마 검증(계약 외 필드·타입 오류 거부).
 * 3) 과목-전략 필드 일치 강제: 선택 과목 전략은 non-null 필수, 미선택 과목은 null로 정규화.
 */
export function validateAiInterpretation(
  raw: unknown,
  subjectSelection: SubjectSelection,
  studentName?: string | null,
): ValidateResult {
  if (containsNumericScoreClaim(raw)) {
    return {
      ok: false,
      reason: "numeric",
      detail: "AI 출력에 서버 점수 조작 필드가 포함됨",
    };
  }

  const parsed = AiInterpretationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema",
      detail: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  const data = parsed.data;

  const typeViolation = findStudentTypeViolation(data.studentType, studentName);
  if (typeViolation) {
    return {
      ok: false,
      reason: "studentType",
      detail: `studentType 계약 위반: ${typeViolation}`,
    };
  }

  const summaryViolation = findDetailedSummaryViolation(data.detailedSummary);
  if (summaryViolation) {
    return {
      ok: false,
      reason: "detailedSummary",
      detail: `detailedSummary 계약 위반: ${summaryViolation}`,
    };
  }

  const needMath = subjectSelection === "math" || subjectSelection === "both";
  const needEnglish =
    subjectSelection === "english" || subjectSelection === "both";

  if (needMath && !data.mathStrategy) {
    return {
      ok: false,
      reason: "subject",
      detail: "수학 선택인데 mathStrategy가 비어 있음",
    };
  }
  if (needEnglish && !data.englishStrategy) {
    return {
      ok: false,
      reason: "subject",
      detail: "영어 선택인데 englishStrategy가 비어 있음",
    };
  }

  // 미선택 과목 전략은 null로 정규화(AI가 창작했더라도 제거).
  return {
    ok: true,
    data: {
      ...data,
      mathStrategy: needMath ? data.mathStrategy : null,
      englishStrategy: needEnglish ? data.englishStrategy : null,
    },
  };
}
