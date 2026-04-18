// 수학 2반 컬럼 추가 마이그레이션
// Usage: node scripts/add-math2-columns.mjs

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  // Test if columns already exist
  const { data, error } = await supabase
    .from("registrations")
    .select("id, assigned_class_math2, teacher_math2")
    .limit(1);

  if (!error) {
    console.log("✅ assigned_class_math2, teacher_math2 columns already exist");
    return;
  }

  if (error.code === "42703") {
    console.log("⚠️  Columns do not exist yet. Please run the following SQL in Supabase Dashboard > SQL Editor:");
    console.log("");
    console.log("ALTER TABLE registrations ADD COLUMN IF NOT EXISTS assigned_class_math2 TEXT;");
    console.log("ALTER TABLE registrations ADD COLUMN IF NOT EXISTS teacher_math2 TEXT;");
    console.log("");
    console.log("Or go to: https://supabase.com/dashboard/project/scrliiiiexjedgzogcfo/sql/new");
  } else {
    console.error("Unexpected error:", error);
  }
}

migrate();
