import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 480, height: 900 } });

// 1. Survey page (no login needed)
console.log('1. Survey page (step 1 - info)...');
await page.goto('http://localhost:3001/survey');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-survey-step1.png', fullPage: true });
console.log('   v2-survey-step1.png saved');

// 2. Fill in name and go to step 2
console.log('2. Filling info and going to step 2...');
await page.fill('input[placeholder="학생 이름"]', '김테스트');
await page.selectOption('select', '중1');
await page.waitForTimeout(300);
await page.click('button:has-text("다음")');
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/v2-survey-step2.png', fullPage: true });
console.log('   v2-survey-step2.png saved');

// 3. Fill some scores to show UI
console.log('3. Filling scores on step 2...');
const buttons = await page.$$('button');
for (const btn of buttons) {
  const text = await btn.textContent();
  if (text === '4') {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/v2-survey-scores.png', fullPage: true });
console.log('   v2-survey-scores.png saved');

await browser.close();
console.log('Done!');
