"use server";

// 설문 V2 공개 제출 서버 액션 (인증 불필요).
// §10 계약: 서버가 raw 응답으로 점수를 재계산하고, 과목 불일치·NK 기대 초과를 서버에서 검증한다.
// 클라이언트가 보낸 점수는 신뢰하지 않는다.
// 서버 로그에 전화번호·서술 전문·전체 응답 JSON을 출력하지 않는다.

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import {
  buildScoringInput,
  buildV2InsertPayload,
  phoneDigits,
  v2SubmissionSchema,
} from "@/lib/assessment/v2/validation";

export type SubmitResult = { success: true } | { success: false; error: string };

export async function submitPublicSurveyV2(raw: unknown): Promise<SubmitResult> {
  const parsed = v2SubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    // 첫 번째 이슈 메시지만 노출(원문 값은 로그·응답에 남기지 않음).
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "제출 형식이 올바르지 않습니다.",
    };
  }

  const data = parsed.data;
  const intake = data.intake;

  // Rate limit: 정규화 연락처 기반(이름 단독 금지). 키에 원문 전화번호를 그대로 로그하지 않는다.
  const rlKey =
    phoneDigits(intake.parent_phone) ||
    phoneDigits(intake.student_phone) ||
    `name:${intake.name}`;
  const { allowed } = checkRateLimit(`survey-v2:${rlKey}`, 3, 60 * 1000);
  if (!allowed) {
    return {
      success: false,
      error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
    };
  }

  // 서버 재채점: raw 응답만 사용(클라이언트 점수 불신).
  const score = computeScoreProfile(buildScoringInput(data));
  const insertData = buildV2InsertPayload(data, score);

  try {
    const supabase = await createClient();

    // 중복 제출 방어: 정규화 연락처 기반 10분 규칙(동명이인 오탐 감소, 이름 단독 금지).
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const parentPhone = intake.parent_phone || null;
    const studentPhone = intake.student_phone || null;
    if (parentPhone || studentPhone) {
      let dupQuery = supabase
        .from("surveys")
        .select("id")
        .eq("instrument_version", "v2")
        .gte("created_at", tenMinutesAgo);
      // 학부모 연락처 우선(더 안정적인 식별자), 없으면 학생 연락처.
      dupQuery = parentPhone
        ? dupQuery.eq("parent_phone", parentPhone)
        : dupQuery.eq("student_phone", studentPhone as string);
      const { data: recentDup } = await dupQuery.limit(1);
      if (recentDup && recentDup.length > 0) {
        return {
          success: false,
          error:
            "이미 제출된 설문이 있습니다. 잠시 후 다시 시도하거나 학원으로 문의해주세요.",
        };
      }
    }

    const { error } = await supabase.from("surveys").insert(insertData);
    if (error) {
      // 메시지만 로깅(응답 JSON·개인정보 미포함).
      console.error("[DB] V2 설문 저장 실패:", error.message);
      return {
        success: false,
        error: "설문 저장에 실패했습니다. 다시 시도해주세요.",
      };
    }

    return { success: true };
  } catch (e) {
    console.error("[DB] V2 설문 예외:", e instanceof Error ? e.message : "unknown");
    return {
      success: false,
      error: "설문 저장 중 오류가 발생했습니다. 다시 시도해주세요.",
    };
  }
}
