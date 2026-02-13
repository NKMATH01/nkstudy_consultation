import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Service Role 키를 사용하는 Supabase Admin 클라이언트.
 *  용도: Auth 사용자 생성/삭제/비밀번호 리셋 등 관리 작업.
 *  서버 전용 - 클라이언트에서 사용하지 말 것. */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
