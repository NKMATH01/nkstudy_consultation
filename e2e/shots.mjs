// V2 결과 보고서 재디자인 스크린샷·PDF 캡처(육안 검수용).
// 실행: E2E_BASE_URL=http://localhost:3210 node e2e/shots.mjs
// 산출물: ../docs/prototypes/2026-07-10-learning-profile-v2/screenshots/v2-final/redesign/

import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3210").replace(/\/$/, "");
const NAV = { waitUntil: "networkidle", timeout: 120000 };
const OUT = path.resolve(
  process.cwd(),
  "..",
  "docs/prototypes/2026-07-10-learning-profile-v2/screenshots/v2-final/redesign"
);

function parsePdf(buf) {
  const text = buf.toString("latin1");
  const pageCount = (text.match(/\/Type\s*\/Page(?![sA-Za-z])/g) || []).length;
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]
  );
  return { pageCount, boxes };
}

async function ready(page) {
  await page.getByText("학생 분석 총평", { exact: false }).first().waitFor({ state: "visible", timeout: 120000 });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(400);
}

async function toggleParent(page) {
  const marker = page.getByText("학습 프로필 요약", { exact: false }).first();
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "학부모 공유본", exact: true }).click().catch(() => {});
    if (await marker.isVisible().catch(() => false)) return;
    await page.waitForTimeout(300);
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const log = [];
  try {
    // 데스크톱 900px.
    const desktop = await browser.newContext({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 2 });
    const dp = await desktop.newPage();
    await dp.goto(`${BASE}/dev-report-preview`, NAV);
    await ready(dp);
    await dp.screenshot({ path: path.join(OUT, "counselor-desktop-top.png") }); // 뷰포트(표지+총평)
    await dp.screenshot({ path: path.join(OUT, "counselor-desktop-full.png"), fullPage: true });
    await toggleParent(dp);
    await dp.screenshot({ path: path.join(OUT, "parent-desktop-top.png") });
    await dp.screenshot({ path: path.join(OUT, "parent-desktop-full.png"), fullPage: true });
    await desktop.close();

    // 모바일 390px.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const mp = await mobile.newPage();
    await mp.goto(`${BASE}/dev-report-preview`, NAV);
    await ready(mp);
    await mp.screenshot({ path: path.join(OUT, "counselor-mobile-top.png") });
    await mp.screenshot({ path: path.join(OUT, "counselor-mobile-full.png"), fullPage: true });
    await toggleParent(mp);
    await mp.screenshot({ path: path.join(OUT, "parent-mobile-full.png"), fullPage: true });
    await mobile.close();

    // A4 PDF(상담자·학부모) + print PNG.
    const pctx = await browser.newContext({ viewport: { width: 1000, height: 1400 } });
    const pp = await pctx.newPage();
    await pp.goto(`${BASE}/dev-report-preview`, NAV);
    await ready(pp);
    await pp.emulateMedia({ media: "print" });
    const cPdf = await pp.pdf({ format: "A4", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    await fs.writeFile(path.join(OUT, "counselor-report.pdf"), cPdf);
    await pp.screenshot({ path: path.join(OUT, "counselor-print-full.png"), fullPage: true });
    await pp.emulateMedia({ media: "screen" });
    const dockVis = await pp.locator('nav[aria-label="보고서 섹션 이동"]').isVisible().catch(() => false);
    const { pageCount: cPages, boxes } = parsePdf(cPdf);

    await pp.goto(`${BASE}/dev-report-preview`, NAV);
    await ready(pp);
    await toggleParent(pp);
    await pp.emulateMedia({ media: "print" });
    const pPdf = await pp.pdf({ format: "A4", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    await fs.writeFile(path.join(OUT, "parent-report.pdf"), pPdf);
    await pp.emulateMedia({ media: "screen" });
    const { pageCount: pPages } = parsePdf(pPdf);
    await pctx.close();

    const a4 = boxes.every(([w, h]) => Math.abs(w - 595) < 6 && Math.abs(h - 842) < 6);
    log.push(`OUT=${OUT}`);
    log.push(`상담자 PDF 페이지=${cPages}, 학부모 PDF 페이지=${pPages}, A4 근사=${a4 ? "예" : "아니오"}`);
    log.push(`인쇄 시 dock 노출=${dockVis}`);
  } finally {
    await browser.close();
  }
  console.log(log.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
