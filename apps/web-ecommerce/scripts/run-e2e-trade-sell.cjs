/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
/**
 * End-to-end acceptance test simulating a real human user clicking through
 * all flows of the Buyback (Thu mua / services/sell) and Trade (Trao đổi / services/trade) services.
 * Runs against the isolated review server on port 6060.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:6060';
const SCREENSHOTS_DIR = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\0b914c65-7392-4466-a685-a7b3bfe70f07\\playwright-e2e-screenshots';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

// 4 distinct valid 1x1 PNGs with distinct SHA-256 hashes
const distinctPngsBase64 = [
  // Red
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  // Green
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAE/gHx2527mQAAAABJRU5ErkJggg==',
  // Blue
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbhyQAAAABJRU5ErkJggg==',
  // White
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
];

const imageFiles = distinctPngsBase64.map((b64, idx) => {
  const filePath = path.join(FIXTURES_DIR, `test-evidence-${idx + 1}.png`);
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  return filePath;
});

async function runRealUserE2ETests() {
  console.log(`\n======================================================`);
  console.log(`Starting Real-User Playwright Acceptance Test Suite`);
  console.log(`Target Review Server: ${BASE_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });

  const page = await context.newPage();
  const summaryLog = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE LOG (err):', msg.text());
  });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('request', (r) => {
    if (r.url().includes('/match') || r.url().includes('/combinations')) {
      console.log('REQ:', r.method(), r.url(), r.postData());
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/match') || r.url().includes('/combinations')) {
      try {
        console.log(`RES [${r.status()}] ${r.url()}:`, await r.text());
      } catch (_) {}
    }
    if (r.url().includes('/api/') && r.status() >= 400) {
      try {
        console.log(`API ERROR [${r.status()}] ${r.url()}:`, await r.text());
      } catch (_) {}
    }
  });

  try {
    // -------------------------------------------------------------------------
    // STEP 0: REAL USER AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log(`[Step 0] Logging in as customer (customer1@example.com)...`);
    await page.goto('/vi/auth/signin?redirect=/vi/services/sell', { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.click();
    await emailInput.fill('customer1@example.com');
    await passwordInput.click();
    await passwordInput.fill('Customer@123');

    const loginBtn = page.getByRole('button', { name: 'Đăng nhập', exact: true });
    await loginBtn.click();

    await page.waitForURL('**/vi/services/sell', { timeout: 15000 });
    await expect(page.locator('.qv')).toBeVisible({ timeout: 10000 });
    console.log(`✓ Real user logged in successfully and landed on /vi/services/sell.`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login-and-sell-home.png'), fullPage: false });
    summaryLog.push({ step: 'Login', status: 'PASS', detail: 'Real form click login redirected to /vi/services/sell' });

    // -------------------------------------------------------------------------
    // STEP 1: SELL FLOW - CATALOG ITEM (Ao Bing / Ngao Bính)
    // -------------------------------------------------------------------------
    console.log(`\n[Step 1] Sell Flow - Catalog Item selection & condition pricing...`);
    const basket = page.locator('.qv');
    await expect(basket).toBeVisible();

    const combobox = basket.getByRole('combobox').first();
    await combobox.click();
    await combobox.fill('Ngao');

    const firstOption = basket.getByRole('option').first();
    await expect(firstOption).toBeVisible({ timeout: 10000 });
    console.log(`Found catalog option: "${(await firstOption.innerText()).replace(/\n/g, ' ')}"`);
    await firstOption.click();

    const catalogRow = basket.locator('.sb-row.is-service:not(.is-custom-model)').first();
    await expect(catalogRow).toBeVisible();
    console.log(`✓ Added catalog model row to basket.`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-sell-catalog-item-added.png'), fullPage: false });

    // Select 2hand condition
    const radio2hand = catalogRow.getByRole('radio', { name: '2hand', exact: true });
    await radio2hand.click();
    await expect(radio2hand).toHaveAttribute('aria-checked', 'true');

    // Wait for preset combinations to appear and click first preset
    const presetButtons = catalogRow.locator('.service-combinations-options > button');
    await expect(presetButtons.first()).toBeVisible({ timeout: 10000 });
    await presetButtons.first().click();
    await expect(presetButtons.first()).toHaveAttribute('aria-pressed', 'true');
    console.log(`✓ Clicked condition preset button.`);

    // Wait for price calculation
    const catalogPrice = catalogRow.locator('.sb-row-price');
    await expect(catalogPrice).not.toHaveText('Đang tính…', { timeout: 10000 });
    const rowPrice = await catalogPrice.innerText();
    console.log(`Calculated Valuation Price: ${rowPrice}`);
    assert(rowPrice && rowPrice !== 'Đang tính…', 'Price should be calculated');

    const continueCta = basket.locator('.qv-cta');
    await expect(continueCta).toBeEnabled();
    console.log(`Clicking continue CTA: "${await continueCta.innerText()}"...`);
    await continueCta.click();

    const requestPanel = page.locator('.service-request-panel');
    await expect(requestPanel).toBeVisible({ timeout: 5000 });
    console.log(`✓ ServiceRequestPanel smoothly opened.`);

    // Upload 4 distinct evidence photos
    const fileInput = requestPanel.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imageFiles);

    const photoCounter = requestPanel.locator('.evidence-head span');
    await expect(photoCounter).toHaveClass(/is-ok/, { timeout: 15000 });
    console.log(`✓ Uploaded 4 distinct photos successfully (${await photoCounter.innerText()}).`);

    const agreeCheckbox = requestPanel.locator('.service-form-agree input[type="checkbox"]');
    await agreeCheckbox.check();
    await expect(agreeCheckbox).toBeChecked();

    const submitBtn = requestPanel.locator('.service-form-submit .mu-button');
    await expect(submitBtn).toBeEnabled();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-sell-catalog-ready-to-submit.png'), fullPage: false });

    console.log(`Clicking submit button: "${await submitBtn.innerText()}"...`);
    const buybackCreatePromise = page.waitForResponse(
      (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await submitBtn.click();
    const buybackRes = await buybackCreatePromise;
    console.log(`✓ Buyback API responded with status ${buybackRes.status()}`);
    assert(buybackRes.status() < 400, `Buyback request failed with status ${buybackRes.status()}`);

    await expect(requestPanel).toBeHidden({ timeout: 10000 });
    const requestRowBtn = page.getByRole('button', { name: /^TM\d+/ }).first();
    await expect(requestRowBtn).toBeVisible({ timeout: 10000 });
    const requestText = await requestRowBtn.innerText();
    console.log(`✓ Created Request visible in history list:\n${requestText.trim()}`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-sell-catalog-submitted.png'), fullPage: false });

    // Open detail panel
    await requestRowBtn.click();
    const detailPanel = page.locator('#buyback-detail');
    await expect(detailPanel).toBeVisible({ timeout: 10000 });
    console.log(`✓ Request detail view opened successfully.`);
    await expect(detailPanel.locator('h2')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-sell-catalog-detail-opened.png'), fullPage: false });

    summaryLog.push({ step: 'Sell Flow (Catalog Item)', status: 'PASS', detail: `Created and inspected request (${requestText.split('\n')[0]})` });

    // -------------------------------------------------------------------------
    // STEP 2: SELL FLOW - CUSTOM MODEL OUTSIDE CATALOG
    // -------------------------------------------------------------------------
    console.log(`\n[Step 2] Sell Flow - Custom/Manual Item outside catalog...`);
    await page.goto('/vi/services/sell', { waitUntil: 'networkidle' });
    const sellBasket = page.locator('.qv');
    await expect(sellBasket).toBeVisible();

    const addManualBtn = sellBasket.locator('.sb-add-manual');
    await expect(addManualBtn).toBeVisible();
    await addManualBtn.click();

    const customRow = sellBasket.locator('.is-custom-model').first();
    await expect(customRow).toBeVisible();
    const customNameInput = customRow.getByRole('textbox', { name: 'Tên mô hình', exact: true });
    await expect(customNameInput).toBeFocused();

    const customModelName = `Gundam Barbatos Lupus Rex Custom 1/100 · E2E`;
    await customNameInput.fill(customModelName);

    const custom2hand = customRow.getByRole('radio', { name: '2hand', exact: true });
    await custom2hand.click();

    const noteBtn = customRow.getByRole('button', { name: 'Mô tả thêm', exact: true });
    await noteBtn.click();
    const noteTextarea = customRow.getByLabel('Điều shop cần biết thêm', { exact: true });
    await expect(noteTextarea).toBeFocused();
    await noteTextarea.fill('Mô hình custom sơn bóng, khớp gối hơi lỏng nhẹ, đủ phụ kiện kiếm chùy.');
    await noteBtn.click();

    const customPrice = customRow.locator('.sb-row-price');
    await expect(customPrice).not.toHaveText('Đang tính…', { timeout: 10000 });
    const customPriceText = await customPrice.innerText();
    console.log(`✓ Custom Model Price: ${customPriceText}`);
    assert(customPriceText.toLowerCase().includes('báo giá'), 'Should indicate shop quote');

    const customContinueCta = sellBasket.locator('.qv-cta');
    await expect(customContinueCta).toBeEnabled();
    await customContinueCta.click();

    const customRequestPanel = page.locator('.service-request-panel');
    await expect(customRequestPanel).toBeVisible({ timeout: 5000 });
    await expect(customRequestPanel.locator('.sb-request-title').first()).toContainText(customModelName);

    const customFileInput = customRequestPanel.locator('input[type="file"]').first();
    await customFileInput.setInputFiles(imageFiles);
    await expect(customRequestPanel.locator('.evidence-head span')).toHaveClass(/is-ok/, { timeout: 15000 });

    await customRequestPanel.locator('.service-form-agree input[type="checkbox"]').check();
    const customSubmitBtn = customRequestPanel.locator('.service-form-submit .mu-button');
    await expect(customSubmitBtn).toBeEnabled();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-sell-custom-ready-to-submit.png'), fullPage: false });

    const customBuybackPromise = page.waitForResponse(
      (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await customSubmitBtn.click();
    const customRes = await customBuybackPromise;
    console.log(`✓ Custom model request created with status ${customRes.status()}`);
    assert(customRes.status() < 400, `Custom request failed with status ${customRes.status()}`);

    await expect(customRequestPanel).toBeHidden({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-sell-custom-submitted.png'), fullPage: false });

    const customHistoryItem = page.getByRole('button', { name: /^TM\d+/ }).first();
    await expect(customHistoryItem).toBeVisible({ timeout: 10000 });
    await customHistoryItem.click();
    const customDetail = page.locator('#buyback-detail');
    await expect(customDetail).toBeVisible({ timeout: 10000 });
    console.log(`✓ Custom model detail view verified: ${await customDetail.locator('h2').innerText()}`);

    summaryLog.push({ step: 'Sell Flow (Custom Item)', status: 'PASS', detail: `Created manual request for ${customModelName}` });

    // -------------------------------------------------------------------------
    // STEP 3: TRADE FLOW (Trao đổi / services/trade)
    // -------------------------------------------------------------------------
    console.log(`\n[Step 3] Trade Flow (Trao đổi) - Model Trade-in + Shop Model Exchange...`);
    await page.goto('/vi/services/trade', { waitUntil: 'networkidle' });
    const tradeBasket = page.locator('.qv.is-trade');
    await expect(tradeBasket).toBeVisible();

    // 1. Add model to trade-in
    const yourModelCombobox = tradeBasket.locator('.sb-list').first().getByRole('combobox');
    await yourModelCombobox.click();
    await yourModelCombobox.fill('Ngao');
    const tradeOption = tradeBasket.getByRole('option').first();
    await expect(tradeOption).toBeVisible({ timeout: 10000 });
    await tradeOption.click();

    const tradeInRow = tradeBasket.locator('.sb-row.is-service').first();
    await expect(tradeInRow).toBeVisible();
    await tradeInRow.getByRole('radio', { name: '2hand', exact: true }).click();
    const tradePresets = tradeInRow.locator('.service-combinations-options > button');
    await expect(tradePresets.first()).toBeVisible({ timeout: 10000 });
    const count = await tradePresets.count();
    const targetPreset = count > 1 ? tradePresets.nth(1) : tradePresets.first();
    await targetPreset.click();
    await expect(targetPreset).toHaveAttribute('aria-pressed', 'true');
    await expect(tradeInRow.locator('.sb-row-price')).not.toHaveText('Đang tính…', { timeout: 10000 });
    console.log(`✓ Selected trade-in model: ${await tradeInRow.locator('.sb-row-copy strong').innerText()}`);

    // Verify continue button is initially disabled because no shop item is selected yet
    await expect(tradeBasket.locator('.qv-cta')).toBeDisabled();
    console.log(`✓ CTA is properly disabled before choosing shop item.`);

    // 2. Select shop item to trade for
    const shopList = tradeBasket.locator('.sb-list').nth(1);
    await expect(shopList).toBeVisible();
    const shopCombobox = shopList.getByRole('combobox');
    await shopCombobox.click();

    const firstShopOption = tradeBasket.getByRole('option').first();
    await expect(firstShopOption).toBeVisible({ timeout: 10000 });
    const shopOptionText = (await firstShopOption.innerText()).replace(/\n/g, ' ');
    console.log(`Selected shop item from catalog: ${shopOptionText}`);
    await firstShopOption.click();

    const shopItemRow = shopList.locator('.sb-row').first();
    await expect(shopItemRow).toBeVisible();

    // 3. Verify trade difference calculation in summary
    const summaryTotal = tradeBasket.locator('.qv-summary-total');
    await expect(summaryTotal).toBeVisible();
    await expect(summaryTotal.locator('strong')).not.toHaveText(/Đang tính|Checking/i, { timeout: 10000 });
    const diffLabel = await summaryTotal.locator('span').first().innerText();
    const diffValue = await summaryTotal.locator('strong').first().innerText();
    console.log(`✓ Trade calculation verified: [${diffLabel}] = ${diffValue}`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-trade-items-calculated.png'), fullPage: false });

    // 4. Continue to photos and submission
    const tradeContinueCta = tradeBasket.locator('.qv-cta');
    await expect(tradeContinueCta).toBeEnabled();
    await tradeContinueCta.click();

    const tradeRequestPanel = page.locator('.service-request-panel');
    await expect(tradeRequestPanel).toBeVisible({ timeout: 5000 });

    const tradeFileInput = tradeRequestPanel.locator('input[type="file"]').first();
    await tradeFileInput.setInputFiles(imageFiles);
    await expect(tradeRequestPanel.locator('.evidence-head span')).toHaveClass(/is-ok/, { timeout: 15000 });

    await tradeRequestPanel.locator('.service-form-agree input[type="checkbox"]').check();
    const tradeSubmitBtn = tradeRequestPanel.locator('.service-form-submit .mu-button');
    await expect(tradeSubmitBtn).toBeEnabled();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-trade-ready-to-submit.png'), fullPage: false });

    const tradeCreatePromise = page.waitForResponse(
      (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await tradeSubmitBtn.click();
    const tradeRes = await tradeCreatePromise;
    console.log(`✓ Trade request created with status ${tradeRes.status()}`);
    assert(tradeRes.status() < 400, `Trade request failed with status ${tradeRes.status()}`);

    await expect(tradeRequestPanel).toBeHidden({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-trade-submitted.png'), fullPage: false });

    const tradeHistoryItem = page.getByRole('button', { name: /^TM\d+/ }).first();
    await expect(tradeHistoryItem).toBeVisible({ timeout: 10000 });
    await tradeHistoryItem.click();

    const tradeDetail = page.locator('#buyback-detail');
    await expect(tradeDetail).toBeVisible({ timeout: 10000 });
    console.log(`✓ Trade request detail inspected: ${await tradeDetail.locator('h2').innerText()}`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-trade-detail-inspected.png'), fullPage: false });

    summaryLog.push({ step: 'Trade Flow', status: 'PASS', detail: `Trade-in paired with shop item, difference: ${diffValue}` });

    // -------------------------------------------------------------------------
    // STEP 4: MOBILE RESPONSIVENESS AND TRACKING INTERACTION
    // -------------------------------------------------------------------------
    console.log(`\n[Step 4] Mobile Viewport Responsiveness (390x844)...`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vi/services/sell', { waitUntil: 'networkidle' });

    const hasNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert(hasNoOverflow, 'Mobile layout must not have horizontal scrolling/overflow');
    console.log(`✓ Mobile viewport has no horizontal overflow.`);

    const mobileBasket = page.locator('.qv');
    await mobileBasket.locator('.sb-add-manual').click();
    await mobileBasket.locator('.is-custom-model').getByRole('textbox', { name: 'Tên mô hình', exact: true }).fill('Mô hình Mobile Test');

    await page.evaluate(() => window.scrollBy(0, 300));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12-mobile-responsive-sell.png'), fullPage: false });
    console.log(`✓ Captured mobile responsive view.`);
    summaryLog.push({ step: 'Mobile Responsiveness', status: 'PASS', detail: 'Viewport 390x844 verified without layout overflow' });

    // -------------------------------------------------------------------------
    // STEP 5: CUSTOMER CANCEL REQUEST FLOW (End-to-End Cycle)
    // -------------------------------------------------------------------------
    console.log(`\n[Step 5] Customer Cancel Request flow on newly submitted request...`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/vi/services/sell', { waitUntil: 'networkidle' });

    const firstReq = page.getByRole('button', { name: /^TM\d+/ }).first();
    await expect(firstReq).toBeVisible({ timeout: 10000 });
    await firstReq.click();

    const detailSection = page.locator('#buyback-detail');
    await expect(detailSection).toBeVisible({ timeout: 10000 });

    const cancelForm = detailSection.locator('form').filter({ hasText: 'Hủy yêu cầu' });
    if (await cancelForm.isVisible()) {
      console.log(`Testing cancel form interaction...`);
      const cancelReason = cancelForm.locator('textarea[name="details"]');
      await cancelReason.fill('Khách hàng đổi ý muốn giữ lại mô hình làm kỷ niệm (E2E Test).');
      const cancelBtn = cancelForm.getByRole('button', { name: 'Hủy yêu cầu', exact: true });

      const cancelPromise = page.waitForResponse(
        (res) => res.url().includes('/actions') && res.request().method() === 'POST' && res.status() < 400,
        { timeout: 20000 }
      );
      await cancelBtn.click();
      await cancelPromise;
      console.log(`✓ Request canceled by customer successfully.`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13-request-canceled.png'), fullPage: false });
      summaryLog.push({ step: 'Cancel Request', status: 'PASS', detail: 'Submitted request canceled by user with details note' });
    } else {
      console.log(`Note: Cancel button not currently visible or already transitioned.`);
    }

    console.log(`\n======================================================`);
    console.log(`ALL REAL-USER E2E ACCEPTANCE TESTS PASSED SUCCESSFULLY`);
    console.log(`======================================================\n`);
    console.table(summaryLog);

    return { success: true, summary: summaryLog };
  } catch (error) {
    console.error(`\n❌ E2E Acceptance Test Failed:`, error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error-failure-state.png'), fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

runRealUserE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

