import { chromium } from 'playwright';

const SURVEY_ID = '0972a871-de38-440e-a314-1e5fec594f47';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. 로그인
console.log('1. Logging in...');
await page.goto('http://localhost:3001/login');
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'admin@nk.com');
await page.fill('input[type="password"]', 'nk123456');
await page.click('button[type="submit"]');
await page.waitForURL('**/consultations**', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2000);

// 2. 설문 목록 확인
console.log('2. Checking surveys list...');
await page.goto('http://localhost:3001/surveys');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/surveys-list-with-data.png', fullPage: true });
console.log('   surveys-list-with-data.png saved');

// 3. 설문 상세 (AI 분석 버튼 확인)
console.log('3. Opening survey detail...');
await page.goto(`http://localhost:3001/surveys/${SURVEY_ID}`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/survey-detail-with-analyze-btn.png', fullPage: true });
console.log('   survey-detail-with-analyze-btn.png saved');

// 4. AI 분석 실행 (버튼 클릭)
console.log('4. Clicking AI 분석 button...');
const analyzeBtn = page.locator('button:has-text("AI 분석")');
if (await analyzeBtn.isVisible()) {
  await analyzeBtn.click();
  console.log('   Waiting for Gemini API response (up to 30s)...');
  // Wait for navigation to /analyses/[id] or for content change
  await page.waitForURL('**/analyses/**', { timeout: 60000 }).catch(async () => {
    console.log('   URL did not change, checking for errors...');
    await page.screenshot({ path: 'screenshots/analysis-error.png', fullPage: true });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/analysis-result.png', fullPage: true });
  console.log('   analysis-result.png saved');

  // 5. 스크롤해서 나머지도 캡처
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/analysis-result-2.png', fullPage: false });
  console.log('   analysis-result-2.png saved');
} else {
  console.log('   AI 분석 button not found!');
}

// 6. 분석 목록 확인
console.log('5. Checking analyses list...');
await page.goto('http://localhost:3001/analyses');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/analyses-list-with-data.png', fullPage: true });
console.log('   analyses-list-with-data.png saved');

await browser.close();
console.log('Done!');
