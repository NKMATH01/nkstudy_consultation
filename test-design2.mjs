import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. Login page
console.log('1. Login page...');
await page.goto('http://localhost:3001/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-login.png' });
console.log('   v2-login.png saved');

// 2. Login
console.log('2. Logging in...');
await page.fill('input[type="email"]', 'admin@nk.com');
await page.fill('input[type="password"]', 'nk123456');
await page.click('button[type="submit"]');
try {
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
} catch {
  console.log('   Login redirect timeout, URL:', page.url());
}
await page.waitForTimeout(2000);
console.log('   Logged in, URL:', page.url());

// 3. Dashboard
console.log('3. Dashboard...');
await page.goto('http://localhost:3001/');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-dashboard.png', fullPage: true });
console.log('   v2-dashboard.png saved');

// 4. Consultations list
console.log('4. Consultations list...');
await page.goto('http://localhost:3001/consultations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-consultations.png', fullPage: true });
console.log('   v2-consultations.png saved');

// 5. Surveys list
console.log('5. Surveys list...');
await page.goto('http://localhost:3001/surveys');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-surveys.png', fullPage: true });
console.log('   v2-surveys.png saved');

// 6. Analyses list
console.log('6. Analyses list...');
await page.goto('http://localhost:3001/analyses');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-analyses.png', fullPage: true });
console.log('   v2-analyses.png saved');

// 7. Registrations list
console.log('7. Registrations list...');
await page.goto('http://localhost:3001/registrations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-registrations.png', fullPage: true });
console.log('   v2-registrations.png saved');

// 8. Settings
console.log('8. Settings...');
await page.goto('http://localhost:3001/settings');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/v2-settings.png', fullPage: true });
console.log('   v2-settings.png saved');

await browser.close();
console.log('Done!');
