import type { Consultation } from "@/types";

export const CONSULT_CONFIRM_TEMPLATE_CODE = "consult_confirm";

export type AlimtalkSendStatus = "pending" | "sent" | "failed";

export type AlimtalkSendEntry = {
  status: AlimtalkSendStatus;
  sendAt: string;
};

export type AlimtalkSendMap = Record<string, AlimtalkSendEntry>;

export type AlimtalkSendRow = {
  consultation_id: string | null;
  status: string;
  send_at: string;
};

const ACCOUNT = "신한은행 110-383-883419  노윤희(학생명으로 입금 부탁드립니다.)";
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function normalizeSendStatus(status: string): AlimtalkSendStatus | null {
  if (status === "sent") return "sent";
  if (status === "pending" || status === "sending" || status === "retry") {
    return "pending";
  }
  if (status === "failed" || status === "dead") return "failed";
  return null;
}

export function buildAlimtalkSendMap(
  rows: readonly AlimtalkSendRow[],
): AlimtalkSendMap {
  const result: AlimtalkSendMap = {};

  for (const row of rows) {
    if (!row.consultation_id) continue;

    const status = normalizeSendStatus(row.status);
    if (!status) continue;

    const existing = result[row.consultation_id];
    if (
      existing &&
      new Date(existing.sendAt).getTime() >= new Date(row.send_at).getTime()
    ) {
      continue;
    }

    result[row.consultation_id] = {
      status,
      sendAt: row.send_at,
    };
  }

  return result;
}

function fmtDate(ds: string | null): string {
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}

function fmtTime(ts: string | null): string {
  if (!ts) return "";
  const [h, m] = ts.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m > 0 ? `${period} ${dh}시 ${m}분` : `${period} ${dh}시`;
}

function fmtPhone(p: string | null): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return p;
}

function consultLine(c: Consultation): string {
  const ds = fmtDate(c.consult_date);
  if (c.consult_type?.includes("대면")) {
    const m = c.consult_type.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      return `${ds} ${fmtTime(`${m[1]}:${m[2]}`)}에 진행됩니다.`;
    }
  }
  if (c.consult_type?.includes("유선")) return "유선으로 진행됩니다.";
  return ds ? `${ds}에 진행됩니다.` : "-";
}

function parentConsultLine(c: Consultation): string {
  if (c.parent_consult_date) {
    const pds = fmtDate(c.parent_consult_date);
    const pts = c.parent_consult_time ? ` ${fmtTime(c.parent_consult_time)}` : "";
    const ploc = c.parent_location ? ` (${c.parent_location})` : "";
    return `${pds}${pts}${ploc}에 진행됩니다.`;
  }
  return consultLine(c);
}

const orDash = (v: string): string => (v && v.trim() ? v : "-");

export function buildConsultConfirmVars(
  c: Consultation,
): Record<string, string> {
  return {
    이름: orDash(c.name),
    학부모: orDash(fmtPhone(c.parent_phone)),
    학교: orDash(`${c.school ?? ""}${c.grade ?? ""}`),
    일시: c.consult_date
      ? `${fmtDate(c.consult_date)} ${fmtTime(c.consult_time)}`
      : "-",
    과목: orDash(c.subject ?? ""),
    상담비: "과목당 1만원",
    계좌: ACCOUNT,
    준비물: "필기도구",
    위치: orDash(c.location ?? ""),
    학부모상담: parentConsultLine(c),
  };
}
