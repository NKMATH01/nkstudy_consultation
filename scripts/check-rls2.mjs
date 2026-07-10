import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
const url = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).split("=")[1].trim();
const serviceKey = lines.find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=")[1].trim();
const anonKey = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")).split("=")[1].trim();

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// 1) 동일 supabase 인스턴스에서 setSession으로 인증
const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: signin, error: signinErr } = await userClient.auth.signInWithPassword({
  email: "admin@nk.com",
  password: "nk123456",
});
console.log("로그인:", signinErr ? signinErr.message : "성공", "user.id:", signin?.user?.id);

console.log("\n=== 같은 클라이언트 인스턴스로 조회 (인증 적용) ===");
for (const t of ["students", "teachers", "classes"]) {
  const { count, error } = await userClient.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${error ? `ERROR ${error.code}: ${error.message}` : `count=${count}`}`);
}

// 2) PostgreSQL pg_policies 조회 (REST로는 직접 안 되니, RPC 또는 information_schema 사용)
console.log("\n=== 실제 RLS 정책 (Supabase REST) ===");
// 직접 SQL 실행을 위한 RPC가 없으므로 raw fetch로 시도
const policiesUrl = `${url}/rest/v1/rpc/get_policies`;
console.log("(pg_policies는 REST API로 직접 조회 불가. management API 또는 SQL Editor 필요)");

// 3) 학생 1건만 가져와보기 (실제 어떤 메시지가 오는지)
console.log("\n=== 단일 row 조회 시도 ===");
const { data: s, error: serr, status, statusText } = await userClient.from("students").select("id,name").limit(1);
console.log("students:", { status, statusText, error: serr?.message, dataLen: s?.length, data: s });

const { data: t, error: terr } = await userClient.from("teachers").select("id,name").limit(1);
console.log("teachers:", { error: terr?.message, dataLen: t?.length, data: t });

// 4) JWT 토큰 디코딩으로 role 확인
const token = signin?.session?.access_token;
if (token) {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  console.log("\n=== JWT payload (role 확인) ===");
  console.log("  role:", payload.role);
  console.log("  aud:", payload.aud);
  console.log("  email:", payload.email);
  console.log("  user_metadata:", payload.user_metadata);
  console.log("  app_metadata:", payload.app_metadata);
}
