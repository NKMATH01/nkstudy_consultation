// 입학테스트 답안 분석 — 사진 내려받기 (로컬 분석용)
// 사용: node scripts/exam-pull.mjs --id <exam_analysis_id>
//       --id 없으면 status='pending' 목록만 출력하고 종료한다.
// ★ 작업 폴더가 OneDrive 동기화 경로면 중단한다(학생 시험지 사진이 MS 클라우드로 복제되는 것 방지).
import { readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";

const BUCKET = "exam-papers"; // Storage 버킷 이름 — 마이그레이션과 일치해야 함
const PHOTO_RE = /^(paper|mathflex)-\d+\.[a-z0-9]+$/i;

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
if (!url || !key) {
  console.error("[exam-pull] .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function workRoot() {
  return join(process.env.LOCALAPPDATA || tmpdir(), "nk-exam-work");
}

function assertNotOneDrive(dir) {
  const abs = resolve(dir);
  const lower = abs.toLowerCase();
  const oneDriveRoots = [process.env.OneDrive, process.env.OneDriveCommercial, process.env.OneDriveConsumer]
    .filter(Boolean)
    .map((p) => resolve(p).toLowerCase());
  if (lower.includes("onedrive") || oneDriveRoots.some((r) => lower.startsWith(r))) {
    console.error(`[exam-pull] 중단: 작업 폴더가 OneDrive 동기화 경로입니다 → ${abs}`);
    console.error("  학생 시험지 사진이 클라우드로 복제될 수 있어 내려받지 않습니다. LOCALAPPDATA 를 OneDrive 밖으로 지정하세요.");
    process.exit(1);
  }
  return abs;
}

const id = argValue("--id");

if (!id) {
  const res = await fetch(
    `${url}/rest/v1/exam_analyses?select=*&status=eq.pending&order=created_at.asc`,
    { headers },
  );
  if (res.status === 404) {
    console.log("대기 없음 — exam_analyses 테이블이 아직 없습니다(마이그레이션 미적용).");
    process.exit(0);
  }
  if (!res.ok) {
    console.error(`[exam-pull] 목록 조회 실패 HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rows = await res.json();
  if (rows.length === 0) {
    console.log("대기 없음");
    process.exit(0);
  }
  console.log(`대기 ${rows.length}건`);
  for (const r of rows) {
    const who = r.student_name ?? "";
    const exam = `${r.exam_title ?? ""} ${r.exam_date ?? ""}`.trim();
    const photos = (r.paper_paths?.length ?? 0) + (r.mathflex_paths?.length ?? 0);
    console.log(`- ${r.id}  ${who}  ${exam}  사진 ${photos}장  ${r.created_at ?? ""}`);
  }
  console.log("\n내려받기: node scripts/exam-pull.mjs --id <id>");
  process.exit(0);
}

if (!/^[A-Za-z0-9-]+$/.test(id)) {
  console.error("[exam-pull] --id 형식이 올바르지 않습니다.");
  process.exit(1);
}

// 1) OneDrive 차단 — 조회·다운로드 전에 먼저 확인
const dir = assertNotOneDrive(join(workRoot(), id));

// 2) 해당 1건 조회
const rowRes = await fetch(
  `${url}/rest/v1/exam_analyses?select=*&id=eq.${id}&status=in.(pending,analyzing)`,
  { headers },
);
if (!rowRes.ok) {
  console.error(`[exam-pull] 조회 실패 HTTP ${rowRes.status}: ${await rowRes.text()}`);
  process.exit(1);
}
const [row] = await rowRes.json();
if (!row) {
  console.error(`[exam-pull] pending/analyzing 상태의 ${id} 가 없습니다.`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
// 이전에 받아둔 사진이 섞이지 않도록 정리
for (const f of readdirSync(dir)) if (PHOTO_RE.test(f)) rmSync(join(dir, f));

async function download(path, fileName) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const sign = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${encoded}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  if (!sign.ok) throw new Error(`서명 URL 실패(${path}) HTTP ${sign.status}: ${await sign.text()}`);
  const { signedURL } = await sign.json();
  const file = await fetch(`${url}/storage/v1${signedURL}`);
  if (!file.ok) throw new Error(`다운로드 실패(${path}) HTTP ${file.status}`);
  writeFileSync(join(dir, fileName), Buffer.from(await file.arrayBuffer()));
}

const pad = (n) => String(n).padStart(2, "0");
const extOf = (p) => (extname(p) || ".jpg").toLowerCase();
const saved = [];
try {
  for (const [kind, paths] of [["paper", row.paper_paths ?? []], ["mathflex", row.mathflex_paths ?? []]]) {
    for (let i = 0; i < paths.length; i++) {
      const name = `${kind}-${pad(i + 1)}${extOf(paths[i])}`;
      await download(paths[i], name);
      saved.push(name);
    }
  }
} catch (e) {
  console.error("[exam-pull]", e instanceof Error ? e.message : e);
  process.exit(1);
}

// 3) meta.json — 학생·시험 정보(Storage 경로 제외)
const meta = Object.fromEntries(
  Object.entries(row).filter(([k]) => k !== "paper_paths" && k !== "mathflex_paths"),
);
writeFileSync(join(dir, "meta.json"), JSON.stringify({ ...meta, files: saved }, null, 2), "utf8");

const upd = await fetch(`${url}/rest/v1/exam_analyses?id=eq.${id}`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
  body: JSON.stringify({ status: "analyzing" }),
});
if (!upd.ok) {
  console.error(`[exam-pull] status 갱신 실패 HTTP ${upd.status}: ${await upd.text()}`);
  process.exit(1);
}

// 4) 작업 폴더 절대경로
console.log(`사진 ${saved.length}장 저장, status=analyzing`);
console.log(dir);
