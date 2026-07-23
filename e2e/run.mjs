// 설문 V2 기능 E2E (playwright 코어). 명세서 §15.3 항목을 검증한다.
// 제출 성공/분석 실행은 운영 DB에 V2 컬럼이 없어 SKIP하고, 제출 직전 단계까지만 검증한다.
//
// 실행: npm run test:e2e  (내부에서 next dev 자동 기동)
//       E2E_BASE_URL=http://localhost:3000 node e2e/run.mjs  (외부 서버 재사용)

import { chromium } from "playwright";
import { startServer, runTests, newPage, assert, assertEqual } from "./lib/harness.mjs";

const NAV = { waitUntil: "domcontentloaded", timeout: 120000 };

// ── 선택자/헬퍼 ──────────────────────────────────────────────────────
const nextBtn = (p) => p.getByRole("button", { name: "다음", exact: true });
const prevBtn = (p) => p.getByRole("button", { name: "이전", exact: true });
const submitBtn = (p) => p.getByRole("button", { name: "제출하기", exact: true });
const radios = (p) => p.getByRole("radio");

async function goSurvey(page, baseURL) {
  await page.goto(`${baseURL}/survey`, NAV);
  await page.locator("#v2-name").waitFor({ state: "visible", timeout: 120000 });
}

async function fillScreen0(page, subjectLabel) {
  // React 하이드레이션 전 입력은 controlled input이 리셋되어 유실될 수 있으므로,
  // "다음" 버튼이 활성화(=서버측 검증 통과)될 때까지 입력을 재적용한다.
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.fill("#v2-name", "가상학생");
    await page.fill("#v2-school", "안산중학교");
    await page.selectOption("#v2-grade", "중2").catch(() => {});
    await page.getByRole("button", { name: subjectLabel, exact: true }).click();
    await page.fill("#v2-student-phone", "01012345678");
    await page.fill("#v2-parent-phone", "01087654321");
    await page.waitForTimeout(250);
    if (await nextBtn(page).isEnabled().catch(() => false)) return;
  }
  throw new Error("기본정보 입력 후에도 '다음'이 활성화되지 않음(하이드레이션/검증 문제)");
}

/** 사전정보 화면(0~4)을 통과해 점수형 첫 문항까지 진입한다. */
async function enterScorePhase(page) {
  for (let i = 0; i < 5; i++) {
    await nextBtn(page).click();
  }
  await page.getByRole("heading").first().waitFor({ state: "visible" });
}

async function currentHeading(page) {
  return (await page.getByRole("heading").first().innerText()).trim();
}

async function getScoreTotal(page) {
  return await page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s*\/\s*(\d+)\s*문항/);
    return m ? Number(m[2]) : null;
  });
}

/** 점수형 문항을 키보드 선택(자동 이동 없음) + 다음으로 끝까지 진행. 응답 수 반환. */
async function answerAllScore(page) {
  let count = 0;
  while (count < 80) {
    if (await page.locator("#v2-commitment14").isVisible().catch(() => false)) break;
    const first = radios(page).first();
    await first.focus();
    await page.keyboard.press("Enter"); // detail=0 → 자동 이동 없음
    count += 1;
    await nextBtn(page).click();
  }
  return count;
}

// ── 설문 테스트 ──────────────────────────────────────────────────────
function surveyTests(baseURL, browser) {
  return [
    {
      name: "학생 기본정보(사전정보) 입력 후 점수형 진입",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학");
          await enterScorePhase(page);
          const total = await getScoreTotal(page);
          assertEqual(total, 48, "수학 단일 선택 점수형 문항 수");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "수학만 48문항 전 문항 진행 + 제출 직전 도달",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학");
          await enterScorePhase(page);
          assertEqual(await getScoreTotal(page), 48, "수학 문항 수(진입)");
          const answered = await answerAllScore(page);
          assertEqual(answered, 48, "수학 응답 문항 수");
          assert(await page.locator("#v2-commitment14").isVisible(), "14일 약속 화면 도달");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "영어만 48문항 전 문항 진행",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "영어");
          await enterScorePhase(page);
          assertEqual(await getScoreTotal(page), 48, "영어 문항 수(진입)");
          assertEqual(await answerAllScore(page), 48, "영어 응답 문항 수");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "수학+영어 60문항 + 14일 약속 전 제출 차단 + 제출 버튼 존재(SKIP: 실제 제출)",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학+영어");
          await enterScorePhase(page);
          assertEqual(await getScoreTotal(page), 60, "수학+영어 문항 수(진입)");
          assertEqual(await answerAllScore(page), 60, "수학+영어 응답 문항 수");
          // 14일 약속 입력 전: 제출 버튼 비활성.
          assert(await submitBtn(page).isVisible(), "제출 버튼 존재");
          assert(await submitBtn(page).isDisabled(), "약속 입력 전 제출 차단(비활성)");
          await page.fill("#v2-commitment14", "매일 학원 오기 전 수학 오답 1개를 다시 풀겠습니다.");
          assert(!(await submitBtn(page).isDisabled()), "약속 입력 후 제출 버튼 활성");
          // 운영 DB에 V2 컬럼이 없어 실제 제출은 SKIP한다.
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "포인터 첫 선택 시 자동 이동(약 520ms)",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학");
          await enterScorePhase(page);
          const q1 = await currentHeading(page);
          await radios(page).first().click(); // 포인터(detail=1)
          await page.waitForTimeout(150);
          assertEqual(await currentHeading(page), q1, "선택 직후에는 아직 이동하지 않음");
          await page.waitForTimeout(700);
          assert((await currentHeading(page)) !== q1, "지연 후 자동으로 다음 문항 이동");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "기존 답 수정 시 자동 이탈 없음 + 이전 이동 후 값 보존",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학");
          await enterScorePhase(page);
          const q1 = await currentHeading(page);
          await radios(page).first().click();
          await page.waitForTimeout(700); // 자동 이동 → q2
          assert((await currentHeading(page)) !== q1, "q2로 이동");
          await prevBtn(page).click(); // 다시 q1
          assertEqual(await currentHeading(page), q1, "이전 이동으로 q1 복귀");
          assertEqual(await radios(page).first().getAttribute("aria-checked"), "true", "이전 선택값 보존");
          await radios(page).nth(1).click(); // 기존 답 수정(포인터)
          await page.waitForTimeout(700);
          assertEqual(await currentHeading(page), q1, "기존 답 수정 시 자동 이탈 없음");
          assert(await nextBtn(page).isVisible(), "수정 시 다음 버튼 노출");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "보조 선택 문항(P4)은 주 선택만으로 자동 이동하지 않음",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학");
          await enterScorePhase(page);
          // LT1~P3(11문항) 키보드 진행 → 12번째가 P4(보조 선택 보유).
          for (let i = 0; i < 11; i++) {
            await radios(page).first().focus();
            await page.keyboard.press("Enter");
            await nextBtn(page).click();
          }
          assert(await page.locator("#sup-phone_weekday").isVisible(), "P4 보조 선택 필드 존재");
          const p4 = await currentHeading(page);
          await radios(page).first().click(); // 주 선택 포인터
          await page.waitForTimeout(700);
          assertEqual(await currentHeading(page), p4, "보조 선택 문항은 자동 이동하지 않음");
          await nextBtn(page).click();
          assert((await currentHeading(page)) !== p4, "다음 버튼으로만 진행");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "NK 기대 복수선택 최대 3개 제한",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goSurvey(page, baseURL);
          await fillScreen0(page, "수학");
          await nextBtn(page).click(); // → 학습 이력
          await page.locator("#v2-prev-academy").waitFor({ state: "visible" });
          await nextBtn(page).click(); // → 학원·일정(NK 기대)
          await page.getByText("NK에 기대하는 점", { exact: false }).first().waitFor({ state: "visible" });
          const opts = ["강한 관리·명확한 기준", "철저한 숙제 관리", "1:1 질문·개별 피드백", "클리닉·보완학습"];
          for (let i = 0; i < 3; i++) {
            await page.getByRole("button", { name: opts[i], exact: true }).click();
          }
          const fourth = page.getByRole("button", { name: opts[3], exact: true });
          assert(await fourth.isDisabled(), "3개 선택 후 네 번째 기대 항목 비활성");
          const selected = await page.locator('button[aria-pressed="true"]').count();
          assertEqual(selected, 3, "선택된 기대 항목 수 3개");
        } finally {
          await context.close();
        }
      },
    },
  ];
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("E2E: dev 서버 기동 중...");
  const server = await startServer({ port: Number(process.env.E2E_PORT || 3210) });
  console.log(`E2E: 서버 준비됨 ${server.baseURL}`);
  const browser = await chromium.launch();
  try {
    console.log("\n[설문 흐름]");
    const results = await runTests(surveyTests(server.baseURL, browser), {});
    const passed = results.filter((result) => result.ok).length;
    console.log(`\n결과: ${passed}/${results.length} 통과`);
    if (passed !== results.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
