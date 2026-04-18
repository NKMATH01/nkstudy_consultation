import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: w } = await c.from("withdrawals").select("name, class_name").order("created_at", { ascending: false }).limit(10);
for (const r of w || []) {
  const raw = r.class_name || "";
  const normalized = raw.includes("-") ? raw : raw.replace(/([가-힣\d])([A-Z])/, "$1-$2");
  const { data: student } = await c.from("students").select("name, class_name, is_active").eq("name", r.name).limit(1);
  const s = student?.[0];
  const match = s ? (s.class_name === normalized ? "MATCH" : "MISMATCH") : "NO_STUDENT";
  console.log(`${r.name} | 퇴원: ${raw} | 정규화: ${normalized} | 학생DB: ${s?.class_name || "N/A"} | ${match}`);
}
