import "server-only";

const TEMPLATE_TOKEN_RE = /#\{([^}]+)\}/g;

export function renderTemplate(
  body: string,
  vars: Record<string, string>,
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = body.replace(TEMPLATE_TOKEN_RE, (token, rawKey: string) => {
    const key = rawKey.trim();
    const value = vars[key];

    if (value === undefined || value === null) {
      missing.add(key);
      return token;
    }

    return value;
  });

  return { text, missing: Array.from(missing) };
}

export function isNightTimeKST(date: Date = new Date()): boolean {
  const kstHour = (date.getUTCHours() + 9) % 24;
  return kstHour >= 21 || kstHour < 8;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }

  return phone.replace(/(\d{3})\d+(\d{4})/, "$1****$2");
}
