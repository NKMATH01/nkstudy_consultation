import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:3001/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.fill('input[type="email"]', 'admin@nk.com');
await page.fill('input[type="password"]', 'nk123456');
await page.click('button[type="submit"]');

// Wait for redirect
try {
  await page.waitForURL('**/login', { timeout: 5000 }).catch(() => {});
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
} catch {
  console.log('Login redirect timeout, current URL:', page.url());
}
await page.waitForTimeout(2000);
console.log('After login:', page.url());

await page.goto('http://localhost:3001/consultations');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);
console.log('Consultations URL:', page.url());
await page.screenshot({ path: 'screenshots/check-consultations.png', fullPage: true });
console.log('Done!');

await browser.close();
