import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. 원클릭 로그인
console.log('1. Quick login...');
await page.goto('http://localhost:3001/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/login-quick-btn.png' });

// 이메일/비번 직접 입력 후 로그인 (더 확실)
await page.fill('input[type="email"]', 'admin@nk.com');
await page.fill('input[type="password"]', 'nk123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log('   Logged in, URL:', page.url());

// 2. 등록 안내 목록 (빈 상태)
console.log('2. Registrations list...');
await page.goto('http://localhost:3001/registrations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/registrations-list-empty.png', fullPage: true });
console.log('   registrations-list-empty.png saved');

// 3. 분석 상세 → 등록 안내 생성 버튼 확인
console.log('3. Analysis detail (registration button)...');
await page.goto('http://localhost:3001/analyses');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

const analysisLink = page.locator('a[href^="/analyses/"]').first();
if (await analysisLink.isVisible()) {
  await analysisLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/analysis-with-reg-btn.png' });
  console.log('   analysis-with-reg-btn.png saved');

  // 4. 등록 안내 생성 버튼 클릭 → 폼 확인
  console.log('4. Opening registration form...');
  const regBtn = page.locator('button:has-text("등록 안내 생성")');
  if (await regBtn.isVisible()) {
    await regBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/registration-form.png', fullPage: true });
    console.log('   registration-form.png saved');

    // 5. 폼 입력
    console.log('5. Filling registration form...');

    // 배정반 선택
    const classSelect = page.locator('button:has-text("반 선택")');
    if (await classSelect.isVisible()) {
      await classSelect.click();
      await page.waitForTimeout(500);
      const classOption = page.locator('[role="option"]').first();
      if (await classOption.isVisible()) {
        await classOption.click();
        await page.waitForTimeout(300);
      }
    }

    // 담임 선택
    const teacherSelect = page.locator('button:has-text("선생님 선택")');
    if (await teacherSelect.isVisible()) {
      await teacherSelect.click();
      await page.waitForTimeout(500);
      const teacherOption = page.locator('[role="option"]').first();
      if (await teacherOption.isVisible()) {
        await teacherOption.click();
        await page.waitForTimeout(300);
      }
    }

    // 테스트 점수 입력
    const testInput = page.locator('input[placeholder="예: 85점"]');
    if (await testInput.isVisible()) {
      await testInput.fill('78점');
    }

    await page.screenshot({ path: 'screenshots/registration-form-filled.png', fullPage: true });
    console.log('   registration-form-filled.png saved');

    // 제출
    console.log('6. Submitting (Gemini API ~30s)...');
    await page.click('button:has-text("안내문 생성")');

    // Gemini API 호출 대기
    try {
      await page.waitForURL('**/registrations/**', { timeout: 60000 });
    } catch {
      console.log('   Timeout waiting for redirect, capturing current state...');
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/registration-detail.png', fullPage: true });
    console.log('   registration-detail.png saved, URL:', page.url());
  } else {
    console.log('   등록 안내 생성 button not found');
  }
} else {
  console.log('   No analysis found');
  await page.screenshot({ path: 'screenshots/analyses-list-debug.png', fullPage: true });
}

// 7. 등록 안내 목록 확인
console.log('7. Registrations list with data...');
await page.goto('http://localhost:3001/registrations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/registrations-list-with-data.png', fullPage: true });
console.log('   registrations-list-with-data.png saved');

await browser.close();
console.log('Done!');
