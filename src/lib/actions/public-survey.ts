"use server";

import { createClient } from "@/lib/supabase/server";
import { FACTOR_MAPPING } from "@/types";
import { z } from "zod";

const scoreField = z.coerce.number().min(1).max(5);

const publicSurveySchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  school: z.string().optional(),
  grade: z.string().optional(),
  student_phone: z.string().optional(),
  parent_phone: z.string().optional(),
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

function calculateFactors(data: Record<string, number | undefined | null>) {
  const factors: Record<string, number | null> = {};
  for (const [key, qNums] of Object.entries(FACTOR_MAPPING)) {
    const values = qNums
      .map((q) => data[`q${q}`])
      .filter((v): v is number => v != null && !isNaN(v));
    factors[`factor_${key}`] =
      values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null;
  }
  return factors;
}

export async function submitPublicSurvey(data: Record<string, unknown>) {
  const parsed = publicSurveySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const factors = calculateFactors(parsed.data as unknown as Record<string, number | undefined | null>);

  const insertData: Record<string, unknown> = {
    name: parsed.data.name,
    school: parsed.data.school || null,
    grade: parsed.data.grade || null,
    student_phone: parsed.data.student_phone || null,
    parent_phone: parsed.data.parent_phone || null,
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
    return { success: false, error: "설문 저장에 실패했습니다. 다시 시도해주세요." };
  }

  return { success: true };
}
