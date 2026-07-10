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

// ── 결과지 테스트 (fixture 라우트) ────────────────────────────────────
const COUNSELOR_SECTIONS = [
  "학생 분석 총평",
  "핵심 지도 판정",
  "지도 좌표와 핵심 신호",
  "첫 수업 전 교사 브리핑",
  "배경·서술 교차해석",
  "학습 태도와 숙제 흐름",
  "장기 의지와 단기 회복",
  "휴대폰·성격 반응·친구관계",
  "MBTI 보조 점수",
  "NK 운영 선호·준비도·지원 조건",
  "과목별 학습전략",
  "강점·개선·심리적 간극",
  "12주 솔루션과 첫 14일 지표",
  "해석 원칙",
];

async function goReport(page, baseURL) {
  await page.goto(`${baseURL}/dev-report-preview`, NAV);
  await page.getByText("NK 학습운영 프로필", { exact: false }).first().waitFor({ state: "visible", timeout: 120000 });
}

/** 학부모 토글. SSR 마크업이 하이드레이션 전에 보이므로 전환될 때까지 클릭을 재시도한다. */
async function toggleParent(page) {
  const marker = page.getByText("학습 프로필 요약", { exact: false }).first();
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.getByRole("button", { name: "학부모용", exact: true }).click();
    if (await marker.isVisible().catch(() => false)) return;
    await page.waitForTimeout(300);
  }
  await marker.waitFor({ state: "visible" });
}

function reportTests(baseURL, browser) {
  return [
    {
      name: "상담자용 14개 섹션 + 수학·영어 전략 모두 렌더",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goReport(page, baseURL);
          for (const title of COUNSELOR_SECTIONS) {
            const n = await page.getByText(title, { exact: false }).count();
            assert(n > 0, `섹션 누락: ${title}`);
          }
          assert((await page.getByText("수학 학습전략", { exact: false }).count()) > 0, "수학 전략 렌더");
          assert((await page.getByText("영어 학습전략", { exact: false }).count()) > 0, "영어 전략 렌더");
          assertEqual(await page.locator(".report-page").count(), 8, "상담자 보고서 페이지 수(표지+7)");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "학부모 토글 시 상담자 전용 섹션 DOM 부재",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goReport(page, baseURL);
          await toggleParent(page);
          // 금지: 상세 총평(원문)·교사 브리핑·배경 교차해석·심리적 간극.
          assertEqual(await page.getByText("AI 해석을 사용할 수 없어", { exact: false }).count(), 0, "상담자 상세총평 부재");
          assertEqual(await page.getByText("첫 수업 전 교사 브리핑", { exact: false }).count(), 0, "교사 브리핑 부재");
          assertEqual(await page.getByText("배경·서술 교차해석", { exact: false }).count(), 0, "배경 교차해석 부재");
          assertEqual(await page.getByText("심리적 간극", { exact: false }).count(), 0, "심리적 간극 부재");
          assertEqual(await page.locator(".report-page").count(), 6, "학부모 보고서 페이지 수(표지+5)");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "하단 고정 메뉴 5개 + fixed",
      fn: async () => {
        const { context, page } = await newPage(browser);
        try {
          await goReport(page, baseURL);
          const dock = page.locator('nav[aria-label="보고서 섹션 이동"]');
          assertEqual(await dock.locator("button").count(), 5, "하단 메뉴 5개");
          for (const label of ["요약", "학습", "생활·관계", "NK 적합", "솔루션"]) {
            assert((await dock.getByText(label, { exact: true }).count()) > 0, `메뉴 누락: ${label}`);
          }
          const pos = await dock.evaluate((el) => getComputedStyle(el).position);
          assertEqual(pos, "fixed", "하단 메뉴 position:fixed");
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "모바일 390×844 가로 넘침 없음(상담자·학부모)",
      fn: async () => {
        const { context, page } = await newPage(browser, { viewport: { width: 390, height: 844 } });
        try {
          await goReport(page, baseURL);
          const overflow = async () =>
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert((await overflow()) <= 1, `상담자 가로 넘침: ${await overflow()}px`);
          await toggleParent(page);
          assert((await overflow()) <= 1, `학부모 가로 넘침: ${await overflow()}px`);
        } finally {
          await context.close();
        }
      },
    },
    {
      name: "결과지 렌더 중 console/page error 없음",
      fn: async () => {
        const { context, page, consoleErrors, pageErrors } = await newPage(browser);
        try {
          await goReport(page, baseURL);
          await toggleParent(page);
          await page.waitForTimeout(400);
          const noise = /favicon|Download the React DevTools|Lighthouse/i;
          const ce = consoleErrors.filter((m) => !noise.test(m));
          assertEqual(ce.length, 0, `console error: ${JSON.stringify(ce)}`);
          assertEqual(pageErrors.length, 0, `page error: ${JSON.stringify(pageErrors)}`);
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
    const r1 = await runTests(surveyTests(server.baseURL, browser), {});
    console.log("\n[결과지]");
    const r2 = await runTests(reportTests(server.baseURL, browser), {});
    const all = [...r1, ...r2];
    const passed = all.filter((r) => r.ok).length;
    console.log(`\n결과: ${passed}/${all.length} 통과`);
    if (passed !== all.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
