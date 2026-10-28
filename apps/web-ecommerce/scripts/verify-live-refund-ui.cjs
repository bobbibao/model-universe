/* eslint-disable @typescript-eslint/no-var-requires */
// UI-only money fixtures. No real transfer, refund or customer data modification.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('@next/env').loadEnvConfig(process.cwd(), false);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      baseURL: 'http://localhost:6050',
      viewport: { width: 1440, height: 1000 },
    });
    let sends = 0,
      syncs = 0;
    const writes = [],
      errors = [];
    await context.route('**/api/**', (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname === '/api/recommendations/events') return route.fulfill({ json: { recorded: true } });
      if (url.pathname === '/api/admin/agent/server/threads/search') return route.continue();
      if (req.method() !== 'GET' && url.pathname !== '/api/auth/login') {
        writes.push(url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    let operation = {
      id: 99003,
      purpose: 'hold_refund',
      entityId: 99002,
      amountVnd: 200000,
      version: 1,
      requestedBy: 99001,
      status: 'approved',
      createdAt: new Date().toISOString(),
      details: {
        reason: 'UI-only fixture',
        accountHash: 'ui-only',
        account: { bank: '970436', number: '123456789', holder: 'UI TEST ONLY' },
        history: [],
      },
    };
    await context.route('**/api/admin/commerce/money-operations**', (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.endsWith('/payos/send')) {
        sends++;
        operation = {
          ...operation,
          version: 3,
          details: {
            ...operation.details,
            payout: { referenceId: 'UI-ONLY-PAYOUT', providerId: 'ui-only', state: 'PROCESSING' },
          },
        };
        return route.fulfill({ json: operation });
      }
      if (req.method() === 'POST' && url.pathname.endsWith('/payos/sync')) {
        syncs++;
        operation = { ...operation, status: 'completed', version: 4, providerReference: 'UI-ONLY-CONFIRMED' };
        return route.fulfill({ json: operation });
      }
      if (req.method() !== 'GET') {
        writes.push(url.pathname);
        return route.abort();
      }
      return route.fulfill({
        json: { bankConfirmationConfigured: false, payosPayoutConfigured: true, operations: [operation] },
      });
    });
    assert.equal(
      (
        await context.request.post('/api/auth/login', {
          data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
        })
      ).status(),
      200,
    );
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/vi/admin/finance', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Duyệt hoàn tiền', exact: true }).click();
    const send = page.getByRole('button', { name: 'Chuyển tiền thật qua payOS', exact: true });
    await send.click();
    assert.equal(sends, 0, 'Recipient confirmation is required before dispatch');
    await page.getByRole('checkbox', { name: /Tôi đã đối chiếu ngân hàng/ }).check();
    await send.click();
    await expect.poll(() => sends).toBe(1);
    await expect(page.getByText(/payOS: PROCESSING/)).toBeVisible();
    await expect(send).toHaveCount(0);
    const out = path.join(process.env.MODEL_UNIVERSE_RUNTIME_DIR || 'D:/ModelUniverseRuntime', 'qa-live-refund');
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, 'processing-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Kiểm tra payOS', exact: true }).click();
    await expect.poll(() => syncs).toBe(1);
    await expect(page.getByText('Ngân hàng đã xác nhận', { exact: true })).toBeVisible();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Finance fits mobile');
    await page.screenshot({ path: path.join(out, 'completed-mobile.png'), fullPage: true });
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'result.json'),
      JSON.stringify({ ok: true, sends, syncs, writes, errors }, null, 2),
    );
    console.log(
      'Live refund UI: confirmation, processing, one dispatch, reconciliation and mobile passed. All money writes mocked in browser.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
