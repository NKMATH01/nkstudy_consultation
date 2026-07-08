import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// .env.local 파싱 (check-supabase-data.mjs 스타일). 값에 '='가 포함될 수 있어 첫 '=' 기준으로 분리.
const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
function envVal(key) {
  const line = lines.find((l) => l.startsWith(key + "="));
  if (!line) return undefined;
  return line.slice(line.indexOf("=") + 1).trim();
}
const url = envVal("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = envVal("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// 1) 삭제 전 registrations 재연결 (정확히 3건)
const REG_RELINK = [
  { reg: "e7d404ef-64f3-4f3b-b713-d0a689b6ad24", analysis: "9fa5d861-a9da-47de-8765-fa8da599d9fc", who: "김태유" },
  { reg: "dc6b9454-1577-41b2-ae68-b8b24d1b2500", analysis: "52ef928b-8ebd-4ff7-ad57-0d3cdf5e914b", who: "신율" },
  { reg: "eea4f860-dc45-4470-bd15-12f1b9ca3590", analysis: "c76fdb31-400b-44fe-9925-d7217c088c32", who: "최서우" },
];

// 2) 삭제 대상 analyses id (정확히 11건, 이외 삭제 금지)
const DELETE_IDS = [
  "72a4901d-5a40-40f4-afba-9d2e5f6e4839", // 김기영
  "58ec152a-4882-4b3d-9bd9-19280c35d6fe", // 김기영
  "f92b1a6c-ce8d-4a4d-9afd-512d04c48696", // 김기영
  "ec0e3c29-1285-4154-b189-cad6698ae700", // 김태유
  "7c9474a8-8d30-4874-9270-a8332370e98a", // 김태유
  "271647f2-b477-4da5-8c15-6e2863d48501", // 김태유
  "314423e9-0cf2-4239-b770-b19b62ab9b62", // 신율
  "c9dd5a22-a477-47a3-ade9-b5837f6b5df6", // 최서우
  "7283586e-9fae-4b85-a1ab-413af60a4306", // 류리안
  "3a656c75-cad6-4f9b-ab5e-24635029ee8b", // 김묘경
];

async function analysesCount() {
  const { count } = await admin.from("analyses").select("*", { count: "exact", head: true });
  return count;
}

async function main() {
  console.log("=== dedupe-analyses 시작 ===");
  console.log("URL:", url);

  const before = await analysesCount();
  console.log(`\n[사전] analyses 총 건수: ${before}`);

  // 1) registrations 재연결
  console.log("\n=== 1) registrations 재연결 (3건) ===");
  for (const { reg, analysis, who } of REG_RELINK) {
    const { data: cur } = await admin.from("registrations").select("id, analysis_id").eq("id", reg).maybeSingle();
    if (!cur) {
      console.log(`  [${who}] registration ${reg} 없음 — 건너뜀`);
      continue;
    }
    console.log(`  [${who}] ${reg}: 이전 analysis_id=${cur.analysis_id} → ${analysis}`);
    const { error } = await admin.from("registrations").update({ analysis_id: analysis }).eq("id", reg);
    if (error) {
      console.error(`    재연결 실패: ${error.message}`);
      process.exit(1);
    }
  }

  // 2) analyses 삭제 (정확히 지정 id만)
  console.log(`\n=== 2) analyses 삭제 (대상 ${DELETE_IDS.length}건) ===`);
  const { data: existing } = await admin.from("analyses").select("id, name").in("id", DELETE_IDS);
  console.log(`  삭제 전 존재 확인: ${existing?.length ?? 0}건`);
  (existing ?? []).forEach((r) => console.log(`    - ${r.id} (${r.name})`));

  const { error: delErr } = await admin.from("analyses").delete().in("id", DELETE_IDS);
  if (delErr) {
    console.error(`  삭제 실패: ${delErr.message}`);
    process.exit(1);
  }
  const { data: remain } = await admin.from("analyses").select("id").in("id", DELETE_IDS);
  console.log(`  삭제 후 잔존(대상 id 중): ${remain?.length ?? 0}건 (0이어야 정상)`);

  const afterDelete = await analysesCount();
  console.log(`  [삭제 후] analyses 총 건수: ${afterDelete}`);

  // 3) 백필 (멱등) — surveys.analysis_id 컬럼 존재 시에만
  console.log("\n=== 3) surveys.analysis_id 백필 ===");
  const { error: colErr } = await admin.from("surveys").select("analysis_id").limit(1);
  if (colErr) {
    console.log("  SKIP: analysis_id 컬럼 없음 — DDL 후 재실행 필요");
    console.log(`  (사유: ${colErr.message})`);
  } else {
    const { data: allAnalyses } = await admin
      .from("analyses")
      .select("id, survey_id, created_at")
      .order("created_at", { ascending: false });
    const latestBySurvey = new Map();
    for (const a of allAnalyses ?? []) {
      if (a.survey_id && !latestBySurvey.has(a.survey_id)) {
        latestBySurvey.set(a.survey_id, a.id);
      }
    }
    console.log(`  연결 대상 survey 수: ${latestBySurvey.size}`);
    let updated = 0;
    for (const [surveyId, analysisId] of latestBySurvey) {
      const { error } = await admin.from("surveys").update({ analysis_id: analysisId }).eq("id", surveyId);
      if (error) {
        console.error(`    survey ${surveyId} 업데이트 실패: ${error.message}`);
        continue;
      }
      updated++;
    }
    console.log(`  백필 완료: ${updated}건 업데이트`);
  }

  const finalCount = await analysesCount();
  console.log(`\n[최종] analyses 총 건수: ${finalCount}`);
  console.log("=== dedupe-analyses 완료 ===");
}

main().catch((e) => {
  console.error("스크립트 오류:", e);
  process.exit(1);
});
