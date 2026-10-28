/* eslint-disable @typescript-eslint/no-var-requires */
// Real navigation and quote clicks; never creates a hold or financial transaction.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { Client } = require('pg');
require('@next/env').loadEnvConfig(process.cwd(), false);

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await db.connect();
  const { rows } = await db.query(`SELECT slug FROM product WHERE stock>0 AND NOT "isArchived"
    AND "partnerId" IS NULL AND "listingStatus"='published' AND "inventoryStatus"='available'
    AND slug IS NOT NULL ORDER BY id LIMIT 1`);
  await db.end();
  assert(rows[0], 'An in-stock shop product exists');
  const productPath = '/vi/san-pham/' + rows[0].slug;
  const out = path.join(process.env.MODEL_UNIVERSE_RUNTIME_DIR || 'D:/ModelUniverseRuntime', 'qa-hold-discovery');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:6050', viewport: { width: 1440, height: 1000 } });
    const errors = [],
      writes = [];
    await ctx.route('**/api/**', (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname === '/api/recommendations/events') return route.fulfill({ json: { recorded: true } });
      if (req.method() !== 'GET' && !['/api/auth/login', '/api/reservations/quote'].includes(url.pathname)) {
        writes.push(url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/vi', { waitUntil: 'networkidle' });
      const nav = page.locator(width < 1024 ? '.mu-mobile-nav' : '.store-primary-nav');
      await nav.getByRole('link', { name: 'Giữ hàng', exact: true }).click();
      await expect(page).toHaveURL(/\/vi\/reservations/);
      await expect(page.getByText('Muốn giữ một mô hình?', { exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Giữ hàng', exact: true })).toHaveAttribute('aria-current', 'page');
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'No horizontal overflow',
      );
      await page.screenshot({ path: path.join(out, `entry-${width}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Chọn mô hình để giữ' }).click();
      await expect(page).toHaveURL(/\/vi\/cua-hang/);
    }
    await page.goto(productPath, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Đặt cọc giữ hàng', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);
    const login = await ctx.request.post('/api/auth/login', {
      data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(login.status(), 200);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(productPath, { waitUntil: 'networkidle' });
      const button = page.getByRole('button', { name: 'Đặt cọc giữ hàng', exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeEnabled();
      await page.screenshot({ path: path.join(out, `product-${width}.png`) });
      await button.click();
      const dialog = page.getByRole('dialog', { name: 'Giữ mô hình này' });
      await expect(dialog.getByText('Tổng tính cọc', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await page.getByRole('link', { name: 'Đơn giữ của tôi' }).click();
      await expect(page).toHaveURL(/\/vi\/reservations/);
    }
    await page.goto('/vi/services', { waitUntil: 'networkidle' });
    await page.locator('.studio-service-grid').getByRole('link').filter({ hasText: 'Giữ hàng' }).click();
    await expect(page).toHaveURL(/\/vi\/services\/reserve/);
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    fs.writeFileSync(
      path.join(out, 'result.json'),
      JSON.stringify({ ok: true, errors, writes, checkedAt: new Date().toISOString() }, null, 2),
    );
    console.log(
      'Hold discovery: desktop, tablet, mobile, guest login, authenticated quote, services and tracking passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
