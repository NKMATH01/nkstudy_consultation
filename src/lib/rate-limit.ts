/** 간단한 in-memory rate limiter (서버 액션용) */

const store = new Map<string, { count: number; resetAt: number }>();

// 5분마다 만료 엔트리 정리
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, val] of store) {
    if (now > val.resetAt) store.delete(key);
  }
}

/**
 * Rate limit 체크
 * @param key 고유 키 (예: IP, 전화번호)
 * @param maxRequests 윈도우 내 최대 요청 수
 * @param windowMs 윈도우 시간 (ms)
 * @returns { allowed: boolean, remaining: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}
