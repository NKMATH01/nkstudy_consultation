import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE URL 또는 SERVICE_ROLE_KEY가 없습니다");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const clinicTeachers = [
  { name: "김재범", phone: "01071496311" },
  { name: "도율", phone: "01038184295" },
  { name: "박환희", phone: "01054608313" },
  { name: "방채민", phone: "01066852462" },
  { name: "신재민", phone: "01066217314" },
  { name: "안세진", phone: "01039530480" },
  { name: "엄효상", phone: "01048277175" },
  { name: "유다연", phone: "01031468930" },
  { name: "유지은", phone: "01023277663" },
  { name: "윤도현", phone: "01020769330" },
  { name: "이소윤", phone: "01094473090" },
  { name: "이소은", phone: "01071221751" },
  { name: "이아름", phone: "01067975399" },
  { name: "장민준", phone: "01066315836" },
  { name: "정민준", phone: "01054489461" },
  { name: "한재현", phone: "01099088768" },
  { name: "황일겸", phone: "01041250929" },
];

async function main() {
  // 기존 클리닉 선생님 전화번호 확인 (중복 방지)
  const { data: existing } = await supabase
    .from("teachers")
    .select("phone")
    .in("phone", clinicTeachers.map((t) => t.phone));

  const existingPhones = new Set((existing || []).map((t) => t.phone));

  const toInsert = clinicTeachers
    .filter((t) => !existingPhones.has(t.phone))
    .map((t) => ({
      name: t.name,
      phone: t.phone,
      role: "clinic",
      password: "1234",
      is_active: true,
    }));

  if (toInsert.length === 0) {
    console.log("모든 클리닉 선생님이 이미 등록되어 있습니다.");
    return;
  }

  console.log(`${toInsert.length}명 신규 등록 중...`);

  const { data, error } = await supabase
    .from("teachers")
    .insert(toInsert)
    .select("name, phone, role");

  if (error) {
    console.error("등록 실패:", error.message);
    process.exit(1);
  }

  console.log(`${data.length}명 등록 완료:`);
  data.forEach((t) => console.log(`  - ${t.name} (${t.phone}) [${t.role}]`));
}

main().catch(console.error);
