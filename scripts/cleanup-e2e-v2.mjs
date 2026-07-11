// 설문 V2 라이브 E2E가 운영 DB에 생성한 테스트 데이터 삭제(멱등).
// live-v2.mjs가 기록한 e2e/.live-ids.json의 id만 삭제한다. 다른 데이터는 건드리지 않는다.
//
// ⚠ 운영 데이터 삭제이므로 자동 실행하지 않는다. 사용자가 직접 실행:
//     ! node scripts/cleanup-e2e-v2.mjs
//   특정 id로 실행하려면:
//     ! node scripts/cleanup-e2e-v2.mjs --survey <id> --analysis <id> --token <token>
//
// 안전장치: id가 하나도 없으면 아무것도 삭제하지 않고 종료한다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === "--survey") out.surveyId = args[i + 1];
    else if (args[i] === "--analysis") out.analysisId = args[i + 1];
    else if (args[i] === "--token") out.token = args[i + 1];
  }
  return out;
}

function loadIds() {
  const cli = parseArgs();
  if (cli.surveyId || cli.analysisId || cli.token) return cli;
  const idsFile = path.join(__dirname, "..", "e2e", ".live-ids.json");
  if (fs.existsSync(idsFile)) {
    try {
      return JSON.parse(fs.readFileSync(idsFile, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

async function main() {
  const env = loadEnvLocal();
  const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ids = loadIds();
  const { surveyId, analysisId, token } = ids;

  if (!surveyId && !analysisId && !token) {
    console.log("삭제할 id가 없습니다. e2e/.live-ids.json이 없거나 비어 있습니다. 종료.");
    return;
  }
  console.log("삭제 대상:", JSON.stringify({ surveyId, analysisId, token }));

  // FK 안전 순서: report_token → surveys.analysis_id 해제 → analyses → surveys.
  if (token) {
    const { error } = await svc.from("report_tokens").delete().eq("token", token);
    console.log(error ? `report_tokens 삭제 오류: ${error.message}` : "report_tokens 삭제 완료(또는 없음)");
  }
  if (surveyId) {
    const { error } = await svc.from("surveys").update({ analysis_id: null }).eq("id", surveyId);
    if (error) console.log(`surveys.analysis_id 해제 오류: ${error.message}`);
  }
  if (analysisId) {
    const { error } = await svc.from("analyses").delete().eq("id", analysisId);
    console.log(error ? `analyses 삭제 오류: ${error.message}` : "analyses 삭제 완료(또는 없음)");
  }
  if (surveyId) {
    const { error } = await svc.from("surveys").delete().eq("id", surveyId);
    console.log(error ? `surveys 삭제 오류: ${error.message}` : "surveys 삭제 완료(또는 없음)");
  }
  console.log("완료.");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
