/* eslint-disable @typescript-eslint/no-var-requires */
// Read-only acceptance against the real running database; no account or order mutations are submitted.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
require('@next/env').loadEnvConfig(process.cwd(), false);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const output = process.env.LIST_QA_OUTPUT || path.resolve('.runtime/qa-operation-lists');
  fs.mkdirSync(output, { recursive: true });
  let page,
    stage = 'login';
  try {
    const context = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:6050',
      viewport: { width: 1440, height: 900 },
    });
    const login = await context.request.post('/api/auth/login', {
      data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    if (login.status() !== 200) throw new Error('Admin login failed');
    const writes = [],
      errors = [];
    await context.route('**/api/**', (route) => {
      const req = route.request(),
        pathname = new URL(req.url()).pathname;
      if (req.method() !== 'GET' && !pathname.startsWith('/api/admin/agent/')) {
        writes.push(pathname);
        return route.abort();
      }
      return route.continue();
    });
    const definitions = [
      {
        name: 'customers',
        api: '/api/admin/users',
        cards: [
          ['Khách có tài khoản', 'total', (url) => !url.searchParams.get('segment')],
          ['Khách mới · 30 ngày', 'new30Days', (url) => url.searchParams.get('segment') === 'new'],
          ['Khách đã mua hàng', 'purchased', (url) => url.searchParams.get('segment') === 'purchased'],
          ['Khách quay lại', 'repeat', (url) => url.searchParams.get('segment') === 'repeat'],
        ],
      },
      {
        name: 'orders',
        api: '/api/admin/orders',
        cards: [
          ['Chờ xử lý', 'processing', (url) => url.searchParams.getAll('status').includes('PROCESSING')],
          ['Đang giao', 'shipping', (url) => url.searchParams.getAll('status').includes('SHIPPED')],
          ['Tiền còn phải thu', 'receivableVnd', (url) => url.searchParams.get('attention') === 'unpaid'],
          ['Yêu cầu huỷ', 'cancellationRequests', (url) => url.searchParams.get('attention') === 'cancellation'],
        ],
      },
    ];
    for (const definition of definitions) {
      stage = definition.name;
      page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const statsResponse = await context.request.get(`${definition.api}/stats`);
      if (statsResponse.status() !== 200) throw new Error(`${definition.name} stats failed`);
      const stats = await statsResponse.json();
      await page.goto(`/vi/admin/${definition.name}`, { waitUntil: 'domcontentloaded' });
      const workspace = page.locator('.admin-list-workspace:visible').first();
      await expect(workspace.locator('.inventory-kpi')).toHaveCount(4);
      await expect(workspace.locator('.admin-table-toolbar')).toHaveCount(0);
      await expect(workspace.locator('[role="tablist"]')).toHaveCount(0);
      for (const [label, field, matches] of definition.cards) {
        stage = `${definition.name}: ${label}`;
        const card = workspace.getByRole('button', { name: new RegExp(`^${label}`) });
        await expect(card).toBeEnabled();
        const value = Number((await card.locator('.inventory-kpi-value').innerText()).replace(/\D/g, ''));
        if (value !== stats[field]) throw new Error(`KPI value differs from server: ${field}`);
        const responsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === definition.api && matches(url);
        });
        await card.click();
        const response = await responsePromise;
        if (response.status() !== 200) throw new Error(`KPI filter failed: ${field}`);
        const payload = (await response.json()).payload;
        await expect(workspace.locator('.catalog-product-count strong')).toHaveText(
          payload.pagination.total.toLocaleString('vi-VN'),
        );
        if (definition.name === 'customers' && payload.pagination.total !== stats[field])
          throw new Error(`Customer KPI count differs from its filter: ${field}`);
        if (definition.name === 'orders' && field !== 'receivableVnd' && payload.pagination.total !== stats[field])
          throw new Error(`Order KPI count differs from its filter: ${field}`);
      }
      const clear = workspace.getByRole('button', { name: 'Xoá lọc', exact: true });
      if (await clear.count()) await clear.click();
      for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1280, height: 720 },
      ]) {
        stage = `${definition.name}: ${viewport.width}x${viewport.height}`;
        await page.setViewportSize(viewport);
        await expect(workspace.locator('.admin-table')).toHaveAttribute('aria-busy', 'false');
        await expect
          .poll(
            async () =>
              workspace.evaluate((w) => {
                const region = w.querySelector('.admin-table-scroll'),
                  last = region.querySelector('tbody tr:last-child');
                if (!last) return false;
                const gap = region.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom;
                return (
                  document.documentElement.scrollWidth <= innerWidth + 1 &&
                  document.documentElement.scrollHeight <= innerHeight + 1 &&
                  gap >= -1 &&
                  (!w.classList.contains('has-full-page') || gap < 3)
                );
              }),
            { timeout: 15000 },
          )
          .toBe(true);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: path.join(output, `${definition.name}-desktop.png`), fullPage: true });
      stage = `${definition.name}: mobile`;
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(workspace.locator('.admin-table')).toHaveAttribute('aria-busy', 'false');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
        throw new Error('Mobile horizontal overflow');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(workspace.locator('.admin-table-pagination')).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `${definition.name}-mobile.png`), fullPage: true });
      await page.close();
      page = undefined;
    }
    const anonymous = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:6050' });
    for (const endpoint of ['/api/admin/users/stats', '/api/admin/orders/stats']) {
      const result = await anonymous.request.get(endpoint);
      if (![401, 403].includes(result.status())) throw new Error('Stats endpoint is not protected');
    }
    await anonymous.close();
    if (writes.length || errors.length) throw new Error(JSON.stringify({ writes, errors }));
    console.log(JSON.stringify({ ok: true, kpiFilters: 8, desktopMobile: true, writes, errors }));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw new Error(`${stage}: ${error.message}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
