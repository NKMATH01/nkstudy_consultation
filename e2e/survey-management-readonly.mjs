// 설문/분석관리의 전체 응답·상담 기록·6개 점수 표시를 운영 데이터로 읽기 전용 검증한다.
// 실행 전 localhost:3000에 개발 서버가 떠 있어야 한다. 입력 필드는 변경하지 않는다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { assert, assertEqual } from "./lib/harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const FACTOR_KEYS = ["attitude", "self_directed", "assignment", "willingness", "social", "management"];

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function hasConsultation(survey, consultations) {
  if (survey.analysis_id && consultations.some((row) => row.analysis_id === survey.analysis_id)) return true;
  const phone = normalizePhone(survey.parent_phone);
  return Boolean(phone) && consultations.some((row) =>
    row.name?.trim() === survey.name?.trim() && normalizePhone(row.parent_phone) === phone
  );
}

async function login(page, env) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const emailInput = page.locator('input[type="email"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.getByRole("button", { name: "관리자 이메일로 로그인", exact: true }).click();
    if (await emailInput.isVisible().catch(() => false)) break;
    await page.waitForTimeout(300);
  }
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(env.NEXT_PUBLIC_TEST_EMAIL);
  await page.locator('input[type="password"]').fill(env.NEXT_PUBLIC_TEST_PASSWORD);
  await page.getByRole("button", { name: "관리자 로그인", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60000 });
}

async function openSurveyRow(page, survey) {
  await page.goto(`${BASE}/surveys?search=${encodeURIComponent(survey.name)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByTestId(`survey-preview-${survey.id}`).waitFor({ state: "visible", timeout: 30000 });
}

async function closeDialog(page, testId) {
  await page.keyboard.press("Escape");
  await page.getByTestId(testId).waitFor({ state: "detached", timeout: 10000 });
}

async function clickUntilDialogOpens(page, buttonTestId, dialogTestId) {
  const button = page.getByTestId(buttonTestId);
  const dialog = page.getByTestId(dialogTestId);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await dialog.isVisible().catch(() => false)) return;
    if (await button.isEnabled().catch(() => false)) await button.click();
    await page.waitForTimeout(400);
  }
  await dialog.waitFor({ state: "visible", timeout: 10000 });
}

async function verifyV2(page, survey) {
  await openSurveyRow(page, survey);
  const common = survey.score_profile_v2?.common;
  const expected = {
    attitude: common.learningAttitude,
    self_directed: common.conscientiousness,
    assignment: common.homeworkReliability,
    willingness: common.longTermPersistence,
    social: common.peerLearningResource,
    management: common.structureNeed,
  };
  for (const key of FACTOR_KEYS) {
    assertEqual(
      (await page.getByTestId(`survey-factor-${survey.id}-${key}`).innerText()).trim(),
      String(Math.round(expected[key])),
      `V2 ${key} 점수`
    );
  }

  await clickUntilDialogOpens(page, `survey-preview-${survey.id}`, "survey-full-response");
  const preview = page.getByTestId("survey-full-response");
  assertEqual(await preview.getAttribute("data-survey-version"), "v2", "V2 미리보기 버전");
  const previewQuestions = preview.locator('[data-testid^="v2-question-"]');
  const previewAnswers = preview.locator('[data-testid^="v2-answer-"]');
  const questionCount = await previewQuestions.count();
  assert(questionCount >= 48, `V2 전체 문항 부족: ${questionCount}`);
  assertEqual(await previewAnswers.count(), questionCount, "V2 미리보기 답변 수");
  assert((await preview.getByTestId("v2-response-count").innerText()).includes(`/${questionCount}`), "V2 응답 수 배지 불일치");
  await closeDialog(page, "survey-full-response");

  await clickUntilDialogOpens(page, `survey-record-${survey.id}`, "consultation-survey-responses");
  const responses = page.getByTestId("consultation-survey-responses");
  const editor = page.getByTestId("consultation-editor");
  await editor.waitFor({ state: "visible", timeout: 30000 });
  assertEqual(await responses.locator('[data-testid^="v2-question-"]').count(), questionCount, "V2 상담 기록 문항 수");
  assert((await editor.locator("input, textarea, select").count()) >= 10, "V2 상담자 작성 필드 부족");
  await closeDialog(page, "consultation-survey-responses");
}

async function verifyV1(page, survey) {
  await openSurveyRow(page, survey);
  const expected = {
    attitude: survey.factor_attitude,
    self_directed: survey.factor_self_directed,
    assignment: survey.factor_assignment,
    willingness: survey.factor_willingness,
    social: survey.factor_social,
    management: survey.factor_management,
  };
  for (const key of FACTOR_KEYS) {
    assertEqual(
      (await page.getByTestId(`survey-factor-${survey.id}-${key}`).innerText()).trim(),
      Number(expected[key]).toFixed(1),
      `V1 ${key} 점수`
    );
  }

  await clickUntilDialogOpens(page, `survey-preview-${survey.id}`, "survey-full-response");
  const preview = page.getByTestId("survey-full-response");
  assertEqual(await preview.getAttribute("data-survey-version"), "v1", "V1 미리보기 버전");
  assertEqual(await preview.locator('[data-testid^="v1-question-"]').count(), 35, "V1 미리보기 문항 수");
  await closeDialog(page, "survey-full-response");

  await clickUntilDialogOpens(page, `survey-record-${survey.id}`, "consultation-survey-responses");
  const responses = page.getByTestId("consultation-survey-responses");
  const editor = page.getByTestId("consultation-editor");
  await editor.waitFor({ state: "visible", timeout: 30000 });
  assertEqual(await responses.locator('[data-testid^="v1-question-"]').count(), 35, "V1 상담 기록 문항 수");
  assert((await editor.locator("input, textarea, select").count()) >= 10, "V1 상담자 작성 필드 부족");
  await closeDialog(page, "consultation-survey-responses");
}

async function main() {
  const env = loadEnvLocal();
  assert(env.SUPABASE_SERVICE_ROLE_KEY, "서비스 조회 키 없음");
  assert(env.NEXT_PUBLIC_TEST_EMAIL && env.NEXT_PUBLIC_TEST_PASSWORD, "관리자 테스트 계정 없음");
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: consultations, error: consultationError }, { data: v2Rows, error: v2Error }, { data: v1Rows, error: v1Error }] = await Promise.all([
    service.from("consultations").select("name, parent_phone, analysis_id"),
    service.from("surveys").select("id, name, parent_phone, analysis_id, score_profile_v2").eq("instrument_version", "v2").order("created_at", { ascending: false }).limit(50),
    service.from("surveys").select("id, name, parent_phone, analysis_id, factor_attitude, factor_self_directed, factor_assignment, factor_willingness, factor_social, factor_management").or("instrument_version.is.null,instrument_version.eq.v1").order("created_at", { ascending: false }).limit(200),
  ]);
  assert(!consultationError && !v2Error && !v1Error, "읽기 전용 검증 데이터 조회 실패");

  const v2 = v2Rows.find((survey) => {
    const common = survey.score_profile_v2?.common;
    return hasConsultation(survey, consultations) && common && [
      common.learningAttitude,
      common.conscientiousness,
      common.homeworkReliability,
      common.longTermPersistence,
      common.peerLearningResource,
      common.structureNeed,
    ].every(Number.isFinite);
  });
  const v1 = v1Rows.find((survey) => hasConsultation(survey, consultations) && FACTOR_KEYS.every((key) =>
    Number.isFinite(survey[`factor_${key}`])
  ));
  assert(v2, "상담과 연결된 V2 검증 설문 없음");
  assert(v1, "상담과 연결된 V1 검증 설문 없음");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await login(page, env);
    await verifyV2(page, v2);
    console.log("PASS V2: 6개 점수, 전체 설문 응답, 상담자 작성 영역");
    await verifyV1(page, v1);
    console.log("PASS V1: 6개 점수, 35개 설문 응답, 상담자 작성 영역");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
