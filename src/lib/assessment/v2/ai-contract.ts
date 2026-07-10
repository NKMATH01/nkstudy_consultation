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
  | { ok: false; reason: "schema" | "subject" | "numeric"; detail: string };

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
 * AI 출력 검증.
 * 1) 숫자 점수 조작 필드가 있으면 거부(서버 점수가 유일한 진실).
 * 2) Zod strict 스키마 검증(계약 외 필드·타입 오류 거부).
 * 3) 과목-전략 필드 일치 강제: 선택 과목 전략은 non-null 필수, 미선택 과목은 null로 정규화.
 */
export function validateAiInterpretation(
  raw: unknown,
  subjectSelection: SubjectSelection
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
