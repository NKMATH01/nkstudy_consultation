import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
const url = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).split("=")[1].trim();
const serviceKey = lines.find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=")[1].trim();
const anonKey = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")).split("=")[1].trim();

console.log("=== Supabase 연결 정보 ===");
console.log("URL:", url);
console.log("Service Key:", serviceKey ? `${serviceKey.substring(0, 20)}...` : "NONE");
console.log("Anon Key:", anonKey ? `${anonKey.substring(0, 20)}...` : "NONE");
console.log("");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

async function checkTable(client, label, name) {
  const { count, error } = await client.from(name).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`[${label}] ${name}: ERROR ${error.code} - ${error.message}`);
    return null;
  }
  console.log(`[${label}] ${name}: count=${count}`);
  return count;
}

async function sample(client, name, limit = 3) {
  const { data, error } = await client.from(name).select("*").limit(limit);
  if (error) {
    console.log(`   샘플 조회 실패: ${error.message}`);
    return;
  }
  console.log(`   샘플 ${data.length}건:`);
  data.forEach((row, i) => {
    console.log(`     [${i}] ${JSON.stringify(row).substring(0, 250)}`);
  });
}

console.log("=== 1) Service Role 키로 전체 데이터 확인 (RLS 무시) ===");
const sStudents = await checkTable(admin, "ADMIN", "students");
const sTeachers = await checkTable(admin, "ADMIN", "teachers");
const sClasses = await checkTable(admin, "ADMIN", "classes");

console.log("\n=== 2) Anon 키로 데이터 확인 (RLS 적용) ===");
const aStudents = await checkTable(anon, "ANON ", "students");
const aTeachers = await checkTable(anon, "ANON ", "teachers");
const aClasses = await checkTable(anon, "ANON ", "classes");

console.log("\n=== 3) is_active=true 필터 적용 시 ===");
const { count: activeS } = await admin.from("students").select("*", { count: "exact", head: true }).eq("is_active", true);
const { count: activeT } = await admin.from("teachers").select("*", { count: "exact", head: true }).eq("is_active", true);
const { count: activeC } = await admin.from("classes").select("*", { count: "exact", head: true }).eq("is_active", true);
console.log(`students(is_active=true): ${activeS}`);
console.log(`teachers(is_active=true): ${activeT}`);
console.log(`classes(is_active=true): ${activeC}`);

console.log("\n=== 4) is_active=false 데이터 ===");
const { count: inactiveS } = await admin.from("students").select("*", { count: "exact", head: true }).eq("is_active", false);
const { count: inactiveT } = await admin.from("teachers").select("*", { count: "exact", head: true }).eq("is_active", false);
const { count: inactiveC } = await admin.from("classes").select("*", { count: "exact", head: true }).eq("is_active", false);
console.log(`students(is_active=false): ${inactiveS}`);
console.log(`teachers(is_active=false): ${inactiveT}`);
console.log(`classes(is_active=false): ${inactiveC}`);

console.log("\n=== 5) 샘플 데이터 (admin) ===");
if (sStudents > 0) { console.log("\n[students]"); await sample(admin, "students"); }
if (sTeachers > 0) { console.log("\n[teachers]"); await sample(admin, "teachers"); }
if (sClasses > 0) { console.log("\n[classes]"); await sample(admin, "classes"); }
