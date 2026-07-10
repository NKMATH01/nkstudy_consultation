import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
const url = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).split("=")[1].trim();
const serviceKey = lines.find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=")[1].trim();

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// authenticated 역할로 시뮬레이션 (테스트 사용자로 로그인)
const { data: signin, error: signinErr } = await admin.auth.signInWithPassword({
  email: "admin@nk.com",
  password: "nk123456",
});
console.log("관리자 로그인:", signinErr ? `실패 (${signinErr.message})` : "성공");
if (signin?.session) {
  console.log("  user.id:", signin.user.id);
  console.log("  email:", signin.user.email);
}

// authenticated 사용자(admin)로 데이터 조회 시도
const anonKey = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")).split("=")[1].trim();
const userClient = createClient(url, anonKey, {
  auth: { persistSession: false },
  global: signin?.session ? { headers: { Authorization: `Bearer ${signin.session.access_token}` } } : {},
});

console.log("\n=== authenticated(admin@nk.com) 사용자로 조회 ===");
for (const t of ["students", "teachers", "classes"]) {
  const { count, error } = await userClient.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${error ? `ERROR: ${error.message}` : `count=${count}`}`);
}

// RLS 정책 확인
console.log("\n=== RLS 정책 조회 (admin) ===");
const { data: pols, error: polErr } = await admin.rpc("pg_policies_query").catch(() => ({ data: null, error: { message: "RPC 없음" } }));
if (polErr) {
  // pg_policies는 일반 테이블처럼 SELECT 가능
  const { data: pols2, error: e2 } = await admin
    .from("pg_policies")
    .select("schemaname,tablename,policyname,cmd,roles,qual")
    .in("tablename", ["students", "teachers", "classes"]);
  if (e2) {
    console.log("정책 조회 불가:", e2.message);
  } else {
    console.log(JSON.stringify(pols2, null, 2));
  }
} else {
  console.log(pols);
}
