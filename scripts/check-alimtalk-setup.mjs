// 알림톡 설정 현황 점검 (읽기 전용) — nkc_alimtalk_templates 행 존재·승인 상태 확인
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const res = await fetch(
  `${url}/rest/v1/nkc_alimtalk_templates?select=template_code,title,kakao_template_id,kakao_status,pf_id,msg_type,variables`,
  { headers },
);
console.log("nkc_alimtalk_templates HTTP", res.status);
console.log(JSON.stringify(await res.json(), null, 2));

for (const t of ["nkc_consents", "nkc_scheduled_messages", "nkc_send_logs"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers });
  console.log(`${t}: HTTP ${r.status}`);
}
