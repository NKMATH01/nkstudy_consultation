// 운영 서버 확인 — 새 분석지 + 기존 학부모 보고서 회귀 + 인증 관문. 읽기만 한다.
// 학생·학부모 이름은 출력하지 않는다(통과/실패만).
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const [REPO, HERE, EXAM_TOKEN, TOKENS_JSON] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(join(REPO, "node_modules/playwright/index.mjs")).href);
const BASE = "https://nkstudy-consultation.vercel.app";
const parsed = JSON.parse(readFileSync(TOKENS_JSON, "utf8"));
const existing = parsed.rows || parsed;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // 학부모 휴대폰
const check = async (label, url, expect) => {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  const body = await page.locator("body").innerText().catch(() => "");
  const r = {
    http: res?.status(),
    login: page.url().includes("/login"),
    broken: /불러올 수 없습니다|만료|찾을 수 없습니다/.test(body),
    rawJson: /"version"\s*:\s*"exam_v1"|"parentSafe"|\{"/.test(body),
    hscroll: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    errors: errors.length,
    len: body.length,
  };
  const ok = expect(r, body);
  console.log(`${ok ? "✅" : "❌"} ${label} — HTTP ${r.http} · 글자 ${r.len} · 로그인튕김 ${r.login ? "예" : "아니오"} · 깨짐문구 ${r.broken ? "있음" : "없음"} · 날것데이터 ${r.rawJson ? "있음" : "없음"} · 가로스크롤 ${r.hscroll ? "있음" : "없음"} · 오류 ${r.errors}`);
  if (label.startsWith("새 분석지")) await page.screenshot({ path: join(HERE, "05-prod-report.png"), fullPage: false });
  await page.close();
  return ok;
};

const results = [];
// ① 새 분석지 (박서진)
results.push(await check("새 분석지(exam_v1)", `${BASE}/report/${EXAM_TOKEN}`,
  (r, b) => r.http === 200 && !r.login && !r.broken && !r.rawJson && !r.hscroll && r.errors === 0 && /박서진/.test(b) && /35/.test(b) && /절벽|전국/.test(b)));
// ② 기존 보고서 회귀 — 종류별 가장 최근 1건
for (const t of existing) {
  results.push(await check(`기존 보고서(${t.report_type})`, `${BASE}/report/${t.token}`,
    (r) => r.http === 200 && !r.login && !r.broken && !r.rawJson && r.errors === 0 && r.len > 200));
}
// ③ 인증 관문 — 새 직원 화면은 로그인 없이 막혀야 한다
for (const p of ["/exams", "/exams/new"]) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
  const ok = page.url().includes("/login");
  console.log(`${ok ? "✅" : "❌"} 인증 관문 ${p} — 비로그인 시 ${ok ? "로그인으로 이동" : "그대로 열림(문제)"}`);
  results.push(ok);
  await page.close();
}
// ④ 공개 설문(v2.3) — 열리는지만(제출은 하지 않는다)
{
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const res = await page.goto(`${BASE}/survey`, { waitUntil: "networkidle" });
  const ok = res?.status() === 200 && !page.url().includes("/login") && errors.length === 0;
  console.log(`${ok ? "✅" : "❌"} 공개 설문 /survey — HTTP ${res?.status()} · 오류 ${errors.length}`);
  results.push(ok);
  await page.close();
}
console.log(`\n합계: ${results.filter(Boolean).length} / ${results.length} 통과`);
await browser.close();
