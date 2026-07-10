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

type PreviewInput = {
  consultationId: string;
  templateCode: string;
  vars: Record<string, string>;
};

type SendInput = PreviewInput & {
  allowSmsFallback?: boolean;
  scheduledDate?: string | Date;
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
    const [{ data: template, error: templateError }, { data: consultation, error: consultationError }] =
      await Promise.all([
        fetchTemplate(supabase, input.templateCode),
        fetchConsultationContact(supabase, input.consultationId),
      ]);

    if (templateError) {
      console.error("[Alimtalk]", {
        action: "previewAlimtalk",
        step: "template",
        error: templateError.message,
      });
      return { success: false, error: templateError.message };
    }

    if (consultationError) {
      console.error("[Alimtalk]", {
        action: "previewAlimtalk",
        step: "consultation",
        error: consultationError.message,
      });
      return { success: false, error: consultationError.message };
    }

    if (!template) {
      return { success: false, error: "템플릿 없음" };
    }

    const contact = consultation as ConsultationContact | null;
    const phone = contact?.parent_phone ?? "";
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
    const [{ data: template, error: templateError }, { data: consultation, error: consultationError }] =
      await Promise.all([
        fetchTemplate(supabase, input.templateCode),
        fetchConsultationContact(supabase, input.consultationId),
      ]);

    if (templateError) {
      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "template",
        error: templateError.message,
      });
      return { success: false, error: templateError.message };
    }

    if (consultationError) {
      console.error("[Alimtalk]", {
        action: "sendAlimtalk",
        step: "consultation",
        error: consultationError.message,
      });
      return { success: false, error: consultationError.message };
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

    const contact = consultation as ConsultationContact | null;
    const phone = contact?.parent_phone ?? "";
    if (!phone || !isValidKoreanMobilePhone(phone)) {
      return { success: false, error: "대상 전화번호 오류" };
    }
    const normalizedPhone = normalizePhone(phone);

    const { data: consent, error: consentError } = await supabase
      .from("nkc_consents")
      .select("optout_at")
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

    const scheduledAt = parseScheduledDate(input.scheduledDate);
    if (!scheduledAt && isNightTimeKST()) {
      return {
        success: false,
        error: "야간시간(21~08시) 발송 불가, 예약발송 권장",
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
    const dedupKey = `${input.templateCode}:${input.consultationId}:${
      scheduledAt ? `sched:${scheduledAt.toISOString()}` : "now"
    }`;

    const { data: scheduledMessage, error: insertError } = await supabase
      .from("nkc_scheduled_messages")
      .insert({
        template_code: input.templateCode,
        consultation_id: input.consultationId,
        target_phone_snapshot: normalizedPhone,
        payload: {
          vars: input.vars,
          text: rendered.text,
          allowSmsFallback: input.allowSmsFallback ?? true,
        },
        send_at: sendAt.toISOString(),
        status: "pending",
        dedup_key: dedupKey,
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
