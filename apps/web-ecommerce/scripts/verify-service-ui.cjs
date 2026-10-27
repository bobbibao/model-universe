/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- Local browser acceptance runner. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
require('@next/env').loadEnvConfig(process.cwd(), false);
const base = 'http://localhost:6050';
const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || path.join(process.cwd(), '.runtime');

// Uses existing credentials, catalog and prices. Never submits a request, uploads evidence or changes stock.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1100 },
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const expectedRelease = JSON.parse(fs.readFileSync(path.join(home, 'release.json'), 'utf8'));
    await expect
      .poll(
        async () => {
          try {
            const state = JSON.parse(fs.readFileSync(path.join(home, 'state.json'), 'utf8'));
            return (
              state.commit === expectedRelease.commit &&
              (await context.request.get('/api/product-condition-tree', { timeout: 2000 })).ok()
            );
          } catch {
            return false;
          }
        },
        { timeout: 60000, intervals: [500, 1000] },
      )
      .toBe(true);
    const login = await context.request.post('/api/auth/login', {
      data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(login.status(), 200, 'Existing local admin authentication');
    const families = await (await context.request.get('/api/product-condition-tree/families?q=Ngao')).json();
    let family, cases;
    for (const candidate of families) {
      const options = await (
        await context.request.get(`/api/product-condition-tree/families/${candidate.id}/combinations`)
      ).json();
      const priced = options.filter((option) => option.itemTypeKey === 'preowned' && option.salePriceVnd > 100000);
      if (priced.some((option) => option.conditionNodeIds.length)) {
        family = candidate;
        cases = priced;
        break;
      }
    }
    assert(family, 'A real catalog family with an approved 2hand condition is required');
    const page = await context.newPage(),
      errors = [],
      failures = [],
      checks = [],
      snapshots = [],
      snapshotReads = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400)
        failures.push({ path: new URL(response.url()).pathname, status: response.status() });
      if (new URL(response.url()).pathname === '/api/product-condition-tree/match' && response.ok())
        snapshotReads.push(response.json().then((snapshot) => snapshots.push(snapshot)));
    });
    for (const kind of ['sell', 'trade', 'pawn']) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(`/vi/services/${kind}`, { waitUntil: 'networkidle' });
      const basket = page.locator('.qv');
      await expect(basket).toBeVisible();
      await basket.getByRole('button', { name: 'Tự nhập tên', exact: true }).click();
      const manual = basket.locator('.is-custom-model').first(),
        name = manual.getByRole('textbox', { name: 'Tên mô hình', exact: true });
      await expect(name).toBeFocused();
      await expect(basket.locator('.qv-cta')).toBeDisabled();
      const modelName = `Mô hình ngoài danh mục · ${kind}`;
      await name.fill(modelName);
      await manual.getByRole('radio', { name: '2hand', exact: true }).click();
      const conditions = manual.locator('.service-condition-tools > button').first();
      await conditions.click();
      const custom = manual.locator('.service-condition-custom');
      await custom.getByRole('button', { name: /^Hộp / }).click();
      await custom.getByRole('button', { name: 'Thiếu hộp', exact: true }).click();
      await expect(custom.getByRole('button', { name: 'Thiếu hộp', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await custom.getByRole('button', { name: 'Hộp bị hư', exact: true }).click();
      await expect(custom.getByRole('button', { name: 'Thiếu hộp', exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expect(custom.getByRole('button', { name: 'Hộp bị hư', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await custom.getByRole('button', { name: 'Đóng', exact: true }).click();
      await custom.getByRole('button', { name: /^Phụ kiện / }).click();
      await custom.getByRole('button', { name: 'Thiếu phụ kiện', exact: true }).click();
      await custom.getByRole('button', { name: 'Đóng', exact: true }).click();
      const selected = await custom.locator('.condition-selection-tags > button').allTextContents();
      await conditions.click();
      await expect(custom).toBeHidden();
      await conditions.click();
      await expect(custom.locator('.condition-selection-tags > button')).toHaveText(selected);
      const noteButton = manual.getByRole('button', { name: 'Mô tả thêm', exact: true });
      await noteButton.click();
      const note = manual.getByLabel('Điều shop cần biết thêm', { exact: true });
      await expect(note).toBeFocused();
      await expect(custom).toBeHidden();
      await note.fill('Khớp gối đã sửa, xem ảnh cận cảnh.');
      await noteButton.click();
      await expect(note).toBeHidden();
      await noteButton.click();
      await expect(note).toHaveValue('Khớp gối đã sửa, xem ảnh cận cảnh.');
      await conditions.click();
      await expect(custom.locator('.condition-selection-tags > button')).toHaveText(selected);
      await conditions.click();
      await expect(manual.locator('.sb-row-price')).toHaveText('Báo giá riêng');

      const search = basket.getByRole('combobox').first();
      await search.fill('Mẫu tự nhập để kiểm tra tìm kiếm');
      await expect(basket.getByText('Chưa tìm thấy mô hình phù hợp.', { exact: true })).toBeVisible();
      await basket.locator('.cc-create-manual').click();
      const copied = basket.locator('.is-custom-model').last();
      await expect(copied.getByRole('textbox', { name: 'Tên mô hình', exact: true })).toHaveValue(
        'Mẫu tự nhập để kiểm tra tìm kiếm',
      );
      await copied.getByRole('button', { name: 'Bỏ', exact: true }).click();
      await search.fill(family.name);
      await expect(
        basket.getByRole('option', { name: new RegExp(family.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first(),
      ).toBeVisible();
      await search.press('Enter');
      const catalog = basket.locator('.sb-row.is-service:not(.is-custom-model)');
      await catalog.getByRole('radio', { name: '2hand', exact: true }).click();
      const optionIndex = cases.findIndex((option) => option.conditionNodeIds.length);
      const preset = catalog.locator('.service-combinations-options > button').nth(optionIndex);
      await preset.click();
      await expect(preset).toHaveAttribute('aria-pressed', 'true');
      await expect(catalog.locator('.sb-row-price')).toHaveText(/\d[\d.]*\s*₫/);
      await catalog.getByRole('radio', { name: '2hand', exact: true }).click();
      await expect(preset).toHaveAttribute('aria-pressed', 'true');
      await catalog.getByRole('radio', { name: '2hand', exact: true }).focus();
      await page.keyboard.press('Home');
      await expect(catalog.getByRole('radio', { name: 'New', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('End');
      await preset.click();
      await expect(catalog.locator('.service-condition-notice')).toContainText('Giá tham khảo');

      if (kind === 'trade') {
        for (let count = 0; count < 2; count++) {
          const shopSearch = basket.locator('.sb-list').nth(1).getByRole('combobox');
          await shopSearch.click();
          await expect(basket.getByRole('option').first()).toBeVisible();
          await basket.getByRole('option').nth(count).click();
        }
        await expect(basket.locator('.sb-list').nth(1).locator('.sb-row')).toHaveCount(2);
      }
      await expect(basket.locator('.qv-cta')).toBeEnabled();
      await basket.screenshot({ path: path.join(home, `service-${kind}-desktop.png`), animations: 'disabled' });
      await basket.locator('.qv-cta').click();
      await expect(page.locator('.sb-request-title').first()).toContainText(modelName);
      await expect(page.locator('.service-request-panel input[name="name"]')).toHaveCount(0);
      await page.locator('.service-form-agree input[type="checkbox"]').check();
      await expect(page.locator('.service-form-submit > button')).toBeDisabled();
      await page.locator('.service-request-panel-head button').click();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await conditions.tap();
      await expect(custom.locator('.condition-selection-tags > button')).toHaveText(selected);
      await basket.screenshot({ path: path.join(home, `service-${kind}-mobile.png`), animations: 'disabled' });
      checks.push({
        kind,
        checks: [
          'Inline required model name and autofocus',
          'Search fallback reuses the typed name',
          'Exclusive choices replace each other',
          'Multiple groups and notes survive panel changes',
          'Correct approved preset and price',
          'Repeated type selection retains conditions',
          'Keyboard type navigation',
          'Request panel reuses model name and requires evidence',
          'Touch interaction and no mobile overflow',
        ],
      });
    }
    await page.goto('/vi/services/sell', { waitUntil: 'networkidle' });
    let interrupt = true;
    const searchRoute = (url) => url.pathname === '/api/product-condition-tree/families';
    await page.route(searchRoute, (route) => {
      if (interrupt) return route.abort();
      return route.continue();
    });
    await page.locator('.qv').getByRole('combobox').first().fill('Ngao');
    await expect(page.locator('.cc-status').getByText('Chưa tải được danh sách.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    interrupt = false;
    await page.locator('.cc-status').getByRole('button', { name: 'Thử lại', exact: true }).click();
    await expect(page.locator('.qv').getByRole('option').first()).toBeVisible();
    await page.unroute(searchRoute);
    checks.push({
      kind: 'search-recovery',
      checks: ['Network failure is contained and retry restores real catalog results'],
    });
    await Promise.all(snapshotReads);
    assert(
      snapshots.some(
        (snapshot) =>
          snapshot.modelFamilyId === null && snapshot.conditionNodeIds.length >= 2 && snapshot.labels.length >= 2,
      ),
      'Models outside the catalog retain server-validated condition labels for submission',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    const state = JSON.parse(fs.readFileSync(path.join(home, 'state.json'), 'utf8'));
    assert.equal(state.commit, expectedRelease.commit, 'The runtime revision must remain stable during acceptance');
    const proof = {
      commit: state.commit,
      database: state.database,
      readOnly: true,
      checks,
      browserErrors: errors,
      apiFailures: failures,
    };
    fs.writeFileSync(path.join(home, 'service-ui-verification.json'), JSON.stringify(proof, null, 2));
    console.log(JSON.stringify(proof, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
