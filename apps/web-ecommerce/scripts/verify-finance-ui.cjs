/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- Browser acceptance runner, never production application code. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
require('@next/env').loadEnvConfig(process.cwd(), false);
const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || require('node:path').join(process.cwd(), '.runtime');
const base = 'http://localhost:6050';
const getJson = async (ctx, path) => {
  const r = await ctx.request.get(path);
  assert.equal(r.status(), 200, path);
  return r.json();
};
(async () => {
  const runtime = JSON.parse(fs.readFileSync(home + '/finance-review.json'));
  assert(/^model_universe_finance_.*_test$/.test(runtime.database), 'Never mutate shop data in this test');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
    assert([401, 403].includes((await context.request.get('/api/admin/finance/report')).status()));
    assert.equal(
      (
        await context.request.post('/api/auth/login', {
          data: { email: 'finance.admin@model-universe.test', password: 'Finance-Check-2026!' },
        })
      ).status(),
      200,
    );
    const initial = await getJson(context, '/api/admin/finance/report?from=2026-10-01&to=2026-10-27');
    assert.equal(initial.developmentFixtures, true);
    assert(initial.current.orders > 5);
    const page = await context.newPage();
    const errors = [],
      financeErrors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/api/admin/finance/') && r.status() >= 400)
        financeErrors.push({ url: r.url(), status: r.status() });
    });
    await page.goto('/vi/admin/finance', { waitUntil: 'networkidle' });
    await expect(page.locator('.finance-kpi')).toHaveCount(4);
    await expect(page.getByText('DỮ LIỆU PHÁT TRIỂN · Không phải giao dịch của shop')).toBeVisible();
    await page.screenshot({ path: home + '/finance-desktop.png' });
    await page.screenshot({ path: home + '/finance-report-full.png', fullPage: true });
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '↓ Xuất báo cáo CSV', exact: true }).click();
    const download = await downloadEvent;
    await download.saveAs(home + '/finance-acceptance-export.csv');
    results.push('Desktop report, verified dataset banner and CSV download');
    await page.getByRole('tab', { name: 'Chi phí & định mức', exact: true }).click();
    await page.getByRole('button', { name: 'Loại chi phí & định mức', exact: true }).click();
    await page.getByRole('button', { name: '+ Thêm loại chi phí', exact: true }).click();
    let dialog = page.getByRole('dialog');
    const label = 'UI · Carton ' + Date.now();
    await dialog.getByLabel('Tên loại chi phí').fill(label);
    await dialog.getByLabel('Phân loại').selectOption('PACKAGING');
    await dialog.getByLabel('Cách ghi nhận').selectOption('QUANTITY');
    await dialog.getByLabel('Đơn vị').fill('m');
    await dialog.getByLabel('Đơn giá mặc định (VND)').fill('4000');
    await dialog.getByRole('button', { name: 'Lưu loại chi phí', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    let type = (await getJson(context, '/api/admin/finance/cost-types')).find((t) => t.name === label);
    assert(type);
    await page.getByRole('button', { name: 'Sổ chi phí', exact: true }).click();
    await page.getByRole('button', { name: '+ Ghi nhận chi phí', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Đơn giá thực tế (VND)')).toBeDisabled();
    await dialog.getByLabel('Loại chi phí').selectOption(String(type.id));
    await expect(dialog.getByLabel('Đơn giá thực tế (VND)')).toBeEnabled();
    await dialog.getByLabel('Ngày phát sinh').fill('2026-10-15');
    await dialog.getByLabel('Lượng sử dụng (m)').fill('1.5');
    await dialog.getByLabel('Chứng từ / nội dung').fill(label + ' invoice');
    await dialog.getByRole('button', { name: 'Ghi nhận chi phí', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    let entries = await getJson(context, '/api/admin/finance/expenses?from=2026-10-15&to=2026-10-15');
    let entry = entries.rows.find((e) => e.nameSnapshot === label);
    assert(entry);
    assert.equal(Number(entry.amountVnd), 6000);
    assert.equal(entry.unitSnapshot, 'm');
    await page.getByRole('button', { name: 'Loại chi phí & định mức', exact: true }).click();
    await page.getByRole('button', { name: 'Sửa ' + label, exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Đơn giá mặc định (VND)').fill('9000');
    await dialog.getByLabel('Đơn vị').fill('cuộn');
    await dialog.getByLabel('Đang sử dụng').uncheck();
    await dialog.getByRole('button', { name: 'Lưu loại chi phí', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    entries = await getJson(context, '/api/admin/finance/expenses?from=2026-10-15&to=2026-10-15');
    entry = entries.rows.find((e) => e.id === entry.id);
    assert.equal(Number(entry.unitCostVnd), 4000);
    assert.equal(entry.unitSnapshot, 'm');
    await page.getByRole('button', { name: 'Sổ chi phí', exact: true }).click();
    await page.getByRole('button', { name: '+ Ghi nhận chi phí', exact: true }).click();
    dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByLabel('Loại chi phí').locator('option').filter({ hasText: label }).count(), 0);
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    // Search expense entries by period containing only our record so paging does not mask the correction action.
    await page.getByLabel('Từ ngày').fill('2026-10-15');
    await page.getByLabel('Đến ngày').fill('2026-10-15');
    await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Đảo chi phí #' + entry.id, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Đảo chi phí #' + entry.id, exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Lý do điều chỉnh').fill('UI acceptance correction');
    await dialog.getByRole('button', { name: 'Xác nhận đảo bút toán', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    entries = await getJson(context, '/api/admin/finance/expenses?from=2026-10-15&to=2026-10-15');
    assert.equal(Number(entries.rows.find((e) => e.reversesId === entry.id).amountVnd), -6000);
    results.push(
      'Create expense type, enabled/disabled inputs, fractional usage, historical price/unit snapshot, retirement, reversal',
    );
    await page.getByRole('button', { name: 'Tháng này', exact: true }).click();
    await page.getByRole('tab', { name: 'Đối soát đơn hàng', exact: true }).click();
    const order = await getJson(context, '/api/admin/finance/orders/3');
    await page.getByLabel('Tìm mã đơn / khách hàng').fill('3');
    await page.getByRole('button', { name: 'Tìm', exact: true }).click();
    await page
      .locator('tr')
      .filter({ has: page.getByRole('link', { name: '#3', exact: true }) })
      .getByRole('button', { name: 'Đối soát', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('checkbox')).toBeDisabled();
    for (const line of order.items) await dialog.getByLabel('Giá vốn / SP · dòng #' + line.id).fill('200000');
    await expect(dialog.getByRole('checkbox')).toBeEnabled();
    await dialog.getByRole('checkbox').check();
    await dialog.getByLabel('Căn cứ / ghi chú đối soát').fill('UI · verified purchase invoices');
    await dialog.getByRole('button', { name: 'Lưu phiên bản đối soát', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const after = await getJson(context, '/api/admin/finance/orders/3');
    assert.equal(after.review.version, order.review.version + 1);
    assert.equal(after.review.costsReviewed, true);
    assert.equal(after.total, order.total);
    results.push('Order review, unknown-cost completion guard, revision history and unchanged order totals');
    await page.getByRole('tab', { name: 'Tổng quan', exact: true }).click();
    await expect(page.locator('.finance-kpi')).toHaveCount(4);
    for (const close of await page.locator('.Toastify__close-button').all()) await close.click();
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('.finance-kpi')).toHaveCount(4);
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'Page overflow ' + viewport.width,
      );
      await page.screenshot({ path: home + '/finance-mobile-' + viewport.width + '.png' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Chi phí & định mức', exact: true }).click();
    await page.getByRole('button', { name: '+ Ghi nhận chi phí', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    assert(await page.getByRole('dialog').evaluate((el) => el.getBoundingClientRect().right <= innerWidth));
    await page.screenshot({ path: home + '/finance-mobile-dialog.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    assert.deepEqual(errors, []);
    assert.deepEqual(financeErrors, []);
    console.log(
      JSON.stringify(
        {
          database: runtime.database,
          commit: runtime.commit,
          checks: results,
          mobileWidths: [390, 768],
          browserErrors: errors,
          financeErrors,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      home + '/finance-ui-verification.json',
      JSON.stringify(
        { database: runtime.database, commit: runtime.commit, checks: results, browserErrors: errors, financeErrors },
        null,
        2,
      ),
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
