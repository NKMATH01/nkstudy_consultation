import { createHash, timingSafeEqual } from "node:crypto";

export function scheduleAuthorized(header: string | null, token: string | undefined): boolean {
  if (!token || token.length < 32 || !/^[\x21-\x7e]+$/.test(token)) return false;
  if (!header || !/^Bearer [\x21-\x7e]{32,512}$/.test(header)) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(token));
}

export function realDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function scheduleRange(from: string | null, to: string | null) {
  if (!realDate(from) || !realDate(to) || from > to) return null;
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 92) return null;
  return { from, to };
}

export interface ScheduleRow {
  id: string; name: string; parent_phone: string | null;
  consult_date: string | null; consult_time: string | null; consult_type: string | null;
  location: string | null; parent_consult_date: string | null;
  parent_consult_time: string | null; parent_location: string | null;
  status: string; consult_done: boolean; subject?: string | null;
}

function normalizedTime(value: string | null) {
  const match = value?.match(/^(\d{1,2}):(\d{2})(?::([0-5]\d))?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function mapDirectorSchedule(rows: ScheduleRow[], range: { from: string; to: string }, includeHistory = false) {
  return rows.flatMap(row => {
    const face = row.consult_type?.includes("대면") ?? false;
    if (!["active", "pending", "completed", "cancelled"].includes(row.status)) return [];
    if (!includeHistory && (!["active", "pending"].includes(row.status) || row.consult_done !== false)) return [];
    const embedded = face ? row.consult_type?.match(/(?:^|[^\d:])(\d{1,2}:\d{2}(?::\d{2})?)(?![\d:])/)?.[1] ?? null : null;
    const schedules = [
      { suffix: "main", kind: "consultation" as const, date: row.consult_date, time: normalizedTime(embedded) ?? normalizedTime(row.consult_time), location: row.location },
      { suffix: "parent", kind: "parent" as const, date: row.parent_consult_date, time: normalizedTime(row.parent_consult_time), location: row.parent_location },
    ];
    return schedules.flatMap(schedule => {
      if (!realDate(schedule.date) || schedule.date < range.from || schedule.date > range.to) return [];
      return [{ id: `${row.id}:${schedule.suffix}`, consultation_id: row.id,
        subject: row.subject ?? null, lifecycle: row.status === "cancelled" ? "cancelled" as const : row.status === "completed" || row.consult_done ? "completed" as const : "scheduled" as const,
        student_name: row.name, parent_phone: row.parent_phone, date: schedule.date,
        time: schedule.time, mode: face ? "in_person" as const : "phone" as const,
        location: schedule.location, status: row.status, kind: schedule.kind,
        source_url: `https://nkstudy-consultation.vercel.app/consultations/${row.id}` }];
    });
  }).sort((a, b) => `${a.date}${a.time ?? "99:99"}${a.id}`.localeCompare(`${b.date}${b.time ?? "99:99"}${b.id}`));
}
