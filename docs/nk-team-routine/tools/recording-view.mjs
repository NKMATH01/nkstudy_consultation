import { pathToFileURL } from "node:url";
import { join } from "node:path";
const [REPO, HERE, CONSULT_ID, WAIT = "120"] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(join(REPO, "node_modules/playwright/index.mjs")).href);
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
page.setDefaultTimeout(150000); page.setDefaultNavigationTimeout(200000);
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`${BASE}/login`);
for (let i = 0; i < 3 && page.url().includes("/login"); i++) {
  await page.getByRole("button", { name: "테스트 계정으로 로그인" }).click({ noWaitAfter: true });
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 150000 }).catch(() => {});
}
await page.goto(`${BASE}/consultations/${CONSULT_ID}`, { waitUntil: "load" });
await page.getByText("상담 녹음").first().waitFor();
const end = Date.now() + Number(WAIT) * 1000;
let txt = "";
while (Date.now() < end) {
  await page.waitForTimeout(10000);
  await page.reload({ waitUntil: "load" });
  await page.getByText("상담 녹음").first().waitFor();
  txt = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  if (/분석 완료|완료/.test(txt) && !/분석 중|전사 중/.test(txt)) break;
}
const i = txt.indexOf("상담 녹음");
console.log("패널 글:", txt.slice(i, i + 900));
await page.getByText("상담 녹음").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: join(HERE, "r4-analyzed.png"), fullPage: true });
console.log("페이지 오류:", errs.length ? errs.join(" | ") : "없음");
await browser.close();
