"use server";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getSolapiService } from "@/lib/solapi/client";
import {
  isNightTimeKST,
  maskPhone,
  renderTemplate,
} from "@/lib/solapi/alimtalk";
import type {
  DetailGroupMessageResponse,
  KakaoButton,
  RequestSendMessagesSchema,
  SendRequestConfigSchema,
} from "solapi";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

type AlimtalkTemplate = {
  id: string;
  template_code: string;
  title: string;
  body: string;
  variables: string[] | null;
  button: unknown | null;
  kakao_template_id: string | null;
  msg_type: "info" | "ad";
  kakao_status: "draft" | "pending" | "approved" | "rejected";
  pf_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

// 발송 대상은 상담(consultationId)이거나, 상담이 아닌 문서(등록안내/분석)의 직접 전화번호다.
type PreviewInput = {
  consultationId?: string;
  phone?: string;
  templateCode: string;
  vars: Record<string, string>;
};

type SendInput = PreviewInput & {
  allowSmsFallback?: boolean;
  scheduledDate?: string | Date;
  subjectType?: string;
  subjectId?: string;
};

type ConsentInput = {
  phone: string;
  info_ok?: boolean;
  ad_ok?: boolean;
  optout?: boolean;
};

type ConsultationContact = {
  id: string;
  parent_phone: string | null;
};

type SendLogChannel = "alimtalk" | "sms" | "lms";

const DUPLICATE_ERROR_CODE = "23505";

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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function toSolapiVariables(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [
      key.startsWith("#{") ? key : `#{${key}}`,
      value,
    ]),
  );
}

function isValidKoreanMobilePhone(phone: string): boolean {
  return /^01[016789]\d{7,8}$/.test(normalizePhone(phone));
}

function parseScheduledDate(date?: string | Date): Date | null {
  if (!date) return null;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("예약일시 형식 오류");
  }
  return parsed;
}

function sumRecordValues(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>(
    (sum, item) => (typeof item === "number" ? sum + item : sum),
    0,
  );
}

function inferLogChannel(response: DetailGroupMessageResponse): SendLogChannel {
  const countForCharge = response.groupInfo.countForCharge;

  if (sumRecordValues(countForCharge.lms) > 0) return "lms";
  if (sumRecordValues(countForCharge.sms) > 0) return "sms";
  return "alimtalk";
}

function getMessageId(response: DetailGroupMessageResponse): string | null {
  return (
    response.messageList?.[0]?.messageId ??
    response.failedMessageList?.[0]?.messageId ??
    null
  );
}

function getResponseStatus(response: DetailGroupMessageResponse): string {
  return (
    response.messageList?.[0]?.statusCode ??
    response.messageList?.[0]?.statusMessage ??
    response.groupInfo.status
  );
}

function getUnitPrice(response: DetailGroupMessageResponse): number | null {
  const balance = response.groupInfo.balance;
  return balance.requested || balance.sum || null;
}

async function fetchTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateCode: string,
) {
  return supabase
    .from("nkc_alimtalk_templates")
    .select("*")
    .eq("template_code", templateCode)
    .maybeSingle();
}

async function fetchConsultationContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  consultationId: string,
) {
  return supabase
    .from("consultations")
    .select("id, parent_phone")
    .eq("id", consultationId)
    .single();
}

/** consultationId가 있으면 상담에서, 없으면 인자로 받은 phone에서 발송 대상 번호를 얻는다. */
async function resolveTargetPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { consultationId?: string; phone?: string },
): Promise<{ phone: string } | { error: string }> {
  if (input.consultationId) {
    const { data, error } = await fetchConsultationContact(
      supabase,
      input.consultationId,
    );
    if (error) return { error: error.message };
    return { phone: (data as ConsultationContact | null)?.parent_phone ?? "" };
  }

  if (input.phone) return { phone: input.phone };

  return { error: "발송 대상 정보 없음" };
}

/** 템플릿 button jsonb({buttons:[...]})를 solapi kakaoOptions.buttons로 변환하고 링크 변수도 치환한다. */
function buildTemplateButtons(
  button: unknown,
  vars: Record<string, string>,
): KakaoButton[] | undefined {
  if (!button || typeof button !== "object") return undefined;

  const raw = (button as { buttons?: unknown }).buttons;
  if (!Array.isArray(raw)) return undefined;

  const buttons = raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const rendered = Object.fromEntries(
      Object.entries(entry as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, renderTemplate(value as string, vars).text]),
    );

    return rendered.buttonName && rendered.buttonType
      ? [rendered as unknown as KakaoButton]
      : [];
  });

  return buttons.length > 0 ? buttons : undefined;
}

export async function getTemplate(
  templateCode: string,
): Promise<ActionResult<AlimtalkTemplate>> {
  try {
    const supabase = await requireAuthenticatedSupabase();
    const { data, error } = await fetchTemplate(supabase, templateCode);

    if (error) {
      console.error("[Alimtalk]", {
        action: "getTemplate",
        templateCode,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "템플릿 없음" };
    }

    return { success: true, data: data as AlimtalkTemplate };
  } catch (e) {
    console.error("[Alimtalk]", {
      action: "getTemplate",
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "템플릿 조회 실패",
    };
  }
}

export async function previewAlimtalk(
  input: PreviewInput,
): Promise<
  ActionResult<{
    template: AlimtalkTemplate;
    text: string;
    missing: string[];
    phone: string;
    maskedPhone: string;
    sendable: boolean;
  }>
> {
  try {
    const supabase = await requireAuthenticatedSupabase();
    const [{ data: template, error: templateError }, target] = await Promise.all([
      fetchTemplate(supabase, input.templateCode),
      resolveTargetPhone(supabase, input),
    ]);

    if (templateError) {
      console.error("[Alimtalk]", {
        action: "previewAlimtalk",
        step: "template",
        error: templateError.message,
      });
      return { success: false, error: templateError.message };
    }

    if ("error" in target) {
      console.error("[Alimtalk]", {
        action: "previewAlimtalk",
        step: "target",
        error: target.error,
      });
      return { success: false, error: target.error };
    }

    if (!template) {
      return { success: false, error: "템플릿 없음" };
    }

    const phone = target.phone;
    const rendered = renderTemplate(template.body, input.vars);

    return {
      success: true,
      data: {
        template: template as AlimtalkTemplate,
        text: rendered.text,
        missing: rendered.missing,
        phone,
        maskedPhone: phone ? maskPhone(phone) : "",
        sendable: rendered.missing.length === 0 && isValidKoreanMobilePhone(phone),
      },
    };
  } catch (e) {
    console.error("[Alimtalk]", {
      action: "previewAlimtalk",
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "알림톡 미리보기 실패",
    };
  }
}

export async function sendAlimtalk(
  input: SendInput,
): Promise<
  ActionResult<{
    scheduledMessageId: string;
    messageId: string | null;
    channel: SendLogChannel;
    status: string;
  }>
> {
  let scheduledMessageId: string | null = null;

  try {
    const supabase = await requireAuthenticatedSupabase();
    const [{ data: template, error: templateError }, target] = await Promise.all([
      fetchTemplate(supabase, input.templateCode),
      resolveTargetPhone(supabase, input),
    ]);

    if (templateError) {
      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "template",
        error: templateError.message,
      });
      return { success: false, error: templateError.message };
    }

    if ("error" in target) {
      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "target",
        error: target.error,
      });
      return { success: false, error: target.error };
    }

    if (!template) {
      return { success: false, error: "템플릿 없음" };
    }

    const alimtalkTemplate = template as AlimtalkTemplate;
    if (alimtalkTemplate.kakao_status !== "approved") {
      return { success: false, error: "미승인 템플릿" };
    }

    const rendered = renderTemplate(alimtalkTemplate.body, input.vars);
    if (rendered.missing.length > 0) {
      return { success: false, error: "변수 미치환" };
    }

    const phone = target.phone;
    if (!phone || !isValidKoreanMobilePhone(phone)) {
      return { success: false, error: "대상 전화번호 오류" };
    }
    const normalizedPhone = normalizePhone(phone);
    const isAdMessage = alimtalkTemplate.msg_type === "ad";

    const { data: consent, error: consentError } = await supabase
      .from("nkc_consents")
      .select("optout_at, ad_ok")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (consentError) {
      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "consent",
        error: consentError.message,
      });
      return { success: false, error: consentError.message };
    }

    if (consent?.optout_at) {
      return { success: false, error: "수신거부자" };
    }

    // 광고성 메시지만 사전 동의와 야간 발송 제한을 받는다.
    if (isAdMessage && !consent?.ad_ok) {
      return { success: false, error: "광고 수신 미동의" };
    }

    const scheduledAt = parseScheduledDate(input.scheduledDate);
    if (isAdMessage && !scheduledAt && isNightTimeKST()) {
      return {
        success: false,
        error: "야간시간(21~08시) 광고 발송 불가, 예약발송 권장",
      };
    }

    const solapiService = getSolapiService();
    const pfId = env.SOLAPI_PFID.trim();
    const from = env.SOLAPI_SENDER_PHONE.trim();
    const templateId = alimtalkTemplate.kakao_template_id?.trim();

    if (!pfId || !from) {
      return { success: false, error: "SOLAPI 발신 설정 미설정" };
    }

    if (!templateId) {
      return { success: false, error: "카카오 템플릿 ID 미설정" };
    }

    const sendAt = scheduledAt ?? new Date();
    // 즉시발송에도 시각을 넣어야 같은 대상에 재발송이 영구 차단되지 않는다.
    const dedupKey = `${input.templateCode}:${input.consultationId ?? normalizedPhone}:${
      scheduledAt
        ? `sched:${scheduledAt.toISOString()}`
        : `now:${sendAt.toISOString()}`
    }`;

    // subject_type/subject_id는 마이그레이션 미적용 DB를 위해 값이 있을 때만 넣는다.
    const { data: scheduledMessage, error: insertError } = await supabase
      .from("nkc_scheduled_messages")
      .insert({
        template_code: input.templateCode,
        consultation_id: input.consultationId ?? null,
        target_phone_snapshot: normalizedPhone,
        payload: {
          vars: input.vars,
          text: rendered.text,
          allowSmsFallback: input.allowSmsFallback ?? true,
        },
        send_at: sendAt.toISOString(),
        status: "pending",
        dedup_key: dedupKey,
        ...(input.subjectType ? { subject_type: input.subjectType } : {}),
        ...(input.subjectId ? { subject_id: input.subjectId } : {}),
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === DUPLICATE_ERROR_CODE) {
        return { success: false, error: "중복 발송 차단" };
      }

      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "schedule_insert",
        error: insertError.message,
      });
      return { success: false, error: insertError.message };
    }

    const insertedScheduledMessageId = scheduledMessage.id as string;
    scheduledMessageId = insertedScheduledMessageId;

    const buttons = buildTemplateButtons(alimtalkTemplate.button, input.vars);
    const messages: RequestSendMessagesSchema = [
      {
        to: normalizedPhone,
        from: normalizePhone(from),
        text: rendered.text,
        type: "ATA",
        kakaoOptions: {
          pfId,
          templateId,
          variables: toSolapiVariables(input.vars),
          disableSms: !(input.allowSmsFallback ?? true),
          ...(buttons ? { buttons } : {}),
        },
      },
    ];
    const sendConfig: SendRequestConfigSchema = {
      showMessageList: true,
      ...(scheduledAt ? { scheduledDate: scheduledAt.toISOString() } : {}),
    };

    const response = await solapiService.send(messages, sendConfig);
    const failed = response.groupInfo.count.sentFailed > 0;
    const nextStatus = failed ? "failed" : "sent";
    const channel = inferLogChannel(response);
    const messageId = getMessageId(response);
    const status = getResponseStatus(response);

    await supabase
      .from("nkc_scheduled_messages")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insertedScheduledMessageId);

    const { error: logError } = await supabase.from("nkc_send_logs").insert({
      scheduled_message_id: insertedScheduledMessageId,
      message_id: messageId,
      template_code: input.templateCode,
      phone: normalizedPhone,
      channel,
      status,
      unit_price: getUnitPrice(response),
      retry_count: 0,
      api_response: response,
    });

    if (logError) {
      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "send_log_insert",
        error: logError.message,
      });
    }

    if (failed) {
      return { success: false, error: "알림톡 발송 실패" };
    }

    return {
      success: true,
      data: {
        scheduledMessageId: insertedScheduledMessageId,
        messageId,
        channel,
        status,
      },
    };
  } catch (e) {
    console.error("[Alimtalk]", {
      action: "sendAlimtalk",
      scheduledMessageId,
      error: e instanceof Error ? e.message : e,
    });

    if (scheduledMessageId) {
      try {
        const supabase = await createClient();
        await supabase
          .from("nkc_scheduled_messages")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scheduledMessageId);
      } catch (updateError) {
        console.error("[Alimtalk]", {
          action: "sendAlimtalk",
          step: "failure_status_update",
          error: updateError instanceof Error ? updateError.message : updateError,
        });
      }
    }

    return {
      success: false,
      error: e instanceof Error ? e.message : "알림톡 발송 실패",
    };
  }
}

export async function markConsent(
  input: ConsentInput,
): Promise<ActionResult> {
  try {
    const supabase = await requireAuthenticatedSupabase();
    const phone = normalizePhone(input.phone);

    if (!isValidKoreanMobilePhone(phone)) {
      return { success: false, error: "전화번호 형식 오류" };
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      phone,
      updated_at: now,
    };

    if (input.info_ok !== undefined) payload.info_ok = input.info_ok;
    if (input.ad_ok !== undefined) {
      payload.ad_ok = input.ad_ok;
      payload.ad_consent_at = input.ad_ok ? now : null;
    }
    if (input.optout !== undefined) {
      payload.optout_at = input.optout ? now : null;
    }

    const { error } = await supabase
      .from("nkc_consents")
      .upsert(payload, { onConflict: "phone" });

    if (error) {
      console.error("[Alimtalk]", {
        action: "markConsent",
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error("[Alimtalk]", {
      action: "markConsent",
      error: e instanceof Error ? e.message : e,
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "수신동의 갱신 실패",
    };
  }
}
