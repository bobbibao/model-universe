const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/ACER/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  console.log('Navigating to signin...');
  await page.goto('http://localhost:6060/vi/auth/signin?redirect=/admin/buyback');
  await page.locator('input[name="email"]').fill('admin@example.com');
  await page.locator('input[name="password"]').fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/admin/buyback', { timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/0b914c65-7392-4466-a685-a7b3bfe70f07/services-ui-screenshots/10-admin-buyback-workspace.png' });
  console.log('Admin buyback screenshot captured successfully!');
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});

