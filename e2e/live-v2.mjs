// 설문 V2 라이브 E2E (운영 DB 대상, DDL 적용 후) — 명세서 §15.3의 SKIP했던 2건.
//   1) 제출 성공: /survey 전체 플로우(수학+영어 60문항) 실제 제출 → DB 저장 검증.
//   2) AI 분석 실행: 관리자 로그인 → 성향분석(analyzeSurveyV2, Gemini 실호출) →
//      /analyses/[id] 상담자 보고서 렌더 → 학부모 토글 → 공유 링크 → /report/[token] 공개 렌더.
//
// 주의:
//   - .env.local의 DB = 운영 DB. 테스트 데이터는 가상 학생 1명으로 최소화한다.
//   - 서비스롤 키는 검증용 조회에만 사용(수정·삭제 안 함). 생성 데이터는 삭제하지 않고
//     id를 e2e/.live-ids.json에 기록 → scripts/cleanup-e2e-v2.mjs로 사용자가 삭제.
//   - Gemini 실호출 1회 허용(실패 시 fallback으로도 분석은 생성되어 검증은 통과).
//
// 실행: node e2e/live-v2.mjs   (dev 서버가 localhost:3000에서 운영 DB로 떠 있어야 함)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { assert, assertEqual } from "./lib/harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const IDS_FILE = path.join(__dirname, ".live-ids.json");

// 가상 학생(삭제 예정). 연락처는 팀리드 지정값.
const STUDENT = {
  name: "E2E검증-삭제예정",
  school: "E2E테스트-삭제예정",
  grade: "중2",
  studentPhone: "01000000001",
  parentPhone: "01000000002",
  parentPhoneFmt: "010-0000-0002",
};

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

// ── 설문 진행 헬퍼 ───────────────────────────────────────────────────
const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };
const nextBtn = (p) => p.getByRole("button", { name: "다음", exact: true });
const submitBtn = (p) => p.getByRole("button", { name: "제출하기", exact: true });
const radios = (p) => p.getByRole("radio");

async function fillScreen0(page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.fill("#v2-name", STUDENT.name);
    await page.fill("#v2-school", STUDENT.school);
    await page.selectOption("#v2-grade", STUDENT.grade).catch(() => {});
    await page.getByRole("button", { name: "수학+영어", exact: true }).click();
    await page.fill("#v2-student-phone", STUDENT.studentPhone);
    await page.fill("#v2-parent-phone", STUDENT.parentPhone);
    await page.waitForTimeout(250);
    if (await nextBtn(page).isEnabled().catch(() => false)) return;
  }
  throw new Error("기본정보 입력 후 '다음'이 활성화되지 않음");
}

async function answerAllScore(page) {
  let count = 0;
  while (count < 80) {
    if (await page.locator("#v2-commitment14").isVisible().catch(() => false)) break;
    await radios(page).first().focus();
    await page.keyboard.press("Enter");
    count += 1;
    await nextBtn(page).click();
  }
  return count;
}

// ── DB 검증(서비스롤, 조회 전용) ─────────────────────────────────────
function makeService(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  const env = loadEnvLocal();
  assert(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY 없음");
  assert(env.NEXT_PUBLIC_TEST_EMAIL && env.NEXT_PUBLIC_TEST_PASSWORD, "테스트 관리자 계정 없음");
  const svc = makeService(env);
  const created = { surveyId: null, analysisId: null, token: null };
  const results = [];
  const step = async (name, fn) => {
    const t = Date.now();
    try {
      await fn();
      results.push({ name, ok: true, ms: Date.now() - t });
      console.log(`  PASS  ${name} (${Date.now() - t}ms)`);
    } catch (e) {
      results.push({ name, ok: false, ms: Date.now() - t, error: String(e?.stack || e) });
      console.log(`  FAIL  ${name}\n        ${String(e?.message || e)}`);
      throw e; // 뒤 단계가 선행 데이터에 의존하므로 중단.
    }
  };

  const browser = await chromium.launch();
  try {
    // ── 1) 제출 성공 ──────────────────────────────────────────────
    await step("① /survey 전체 플로우 제출(수학+영어 60문항)", async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE}/survey`, NAV);
        await page.locator("#v2-name").waitFor({ state: "visible", timeout: 120000 });
        await fillScreen0(page);
        for (let i = 0; i < 5; i++) await nextBtn(page).click();
        const answered = await answerAllScore(page);
        assertEqual(answered, 60, "수학+영어 응답 문항 수");
        await page.fill("#v2-commitment14", "E2E 검증용 약속(삭제 예정): 매일 오답 1개 재풀이");
        await submitBtn(page).click();
        // 성공 화면 또는 중복 방어 메시지.
        const ok = page.getByText("설문이 제출되었습니다", { exact: false });
        const dup = page.getByText("이미 제출된 설문", { exact: false });
        await Promise.race([
          ok.first().waitFor({ state: "visible", timeout: 30000 }),
          dup.first().waitFor({ state: "visible", timeout: 30000 }),
        ]);
        if (await dup.first().isVisible().catch(() => false)) {
          console.log("        (기존 테스트 제출 존재 → 중복 방어 동작 확인, 기존 행으로 검증 진행)");
        } else {
          assert(await ok.first().isVisible(), "제출 성공 화면 미표시");
        }
      } finally {
        await ctx.close();
      }
    });

    // ── 2) 제출 DB 저장 검증(서비스롤 조회) ──────────────────────
    await step("② surveys 저장 검증(instrument_version·responses_v2·score_profile_v2)", async () => {
      const { data, error } = await svc
        .from("surveys")
        .select("id, instrument_version, subject_selection, responses_v2, score_profile_v2, name, parent_phone, created_at")
        .eq("parent_phone", STUDENT.parentPhoneFmt)
        .eq("instrument_version", "v2")
        .order("created_at", { ascending: false })
        .limit(1);
      assert(!error, `조회 오류: ${error?.message}`);
      assert(data && data.length === 1, "제출된 V2 설문 행을 찾지 못함");
      const row = data[0];
      created.surveyId = row.id;
      assertEqual(row.instrument_version, "v2", "instrument_version");
      assertEqual(row.subject_selection, "both", "subject_selection");
      assert(row.responses_v2 && typeof row.responses_v2 === "object", "responses_v2 저장 안 됨");
      assert(row.responses_v2.responses && Object.keys(row.responses_v2.responses).length >= 50, "responses_v2.responses 문항 부족");
      assert(row.score_profile_v2 && row.score_profile_v2.instrumentVersion === "v2", "score_profile_v2 저장 안 됨");
      assert(typeof row.score_profile_v2.common?.learningAttitude === "number", "score_profile_v2.common 점수 없음");
      console.log(`        survey.id=${row.id}`);
    });

    // ── 3) 관리자 로그인 + 성향분석 실행(analyzeSurveyV2, Gemini 실호출) ──
    const authCtx = await browser.newContext();
    await authCtx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const page = await authCtx.newPage();
    await step("③ 관리자 로그인 + 성향분석 실행 → /analyses/[id] 이동", async () => {
      await page.goto(`${BASE}/login`, NAV);
      await page.getByRole("button", { name: "관리자 이메일로 로그인", exact: true }).click();
      await page.locator('input[type="email"]').fill(env.NEXT_PUBLIC_TEST_EMAIL);
      await page.locator('input[type="password"]').fill(env.NEXT_PUBLIC_TEST_PASSWORD);
      await page.getByRole("button", { name: "관리자 로그인", exact: true }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });

      await page.goto(`${BASE}/surveys/${created.surveyId}`, NAV);
      // 이미 분석된 경우(재실행) "분석 보기", 아니면 "성향분석".
      const analyzeBtn = page.getByRole("button", { name: "성향분석", exact: true });
      const viewLink = page.getByRole("link", { name: "분석 보기", exact: true });
      if (await analyzeBtn.isVisible().catch(() => false)) {
        await analyzeBtn.click();
        await page.waitForURL(/\/analyses\/[0-9a-f-]+/i, { timeout: 90000 });
      } else {
        await viewLink.click();
        await page.waitForURL(/\/analyses\/[0-9a-f-]+/i, { timeout: 30000 });
      }
      const m = page.url().match(/\/analyses\/([0-9a-f-]+)/i);
      assert(m, `분석 상세 URL 파싱 실패: ${page.url()}`);
      created.analysisId = m[1];
      console.log(`        analysis.id=${created.analysisId}`);
    });

    // ── 4) 상담자 보고서 렌더 + 학부모 토글 ──────────────────────
    await step("④ /analyses/[id] 상담자 보고서 렌더 + 학부모 토글", async () => {
      await page.getByText("학생 분석 총평", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
      assert((await page.getByText("첫 수업 전 교사 브리핑", { exact: false }).count()) > 0, "상담자 교사 브리핑 섹션 없음");
      assert((await page.getByText(STUDENT.name, { exact: false }).count()) > 0, "학생 이름 미표시");
      // 학부모 토글(하이드레이션 레이스 대비 재시도).
      const marker = page.getByText("학습 프로필 요약", { exact: false }).first();
      for (let i = 0; i < 20; i++) {
        await page.getByRole("button", { name: "학부모용", exact: true }).click();
        if (await marker.isVisible().catch(() => false)) break;
        await page.waitForTimeout(300);
      }
      await marker.waitFor({ state: "visible", timeout: 10000 });
      assertEqual(await page.getByText("첫 수업 전 교사 브리핑", { exact: false }).count(), 0, "학부모 뷰에 교사 브리핑 노출");
    });

    // ── 5) 공유 링크 생성(createReportTokenV2) → 토큰 확보 ───────
    await step("⑤ 공유 링크 생성 → report_tokens 저장", async () => {
      await page.getByRole("button", { name: "공유 링크", exact: true }).click();
      await page.getByText("학부모 공유 링크가 복사되었습니다", { exact: false }).first()
        .waitFor({ state: "visible", timeout: 20000 });
      // 신뢰성 위해 토큰은 DB에서 확보(클립보드 대신).
      const { data, error } = await svc
        .from("report_tokens")
        .select("token, report_type, name, created_at")
        .eq("report_type", "analysis_v2")
        .eq("name", STUDENT.name)
        .order("created_at", { ascending: false })
        .limit(1);
      assert(!error && data && data.length === 1, `report_tokens 조회 실패: ${error?.message}`);
      created.token = data[0].token;
      assert(created.token, "토큰 없음");
      console.log(`        token=${created.token}`);
    });

    // ── 6) 학부모 공개 화면 /report/[token] 렌더 ─────────────────
    await step("⑥ /report/[token] 학부모 공개 화면 렌더", async () => {
      const pubCtx = await browser.newContext();
      const pub = await pubCtx.newPage();
      try {
        await pub.goto(`${BASE}/report/${created.token}`, NAV);
        await pub.getByText("학습 프로필 요약", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
        assert((await pub.getByText(STUDENT.name, { exact: false }).count()) > 0, "공개 화면에 학생 이름 없음");
        assertEqual(await pub.getByText("첫 수업 전 교사 브리핑", { exact: false }).count(), 0, "공개 화면에 상담자 전용 섹션 노출");
        assertEqual(await pub.getByText("배경·서술 교차해석", { exact: false }).count(), 0, "공개 화면에 배경 교차해석 노출");
        assertEqual(await pub.getByRole("button", { name: "상담자용", exact: true }).count(), 0, "공개 화면에 상담자 토글 노출");
      } finally {
        await pubCtx.close();
      }
    });

    // ── 7) analyses 저장 검증(서비스롤 조회) ─────────────────────
    await step("⑦ analyses 저장 검증(analysis_version·result_profile_v2) + survey 연결", async () => {
      const { data, error } = await svc
        .from("analyses")
        .select("id, survey_id, name, analysis_version, result_profile_v2, response_quality_v2, student_type")
        .eq("survey_id", created.surveyId)
        .limit(1);
      assert(!error && data && data.length === 1, `analyses 조회 실패: ${error?.message}`);
      const a = data[0];
      assertEqual(a.id, created.analysisId, "analyses.id가 상세 URL과 불일치");
      assertEqual(a.analysis_version, "v2", "analysis_version");
      assert(a.result_profile_v2 && a.result_profile_v2.scores?.common, "result_profile_v2.scores.common 없음");
      assert(["ai", "fallback"].includes(a.result_profile_v2.source), "result_profile_v2.source 이상");
      assertEqual(a.name, STUDENT.name, "analyses.name 합성값");
      console.log(`        analysis_version=v2, source=${a.result_profile_v2.source}`);
      // survey 연결 확인.
      const { data: srow } = await svc.from("surveys").select("analysis_id").eq("id", created.surveyId).single();
      assertEqual(srow?.analysis_id, created.analysisId, "surveys.analysis_id 연결 안 됨");
    });

    await authCtx.close();
  } finally {
    await browser.close();
    fs.writeFileSync(IDS_FILE, JSON.stringify(created, null, 2));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n결과: ${passed}/${results.length} 통과`);
  console.log("생성 데이터 id (삭제 대상):", JSON.stringify(created));
  console.log(`id 기록: ${IDS_FILE}`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
