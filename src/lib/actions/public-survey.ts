"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateFactors } from "@/lib/factors";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const scoreField = z.coerce.number().min(1).max(5);

const publicSurveySchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  school: z.string().optional(),
  grade: z.string().optional(),
  student_phone: z.string()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)")
    .optional()
    .or(z.literal("")),
  parent_phone: z.string()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)")
    .optional()
    .or(z.literal("")),
  referral: z.string().optional(),
  referral_friend: z.string().optional(),
  prev_academy: z.string().optional(),
  prev_complaint: z.string().min(1, "기존 학원에서 아쉬웠던 점을 입력해주세요").optional().or(z.literal("")),
  q1: scoreField, q2: scoreField, q3: scoreField, q4: scoreField, q5: scoreField,
  q6: scoreField, q7: scoreField, q8: scoreField, q9: scoreField, q10: scoreField,
  q11: scoreField, q12: scoreField, q13: scoreField, q14: scoreField, q15: scoreField,
  q16: scoreField, q17: scoreField, q18: scoreField, q19: scoreField, q20: scoreField,
  q21: scoreField, q22: scoreField, q23: scoreField, q24: scoreField, q25: scoreField,
  q26: scoreField, q27: scoreField, q28: scoreField, q29: scoreField, q30: scoreField,
  study_core: z.string().optional(),
  problem_self: z.string().optional(),
  dream: z.string().optional(),
  prefer_days: z.string().optional(),
  requests: z.string().optional(),
});

export async function submitPublicSurvey(data: Record<string, unknown>) {
  // Rate limit: 이름 기반 분당 3회 제한
  const name = typeof data.name === "string" ? data.name : "unknown";
  const { allowed } = checkRateLimit(`survey:${name}`, 3, 60 * 1000);
  if (!allowed) {
    return { success: false, error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요." };
  }

  const parsed = publicSurveySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const qValues: Record<string, number | undefined | null> = {};
  for (let i = 1; i <= 30; i++) {
    qValues[`q${i}`] = parsed.data[`q${i}` as keyof typeof parsed.data] as number | undefined | null;
  }
  const factors = calculateFactors(qValues);

  const insertData: Record<string, unknown> = {
    name: parsed.data.name,
    school: parsed.data.school || null,
    grade: parsed.data.grade || null,
    student_phone: parsed.data.student_phone || null,
    parent_phone: parsed.data.parent_phone || null,
    referral: parsed.data.referral_friend
      ? `${parsed.data.referral} (${parsed.data.referral_friend})`
      : parsed.data.referral || null,
    prev_academy: parsed.data.prev_academy || null,
    prev_complaint: parsed.data.prev_complaint || null,
    study_core: parsed.data.study_core || null,
    problem_self: parsed.data.problem_self || null,
    dream: parsed.data.dream || null,
    prefer_days: parsed.data.prefer_days || null,
    requests: parsed.data.requests || null,
    ...factors,
  };

  for (let i = 1; i <= 30; i++) {
    const key = `q${i}` as keyof typeof parsed.data;
    insertData[`q${i}`] = parsed.data[key] ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("surveys").insert(insertData);

  if (error) {
    // TODO: Sentry 등 외부 로깅 서비스로 교체 가능
    console.error("[DB] 공개 설문 저장 실패:", error.message);
    return { success: false, error: "설문 저장에 실패했습니다. 다시 시도해주세요." };
  }

  return { success: true };
}
