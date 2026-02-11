import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. Login page
console.log('1. Login page...');
await page.goto('http://localhost:3001/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-login.png' });
console.log('   design-login.png saved');

// 2. Login
console.log('2. Logging in...');
await page.fill('input[type="email"]', 'admin@nk.com');
await page.fill('input[type="password"]', 'nk123456');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log('   Logged in, URL:', page.url());

// 3. Dashboard
console.log('3. Dashboard...');
await page.goto('http://localhost:3001/');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-dashboard.png', fullPage: true });
console.log('   design-dashboard.png saved');

// 4. Consultations list
console.log('4. Consultations list...');
await page.goto('http://localhost:3001/consultations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-consultations.png', fullPage: true });
console.log('   design-consultations.png saved');

// 5. Surveys list
console.log('5. Surveys list...');
await page.goto('http://localhost:3001/surveys');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-surveys.png', fullPage: true });
console.log('   design-surveys.png saved');

// 6. Analyses list
console.log('6. Analyses list...');
await page.goto('http://localhost:3001/analyses');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-analyses.png', fullPage: true });
console.log('   design-analyses.png saved');

// 7. Analysis detail (if exists)
console.log('7. Analysis detail...');
const analysisLink = page.locator('a[href^="/analyses/"]').first();
if (await analysisLink.isVisible()) {
  await analysisLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/design-analysis-detail.png', fullPage: true });
  console.log('   design-analysis-detail.png saved');
} else {
  console.log('   No analysis data');
}

// 8. Registrations list
console.log('8. Registrations list...');
await page.goto('http://localhost:3001/registrations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-registrations.png', fullPage: true });
console.log('   design-registrations.png saved');

// 9. Registration detail (if exists)
const regLink = page.locator('a[href^="/registrations/"]').first();
if (await regLink.isVisible()) {
  await regLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/design-registration-detail.png', fullPage: true });
  console.log('   design-registration-detail.png saved');
} else {
  console.log('   No registration data');
}

// 10. Settings
console.log('10. Settings...');
await page.goto('http://localhost:3001/settings');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-settings.png', fullPage: true });
console.log('   design-settings.png saved');

await browser.close();
console.log('Done!');
