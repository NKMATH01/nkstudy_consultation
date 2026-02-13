/** 전화번호 ↔ 이메일 변환 유틸 (Supabase Auth 연동용) */

const EMAIL_DOMAIN = "nk.local";

/** 전화번호 → Supabase Auth 이메일 (예: 01012345678 → 01012345678@nk.local) */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@${EMAIL_DOMAIN}`;
}

/** Supabase Auth 이메일 → 전화번호 */
export function emailToPhone(email: string): string {
  return email.replace(`@${EMAIL_DOMAIN}`, "");
}

/** nk.local 이메일인지 확인 (선생님 계정 여부) */
export function isTeacherEmail(email: string): boolean {
  return email.endsWith(`@${EMAIL_DOMAIN}`);
}

/** Supabase Auth 비밀번호 변환 (4자리 → 6자리, Supabase 최소 6자 요구) */
const AUTH_PW_PREFIX = "nk";
export function toAuthPassword(password: string): string {
  return `${AUTH_PW_PREFIX}${password}`;
}
