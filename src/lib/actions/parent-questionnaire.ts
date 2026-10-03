"use server";

// 학부모 질문지(8문항) — 공개 화면 /survey/parent/[token] 과 직원용 관리 액션.
// 공개 읽기·제출: public-survey.ts 패턴(createTrustedWriteClient + checkRateLimit). 표는 anon 이 못 읽으므로
//   서버가 토큰을 정확히 1건 맞춘 뒤 service role 로만 읽고 쓴다. 학부모에게는 학생 이름만 돌려준다.
// 관리: 로그인 직원만(authenticated RLS + 서버 게이트).

import { createClient } from "@/lib/supabase/server";
import { createTrustedWriteClient } from "@/lib/supabase/trusted-write";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CONSULT_CONFIRM_TEMPLATE_CODE,
  CONSULT_CONFIRM_V3_TEMPLATE_CODE,
  QUESTIONNAIRE_TOKEN_VAR,
  selectConsultConfirmTemplate,
  type ConsultConfirmTemplateCode,
} from "@/lib/consultation-alimtalk";
import {
  PARENT_QUESTIONNAIRE_VERSION,
  getQuestionnaireTokenState,
  isQuestionnaireTokenFormat,
  parentQuestionnaireAnswersSchema,
  type QuestionnaireTokenState,
} from "@/lib/parent-questionnaire/questions";

const TABLE = "parent_questionnaires";
const RATE_WINDOW_MS = 60 * 1000;
/** 토큰과 상관없는 전역 상한(분당). 토큰을 바꿔 가며 두드리는 요청을 막는다. 인메모리라 인스턴스별이다. */
const GLOBAL_READ_PER_MIN = 60;
const GLOBAL_SUBMIT_PER_MIN = 60;
const DUPLICATE_ERROR_CODE = "23505";

type ActionResult<T = unknown> = { success: boolean; data?: T; error?: string };

type QuestionnaireRow = {
  id: string;
  consultation_id: string;
  token: string;
  expires_at: string | null;
  answers: unknown;
  answered_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
};

async function requireAuthenticated() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return supabase;
}

// ── 공개(비로그인) ─────────────────────────────────────────────────────

export type PublicQuestionnaireView =
  | { state: "open"; studentName: string }
  | { state: Exclude<QuestionnaireTokenState, "open"> };

/** 공개 화면용. 열린 질문지일 때만 학생 이름을 돌려준다(연락처·상담 내용 없음). */
export async function getPublicParentQuestionnaire(
  token: string,
): Promise<PublicQuestionnaireView> {
  if (!isQuestionnaireTokenFormat(token)) return { state: "not_found" };

  const allowed =
    checkRateLimit(`parent-questionnaire:read:${token}`, 30, RATE_WINDOW_MS).allowed &&
    checkRateLimit("parent-questionnaire:read:*", GLOBAL_READ_PER_MIN, RATE_WINDOW_MS).allowed;
  if (!allowed) return { state: "not_found" };

  try {
    const { client } = await createTrustedWriteClient();
    const { data, error } = await client
      .from(TABLE)
      .select("consultation_id, expires_at, answered_at, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("[ParentQuestionnaire]", { action: "getPublic", error: error.message });
      return { state: "not_found" };
    }

    const state = getQuestionnaireTokenState(data);
    if (state !== "open" || !data) return { state: state === "open" ? "not_found" : state };

    const { data: consultation, error: cError } = await client
      .from("consultations")
      .select("name")
      .eq("id", data.consultation_id)
      .maybeSingle();

    if (cError || !consultation) {
      console.error("[ParentQuestionnaire]", {
        action: "getPublic",
        step: "consultation",
        error: cError?.message ?? "상담 없음",
      });
      return { state: "not_found" };
    }

    return { state: "open", studentName: (consultation.name as string | null)?.trim() || "" };
  } catch (e) {
    console.error("[ParentQuestionnaire]", {
      action: "getPublic",
      error: e instanceof Error ? e.message : e,
    });
    return { state: "not_found" };
  }
}

const STATE_MESSAGE: Record<Exclude<QuestionnaireTokenState, "open">, string> = {
  not_found: "질문지 링크를 찾을 수 없습니다.",
  revoked: "더 이상 사용할 수 없는 링크입니다.",
  answered: "이미 제출된 질문지입니다.",
  expired: "작성 기간이 지난 링크입니다.",
};

/** 공개 제출. 토큰 정확 일치 1건, 열린 상태일 때 1회만 저장된다. */
export async function submitParentQuestionnaire(
  token: string,
  rawAnswers: Record<string, unknown>,
): Promise<{ success: boolean; error?: string; state?: QuestionnaireTokenState }> {
  if (typeof token !== "string" || !isQuestionnaireTokenFormat(token)) {
    return { success: false, error: STATE_MESSAGE.not_found, state: "not_found" };
  }

  const allowed =
    checkRateLimit(`parent-questionnaire:submit:${token}`, 5, RATE_WINDOW_MS).allowed &&
    checkRateLimit("parent-questionnaire:submit:*", GLOBAL_SUBMIT_PER_MIN, RATE_WINDOW_MS).allowed;
  if (!allowed) {
    return { success: false, error: "너무 많은 요청입니다. 잠시 후 다시 시도해 주세요." };
  }

  const parsed = parentQuestionnaireAnswersSchema.safeParse(rawAnswers ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "응답을 확인해 주세요." };
  }

  try {
    const { client } = await createTrustedWriteClient();
    const nowIso = new Date().toISOString();

    // 조건부 UPDATE 한 번으로 "열린 상태에서 1회"를 보장한다(동시 제출이 와도 한 건만 바뀐다).
    const { data: updated, error } = await client
      .from(TABLE)
      .update({
        answers: { version: PARENT_QUESTIONNAIRE_VERSION, ...parsed.data },
        answered_at: nowIso,
      })
      .eq("token", token)
      .is("answered_at", null)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .select("id");

    if (error) {
      console.error("[ParentQuestionnaire]", { action: "submit", error: error.message });
      return { success: false, error: "제출에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    if (updated && updated.length === 1) return { success: true };

    // 바뀐 행이 없으면 왜 막혔는지 다시 읽어 안내한다.
    const { data: row } = await client
      .from(TABLE)
      .select("expires_at, answered_at, revoked_at")
      .eq("token", token)
      .maybeSingle();
    const state = getQuestionnaireTokenState(row);
    const blocked = state === "open" ? "not_found" : state;
    return { success: false, error: STATE_MESSAGE[blocked], state: blocked };
  } catch (e) {
    console.error("[ParentQuestionnaire]", {
      action: "submit",
      error: e instanceof Error ? e.message : e,
    });
    return { success: false, error: "제출에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

// ── 관리(로그인 직원) ──────────────────────────────────────────────────

/**
 * 상담의 살아 있는 질문지 토큰을 돌려준다. 있으면 재사용, 없으면 만든다.
 * 답하지 않은 채 기한이 지난 것은 회수하고 새로 만든다(만료 링크를 다시 보내지 않도록).
 */
export async function getOrCreateQuestionnaireToken(
  consultationId: string,
): Promise<ActionResult<{ token: string }>> {
  const supabase = await requireAuthenticated();
  if (!supabase) return { success: false, error: "인증이 필요합니다" };
  if (!consultationId) return { success: false, error: "상담 정보 없음" };

  const findActive = () =>
    supabase
      .from(TABLE)
      .select("id, token, expires_at, answered_at, revoked_at")
      .eq("consultation_id", consultationId)
      .is("revoked_at", null)
      .maybeSingle();

  try {
    const { data: active, error } = await findActive();
    if (error) {
      console.error("[ParentQuestionnaire]", { action: "getOrCreate", step: "find", error: error.message });
      return { success: false, error: error.message };
    }

    if (active) {
      const state = getQuestionnaireTokenState(active);
      if (state !== "expired") return { success: true, data: { token: active.token as string } };

      const { error: revokeError } = await supabase
        .from(TABLE)
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", active.id)
        .is("revoked_at", null);
      if (revokeError) {
        console.error("[ParentQuestionnaire]", {
          action: "getOrCreate",
          step: "revokeExpired",
          error: revokeError.message,
        });
        return { success: false, error: revokeError.message };
      }
    }

    const { data: created, error: insertError } = await supabase
      .from(TABLE)
      .insert({ consultation_id: consultationId })
      .select("token")
      .single();

    if (insertError) {
      // 동시에 두 번 눌러 부분 유니크에 걸리면 먼저 만들어진 것을 쓴다.
      if (insertError.code === DUPLICATE_ERROR_CODE) {
        const { data: again } = await findActive();
        if (again) return { success: true, data: { token: again.token as string } };
      }
      console.error("[ParentQuestionnaire]", { action: "getOrCreate", step: "insert", error: insertError.message });
      return { success: false, error: insertError.message };
    }

    return { success: true, data: { token: created.token as string } };
  } catch (e) {
    console.error("[ParentQuestionnaire]", {
      action: "getOrCreate",
      error: e instanceof Error ? e.message : e,
    });
    return { success: false, error: e instanceof Error ? e.message : "질문지 링크 생성 실패" };
  }
}

export type QuestionnaireStatus = {
  consultationId: string;
  /** 회수되지 않은 질문지 링크가 만들어졌다(v3 알림톡 미리보기·발송 때 생성). 실제 발송 여부는 아니다. */
  issued: boolean;
  /** 살아 있는 질문지에 답한 시각. 답하지 않았으면 null. */
  answeredAt: string | null;
};

const STATUS_MAX_IDS = 200;

/**
 * 상담 여러 건의 질문지 상태(목록 화면 표시용). 입력 순서대로, 중복·빈 값은 빼고 돌려준다.
 * 회수된 질문지는 보낸 것으로도 답한 것으로도 치지 않는다.
 */
export async function getQuestionnaireStatusByConsultationIds(
  consultationIds: string[],
): Promise<ActionResult<QuestionnaireStatus[]>> {
  const supabase = await requireAuthenticated();
  if (!supabase) return { success: false, error: "인증이 필요합니다" };

  const ids = [...new Set((consultationIds ?? []).filter((id) => typeof id === "string" && id))];
  if (ids.length === 0) return { success: true, data: [] };
  if (ids.length > STATUS_MAX_IDS) {
    return { success: false, error: `한 번에 ${STATUS_MAX_IDS}건까지 조회할 수 있습니다` };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("consultation_id, answered_at, revoked_at")
    .in("consultation_id", ids);

  if (error) {
    console.error("[ParentQuestionnaire]", { action: "getStatusByIds", error: error.message });
    return { success: false, error: error.message };
  }

  const byId = new Map<string, QuestionnaireStatus>(
    ids.map((id) => [id, { consultationId: id, issued: false, answeredAt: null }]),
  );
  for (const row of (data ?? []) as Pick<QuestionnaireRow, "consultation_id" | "answered_at" | "revoked_at">[]) {
    const entry = byId.get(row.consultation_id);
    if (!entry || row.revoked_at) continue;
    entry.issued = true;
    if (row.answered_at && (!entry.answeredAt || row.answered_at > entry.answeredAt)) {
      entry.answeredAt = row.answered_at;
    }
  }

  return { success: true, data: ids.map((id) => byId.get(id)!) };
}

/**
 * 테스트 예약 알림톡에 쓸 템플릿과 추가 변수.
 * consult_confirm_v3 가 카카오 승인(approved)일 때만 v3 + 질문지 토큰(이때만 토큰을 만든다).
 * 그 밖에는 지금처럼 v2, 추가 변수 없음. 어떤 단계가 실패해도 v2 로 돌아가 발송 흐름을 막지 않는다.
 */
export async function prepareConsultConfirmAlimtalk(
  consultationId: string,
): Promise<{ templateCode: ConsultConfirmTemplateCode; extraVars: Record<string, string> }> {
  const v2 = { templateCode: CONSULT_CONFIRM_TEMPLATE_CODE, extraVars: {} } as const;

  try {
    const supabase = await requireAuthenticated();
    if (!supabase) return v2;

    const { data, error } = await supabase
      .from("nkc_alimtalk_templates")
      .select("kakao_status")
      .eq("template_code", CONSULT_CONFIRM_V3_TEMPLATE_CODE)
      .maybeSingle();

    if (error) {
      console.error("[ParentQuestionnaire]", { action: "prepareConsultConfirm", step: "template", error: error.message });
      return v2;
    }

    const templateCode = selectConsultConfirmTemplate(data?.kakao_status as string | null | undefined);
    if (templateCode !== CONSULT_CONFIRM_V3_TEMPLATE_CODE) return v2;

    const tokenResult = await getOrCreateQuestionnaireToken(consultationId);
    if (!tokenResult.success || !tokenResult.data) {
      console.error("[ParentQuestionnaire]", {
        action: "prepareConsultConfirm",
        step: "token",
        consultationId,
        error: tokenResult.error,
      });
      return v2;
    }

    return {
      templateCode: CONSULT_CONFIRM_V3_TEMPLATE_CODE,
      extraVars: { [QUESTIONNAIRE_TOKEN_VAR]: tokenResult.data.token },
    };
  } catch (e) {
    console.error("[ParentQuestionnaire]", {
      action: "prepareConsultConfirm",
      error: e instanceof Error ? e.message : e,
    });
    return v2;
  }
}
