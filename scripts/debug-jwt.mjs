import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
const url = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).split("=")[1].trim();
const anonKey = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")).split("=")[1].trim();
const serviceKey = lines.find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=")[1].trim();

// 1) anon key만 사용 (로그인 없음)
console.log("=== 1) anon만 보낼 때 ===");
let r = await fetch(`${url}/rest/v1/students?select=count`, {
  headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}`, "Prefer": "count=exact", "Range": "0-0" },
});
console.log(`status=${r.status}, range=${r.headers.get("content-range")}, body=${await r.text()}`);

// 2) Service Role 사용 (RLS bypass)
console.log("\n=== 2) service_role 보낼 때 ===");
r = await fetch(`${url}/rest/v1/students?select=count`, {
  headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Prefer": "count=exact", "Range": "0-0" },
});
console.log(`status=${r.status}, range=${r.headers.get("content-range")}, body=${await r.text()}`);

// 3) authenticated 토큰 (admin@nk.com)
const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: signin } = await userClient.auth.signInWithPassword({
  email: "admin@nk.com", password: "nk123456",
});
const token = signin.session.access_token;

console.log("\n=== 3) authenticated 토큰 보낼 때 ===");
r = await fetch(`${url}/rest/v1/students?select=count`, {
  headers: { "apikey": anonKey, "Authorization": `Bearer ${token}`, "Prefer": "count=exact", "Range": "0-0" },
});
console.log(`status=${r.status}, range=${r.headers.get("content-range")}, body=${await r.text()}`);

// 4) PostgREST에 현재 role/uid를 묻는 RPC 만들기
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
console.log("\n=== 4) debug_jwt 함수 생성 ===");
const { data: rpcCreate, error: rpcCreateErr } = await admin.rpc("query", {}).then(()=>({})).catch(()=>({}));

// PostgREST에 RPC 생성은 SQL Editor에서만 가능. 대신 아래 SQL을 사용자에게 안내
console.log(`
사용자가 SQL Editor에서 실행할 SQL:

CREATE OR REPLACE FUNCTION public.debug_whoami()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'jwt_role', current_setting('request.jwt.claim.role', true),
    'jwt_sub', current_setting('request.jwt.claim.sub', true),
    'jwt_email', current_setting('request.jwt.claim.email', true),
    'auth_uid', auth.uid(),
    'auth_role', auth.role()
  );
$$;
GRANT EXECUTE ON FUNCTION public.debug_whoami() TO anon, authenticated;
`);

// 만약 함수가 이미 있다면 호출
console.log("\n=== 5) authenticated로 debug_whoami 호출 시도 ===");
r = await fetch(`${url}/rest/v1/rpc/debug_whoami`, {
  method: "POST",
  headers: { "apikey": anonKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  body: "{}",
});
console.log(`status=${r.status}, body=${await r.text()}`);
