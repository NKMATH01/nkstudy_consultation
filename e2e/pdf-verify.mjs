// PDF 시각 검증 (명세서 §15.4).
// 1) Chromium(headless)로 fixture 결과지를 실제 A4 PDF로 생성.
// 2) PDF의 페이지 수와 MediaBox(≈595×842pt = A4)를 확인.
// 3) 인쇄 미디어를 에뮬레이션한 상태에서 각 .report-page를 PNG로 캡처해
//    잘림·빈 페이지·고립 제목·fixed dock 출력 여부를 육안 검수용으로 저장한다.
//
// 실행: npm run verify:pdf  (내부에서 next dev 자동 기동)

import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { startServer } from "./lib/harness.mjs";

const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };
const OUT =
  process.env.PDF_OUT ||
  path.resolve(
    process.cwd(),
    "..",
    "docs/prototypes/2026-07-10-learning-profile-v2/screenshots/v2-final"
  );

function parsePdf(buf) {
  const text = buf.toString("latin1");
  const pageCount = (text.match(/\/Type\s*\/Page(?![sA-Za-z])/g) || []).length;
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]
  );
  return { pageCount, boxes };
}

/** 인쇄 미디어 상태에서 각 .report-page를 PNG로 캡처. 캡처 후 미디어를 화면으로 복원. */
async function capturePages(page, prefix) {
  await page.emulateMedia({ media: "print" });
  const pages = page.locator(".report-v2-cover, .report-v2-section");
  const n = await pages.count();
  for (let i = 0; i < n; i++) {
    await pages.nth(i).screenshot({ path: path.join(OUT, `${prefix}-page-${String(i + 1).padStart(2, "0")}.png`) });
  }
  // dock/toolbar가 인쇄에서 숨겨지는지 확인.
  const dockVisible = await page.locator('nav[aria-label="보고서 섹션 이동"]').isVisible().catch(() => false);
  const toolbarVisible = await page.locator(".rptv2-toolbar").isVisible().catch(() => false);
  await page.emulateMedia({ media: "screen" });
  return { n, dockVisible, toolbarVisible };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  console.log("PDF: dev 서버 기동 중...");
  const server = await startServer({ port: Number(process.env.E2E_PORT || 3211) });
  console.log(`PDF: 서버 준비됨 ${server.baseURL}`);
  const browser = await chromium.launch();
  const findings = [];
  try {
    const page = await browser.newPage();
    await page.goto(`${server.baseURL}/dev-report-preview`, NAV);
    await page.getByText("학생 분석 총평", { exact: false }).first().waitFor({ state: "visible", timeout: 120000 });
    if (page.emulateMedia) await page.evaluateHandle(() => document.fonts && document.fonts.ready);

    // 1) 상담자용 실제 A4 PDF 생성.
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    await page.emulateMedia({ media: "screen" });
    const pdfPath = path.join(OUT, "counselor-report.pdf");
    await fs.writeFile(pdfPath, pdf);
    const { pageCount, boxes } = parsePdf(pdf);
    const a4 = boxes.every(([w, h]) => Math.abs(w - 595) < 6 && Math.abs(h - 842) < 6);
    findings.push(`PDF 생성: ${pdfPath}`);
    findings.push(`PDF 페이지 수: ${pageCount}`);
    findings.push(`MediaBox(pt): ${boxes.slice(0, 3).map((b) => b.map((v) => v.toFixed(1)).join("×")).join(", ")}${boxes.length > 3 ? " ..." : ""}`);
    findings.push(`모든 페이지 A4(595×842pt) 근사: ${a4 ? "예" : "아니오"}`);

    // 2) 상담자용 페이지 PNG 캡처.
    const c = await capturePages(page, "counselor");
    findings.push(`상담자 페이지 PNG: ${c.n}장 (인쇄 시 dock 노출=${c.dockVisible}, toolbar 노출=${c.toolbarVisible})`);

    // 3) 학부모용 페이지 PNG 캡처.
    await page.goto(`${server.baseURL}/dev-report-preview`, NAV);
    await page.getByRole("button", { name: "학부모 공유본", exact: true }).click();
    await page.getByText("학습 프로필 요약", { exact: false }).first().waitFor({ state: "visible" });
    const pdel = await capturePages(page, "parent");
    findings.push(`학부모 페이지 PNG: ${pdel.n}장 (인쇄 시 dock 노출=${pdel.dockVisible})`);

    console.log("\n=== PDF 검증 결과 ===");
    for (const f of findings) console.log(" - " + f);
    console.log(`\n출력 폴더: ${OUT}`);

    // 표지+5섹션(.report-v2-cover/.report-v2-section)이 내용 분량에 따라 물리 페이지로 자연 분할되므로
    // pageCount는 6 이상이면 정상이다(자르기·축소 없이 다음 페이지로 이어짐, §13.2).
    const ok = pageCount >= 6 && a4 && !c.dockVisible && !c.toolbarVisible && pdel.n === 6;
    if (!ok) {
      console.log("\n주의: 기대와 다른 항목이 있습니다(수동 검수 필요).");
      process.exitCode = 2;
    } else {
      console.log("\n검증 통과: A4 규격·페이지 분할·인쇄 시 화면 요소 숨김 정상.");
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
