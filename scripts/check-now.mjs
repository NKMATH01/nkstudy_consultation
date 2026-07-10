import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
const url = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).split("=")[1].trim();
const serviceKey = lines.find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=")[1].trim();
const anonKey = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")).split("=")[1].trim();

console.log("URL:", url);
console.log("ProjectRef:", url.match(/https:\/\/(\w+)\./)?.[1]);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

console.log("\n=== Service Role (RLS bypass) ===");
for (const t of ["students", "teachers", "classes"]) {
  const { count } = await admin.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${count}`);
}

console.log("\n=== authenticated 사용자(admin@nk.com)로 PostgREST 조회 ===");
const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: signin, error: signinErr } = await userClient.auth.signInWithPassword({
  email: "admin@nk.com",
  password: "nk123456",
});
console.log("로그인:", signinErr ? signinErr.message : `성공 (uid=${signin.user.id})`);

for (const t of ["students", "teachers", "classes"]) {
  const { count, error } = await userClient.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: count=${count} ${error ? "ERROR=" + error.message : ""}`);
}

// 직접 fetch로도 확인
console.log("\n=== Raw fetch (Authorization header 직접 설정) ===");
const token = signin?.session?.access_token;
for (const t of ["students", "teachers", "classes"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=count`, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${token}`,
      "Prefer": "count=exact",
      "Range": "0-0",
    },
  });
  const range = r.headers.get("content-range");
  const body = await r.text();
  console.log(`${t}: status=${r.status}, content-range=${range}, body=${body.substring(0, 100)}`);
}

// 만료/issuer 확인
const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
console.log("\n=== JWT info ===");
console.log("  iss:", payload.iss);
console.log("  ref:", payload.ref);
console.log("  exp:", new Date(payload.exp * 1000).toISOString());
console.log("  role:", payload.role);
