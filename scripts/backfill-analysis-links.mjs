// consultations.analysis_id 백필 — STEP4 이전 분석은 상담에 스탬프돼 있지 않아
// 상담 관리 화면과 학생분석 화면이 서로 다른 상담 행을 갱신할 수 있다.
// 유일하게 식별되는 건만 연결하고, 모호한 건은 사람이 판단하도록 목록으로 출력한다.
//
// 사용법:
//   node scripts/backfill-analysis-links.mjs           # 계획만 출력(변경 없음, 기본값)
//   node scripts/backfill-analysis-links.mjs --apply   # 실제 PATCH 실행
//
// --apply 시에도 각 PATCH에 analysis_id=is.null 조건을 걸어, 계획 산출 이후
// 다른 경로가 먼저 스탬프했다면 덮어쓰지 않는다(race 방지).

import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

// ── env ──────────────────────────────────────────────────────────────
const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();

if (!url || !key) {
  console.error("[중단] .env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

// ── 식별 규칙 (src/lib/student-identity.ts와 동일 규칙을 복제) ──────────
// mjs에서는 TS 모듈을 import할 수 없어 아래 두 함수를 복제한다.
// 원본이 바뀌면 이 파일도 함께 고쳐야 한다.
//
// normalizeIdentityPhone: 숫자만 남기고, 국가번호 82로 시작하면 0으로 치환.
function normalizeIdentityPhone(value) {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  return digits;
}

// isConsultationNameVariant: 정확히 같거나 "이름(" 접두 형태(동명이인 표기)만 인정.
function isConsultationNameVariant(candidateName, baseName) {
  const candidate = String(candidateName ?? "").trim();
  const base = String(baseName ?? "").trim();
  return candidate === base || candidate.startsWith(`${base}(`);
}

// ── 조회 (PostgREST 기본 상한을 넘기지 않도록 페이지 단위로 읽는다) ────
async function fetchAll(table, select) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, {
      headers: { ...headers, Range: `${from}-${from + pageSize - 1}` },
    });
    if (!res.ok) {
      throw new Error(`${table} 조회 실패: HTTP ${res.status} ${await res.text()}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

const [analyses, surveys, consultations] = await Promise.all([
  fetchAll("analyses", "id,name,survey_id"),
  fetchAll("surveys", "id,name,parent_phone"),
  fetchAll("consultations", "id,name,parent_phone,analysis_id,consult_date"),
]);

console.log(
  `로드: analyses ${analyses.length} / surveys ${surveys.length} / consultations ${consultations.length}`,
);

const surveyById = new Map(surveys.map((s) => [s.id, s]));
// 이미 어떤 상담에 스탬프된 analysis_id 집합
const stampedAnalysisIds = new Set(
  consultations.map((c) => c.analysis_id).filter(Boolean),
);

// ── 매칭 ─────────────────────────────────────────────────────────────
const plan = [];       // 유일 매칭 + 대상 상담이 비어 있음 → 스탬프 예정
const ambiguous = [];  // 0건 또는 2건 이상 → 사람이 판단
const blocked = [];    // 유일 매칭이지만 그 상담에 이미 다른 분석이 연결됨

for (const analysis of analyses) {
  if (stampedAnalysisIds.has(analysis.id)) continue;

  const survey = analysis.survey_id ? surveyById.get(analysis.survey_id) : null;
  // 이름은 stampConsultationAnalysis와 동일하게 설문 기준을 우선한다.
  const name = (survey?.name ?? analysis.name ?? "").trim();
  const phone = normalizeIdentityPhone(survey?.parent_phone);

  if (!name || !phone) {
    ambiguous.push({
      analysisId: analysis.id,
      name: name || "(이름 없음)",
      reason: !name ? "이름 없음" : "설문 학부모 연락처 없음",
      candidates: [],
    });
    continue;
  }

  const matches = consultations.filter(
    (c) =>
      isConsultationNameVariant(c.name, name) &&
      normalizeIdentityPhone(c.parent_phone) === phone,
  );

  if (matches.length !== 1) {
    ambiguous.push({
      analysisId: analysis.id,
      name,
      reason: matches.length === 0 ? "매칭 상담 없음" : `후보 ${matches.length}건`,
      candidates: matches,
    });
    continue;
  }

  const target = matches[0];
  if (target.analysis_id) {
    blocked.push({ analysisId: analysis.id, name, target });
    continue;
  }

  plan.push({ analysisId: analysis.id, name, consultationId: target.id, consultDate: target.consult_date });
}

// ── 출력 ─────────────────────────────────────────────────────────────
console.log(`\n=== 계획 요약 ===`);
console.log(`스탬프 예정 : ${plan.length}건`);
console.log(`모호        : ${ambiguous.length}건`);
console.log(`이미 연결됨 : ${blocked.length}건 (유일 매칭이나 해당 상담에 다른 분석이 이미 연결)`);

if (plan.length > 0) {
  console.log(`\n--- 스탬프 예정 ---`);
  console.table(
    plan.map((p) => ({
      이름: p.name,
      상담일: p.consultDate ?? "-",
      analysis_id: p.analysisId,
      consultation_id: p.consultationId,
    })),
  );
}

if (ambiguous.length > 0) {
  console.log(`\n--- 모호(수동 확인 필요) ---`);
  for (const a of ambiguous) {
    console.log(`\n[${a.name}] ${a.reason} (analysis_id=${a.analysisId})`);
    for (const c of a.candidates) {
      console.log(
        `   후보: id=${c.id} 상담일=${c.consult_date ?? "-"} 번호=${c.parent_phone ?? "-"} analysis_id=${c.analysis_id ?? "null"}`,
      );
    }
  }
}

if (blocked.length > 0) {
  console.log(`\n--- 이미 다른 분석이 연결된 상담 ---`);
  for (const b of blocked) {
    console.log(
      `[${b.name}] analysis_id=${b.analysisId} → 상담 ${b.target.id}에 이미 ${b.target.analysis_id} 연결됨`,
    );
  }
}

// ── 적용 ─────────────────────────────────────────────────────────────
if (!APPLY) {
  console.log(`\n변경 없음(기본 모드). 실제 적용하려면 --apply 플래그를 붙이세요.`);
  process.exit(0);
}

if (plan.length === 0) {
  console.log(`\n적용할 항목이 없습니다.`);
  process.exit(0);
}

console.log(`\n=== --apply: ${plan.length}건 스탬프 실행 ===`);
let ok = 0;
let noop = 0;
let failed = 0;

for (const p of plan) {
  const res = await fetch(
    `${url}/rest/v1/consultations?id=eq.${p.consultationId}&analysis_id=is.null`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ analysis_id: p.analysisId }),
    },
  );

  if (!res.ok) {
    failed += 1;
    console.log(`  실패 [${p.name}] HTTP ${res.status} ${await res.text()}`);
    continue;
  }

  const updated = await res.json();
  if (Array.isArray(updated) && updated.length > 0) {
    ok += 1;
  } else {
    // 계획 산출 이후 다른 경로가 먼저 스탬프한 경우.
    noop += 1;
    console.log(`  건너뜀 [${p.name}] 이미 스탬프됨(0건 갱신)`);
  }
}

console.log(`\n적용 완료: 성공 ${ok} / 건너뜀 ${noop} / 실패 ${failed}`);
if (failed > 0) process.exit(1);
