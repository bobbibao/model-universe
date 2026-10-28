/* eslint-disable @typescript-eslint/no-var-requires -- Browser acceptance, never production code. */
// Real production pages, real clicks, API-read checks and browser-only fixtures for money workflows.
// All financial writes are intercepted: no synthetic money, policies or stock in the shop database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
require('@next/env').loadEnvConfig(process.cwd(), false);
const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || 'D:/ModelUniverseRuntime';
const out = path.join(home, 'qa-pawn-hold');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    baseURL: 'http://localhost:6050',
    viewport: { width: 1440, height: 1000 },
    locale: 'vi-VN',
  });
  const errors = [],
    writes = [];
  await ctx.route('**/api/**', (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname === '/api/recommendations/events') return route.fulfill({ json: { recorded: true } });
    if (url.pathname === '/api/admin/agent/server/threads/search') return route.continue();
    if (req.method() !== 'GET' && !['/api/auth/login', '/api/reservations/quote'].includes(url.pathname)) {
      writes.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const login = await ctx.request.post('/api/auth/login', {
    data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  assert.equal(login.status(), 200, 'Owner login');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/vi/admin/finance', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Duyệt hoàn tiền', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Duyệt hoàn tiền & phân quyền' })).toBeVisible();
  await expect(page.getByText('Phân quyền Finance / Compliance', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(out, 'finance-desktop.png'), fullPage: true });
  const now = new Date(),
    due = new Date(now.getTime() + 20 * 86400000).toISOString();
  let pawn = {
    id: 99901,
    userId: 1,
    status: 'in_custody',
    version: 0,
    asset: {
      name: 'Kiểm thử UI · mô hình cầm',
      modelCode: 'UI-ONLY',
      version: 'Bản kiểm thử trình duyệt',
      assemblyState: 'assembled',
      boxCondition: 'Thiếu hộp',
      accessories: 'Đủ phụ kiện',
      defects: 'Không ghi nhận thêm',
      repairHistory: 'Không ghi nhận',
    },
    terms: {
      appraisalVnd: 1000000,
      principalVnd: 500000,
      termDays: 20,
      contractText: 'Dữ liệu kiểm thử chỉ trong trình duyệt.',
      disposalAfterGrace: true,
      policyVersion: 1,
      policy: {
        calculation: 'compound_0_3_v2',
        cashFlowClock: 'elapsed_24h_periods',
        legalMode: 'simulation',
        dailyRateBasisPoints: 30,
        dayCount: 'completed_days',
        rounding: 'nearest',
        graceDays: 2,
        interestStopEvent: 'verified_repayment',
      },
    },
    governance: {},
    contractReference: 'UI-CONTRACT',
    contractEvidenceIds: [],
    custodyAt: now.toISOString(),
    custodyReference: 'UI-CUSTODY',
    disbursedAt: null,
    dueAt: null,
    paidAt: null,
    handbackAt: null,
    disposedAt: null,
    disposalStatement: null,
    disposal: null,
    productId: null,
    extensionRequest: null,
    createdAt: now.toISOString(),
    overdue: false,
    evidence: [],
    events: [],
    payments: [],
    estimate: { asOf: now.toISOString(), days: 0, interestVnd: 0, capped: false, collectedVnd: 0, remainingVnd: 0 },
    operations: [],
  };
  let actions = 0;
  await ctx.route('**/api/evidence', (route) =>
    route.fulfill({ json: { id: 990001, originalName: 'Ảnh kiểm thử.webp' } }),
  );
  await ctx.route('**/api/admin/pawn**', async (route) => {
    const req = route.request(),
      pathname = new URL(req.url()).pathname;
    if (req.method() === 'POST') {
      const data = req.postDataJSON();
      assert.equal(data.action, 'verify_documents');
      assert.equal(data.identityVerified, true);
      assert.equal(data.ownershipVerified, true);
      assert.deepEqual(data.evidenceIds, [990001]);
      actions++;
      pawn = { ...pawn, version: pawn.version + 1, governance: { identityVerified: true, ownershipVerified: true } };
      return route.fulfill({ json: pawn });
    }
    return route.fulfill({ json: /\/99901/.test(pathname) ? pawn : [pawn] });
  });
  await page.goto('/vi/admin/pawn', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Kiểm thử UI · mô hình cầm/ }).click();
  await expect(page.getByText('Chỉ mô phỏng · chưa được giao dịch cầm cố thực tế', { exact: true })).toBeVisible();
  assert.equal(
    await page.locator('form input[name="amountVnd"]').count(),
    0,
    'Simulation cannot show real disbursement form',
  );
  await page.getByText('Kiểm soát giấy tờ, tranh chấp & tài sản', { exact: true }).click();
  await page.getByLabel('Đã đối chiếu giấy tờ và danh tính').check();
  await page.getByLabel('Đã xác minh chủ sở hữu và quyền định đoạt').check();
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles(path.resolve('public/images/catalog/rg-zaku-ii-box.webp'));
  await page.getByLabel('Căn cứ / nội dung kiểm tra').fill('Hồ sơ kiểm thử trong trình duyệt, không ghi vào database.');
  await page.getByRole('button', { name: 'Lưu hồ sơ kiểm soát', exact: true }).click();
  await expect.poll(() => actions).toBe(1);
  await page.screenshot({ path: path.join(out, 'pawn-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'pawn-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Pawn fits mobile width');
  pawn = {
    ...pawn,
    status: 'OVERDUE_REVIEW',
    disbursedAt: now.toISOString(),
    dueAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
    extensionRequest: {
      id: 'UI-REQUEST',
      proposedDueAt: due,
      reason: 'Pending overdue review',
      creditDueVnd: 10000,
      projectedDebtVnd: 550000,
      ceilingVnd: 800000,
    },
  };
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Kiểm thử UI · mô hình cầm/ }).click();
  await expect(page.locator('select[name="accepted"] option[value="yes"]')).toHaveAttribute('disabled', '');
  let hold = {
    id: 99902,
    productId: 1,
    productName: 'Kiểm thử UI · giữ hàng',
    imageUrl: '/images/catalog/rg-zaku-ii-box.webp',
    quantity: 1,
    totalVnd: 1000000,
    paidVnd: 200000,
    remainingVnd: 800000,
    minimumInitialVnd: 200000,
    status: 'holding',
    inventoryAllocated: true,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
    policyVersion: 1,
    unresolvedDepositVnd: 0,
    operations: [],
    payments: [],
    events: [],
  };
  let cancelled = 0,
    refunds = 0;
  await ctx.route('**/api/reservations**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname;
    if (p.endsWith('/notifications')) return route.fulfill({ json: [] });
    if (req.method() === 'POST') {
      if (p.endsWith('/payment-link'))
        return route.fulfill({
          json: {
            checkoutUrl: 'https://example.invalid/ui-only',
            amountVnd: 200000,
            qrCode: 'UI-ONLY-NOT-A-PAYMENT',
            description: 'UI-ONLY',
            accountNumber: 'UI-ONLY',
            accountName: 'UI FIXTURE',
            expiresAt: due,
          },
        });
      if (p.endsWith('/cancel')) {
        cancelled++;
        hold = { ...hold, status: 'cancel_requested' };
        return route.fulfill({ json: hold });
      }
      if (p.endsWith('/refund-request')) {
        const data = req.postDataJSON();
        assert.equal(data.amountVnd, 200000);
        refunds++;
        hold = {
          ...hold,
          operations: [
            {
              id: 990002,
              purpose: 'hold_refund',
              entityId: hold.id,
              amountVnd: 200000,
              status: 'requested',
              createdAt: now.toISOString(),
            },
          ],
        };
        return route.fulfill({ json: hold.operations[0] });
      }
      if (p === '/api/reservations/quote') return route.continue();
      throw new Error('Unexpected mocked hold action ' + p);
    }
    return route.fulfill({ json: /\/99902/.test(p) ? hold : [hold] });
  });
  await page.goto('/vi/reservations', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Kiểm thử UI · giữ hàng/ }).click();
  await page.getByRole('button', { name: 'Tạo QR thanh toán', exact: true }).click();
  await expect(page.getByText('Mở trang thanh toán', { exact: true })).toBeVisible();
  assert.equal(await page.locator('input[name=amountVnd]').count(), 0, 'QR amount stays locked');
  const cancel = page.locator('form').filter({ has: page.locator('input[name=reason]') });
  await cancel.locator('input[name=reason]').fill('Yêu cầu hủy và đối soát tiền đã cọc.');
  await cancel.locator('button').click();
  await expect.poll(() => cancelled).toBe(1);
  await expect(page.getByText(/Chờ duyệt hủy/).last()).toBeVisible();
  hold = { ...hold, status: 'cancelled', inventoryAllocated: false, unresolvedDepositVnd: 200000 };
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Kiểm thử UI · giữ hàng/ }).click();
  await page.getByText('Yêu cầu hoàn tiền dư', { exact: true }).click();
  await page.getByLabel('Ngân hàng nhận', { exact: true }).fill('UI-only bank');
  await page.getByLabel('Số tài khoản', { exact: true }).fill('123456');
  await page.getByLabel('Tên chủ tài khoản', { exact: true }).fill('UI-only collector');
  await page
    .getByLabel('Lý do / hồ sơ đối soát', { exact: true })
    .fill('Hủy giữ hàng đã được duyệt, dữ liệu chỉ trong browser.');
  await page.getByRole('button', { name: 'Gửi yêu cầu hoàn tiền', exact: true }).click();
  await expect.poll(() => refunds).toBe(1);
  await expect(page.getByText('Chờ duyệt', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiền chờ đối soát', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(out, 'hold-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Hold fits mobile width');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(out, 'hold-desktop.png'), fullPage: true });
  const { Client } = require('pg'),
    database = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  await database.connect();
  const product = (
    await database.query(
      `SELECT slug FROM product WHERE stock>0 AND NOT "isArchived" AND "partnerId" IS NULL AND "modelCode" IS NOT NULL AND "listingStatus"='published' AND "inventoryStatus"='available' AND slug IS NOT NULL ORDER BY id LIMIT 1`,
    )
  ).rows[0];
  await database.end();
  assert(product, 'A real in-stock model exists');
  await page.goto('/vi/san-pham/' + product.slug, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Đặt cọc giữ hàng', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Giữ mô hình này' });
  await expect(dialog.getByText('Tổng tính cọc', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Cọc tối thiểu 20%', { exact: true })).toBeVisible();
  await dialog.getByRole('checkbox').check();
  await page.screenshot({ path: path.join(out, 'hold-terms-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'hold-terms-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Hold dialog fits mobile');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  assert.deepEqual(writes, [], 'No unintended financial write to the shop');
  assert.deepEqual(errors, [], 'No page runtime errors');
  fs.writeFileSync(
    path.join(out, 'result.json'),
    JSON.stringify(
      {
        ok: true,
        actions,
        cancelled,
        refunds,
        unexpectedWrites: writes,
        pageErrors: errors,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: real desktop/mobile pages, Finance queue, document verification, locked hold QR, reviewed cancellation and refund request; financial writes were browser-intercepted.',
  );
  await browser.close();
})().catch((e) => {
  console.error(e.stack);
  process.exit(1);
});
