"use server";

import { createClient } from "@/lib/supabase/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://nkstudy-consultation.vercel.app";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

type DripWave = "D1" | "W1" | "W2";

type DripInvitation = {
  wave: string | null;
  expired: boolean;
  responded: boolean;
};

type DripAnswers = {
  difficulty?: string;
  [key: string]: unknown;
};

export type DripResponseRow = {
  id: string;
  wave: string;
  difficulty: string;
  freeText: string | null;
  flag: string | null;
  handled: boolean;
  createdAt: string;
  name: string;
  maskedPhone: string;
};

type RawDripResponse = {
  id: string;
  wave: string | null;
  answers: DripAnswers | null;
  free_text: string | null;
  flag: string | null;
  handled: boolean;
  handled_at: string | null;
  created_at: string;
  nkc_survey_invitations:
    | {
        consultation_id: string | null;
        target_phone: string | null;
      }
    | {
        consultation_id: string | null;
        target_phone: string | null;
      }[]
    | null;
};

async function requireAuthenticatedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("인증 필요");
  }

  return supabase;
}

function maskPhone(phone: string | null): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  return phone ?? "";
}

function normalizeInvitation(
  invitation: RawDripResponse["nkc_survey_invitations"],
) {
  if (Array.isArray(invitation)) return invitation[0] ?? null;
  return invitation;
}

export async function createDripInvitation({
  consultationId,
  wave,
}: {
  consultationId: string;
  wave: DripWave;
}): Promise<{ success: boolean; token?: string; url?: string; error?: string }> {
  try {
    const supabase = await requireAuthenticatedSupabase();

    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("parent_phone")
      .eq("id", consultationId)
      .single();

    if (consultationError) {
      console.error("[DripSurvey]", {
        action: "createDripInvitation",
        step: "consultation",
        error: consultationError.message,
      });
      return { success: false, error: consultationError.message };
    }

    const { data, error } = await supabase
      .from("nkc_survey_invitations")
      .insert({
        consultation_id: consultationId,
        wave,
        target_phone: consultation?.parent_phone ?? null,
      })
      .select("token")
      .single();

    if (error) {
      console.error("[DripSurvey]", {
        action: "createDripInvitation",
        step: "insert",
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      token: data.token,
      url: `${BASE_URL}/feedback/${data.token}`,
    };
  } catch (e) {
    console.error("[DripSurvey]", {
      action: "createDripInvitation",
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "초대 링크 생성 실패",
    };
  }
}

export async function getDripInvitation(
  token: string,
): Promise<DripInvitation | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("get_drip_invitation", { p_token: token })
      .maybeSingle();

    if (error) {
      console.error("[DripSurvey]", {
        action: "getDripInvitation",
        error: error.message,
      });
      return null;
    }

    return data as DripInvitation | null;
  } catch (e) {
    console.error("[DripSurvey]", {
      action: "getDripInvitation",
      error: e instanceof Error ? e.message : e,
    });
    return null;
  }
}

export async function submitDripResponse({
  token,
  answers,
  freeText,
}: {
  token: string;
  answers: DripAnswers;
  freeText?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const flag = answers.difficulty === "너무 어려움" ? "too_hard" : null;
    const { data, error } = await supabase.rpc("submit_drip_response", {
      p_token: token,
      p_answers: answers,
      p_free_text: freeText?.trim() || null,
      p_flag: flag,
    });

    if (error) {
      console.error("[DripSurvey]", {
        action: "submitDripResponse",
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    if (!data) {
      return {
        success: false,
        error: "만료/이미 응답/잘못된 링크",
      };
    }

    return { success: true };
  } catch (e) {
    console.error("[DripSurvey]", {
      action: "submitDripResponse",
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "응답 제출 실패",
    };
  }
}

export async function getDripResponses(): Promise<
  ActionResult<DripResponseRow[]>
> {
  try {
    const supabase = await requireAuthenticatedSupabase();
    const { data, error } = await supabase
      .from("nkc_survey_responses")
      .select(
        "id, wave, answers, free_text, flag, handled, handled_at, created_at, nkc_survey_invitations!inner(consultation_id, target_phone)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DripSurvey]", {
        action: "getDripResponses",
        step: "responses",
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    const rows = (data ?? []) as RawDripResponse[];
    const consultationIds = Array.from(
      new Set(
        rows
          .map((row) => normalizeInvitation(row.nkc_survey_invitations)?.consultation_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let nameByConsultationId = new Map<string, string>();
    if (consultationIds.length > 0) {
      const { data: consultations, error: consultationError } = await supabase
        .from("consultations")
        .select("id, name")
        .in("id", consultationIds);

      if (consultationError) {
        console.error("[DripSurvey]", {
          action: "getDripResponses",
          step: "consultations",
          error: consultationError.message,
        });
      } else {
        nameByConsultationId = new Map(
          (consultations ?? []).map((consultation) => [
            consultation.id as string,
            (consultation.name as string | null) ?? "",
          ]),
        );
      }
    }

    return {
      success: true,
      data: rows.map((row) => {
        const invitation = normalizeInvitation(row.nkc_survey_invitations);
        const consultationId = invitation?.consultation_id ?? "";
        return {
          id: row.id,
          wave: row.wave ?? "",
          difficulty:
            typeof row.answers?.difficulty === "string"
              ? row.answers.difficulty
              : "",
          freeText: row.free_text,
          flag: row.flag,
          handled: row.handled,
          createdAt: row.created_at,
          name: nameByConsultationId.get(consultationId) ?? "",
          maskedPhone: maskPhone(invitation?.target_phone ?? null),
        };
      }),
    };
  } catch (e) {
    console.error("[DripSurvey]", {
      action: "getDripResponses",
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "응답 조회 실패",
    };
  }
}

export async function markResponseHandled(
  id: string,
  handled: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireAuthenticatedSupabase();
    const { error } = await supabase
      .from("nkc_survey_responses")
      .update({
        handled,
        handled_at: handled ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (error) {
      console.error("[DripSurvey]", {
        action: "markResponseHandled",
        id,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error("[DripSurvey]", {
      action: "markResponseHandled",
      id,
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "조치 상태 변경 실패",
    };
  }
}
