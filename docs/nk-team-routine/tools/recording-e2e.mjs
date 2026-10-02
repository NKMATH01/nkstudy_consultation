// 팀장 화면 확인 ③ — 상담 녹음: 동의 → 녹음(가짜 마이크 = 합성 음성 sample.wav) → 마치기 → 전사·분석(실제 Gemini) → 결과 확인.
// 삭제는 별도 단계(recording-delete). 개인정보 없음(합성 음성).
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const [REPO, HERE, CONSULT_ID, WAV, SECONDS = "45"] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(join(REPO, "node_modules/playwright/index.mjs")).href);
const BASE = "http://localhost:3000";
const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${WAV}`,
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ["microphone"] });
const page = await ctx.newPage();
page.setDefaultTimeout(150000);
page.setDefaultNavigationTimeout(200000);
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on("dialog", (d) => { console.log("확인창:", d.message().slice(0, 80)); d.accept(); });

await page.goto(`${BASE}/login`);
for (let i = 0; i < 3 && page.url().includes("/login"); i++) {
  await page.getByRole("button", { name: "테스트 계정으로 로그인" }).click({ noWaitAfter: true });
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 150000 }).catch(() => {});
}
await page.goto(`${BASE}/consultations/${CONSULT_ID}`, { waitUntil: "load" });
await page.getByRole("button", { name: /녹음 시작/ }).waitFor();
const panel = page.getByText("상담 녹음").first();
await panel.scrollIntoViewIfNeeded();
const startBtn = page.getByRole("button", { name: /녹음 시작/ });
console.log("동의 전 녹음 버튼 비활성:", await startBtn.isDisabled());
await page.locator('input[type="checkbox"]').last().check();
console.log("동의 후 녹음 버튼 활성:", !(await startBtn.isDisabled()));
await page.screenshot({ path: join(HERE, "r1-consent.png") });
await startBtn.click();
const t0 = Date.now();
await page.waitForTimeout(8000);
const during = (await page.locator("main").innerText()).replace(/\s+/g, " ");
console.log("녹음 중 표시:", /녹음 중/.test(during) ? "있음" : "없음", "· 화면 끄지 말라는 안내:", /화면/.test(during) ? "있음" : "없음");
await page.screenshot({ path: join(HERE, "r2-recording.png") });
await page.waitForTimeout(Math.max(0, Number(SECONDS) * 1000 - (Date.now() - t0)));
await page.getByRole("button", { name: /녹음 마치기/ }).click();
console.log("녹음 마치기 클릭 — 경과", Math.round((Date.now() - t0) / 1000), "초");
await page.waitForTimeout(15000);
await page.screenshot({ path: join(HERE, "r3-after-finish.png") });
console.log("화면 오류·경고:", errs.length ? errs.slice(0, 8).join("\n  ") : "없음");
await browser.close();
