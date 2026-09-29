// 입학테스트 시험지 버킷 고아 폴더 정리
// 사용: node scripts/exam-orphans.mjs            → 목록만 출력(dry-run, 아무것도 지우지 않음)
//       node scripts/exam-orphans.mjs --delete   → 대상 폴더의 파일을 지우고 지운 개수를 확인해 출력
// 대상: exam-papers 최상위 폴더(=시험 id) 중 exam_analyses 에 같은 id 행이 없고,
//       폴더 안 가장 최근 파일이 24시간보다 오래된 것만. (업로드 중 화면 이탈로 남은 파일)
// 출력에는 폴더 id·파일 수만 쓴다(학생 이름 등 개인정보 출력 금지).
// 로컬에 파일을 내려받지 않으므로 exam-pull 의 OneDrive 작업 폴더 가드는 필요 없다.
import { readFileSync } from "node:fs";

const BUCKET = "exam-papers"; // Storage 버킷 이름 — 마이그레이션과 일치해야 함
const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 1000;

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
if (!url || !key) {
  console.error("[exam-orphans] .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const doDelete = process.argv.includes("--delete");

async function listStorage(prefix) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`Storage 목록 실패(${prefix || "/"}) HTTP ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function examIds() {
  const ids = new Set();
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/exam_analyses?select=id&order=id.asc`, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" },
    });
    if (!res.ok) throw new Error(`exam_analyses 조회 실패 HTTP ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    for (const r of rows) ids.add(String(r.id));
    if (rows.length < PAGE) return ids;
  }
}

try {
  const [top, ids] = await Promise.all([listStorage(""), examIds()]);
  // 폴더는 id 가 null 로 돌아온다. 시험 id 형식(uuid)만 본다.
  const folders = top.filter((o) => o.id == null && UUID_RE.test(o.name)).map((o) => o.name);
  const now = Date.now();
  const targets = [];
  for (const folder of folders) {
    if (ids.has(folder)) continue;
    const files = (await listStorage(`${folder}/`)).filter((o) => o.id != null);
    if (files.length === 0) continue;
    const newest = Math.max(...files.map((f) => new Date(f.created_at ?? f.updated_at ?? 0).getTime()));
    if (!Number.isFinite(newest) || now - newest < MIN_AGE_MS) continue;
    targets.push({ folder, paths: files.map((f) => `${folder}/${f.name}`) });
  }

  console.log(`폴더 ${folders.length}개 중 고아(행 없음·24시간 경과) ${targets.length}개`);
  for (const t of targets) console.log(`- ${t.folder}  파일 ${t.paths.length}개`);
  if (targets.length === 0) process.exit(0);

  if (!doDelete) {
    console.log("\n목록만 출력했습니다(dry-run). 지우려면: node scripts/exam-orphans.mjs --delete");
    process.exit(0);
  }

  let failed = 0;
  for (const t of targets) {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: t.paths }),
    });
    if (!res.ok) {
      failed++;
      console.error(`- ${t.folder}  삭제 실패 HTTP ${res.status}`);
      continue;
    }
    const removed = await res.json();
    const count = Array.isArray(removed) ? removed.length : 0;
    const ok = count === t.paths.length;
    if (!ok) failed++;
    console.log(`- ${t.folder}  삭제 ${count}/${t.paths.length}${ok ? "" : "  ← 개수 불일치, 다시 확인 필요"}`);
  }
  if (failed > 0) {
    console.error(`[exam-orphans] ${failed}개 폴더 삭제가 완전하지 않습니다.`);
    process.exit(1);
  }
  console.log("삭제 완료");
} catch (e) {
  console.error("[exam-orphans]", e instanceof Error ? e.message : e);
  process.exit(1);
}
