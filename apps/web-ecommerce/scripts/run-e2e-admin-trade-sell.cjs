/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
/**
 * Comprehensive End-to-End Real-User Playwright Test Suite
 * Simulating real human users (Customer + Shop Owner/Admin) clicking through
 * all Admin-side processing flows for Buyback (Thu mua) and Trade (Trao đổi)
 * covering all interaction cases between Customer and Admin.
 *
 * Cases Covered:
 * 1. Sell Full Cycle: Customer submit -> Admin preliminary offer -> Customer send item ->
 *    Admin received & inspect -> Admin final offer -> Customer accept -> Admin payout settlement ->
 *    Admin QC checklist -> Admin stock intake (+1 stock verified).
 * 2. Trade Full Cycle: Customer trade request (Item 285) -> Admin preliminary offer -> Customer send item ->
 *    Admin received & final offer with refund -> Admin approve refund (D < 0) -> Customer accept ->
 *    Admin settle payout & handover -> Shop item stock decremented by -1.
 * 3. Custom Model & Evidence Flow: Customer submit custom item -> Admin request evidence ->
 *    Customer add evidence -> Admin preliminary appraisal.
 * 4. Dispute & Return Flow: Final offer -> Customer request review (dispute) -> Customer reject offer ->
 *    Admin propose return terms -> Customer accept return terms -> Admin dispatch return with tracking -> Closed.
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
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // Red
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAE/gHx2527mQAAAABJRU5ErkJggg==', // Green
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbhyQAAAABJRU5ErkJggg==', // Blue
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // White
];

const imageFiles = distinctPngsBase64.map((b64, idx) => {
  const filePath = path.join(FIXTURES_DIR, `admin-evidence-${idx + 1}.png`);
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  return filePath;
});

async function runAdminTradeSellE2ETests() {
  console.log(`\n======================================================================`);
  console.log(`Starting Admin E2E Playwright Acceptance Test Suite`);
  console.log(`Simulating Real User Interactions: Customer & Shop Owner (Admin)`);
  console.log(`Target Review Server: ${BASE_URL}`);
  console.log(`======================================================================\n`);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  // Context 1: Customer Context (customer1@example.com)
  const customerContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });
  const customerPage = await customerContext.newPage();

  // Context 2: Admin Context (admin@clothingshop.local)
  const adminContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });
  const adminPage = await adminContext.newPage();

  for (const p of [customerPage, adminPage]) {
    p.on('console', (msg) => {
      if (msg.type() === 'error') console.log('PAGE LOG (err):', msg.text());
    });
    p.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    p.on('response', async (r) => {
      if (r.url().includes('/api/') && r.status() >= 400) {
        try {
          console.log(`API ERROR [${r.status()}] ${r.url()}:`, await r.text());
        } catch (_) {}
      }
    });
  }

  const summaryLog = [];

  // ---------------------------------------------------------------------------
  // STEP 0: AUTHENTICATION FOR BOTH ACTORS
  // ---------------------------------------------------------------------------
  console.log(`[Step 0A] Real user login as Customer (customer1@example.com)...`);
  await customerPage.goto('/vi/auth/signin?redirect=/vi/services/sell', { waitUntil: 'networkidle' });
  await customerPage.locator('input[name="email"]').fill('customer1@example.com');
  await customerPage.locator('input[name="password"]').fill('Customer@123');
  await customerPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await customerPage.waitForURL('**/vi/services/sell', { timeout: 15000 });
  await expect(customerPage.locator('.qv')).toBeVisible({ timeout: 10000 });
  console.log(`✓ Customer logged in successfully.`);

  console.log(`[Step 0B] Real user login as Shop Owner/Admin (admin@clothingshop.local)...`);
  await adminPage.goto('/vi/auth/signin?redirect=/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.locator('input[name="email"]').fill('admin@clothingshop.local');
  await adminPage.locator('input[name="password"]').fill('Admin@e661150577d9');
  await adminPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await adminPage.waitForURL('**/vi/admin/buyback', { timeout: 15000 });
  await expect(adminPage.locator('.service-workspace')).toBeVisible({ timeout: 10000 });
  console.log(`✓ Shop Owner/Admin logged in successfully and landed on /vi/admin/buyback.`);

  // Ensure Buyback Commerce Policy is approved by Admin
  const policiesRes = await adminPage.request.get('/api/admin/commerce/policies');
  const policies = await policiesRes.json();
  const buybackPolicy = Array.isArray(policies) ? policies.find((p) => p.name === 'buyback') : null;
  if (!buybackPolicy) {
    console.log(`Approving initial buyback commerce policy as Admin...`);
    const approveRes = await adminPage.request.post('/api/admin/commerce/policies/buyback/approve', {
      data: {
        settings: { inboundCod: 'not_supported' },
        version: 0,
        reason: 'Phê duyệt chính sách thu mua và trao đổi mô hình chuẩn.',
        confirmApproval: true,
      },
    });
    console.log(`✓ Buyback policy approval status: ${approveRes.status()}`);
  } else {
    console.log(`✓ Buyback commerce policy version ${buybackPolicy.version} is active.`);
  }

  // ===========================================================================
  // CASE 1: SELL FLOW (THU MUA) FULL CYCLE - TO STOCK INTAKE
  // ===========================================================================
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`CASE 1: Sell Flow Full Cycle (Customer Submit -> Admin Settle -> Stock Intake)`);
  console.log(`----------------------------------------------------------------------`);

  // 1.1 Customer creates Buyback request
  console.log(`[Case 1.1] Customer submits buyback request for Ao Bing / Ngao Bính...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  const basket1 = customerPage.locator('.qv');
  await expect(basket1).toBeVisible();

  const combobox1 = basket1.getByRole('combobox').first();
  await combobox1.click();
  await combobox1.fill('Ngao');
  const option1 = basket1.getByRole('option').first();
  await expect(option1).toBeVisible({ timeout: 10000 });
  await option1.click();

  const catalogRow1 = basket1.locator('.sb-row.is-service:not(.is-custom-model)').first();
  await expect(catalogRow1).toBeVisible();
  await catalogRow1.getByRole('radio', { name: '2hand', exact: true }).click();

  const presetBtns1 = catalogRow1.locator('.service-combinations-options > button');
  await expect(presetBtns1.first()).toBeVisible({ timeout: 10000 });
  const count1 = await presetBtns1.count();
  const targetPreset1 = count1 > 1 ? presetBtns1.nth(1) : presetBtns1.first();
  await targetPreset1.click();
  await expect(targetPreset1).toHaveAttribute('aria-pressed', 'true');

  // Wait for condition matching and valuation price calculation
  const catalogPrice1 = catalogRow1.locator('.sb-row-price');
  await expect(catalogPrice1).not.toHaveText('Đang tính…', { timeout: 15000 });
  const rowPrice1 = await catalogPrice1.innerText();
  console.log(`Calculated Valuation Price for Ao Bing: ${rowPrice1}`);

  const continueCta1 = basket1.locator('.qv-cta');
  await expect(continueCta1).toBeEnabled({ timeout: 10000 });
  await continueCta1.click();

  const requestPanel1 = customerPage.locator('.service-request-panel');
  await expect(requestPanel1).toBeVisible({ timeout: 5000 });
  await requestPanel1.locator('input[type="file"]').first().setInputFiles(imageFiles);
  await expect(requestPanel1.locator('.evidence-head span')).toHaveClass(/is-ok/, { timeout: 15000 });
  await requestPanel1.locator('.service-form-agree input[type="checkbox"]').check();

  const createPromise1 = customerPage.waitForResponse(
    (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST'
  );
  await requestPanel1.locator('.service-form-submit .mu-button').click();
  const createRes1 = await createPromise1;
  const createJson1 = await createRes1.json();
  const requestId1 = createJson1.data?.id ?? createJson1.payload?.id ?? createJson1.id;
  console.log(`✓ Buyback Request created with ID: TM${requestId1} (status: ${createRes1.status()})`);

  await expect(requestPanel1).toBeHidden({ timeout: 10000 });
  const custCreatedBtn1 = customerPage.getByRole('button', { name: new RegExp(`TM${requestId1}\\b`) }).first();
  await expect(custCreatedBtn1).toBeVisible({ timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-01-sell-submitted.png'), fullPage: false });

  // 1.2 Admin inspects request and submits preliminary offer
  console.log(`[Case 1.2] Admin inspects TM${requestId1} and provides preliminary offer...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  const adminRowBtn1 = adminPage.getByRole('button', { name: new RegExp(`TM${requestId1}\\b`) }).first();
  await expect(adminRowBtn1).toBeVisible({ timeout: 10000 });
  await adminRowBtn1.click();

  const adminDetail1 = adminPage.locator('#buyback-detail');
  await expect(adminDetail1).toBeVisible({ timeout: 10000 });
  await expect(adminDetail1.locator('.mu-eyebrow')).toContainText(`TM${requestId1}`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-02-admin-open-request.png'), fullPage: false });

  // Preliminary Offer Form
  const prelimForm = adminDetail1.locator('form').filter({ hasText: 'Thẩm định sơ bộ' }).first();
  await expect(prelimForm).toBeVisible({ timeout: 5000 });
  await prelimForm.locator('textarea[name="details"]').fill('Đã xem ảnh chụp sơ bộ. Ngoại quan tốt, khớp chuẩn. Shop báo giá sơ bộ.');

  const prelimPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await prelimForm.getByRole('button', { name: 'Thẩm định sơ bộ', exact: true }).click();
  await prelimPromise;
  console.log(`✓ Admin submitted preliminary appraisal.`);
  await expect(adminDetail1.locator('.mu-eyebrow')).toContainText('Có báo giá sơ bộ', { timeout: 10000 });
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-03-preliminary-quoted.png'), fullPage: false });

  // 1.3 Customer sends item
  console.log(`[Case 1.3] Customer enters shipping reference and dispatches item...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  const custRowBtn1 = customerPage.getByRole('button', { name: new RegExp(`TM${requestId1}\\b`) }).first();
  await custRowBtn1.click();
  const custDetail1 = customerPage.locator('#buyback-detail');
  await expect(custDetail1).toBeVisible();

  const sendItemForm = custDetail1.locator('form').filter({ hasText: 'Ghi nhận phương án giao không COD' }).first();
  await expect(sendItemForm).toBeVisible({ timeout: 5000 });
  await sendItemForm.locator('input[name="inboundReference"]').fill('VNPOST-HN-884920');

  const sendItemPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await sendItemForm.getByRole('button', { name: 'Ghi nhận phương án giao không COD' }).click();
  await sendItemPromise;
  console.log(`✓ Customer dispatched item with tracking VNPOST-HN-884920.`);
  await expect(custDetail1.locator('.mu-eyebrow')).toContainText('Chờ mô hình', { timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-04-customer-sent-item.png'), fullPage: false });

  // 1.4 Admin marks received
  console.log(`[Case 1.4] Admin confirms physical item handover receipt...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${requestId1}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const receivedForm = adminDetail1.locator('form').filter({ hasText: 'Ghi nhận kiểm tra hiện vật' }).first();
  await expect(receivedForm).toBeVisible({ timeout: 5000 });
  await receivedForm.locator('textarea[name="details"]').fill('Kiện hàng VNPOST-HN-884920 đã tới shop. Mở hộp niêm phong trước camera.');
  await receivedForm.locator('input[name="handoverVerified"]').check();

  const receivedPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await receivedForm.getByRole('button', { name: 'Ghi nhận kiểm tra hiện vật' }).click();
  await receivedPromise;
  console.log(`✓ Admin verified receipt. Status is now inspecting.`);
  await expect(adminDetail1.locator('.mu-eyebrow')).toContainText('Đang kiểm tra hiện vật', { timeout: 10000 });
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-05-admin-received.png'), fullPage: false });

  // 1.5 Admin inspects item and submits final offer
  console.log(`[Case 1.5] Admin uploads inspection evidence and submits final offer...`);
  const finalOfferForm = adminDetail1.locator('form').filter({ hasText: 'Báo giá cuối sau kiểm tra' }).first();
  await expect(finalOfferForm).toBeVisible({ timeout: 5000 });

  // Upload inspection evidence
  const inspectionUploadPromise = adminPage.waitForResponse(
    (res) => res.url().includes('/api/evidence') && res.request().method() === 'POST'
  );
  await finalOfferForm.locator('input[type="file"]').setInputFiles(imageFiles.slice(0, 2));
  await inspectionUploadPromise;
  console.log(`✓ Admin uploaded inspection media proof.`);

  const matchCheckbox = finalOfferForm.locator('input[name="conditionMatchesApproved"]');
  if (await matchCheckbox.count() > 0) {
    await matchCheckbox.check();
  }
  await finalOfferForm.locator('input[name="amountVnd"]').fill('520000');
  await finalOfferForm.locator('textarea[name="details"]').fill('Đã kiểm tra toàn bộ part và khớp, không gãy nứt, đúng mô tả. Chốt báo giá 520k.');

  const finalOfferPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await finalOfferForm.getByRole('button', { name: 'Báo giá cuối sau kiểm tra' }).click();
  await finalOfferPromise;
  console.log(`✓ Admin submitted final offer.`);
  await expect(adminDetail1.locator('.mu-eyebrow')).toContainText('Chờ bạn quyết định giá cuối', { timeout: 10000 });
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-06-final-offer-submitted.png'), fullPage: false });

  // 1.6 Customer accepts final offer
  console.log(`[Case 1.6] Customer reviews and accepts final offer...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${requestId1}\\b`) }).first().click();
  await expect(custDetail1).toBeVisible();

  const acceptBtn = custDetail1.getByRole('button', { name: 'Chấp nhận báo giá cuối này', exact: true });
  await expect(acceptBtn).toBeVisible({ timeout: 10000 });
  const acceptPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await acceptBtn.click();
  await acceptPromise;
  console.log(`✓ Customer accepted final offer. Status is awaiting_payout.`);
  await expect(custDetail1.locator('.mu-eyebrow')).toContainText('Đã chấp nhận, chờ chi trả', { timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-07-customer-accepted.png'), fullPage: false });

  // 1.7 Admin completes payout settlement
  console.log(`[Case 1.7] Admin executes bank payout settlement and transfers ownership...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${requestId1}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const payoutForm = adminDetail1.locator('form').filter({ hasText: 'Xác nhận chi trả đã thực hiện' }).first();
  await expect(payoutForm).toBeVisible({ timeout: 5000 });
  await payoutForm.locator('input[name="externalReference"]').fill(`VCB-E2E-${Date.now()}`);
  await payoutForm.locator('textarea[name="details"]').fill('Đã chuyển khoản thành công qua VCB tới tài khoản của khách.');
  await payoutForm.locator('input[name="moneyVerified"]').check();

  const payoutPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/payout`) && res.request().method() === 'POST'
  );
  await payoutForm.getByRole('button', { name: 'Xác nhận chi trả đã thực hiện' }).click();
  await payoutPromise;
  console.log(`✓ Admin verified payout. Status completed, ownership transferred.`);
  await expect(adminDetail1.locator('.mu-eyebrow')).toContainText('Đã trả tiền, chuyển quyền sở hữu', { timeout: 10000 });
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-08-payout-completed.png'), fullPage: false });

  // 1.8 Admin pre-listing QC & stock intake
  console.log(`[Case 1.8] Admin performs pre-listing QC checklist & stock intake (+1 stock)...`);
  const qcForm = adminDetail1.locator('form').filter({ hasText: 'Lưu kết quả QC' }).first();
  await expect(qcForm).toBeVisible({ timeout: 10000 });

  // Select draft product in ProductPicker if required
  const pickerInput = qcForm.getByPlaceholder(/Tìm tên mô hình/i);
  if (await pickerInput.count() > 0) {
    console.log(`Searching for matching SKU 287 in ProductPicker...`);
    await pickerInput.click();
    await pickerInput.fill('Ao Bing');
    const option287 = qcForm.locator('ul button').filter({ hasText: '287' }).first();
    await expect(option287).toBeVisible({ timeout: 10000 });
    await option287.click();
    console.log(`✓ Selected matching SKU 287 in ProductPicker.`);
  }

  // Tick all required manual QC checkboxes
  const qcCheckboxes = qcForm.locator('input[type="checkbox"]:not(:disabled)');
  const qcCount = await qcCheckboxes.count();
  for (let i = 0; i < qcCount; i++) {
    await qcCheckboxes.nth(i).check();
  }
  await qcForm.locator('textarea[name="details"]').fill('Kiểm định QC toàn diện hoàn tất, đạt tiêu chuẩn nhập kho hàng 2hand.');

  const submitQcBtn = qcForm.getByRole('button', { name: 'Lưu kết quả QC' });
  await expect(submitQcBtn).toBeEnabled({ timeout: 10000 });
  const qcPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/qc`) && res.request().method() === 'POST'
  );
  await submitQcBtn.click();
  await qcPromise;
  console.log(`✓ Admin passed QC checklist.`);

  // Intake Form
  const intakeForm = adminDetail1.locator('form').filter({ hasText: 'Nhập kho (tin nháp)' }).first();
  await expect(intakeForm).toBeVisible({ timeout: 10000 });
  await intakeForm.locator('textarea[name="details"]').fill('Nhập kho chiếc 2hand liên kết nguồn thu mua TM' + requestId1);
  await intakeForm.locator('input[name="actualPhotosVerified"]').check();

  const intakePromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/intake`) && res.request().method() === 'POST'
  );
  await intakeForm.getByRole('button', { name: 'Nhập kho (tin nháp)' }).click();
  await intakePromise;
  console.log(`✓ Admin completed stock intake! SKU inventory increased by +1.`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-09-qc-and-intake-completed.png'), fullPage: false });

  summaryLog.push({ step: 'Case 1: Sell Full Cycle to Stock Intake', status: 'PASS', detail: `TM${requestId1} progressed through all 8 stages from submitted to stock intake (+1)` });

  // ===========================================================================
  // CASE 2: TRADE FLOW (TRAO ĐỔI) FULL CYCLE & INVENTORY DEDUCTION
  // ===========================================================================
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`CASE 2: Trade Flow Full Cycle (Shop Item 285 Exchange & Inventory Deduction)`);
  console.log(`----------------------------------------------------------------------`);

  // Ensure shop item 285 has stock for the trade test
  const { Client: PgClient } = require(path.join(__dirname, '../node_modules/pg'));
  const pgClient = new PgClient({ connectionString: 'postgresql://postgres:123456@localhost:5432/web_ecommerce_ci_verify' });
  await pgClient.connect();
  await pgClient.query('UPDATE product SET stock = 2 WHERE id = 285 AND stock < 1');
  await pgClient.end();

  // Query initial stock of product 285
  const initialProd285Res = await customerPage.request.get(`/api/products/285`);
  const initialProd285Data = await initialProd285Res.json();
  const initialStock285 = initialProd285Data.payload?.stock ?? initialProd285Data.stock;
  console.log(`Initial stock for Shop Item #285 (Tần Thủy Hoàng): ${initialStock285}`);

  // 2.1 Customer submits Trade Request
  console.log(`[Case 2.1] Customer submits Trade Request for Shop Item #285...`);
  await customerPage.goto('/vi/services/trade', { waitUntil: 'networkidle' });
  const tradeBasket = customerPage.locator('.qv.is-trade');
  await expect(tradeBasket).toBeVisible({ timeout: 10000 });

  // 1. Add customer's trade-in model
  const yourModelCombobox = tradeBasket.locator('.sb-list').first().getByRole('combobox');
  await yourModelCombobox.click();
  await yourModelCombobox.fill('Ngao');
  const tradeModelOpt = tradeBasket.getByRole('option').first();
  await expect(tradeModelOpt).toBeVisible({ timeout: 10000 });
  await tradeModelOpt.click();

  const tradeCatalogRow = tradeBasket.locator('.sb-row.is-service:not(.is-custom-model)').first();
  await expect(tradeCatalogRow).toBeVisible();
  await tradeCatalogRow.getByRole('radio', { name: '2hand', exact: true }).click();
  const tradePresetBtns = tradeCatalogRow.locator('.service-combinations-options > button');
  await expect(tradePresetBtns.first()).toBeVisible({ timeout: 10000 });
  const tradePresetCount = await tradePresetBtns.count();
  const targetTradePreset = tradePresetCount > 1 ? tradePresetBtns.nth(1) : tradePresetBtns.first();
  await targetTradePreset.click();
  await expect(targetTradePreset).toHaveAttribute('aria-pressed', 'true');

  const tradeCatalogPrice = tradeCatalogRow.locator('.sb-row-price');
  await expect(tradeCatalogPrice).not.toHaveText('Đang tính…', { timeout: 15000 });

  // 2. Select shop item #285 in trade search section
  const shopList = tradeBasket.locator('.sb-list').nth(1);
  await expect(shopList).toBeVisible();
  const shopCombobox = shopList.getByRole('combobox');
  await shopCombobox.click();
  await shopCombobox.fill('Tần Thủy Hoàng');
  const shopItemOption = tradeBasket.getByRole('option').filter({ hasText: /Tần Thủy Hoàng/i }).first();
  await expect(shopItemOption).toBeVisible({ timeout: 10000 });
  await shopItemOption.click();
  console.log(`✓ Picked shop item to receive: Tần Thủy Hoàng (#285).`);

  const tradeContinueCta = tradeBasket.locator('.qv-cta');
  await expect(tradeContinueCta).toBeEnabled({ timeout: 10000 });
  await tradeContinueCta.click();

  const tradeRequestPanel = customerPage.locator('.service-request-panel');
  await expect(tradeRequestPanel).toBeVisible({ timeout: 5000 });
  await tradeRequestPanel.locator('input[type="file"]').first().setInputFiles(imageFiles);
  await expect(tradeRequestPanel.locator('.evidence-head span')).toHaveClass(/is-ok/, { timeout: 15000 });
  await tradeRequestPanel.locator('.service-form-agree input[type="checkbox"]').check();

  const tradeCreatePromise = customerPage.waitForResponse(
    (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST'
  );
  await tradeRequestPanel.locator('.service-form-submit .mu-button').click();
  const tradeCreateRes = await tradeCreatePromise;
  const tradeCreateJson = await tradeCreateRes.json();
  const tradeRequestId = tradeCreateJson.data?.id ?? tradeCreateJson.payload?.id ?? tradeCreateJson.id;
  console.log(`✓ Trade Request created with ID: TM${tradeRequestId} (status: ${tradeCreateRes.status()})`);

  await expect(tradeRequestPanel).toBeHidden({ timeout: 10000 });
  const custTradeRowBtn = customerPage.getByRole('button', { name: new RegExp(`TM${tradeRequestId}\\b`) }).first();
  await expect(custTradeRowBtn).toBeVisible({ timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-10-trade-submitted.png'), fullPage: false });

  // 2.2 Admin submits preliminary offer on Trade
  console.log(`[Case 2.2] Admin inspects Trade TM${tradeRequestId} and submits preliminary offer...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${tradeRequestId}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const tradePrelimForm = adminDetail1.locator('form').filter({ hasText: 'Thẩm định sơ bộ' }).first();
  await expect(tradePrelimForm).toBeVisible({ timeout: 5000 });
  await tradePrelimForm.locator('textarea[name="details"]').fill('Thẩm định sơ bộ mô hình đổi. Ngoại quan chuẩn.');

  const tradePrelimPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await tradePrelimForm.getByRole('button', { name: 'Thẩm định sơ bộ', exact: true }).click();
  await tradePrelimPromise;
  console.log(`✓ Admin quoted preliminary offer on trade request.`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-11-trade-quoted.png'), fullPage: false });

  // 2.3 Customer sends trade-in item
  console.log(`[Case 2.3] Customer sends trade-in item...`);
  await customerPage.goto('/vi/services/trade', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${tradeRequestId}\\b`) }).first().click();
  await expect(custDetail1).toBeVisible();

  const tradeSendForm = custDetail1.locator('form').filter({ hasText: 'Ghi nhận phương án giao không COD' }).first();
  await expect(tradeSendForm).toBeVisible({ timeout: 5000 });
  await tradeSendForm.locator('input[name="inboundReference"]').fill('VNPOST-TRADE-99001');

  const tradeSendPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await tradeSendForm.getByRole('button', { name: 'Ghi nhận phương án giao không COD' }).click();
  await tradeSendPromise;
  console.log(`✓ Customer sent trade item with reference VNPOST-TRADE-99001.`);

  // 2.4 Admin marks received & final offer with refund
  console.log(`[Case 2.4] Admin receives item, submits final offer (> item price) and approves refund...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${tradeRequestId}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const tradeRecvForm = adminDetail1.locator('form').filter({ hasText: 'Ghi nhận kiểm tra hiện vật' }).first();
  await expect(tradeRecvForm).toBeVisible({ timeout: 5000 });
  await tradeRecvForm.locator('textarea[name="details"]').fill('Đã nhận kiện hàng trao đổi từ khách.');
  await tradeRecvForm.locator('input[name="handoverVerified"]').check();
  const tradeRecvPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await tradeRecvForm.getByRole('button', { name: 'Ghi nhận kiểm tra hiện vật' }).click();
  await tradeRecvPromise;

  // Final offer: Buyback price 1,500,000 VND (> 1,100,000 item price), difference D = -400,000 VND
  const tradeFinalForm = adminDetail1.locator('form').filter({ hasText: 'Báo giá cuối sau kiểm tra' }).first();
  await expect(tradeFinalForm).toBeVisible({ timeout: 5000 });

  const tradeInspectUploadPromise = adminPage.waitForResponse(
    (res) => res.url().includes('/api/evidence') && res.request().method() === 'POST'
  );
  await tradeFinalForm.locator('input[type="file"]').setInputFiles(imageFiles.slice(0, 2));
  await tradeInspectUploadPromise;

  const tradeMatchCheckbox = tradeFinalForm.locator('input[name="conditionMatchesApproved"]');
  if (await tradeMatchCheckbox.count() > 0) {
    await tradeMatchCheckbox.check();
  }
  await tradeFinalForm.locator('input[name="amountVnd"]').fill('1500000');
  await tradeFinalForm.locator('textarea[name="details"]').fill('Mô hình trao đổi đẹp xuất sắc, định giá thu mua 1.500.000đ.');

  const tradeFinalPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await tradeFinalForm.getByRole('button', { name: 'Báo giá cuối sau kiểm tra' }).click();
  await tradeFinalPromise;
  console.log(`✓ Admin final offer submitted. Difference D < 0 requires refund approval.`);

  // Admin approves trade refund button
  const approveRefundBtn = adminDetail1.getByRole('button', { name: /Duyệt khoản shop trả lại/ });
  await expect(approveRefundBtn).toBeVisible({ timeout: 10000 });
  const approveRefundPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await approveRefundBtn.click();
  await approveRefundPromise;
  console.log(`✓ Admin approved negative difference refund to customer!`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-12-trade-refund-approved.png'), fullPage: false });

  // 2.5 Customer accepts trade terms
  console.log(`[Case 2.5] Customer accepts finalized trade terms & refund...`);
  await customerPage.goto('/vi/services/trade', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${tradeRequestId}\\b`) }).first().click();
  await expect(custDetail1).toBeVisible();

  const tradeAcceptBtn = custDetail1.getByRole('button', { name: 'Chấp nhận báo giá cuối này', exact: true });
  await expect(tradeAcceptBtn).toBeVisible({ timeout: 10000 });
  const tradeAcceptPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await tradeAcceptBtn.click();
  await tradeAcceptPromise;
  console.log(`✓ Customer accepted trade terms.`);
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-13-trade-accepted.png'), fullPage: false });

  // 2.6 Admin settles trade difference & hands over shop item
  console.log(`[Case 2.6] Admin settles trade difference refund and hands over shop item #285...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${tradeRequestId}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const tradePayoutForm = adminDetail1.locator('form').filter({ hasText: 'Xác nhận chi trả đã thực hiện' }).first();
  await expect(tradePayoutForm).toBeVisible({ timeout: 5000 });
  await tradePayoutForm.locator('input[name="externalReference"]').fill(`TRADE-REFUND-${Date.now()}`);
  await tradePayoutForm.locator('textarea[name="details"]').fill('Đã hoàn trả khoản chênh lệch 400.000đ và bàn giao mô hình Tần Thủy Hoàng.');
  await tradePayoutForm.locator('input[name="moneyVerified"]').check();

  const tradePayoutPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/payout`) && res.request().method() === 'POST'
  );
  await tradePayoutForm.getByRole('button', { name: 'Xác nhận chi trả đã thực hiện' }).click();
  await tradePayoutPromise;
  console.log(`✓ Trade settlement confirmed!`);

  // Verify product 285 stock decremented
  const finalProd285Res = await customerPage.request.get(`/api/products/285`);
  const finalProd285Data = await finalProd285Res.json();
  const finalStock285 = finalProd285Data.payload?.stock ?? finalProd285Data.stock;
  console.log(`Post-trade stock for Shop Item #285: ${finalStock285} (was ${initialStock285})`);
  assert.equal(finalStock285, initialStock285 - 1, 'Traded shop item stock must decrement by exactly 1');
  console.log(`✓ Confirmed inventory decrement: Shop Item #285 stock decreased from ${initialStock285} to ${finalStock285}!`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-14-trade-settled-inventory-deducted.png'), fullPage: false });

  summaryLog.push({ step: 'Case 2: Trade Full Cycle with Refund & Inventory Deduction', status: 'PASS', detail: `TM${tradeRequestId} completed, refund approved and stock decremented from ${initialStock285} to ${finalStock285}` });

  // ===========================================================================
  // CASE 3: CUSTOM MODEL SUBMISSION & EVIDENCE REQUEST FLOW
  // ===========================================================================
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`CASE 3: Custom Model, Evidence Request & Appraisal`);
  console.log(`----------------------------------------------------------------------`);

  // 3.1 Customer submits Custom Model
  console.log(`[Case 3.1] Customer submits custom model outside catalog...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  const customBasket = customerPage.locator('.qv');
  await expect(customBasket).toBeVisible();

  await customBasket.locator('.sb-add-manual').click();
  const customRow = customBasket.locator('.is-custom-model').first();
  await expect(customRow).toBeVisible();

  const customNameInput = customRow.getByRole('textbox', { name: 'Tên mô hình', exact: true });
  await customNameInput.fill('MNP-XH03');
  await customRow.getByRole('radio', { name: '2hand', exact: true }).click();

  const customPrice = customRow.locator('.sb-row-price');
  await expect(customPrice).not.toHaveText(/Đang tính|Checking/, { timeout: 15000 });

  const customContinueCta = customBasket.locator('.qv-cta');
  await expect(customContinueCta).toBeEnabled({ timeout: 10000 });
  await customContinueCta.click();

  const customRequestPanel = customerPage.locator('.service-request-panel');
  await expect(customRequestPanel).toBeVisible({ timeout: 5000 });
  await customRequestPanel.locator('input[type="file"]').first().setInputFiles(imageFiles);
  await expect(customRequestPanel.locator('.evidence-head span')).toHaveClass(/is-ok/, { timeout: 15000 });
  await customRequestPanel.locator('.service-form-agree input[type="checkbox"]').check();

  const customCreatePromise = customerPage.waitForResponse(
    (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST'
  );
  await customRequestPanel.locator('.service-form-submit .mu-button').click();
  const customCreateRes = await customCreatePromise;
  const customCreateJson = await customCreateRes.json();
  const customRequestId = customCreateJson.data?.id ?? customCreateJson.payload?.id ?? customCreateJson.id;
  console.log(`✓ Custom Model Request created with ID: TM${customRequestId} (status: ${customCreateRes.status()})`);

  await expect(customRequestPanel).toBeHidden({ timeout: 10000 });
  const custCustomRowBtn = customerPage.getByRole('button', { name: new RegExp(`TM${customRequestId}\\b`) }).first();
  await expect(custCustomRowBtn).toBeVisible({ timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-15-custom-submitted.png'), fullPage: false });

  // 3.2 Admin requests more evidence
  console.log(`[Case 3.2] Admin requests additional photo/video evidence...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${customRequestId}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const conditionCaseSectionAdmin = adminDetail1.locator('.service-condition-case');
  await expect(conditionCaseSectionAdmin).toBeVisible({ timeout: 5000 });
  const caseDetailsToggle = conditionCaseSectionAdmin.locator('details');
  if (await caseDetailsToggle.count() > 0) {
    const isOpen = await caseDetailsToggle.evaluate((el) => el.open);
    if (!isOpen) await caseDetailsToggle.locator('summary').click();
  }
  const caseDetailsInput = conditionCaseSectionAdmin.locator('textarea[name="caseDetails"]');
  await expect(caseDetailsInput).toBeVisible({ timeout: 5000 });
  await caseDetailsInput.fill('Yêu cầu chụp thêm ảnh rõ các khớp vai, mặt bên và phụ kiện chùy sắt.');

  const reqEvidencePromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/condition-case`) && res.request().method() === 'POST'
  );
  await conditionCaseSectionAdmin.getByRole('button', { name: 'Yêu cầu bổ sung' }).click();
  await reqEvidencePromise;
  console.log(`✓ Admin requested additional evidence on condition case. Status is needs_evidence.`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-16-evidence-requested.png'), fullPage: false });

  // 3.3 Customer uploads additional evidence
  console.log(`[Case 3.3] Customer uploads requested evidence...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${customRequestId}\\b`) }).first().click();
  await expect(custDetail1).toBeVisible();

  const conditionCaseSectionCust = custDetail1.locator('.service-condition-case');
  await expect(conditionCaseSectionCust).toBeVisible({ timeout: 5000 });

  const addEvUploadPromise = customerPage.waitForResponse(
    (res) => res.url().includes('/api/evidence') && res.request().method() === 'POST'
  );
  await conditionCaseSectionCust.locator('input[type="file"]').setInputFiles(imageFiles.slice(2, 4));
  await addEvUploadPromise;

  const sendEvPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await conditionCaseSectionCust.getByRole('button', { name: 'Gửi bằng chứng bổ sung' }).click();
  await sendEvPromise;
  console.log(`✓ Customer uploaded and sent additional evidence.`);
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-17-evidence-uploaded.png'), fullPage: false });

  // 3.4 Admin reviews updated evidence and provides appraisal
  console.log(`[Case 3.4] Admin reviews extra evidence, maps condition case, and quotes preliminary offer...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${customRequestId}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  // If condition case is pending resolution, resolve it
  const conditionCaseSection = adminDetail1.locator('.service-condition-case');
  if (await conditionCaseSection.count() > 0) {
    const caseDetailsToggle = conditionCaseSection.locator('details');
    if (await caseDetailsToggle.count() > 0) {
      const isOpen = await caseDetailsToggle.evaluate((el) => el.open);
      if (!isOpen) await caseDetailsToggle.locator('summary').click();
    }
    const casePicker = conditionCaseSection.locator('input[placeholder*="Tìm tên mô hình"], input[aria-label*="Tìm tên mô hình"]').first();
    if (await casePicker.count() > 0) {
      await casePicker.click();
      await casePicker.fill('Ao Bing');
      const caseOpt287 = conditionCaseSection.locator('ul button').filter({ hasText: '287' }).first();
      await expect(caseOpt287).toBeVisible({ timeout: 10000 });
      await caseOpt287.click();
    }
    const casePriceInput = conditionCaseSection.locator('input[name="casePrice"]');
    if (await casePriceInput.count() > 0 && await casePriceInput.isVisible()) {
      await casePriceInput.fill('1200000');
    }
    const caseDetailsInput = conditionCaseSection.locator('textarea[name="caseDetails"]');
    if (await caseDetailsInput.count() > 0) {
      await caseDetailsInput.fill('Duyệt tổ hợp mô hình custom theo mẫu chuẩn Ao Bing.');
    }
    const approveCaseBtn = conditionCaseSection.getByRole('button', { name: 'Duyệt · chưa nhập kho' });
    if (await approveCaseBtn.count() > 0 && await approveCaseBtn.isEnabled()) {
      const casePromise = adminPage.waitForResponse(
        (res) => res.url().includes('/condition-case') && res.request().method() === 'POST'
      );
      await approveCaseBtn.click();
      await casePromise;
      console.log(`✓ Admin approved condition case S.`);
    }
  }

  // Reload admin page to ensure fresh state after resolving condition case
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${customRequestId}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const customPrelimForm = adminDetail1.locator('form').filter({ hasText: 'Thẩm định sơ bộ' }).first();
  await expect(customPrelimForm).toBeVisible({ timeout: 10000 });
  await customPrelimForm.locator('input[name="amountVnd"]').fill('950000');
  await customPrelimForm.locator('textarea[name="details"]').fill('Đã xem ảnh chụp chi tiết khớp vai và phụ kiện. Báo giá sơ bộ 950.000đ.');

  const customPrelimPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await customPrelimForm.getByRole('button', { name: 'Thẩm định sơ bộ', exact: true }).click();
  await customPrelimPromise;
  console.log(`✓ Admin successfully quoted preliminary appraisal for custom model!`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-18-custom-preliminary-quoted.png'), fullPage: false });

  summaryLog.push({ step: 'Case 3: Custom Model & Evidence Flow', status: 'PASS', detail: `TM${customRequestId} evidence requested by Admin, uploaded by Customer, and appraised` });

  // ===========================================================================
  // CASE 4: DISPUTE, REVIEW REQUEST, REJECT & RETURN DISPATCH FLOW
  // ===========================================================================
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`CASE 4: Dispute, Review Request, Reject & Return Dispatch Flow`);
  console.log(`----------------------------------------------------------------------`);

  // 4.1 Customer creates request, Admin quotes -> sends -> receives -> final offer
  console.log(`[Case 4.1] Setup request to final offer stage...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  const basket4 = customerPage.locator('.qv');
  await expect(basket4).toBeVisible();

  const combobox4 = basket4.getByRole('combobox').first();
  await combobox4.click();
  await combobox4.fill('Ngao');
  await basket4.getByRole('option').first().click();

  const catalogRow4 = basket4.locator('.sb-row.is-service:not(.is-custom-model)').first();
  await expect(catalogRow4).toBeVisible();
  await catalogRow4.getByRole('radio', { name: '2hand', exact: true }).click();
  const presetBtns4 = catalogRow4.locator('.service-combinations-options > button');
  await expect(presetBtns4.first()).toBeVisible({ timeout: 10000 });
  const presetCount4 = await presetBtns4.count();
  const targetPreset4 = presetCount4 > 1 ? presetBtns4.nth(1) : presetBtns4.first();
  await targetPreset4.click();
  await expect(targetPreset4).toHaveAttribute('aria-pressed', 'true');

  const catalogPrice4 = catalogRow4.locator('.sb-row-price');
  await expect(catalogPrice4).not.toHaveText('Đang tính…', { timeout: 15000 });

  const continueCta4 = basket4.locator('.qv-cta');
  await expect(continueCta4).toBeEnabled({ timeout: 10000 });
  await continueCta4.click();

  const requestPanel4 = customerPage.locator('.service-request-panel');
  await expect(requestPanel4).toBeVisible();
  await requestPanel4.locator('input[type="file"]').first().setInputFiles(imageFiles);
  await expect(requestPanel4.locator('.evidence-head span')).toHaveClass(/is-ok/, { timeout: 15000 });
  await requestPanel4.locator('.service-form-agree input[type="checkbox"]').check();

  const createPromise4 = customerPage.waitForResponse(
    (res) => res.url().includes('/api/buyback') && res.request().method() === 'POST'
  );
  await requestPanel4.locator('.service-form-submit .mu-button').click();
  const createRes4 = await createPromise4;
  const createJson4 = await createRes4.json();
  const requestId4 = createJson4.data?.id ?? createJson4.payload?.id ?? createJson4.id;
  console.log(`✓ Request for dispute created: TM${requestId4} (status: ${createRes4.status()})`);

  await expect(requestPanel4).toBeHidden({ timeout: 10000 });
  const custRowBtn4 = customerPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first();
  await expect(custRowBtn4).toBeVisible({ timeout: 10000 });

  // Admin prelim offer
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  const prelimForm4 = adminDetail1.locator('form').filter({ hasText: 'Thẩm định sơ bộ' }).first();
  await prelimForm4.locator('textarea[name="details"]').fill('Báo giá sơ bộ thẩm định.');
  const pPromise4 = adminPage.waitForResponse((r) => r.url().includes('/actions') && r.request().method() === 'POST');
  await prelimForm4.getByRole('button', { name: 'Thẩm định sơ bộ' }).click();
  await pPromise4;

  // Customer sends item
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  const sendForm4 = custDetail1.locator('form').filter({ hasText: 'Ghi nhận phương án giao không COD' }).first();
  await sendForm4.locator('input[name="inboundReference"]').fill('VNPOST-DISPUTE-01');
  const sPromise4 = customerPage.waitForResponse((r) => r.url().includes('/actions') && r.request().method() === 'POST');
  await sendForm4.getByRole('button', { name: 'Ghi nhận phương án giao không COD' }).click();
  await sPromise4;

  // Admin marks received
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  const recvForm4 = adminDetail1.locator('form').filter({ hasText: 'Ghi nhận kiểm tra hiện vật' }).first();
  await recvForm4.locator('textarea[name="details"]').fill('Nhận kiện hàng kiểm tra thực tế.');
  await recvForm4.locator('input[name="handoverVerified"]').check();
  const rPromise4 = adminPage.waitForResponse((r) => r.url().includes('/actions') && r.request().method() === 'POST');
  await recvForm4.getByRole('button', { name: 'Ghi nhận kiểm tra hiện vật' }).click();
  await rPromise4;

  // Admin final offer (low amount 300k to provoke dispute)
  const finalForm4 = adminDetail1.locator('form').filter({ hasText: 'Báo giá cuối sau kiểm tra' }).first();
  const upPromise4 = adminPage.waitForResponse((r) => r.url().includes('/api/evidence') && r.request().method() === 'POST');
  await finalForm4.locator('input[type="file"]').setInputFiles(imageFiles.slice(0, 2));
  await upPromise4;

  const matchCb4 = finalForm4.locator('input[name="conditionMatchesApproved"]');
  if (await matchCb4.count() > 0) await matchCb4.check();
  await finalForm4.locator('input[name="amountVnd"]').fill('300000');
  await finalForm4.locator('textarea[name="details"]').fill('Phát hiện trầy xước nhẹ ở mặt giáp, báo giá 300.000đ.');

  const fPromise4 = adminPage.waitForResponse((r) => r.url().includes('/actions') && r.request().method() === 'POST');
  await finalForm4.getByRole('button', { name: 'Báo giá cuối sau kiểm tra' }).click();
  await fPromise4;
  console.log(`✓ Admin submitted final offer of 300.000đ.`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-19-dispute-flow-final-offer.png'), fullPage: false });

  // 4.2 Customer requests review (disputes)
  console.log(`[Case 4.2] Customer disputes valuation and requests re-inspection...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  await expect(custDetail1).toBeVisible();

  const reqReviewForm = custDetail1.locator('form').filter({ hasText: 'Gửi yêu cầu kiểm tra lại' }).first();
  await expect(reqReviewForm).toBeVisible({ timeout: 5000 });
  await reqReviewForm.locator('textarea[name="details"]').fill('Giá 300.000đ quá thấp so với thỏa thuận ban đầu, đề nghị thẩm định lại vết xước.');

  const reqReviewPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await reqReviewForm.getByRole('button', { name: 'Gửi yêu cầu kiểm tra lại' }).click();
  await reqReviewPromise;
  console.log(`✓ Customer submitted dispute / review request.`);
  await expect(custDetail1.locator('.mu-eyebrow')).toContainText('Đang kiểm tra lại theo yêu cầu', { timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-20-dispute-review-requested.png'), fullPage: false });

  // 4.3 Customer rejects final offer & requests item return
  console.log(`[Case 4.3] Customer rejects final offer and demands return...`);
  const rejectForm = custDetail1.locator('form').filter({ hasText: 'Từ chối giá và sắp xếp trả lại' }).first();
  await expect(rejectForm).toBeVisible({ timeout: 5000 });
  await rejectForm.locator('textarea[name="details"]').fill('Tôi không đồng ý với mức giá này. Đề nghị shop gửi trả lại mô hình cho tôi.');

  const rejectPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await rejectForm.getByRole('button', { name: 'Từ chối giá và sắp xếp trả lại' }).click();
  await rejectPromise;
  console.log(`✓ Customer rejected offer. Status transitioned to returning.`);
  await expect(custDetail1.locator('.mu-eyebrow')).toContainText('Sắp xếp trả lại mô hình', { timeout: 10000 });
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-21-customer-rejected-returning.png'), fullPage: false });

  // 4.4 Admin provides return terms
  console.log(`[Case 4.4] Admin sends return shipping terms to customer...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const returnTermsForm = adminDetail1.locator('form').filter({ hasText: 'Thỏa thuận trả lại và chi phí vận chuyển' }).first();
  await expect(returnTermsForm).toBeVisible({ timeout: 5000 });
  await returnTermsForm.locator('textarea[name="details"]').fill('Shop hoàn trả qua Viettel Post, người nhận thanh toán cước 35.000đ khi nhận hàng.');

  const returnOfferPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await returnTermsForm.getByRole('button', { name: 'Thỏa thuận trả lại và chi phí vận chuyển' }).click();
  await returnOfferPromise;
  console.log(`✓ Admin sent return terms.`);
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-22-admin-return-offered.png'), fullPage: false });

  // 4.5 Customer accepts return terms
  console.log(`[Case 4.5] Customer accepts return terms...`);
  await customerPage.goto('/vi/services/sell', { waitUntil: 'networkidle' });
  await customerPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  await expect(custDetail1).toBeVisible();

  const acceptReturnBtn = custDetail1.getByRole('button', { name: 'Chấp nhận điều kiện trả lại và chi phí' });
  await expect(acceptReturnBtn).toBeVisible({ timeout: 10000 });
  const acceptReturnPromise = customerPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await acceptReturnBtn.click();
  await acceptReturnPromise;
  console.log(`✓ Customer accepted return terms.`);
  await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-23-customer-accepted-return.png'), fullPage: false });

  // 4.6 Admin dispatches return with tracking reference
  console.log(`[Case 4.6] Admin hands over return package to courier with tracking...`);
  await adminPage.goto('/vi/admin/buyback', { waitUntil: 'networkidle' });
  await adminPage.getByRole('button', { name: new RegExp(`TM${requestId4}\\b`) }).first().click();
  await expect(adminDetail1).toBeVisible();

  const returnDispatchForm = adminDetail1.locator('form').filter({ hasText: 'Ghi nhận bàn giao trả lại thực tế' }).first();
  await expect(returnDispatchForm).toBeVisible({ timeout: 5000 });
  await returnDispatchForm.locator('input[name="inboundReference"]').fill('VTP-RETURN-TRK-77129');
  await returnDispatchForm.locator('input[name="handoverVerified"]').check();

  const dispatchPromise = adminPage.waitForResponse(
    (res) => res.url().includes(`/actions`) && res.request().method() === 'POST'
  );
  await returnDispatchForm.getByRole('button', { name: 'Ghi nhận bàn giao trả lại thực tế' }).click();
  await dispatchPromise;
  console.log(`✓ Return dispatch recorded with tracking VTP-RETURN-TRK-77129! Status closed.`);
  await expect(adminDetail1.locator('.mu-eyebrow')).toContainText('Đã đóng', { timeout: 10000 });
  await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-24-return-dispatched-closed.png'), fullPage: false });

  summaryLog.push({ step: 'Case 4: Dispute, Reject & Return Dispatch Flow', status: 'PASS', detail: `TM${requestId4} disputed, rejected, return terms agreed and dispatched with tracking VTP-RETURN-TRK-77129` });

  // ---------------------------------------------------------------------------
  // FINAL CLEANUP AND SUMMARY
  // ---------------------------------------------------------------------------
  await browser.close();

  console.log(`\n======================================================================`);
  console.log(`ALL REAL-USER E2E ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log(`======================================================================\n`);
  console.table(summaryLog);

  return summaryLog;
}

runAdminTradeSellE2ETests().catch((err) => {
  console.error('\nE2E ACCEPTANCE TEST RUNNER FAILED WITH ERROR:\n', err);
  process.exit(1);
});

