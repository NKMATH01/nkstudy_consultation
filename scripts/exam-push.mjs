// 입학테스트 답안 분석 — 분석 결과(JSON) 올리기
// 사용: node scripts/exam-push.mjs --id <exam_analysis_id> --file <report.json> [--dry-run]
// 실행 쿼리는 두 개뿐: report_tokens INSERT → exam_analyses UPDATE.
// 성공 시에만 작업 폴더의 사진을 지운다(개인정보 잔존 방지). 실패하면 아무것도 지우지 않는다.
import { readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateExamReportV1 } from "./lib/exam-report-validate.mjs";
import { buildExamScoreSummary } from "./lib/exam-score-summary.mjs";

const DEFAULT_BASE_URL = "https://nkstudy-consultation.vercel.app"; // src/lib/academy.ts 와 동일
const PHOTO_RE = /^(paper|mathflex)-\d+\.[a-z0-9]+$/i;

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const id = argValue("--id");
const file = argValue("--file");
const dryRun = process.argv.includes("--dry-run");

if (!id || !file) {
  console.error("사용: node scripts/exam-push.mjs --id <id> --file <report.json> [--dry-run]");
  process.exit(1);
}
if (!/^[A-Za-z0-9-]+$/.test(id)) {
  console.error("[exam-push] --id 형식이 올바르지 않습니다.");
  process.exit(1);
}

// ── report.json 검증 ───────────────────────────────────────────────────
// 규칙은 scripts/lib/exam-report-validate.mjs 한 곳에만 둔다.
// 학부모 화면(zod)과 판정이 어긋나면 src/lib/__tests__/exam-report-validate.test.ts 가 실패한다.

let report;
try {
  report = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
} catch (e) {
  console.error(`[exam-push] ${file} 을 JSON 으로 읽지 못했습니다: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
// 없는 선택 배열은 먼저 빈 배열로 채운다 — 저장하는 값과 검증한 값이 같아야 한다.
for (const k of ["difficulty", "picks", "causes", "plan", "summary", "units"]) {
  if (report[k] === undefined) report[k] = [];
}
const verdict = validateExamReportV1(report);
if (!verdict.ok) {
  console.error(`[exam-push] report.json 검증 실패 ${verdict.errors.length}건:`);
  for (const m of verdict.errors) console.error(`  - ${m}`);
  console.error("  (규칙: scripts/lib/exam-report-validate.mjs · 학부모 화면과 동일한 기준)");
  process.exit(1);
}

// ── 점수 칸(exam_analyses.score_*) ─────────────────────────────────────
// 등록 화면이 바로 읽는 값. 요약 규칙은 scripts/lib/exam-score-summary.mjs 한 곳(앱과 공유).
const scoreFields = {
  score_raw: report.score.raw,
  score_max: report.score.max,
  score_grade:
    report.score.grade === undefined || String(report.score.grade).trim() === ""
      ? null
      : String(report.score.grade).trim(),
  score_summary: buildExamScoreSummary(report.units),
};

// ── 날짜 ────────────────────────────────────────────────────────────────
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const expiresAt = addDays(14).toISOString();
const retainUntil = ymd(addDays(90));

const workDir = join(process.env.LOCALAPPDATA || tmpdir(), "nk-exam-work", id);
const photos = existsSync(workDir) ? readdirSync(workDir).filter((f) => PHOTO_RE.test(f)) : [];

if (dryRun) {
  console.log("[dry-run] 검증 통과 — DB 변경·사진 삭제 없음");
  console.log(`  report_tokens INSERT: report_type=exam_v1, name=${report.student.name}, expires_at=${expiresAt}`);
  console.log(`  exam_analyses UPDATE id=${id}: status=done, analyzed_at=now, retain_until=${retainUntil}`);
  console.log(
    `    score_raw=${scoreFields.score_raw}, score_max=${scoreFields.score_max}, score_grade=${scoreFields.score_grade ?? "(없음)"}`,
  );
  console.log(`    score_summary=${scoreFields.score_summary ?? "(없음)"}`);
  console.log(`  성공 시 작업 폴더 통째로 삭제(사진 ${photos.length}장 포함): ${workDir}`);
  process.exit(0);
}

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const baseUrl = (env.match(/^NEXT_PUBLIC_BASE_URL=(.+)$/m)?.[1]?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
if (!url || !key) {
  console.error("[exam-push] .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
  process.exit(1);
}
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// 쿼리 1: report_tokens INSERT
const ins = await fetch(`${url}/rest/v1/report_tokens?select=token`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    report_type: "exam_v1",
    report_html: JSON.stringify(report),
    name: report.student.name,
    expires_at: expiresAt,
  }),
});
if (!ins.ok) {
  console.error(`[exam-push] report_tokens INSERT 실패 HTTP ${ins.status}: ${await ins.text()}`);
  process.exit(1);
}
const token = (await ins.json())?.[0]?.token;
if (!token) {
  console.error("[exam-push] report_tokens INSERT 응답에 token 이 없습니다.");
  process.exit(1);
}

// 쿼리 2: exam_analyses UPDATE
// status 필터: 이미 발송(sent)된 건을 done 으로 되돌리지 않는다.
// 0행이면 아래 롤백 경로가 돌아 방금 만든 토큰을 지운다.
const baseUpdate = {
  status: "done",
  report_token: token,
  analyzed_at: new Date().toISOString(),
  retain_until: retainUntil,
};
const patchExam = (body) =>
  fetch(`${url}/rest/v1/exam_analyses?id=eq.${id}&status=in.(pending,analyzing)&select=id`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
let upd = await patchExam({ ...baseUpdate, ...scoreFields });
// 점수 칸 마이그레이션(20260929100000) 적용 전이면 PostgREST 가 PGRST204(없는 칸)로 거부한다.
// 이때만 점수 칸을 빼고 한 번 더 저장한다 — 분석지 올리기 자체는 막지 않는다.
if (!upd.ok && upd.status === 400) {
  const text = await upd.text();
  if (/PGRST204/.test(text) && /score_/.test(text)) {
    console.error("[exam-push] 경고: exam_analyses 에 score_* 칸이 없어 점수 없이 저장합니다(마이그레이션 20260929100000 적용 필요).");
    upd = await patchExam(baseUpdate);
  } else {
    upd = new Response(text, { status: upd.status });
  }
}
const updRows = upd.ok ? await upd.json() : null;
if (!upd.ok || !Array.isArray(updRows) || updRows.length !== 1) {
  const detail = upd.ok ? `갱신된 행 ${updRows?.length ?? 0}건` : `HTTP ${upd.status}: ${await upd.text()}`;
  console.error(`[exam-push] exam_analyses UPDATE 실패 (${detail})`);
  // 복구: 방금 만든 토큰 행을 지워 어디에도 연결되지 않은 분석지가 남지 않게 한다.
  let rolledBack = false;
  try {
    const del = await fetch(`${url}/rest/v1/report_tokens?token=eq.${encodeURIComponent(token)}&select=token`, {
      method: "DELETE",
      headers,
    });
    const delRows = del.ok ? await del.json().catch(() => null) : null;
    rolledBack = Array.isArray(delRows) && delRows.length === 1;
  } catch {
    rolledBack = false;
  }
  if (rolledBack) {
    console.error(`  되돌렸습니다: 방금 만든 공유 토큰(${token})을 삭제했습니다. 작업 폴더는 지우지 않았습니다.`);
  } else {
    console.error("  ==================================================================");
    console.error("  !!! 수동 삭제 필요 !!! 공유 토큰 되돌리기(DELETE)에 실패했습니다.");
    console.error(`  !!! report_tokens.token = ${token}`);
    console.error("  !!! 이 토큰에 학생 분석지가 담겨 있습니다. 직접 삭제하세요.");
    console.error("  ==================================================================");
  }
  process.exit(1);
}

console.log(`${baseUrl}/report/${token}`);

// 성공 후에만 작업 폴더 통째로 삭제(사진·meta.json·report.json 등 개인정보 잔존 방지)
rmSync(workDir, { recursive: true, force: true });
console.log(`작업 폴더 삭제: ${workDir}`);
