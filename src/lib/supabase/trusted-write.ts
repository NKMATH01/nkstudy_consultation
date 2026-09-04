// 공개 제출(설문)처럼 인증 없는 요청을 서버가 검증한 뒤 DB에 쓰는 단일 경로.
// service role 키가 있으면 RLS를 우회하는 admin 클라이언트를, 없으면 기존 anon 서버 클라이언트로 폴백한다.
// 폴백은 DB에서 anon 쓰기 권한을 회수하기 전까지의 과도기용이다(회수 뒤에는 키 없이는 저장이 실패해야 정상).

import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * "service"      — service role 키로 RLS를 우회하는 신뢰 경로(정상 상태).
 * "anon-fallback" — 키 미설정 시 과도기 폴백. anon 쓰기 권한 회수 후에는 저장이 실패한다.
 */
export type TrustedWriteMode = "service" | "anon-fallback";

export async function createTrustedWriteClient(): Promise<{
  client: SupabaseClient;
  mode: TrustedWriteMode;
}> {
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return { client: createAdminClient(), mode: "service" };
  }

  console.warn(
    "[trusted-write] SUPABASE_SERVICE_ROLE_KEY 미설정 — anon 서버 클라이언트로 폴백"
  );
  return { client: await createClient(), mode: "anon-fallback" };
}
