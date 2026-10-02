import { pathToFileURL } from "node:url";
import { join } from "node:path";
const [REPO, CONSULT_ID] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(join(REPO, "node_modules/playwright/index.mjs")).href);
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.setDefaultTimeout(150000); page.setDefaultNavigationTimeout(200000);
page.on("dialog", (d) => { console.log("확인창:", d.message().slice(0, 60)); d.accept(); });
await page.goto(`${BASE}/login`);
for (let i = 0; i < 3 && page.url().includes("/login"); i++) {
  await page.getByRole("button", { name: "테스트 계정으로 로그인" }).click({ noWaitAfter: true });
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 150000 }).catch(() => {});
}
await page.goto(`${BASE}/consultations/${CONSULT_ID}`, { waitUntil: "load" });
await page.getByRole("button", { name: /원본 듣기/ }).click();
const audio = page.locator("audio").first();
await audio.waitFor({ timeout: 30000 }).catch(() => {});
const src = (await audio.count()) ? await audio.getAttribute("src") : null;
console.log("원본 듣기:", src ? `오디오 연결됨(서명 주소, 만료 파라미터 ${/token=|Expires|expires/i.test(src) ? "있음" : "?"})` : "오디오 없음");
if (src) { const ok = await page.evaluate(async (u) => (await fetch(u)).status, src); console.log("오디오 주소 응답:", ok); }
await page.getByRole("button", { name: /녹음 삭제/ }).click();
await page.waitForTimeout(8000);
const txt = (await page.locator("main").innerText()).replace(/\s+/g, " ");
console.log("삭제 뒤 패널:", /아직 녹음이 없습니다/.test(txt) ? "녹음 없음(삭제됨)" : txt.slice(txt.indexOf("상담 녹음"), txt.indexOf("상담 녹음") + 120));
await browser.close();
