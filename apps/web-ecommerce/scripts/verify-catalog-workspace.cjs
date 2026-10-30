/* eslint-disable @typescript-eslint/no-var-requires */
// Read-only acceptance on the running shop. Selection and form edits are never submitted.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
require('@next/env').loadEnvConfig(process.cwd(), false);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const output = process.env.CATALOG_QA_OUTPUT || path.resolve('.runtime/qa-catalog');
  fs.mkdirSync(output, { recursive: true });
  try {
    const context = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:6050',
      viewport: { width: 1440, height: 1000 },
    });
    const login = await context.request.post('/api/auth/login', {
      data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    if (login.status() !== 200) throw new Error('Admin login failed');
    const errors = [],
      writes = [];
    await context.route('**/api/**', (route) => {
      const req = route.request(),
        pathname = new URL(req.url()).pathname;
      if (req.method() !== 'GET' && !pathname.startsWith('/api/admin/agent/')) {
        writes.push(pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/vi/admin/products', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.catalog-workspace .inventory-kpi')).toHaveCount(4);
    await expect(page.locator('.admin-table')).toHaveClass(/is-compact/);
    await expect(page.locator('.catalog-product-count')).toContainText('sản phẩm');
    const listing = await (await context.request.get('/api/admin/products?per_page=1')).json();
    if (!listing.payload?.summary || listing.payload.summary.products !== listing.payload.pagination.total)
      throw new Error('Product counts missing or inconsistent in API response');
    await expect(page.locator('.catalog-product-count')).toContainText(
      listing.payload.summary.products.toLocaleString('vi-VN'),
    );
    await expect(page.locator('.compact-admin-catalog-page [role="tablist"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hàng gọn', exact: true })).toHaveCount(0);
    await expect(page.locator('select[aria-label="Danh mục"]')).toHaveCount(0);
    await expect(page.locator('.admin-table-toolbar')).toHaveCount(0);
    await expect(page.locator('.catalog-inventory-footnote')).toHaveCount(0);
    const statusTrigger = page.getByRole('button', { name: /^Trạng thái sản phẩm/ });
    await statusTrigger.click();
    const statusMenu = page.getByRole('group', { name: 'Trạng thái sản phẩm', exact: true });
    await statusMenu.getByRole('button', { name: 'Đang bán', exact: true }).click();
    await expect(statusMenu).toBeVisible();
    await statusMenu.getByRole('button', { name: 'Tạm ngưng', exact: true }).click();
    await expect(statusMenu.getByRole('button', { name: 'Đang bán', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(statusMenu.getByRole('button', { name: 'Tạm ngưng', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await statusMenu.getByRole('button', { name: 'Bỏ lựa chọn', exact: true }).click();
    await statusMenu.getByRole('button', { name: 'Đóng', exact: true }).click();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
      { width: 390, height: 667 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const region = document.querySelector('.admin-table-scroll');
              const rows = [...document.querySelectorAll('.admin-table tbody tr')];
              const last = rows.at(-1)?.getBoundingClientRect();
              return (
                document.documentElement.scrollWidth <= innerWidth + 1 &&
                (innerWidth < 768 || document.documentElement.scrollHeight <= innerHeight + 1) &&
                !!last &&
                last.bottom <= region.getBoundingClientRect().bottom + 1
              );
            }),
          { timeout: 15000 },
        )
        .toBe(true);
    }
    await expect.poll(async () => page.locator('.admin-table tbody tr').count()).toBe(10);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('.admin-table-pagination')).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width: 1440, height: 900 });
    const rows = page.locator('input[aria-label^="Chọn sản phẩm:"]');
    await rows.first().check();
    const toolbar = page.getByRole('region', { name: 'Thao tác với sản phẩm đã chọn' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveCSS('position', 'fixed');
    await toolbar.getByRole('button', { name: 'Cập nhật hàng loạt', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'products-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(toolbar).toBeVisible();
    const bounds = await toolbar.boundingBox();
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > 391) throw new Error('Bulk toolbar overflows mobile');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      throw new Error('Mobile page overflows');
    await page.screenshot({ path: path.join(output, 'products-mobile.png'), fullPage: true });
    await toolbar.getByRole('button', { name: 'Bỏ chọn', exact: true }).click();
    await expect(toolbar).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const search = page.locator('.admin-table-actions input');
    await search.fill('Bạch Khởi');
    await expect(page.locator('.admin-table tbody')).toContainText('Bạch Khởi');
    await expect(page.locator('.admin-table')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('link', { name: 'Phân tích tồn kho', exact: true }).click();
    await page.waitForURL('**/admin/products/report');
    await expect(page.locator('.inventory-tables table')).toHaveCount(2, { timeout: 15000 });
    await page.screenshot({ path: path.join(output, 'inventory-report.png'), fullPage: true });
    await page.goto('/vi/admin/products/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.compact-admin-create-page input[name="name"]:visible')).toBeVisible();
    await expect(page.locator('[name="categoryId"], [name="supplierId"]')).toHaveCount(0);
    await page.goto('/vi/admin/products/125', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.compact-admin-product-page input[name="name"]:visible')).toBeVisible();
    await expect(page.locator('[name="categoryId"], [name="supplierId"]')).toHaveCount(0);
    if (writes.length || errors.length) throw new Error(JSON.stringify({ writes, errors }));
    console.log(JSON.stringify({ ok: true, kpis: 4, bulkDesktopMobile: true, report: true, errors, writes }));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
