import { test, expect, type Page, type Locator, type BrowserContext } from '@playwright/test';
import sharp from 'sharp';
import en from '../src/messages/en.json';

// Real browser mutations only, explicitly enabled on the isolated condition demo. API calls below only log in/read.
test.describe('service condition journeys', () => {
  test.skip(process.env.CONDITION_DEMO_E2E !== 'true', 'Requires the isolated condition demo.');
  test.setTimeout(480_000);
  test.use({ actionTimeout: 15000 });
  const b = en.buyback,
    qc = en.listingQc,
    basket = en.serviceBasket;
  const body = async (response: { json(): Promise<any> }) => {
    const json = await response.json();
    return json.data ?? json;
  };
  const login = async (context: BrowserContext, admin: boolean) => {
    const response = await context.request.post('/api/auth/login', {
      data: {
        email: `${admin ? 'admin' : 'customer'}@condition.demo`,
        password: process.env.CONDITION_DEMO_PASSWORD ?? 'Demo@2026!',
      },
    });
    expect(response.ok()).toBeTruthy();
    if (admin) expect((await body(await context.request.get('/api/admin/products/5'))).sku).toMatch(/^DEMO-COND-/);
  };
  const photos = async (suffix: string, count = 3) =>
    Promise.all(
      Array.from({ length: count }, async (_, index) => ({
        name: `DEMO-${suffix}-${index}.png`,
        mimeType: 'image/png',
        buffer: await sharp({
          create: { width: 320, height: 240, channels: 3, background: ['#5b42a3', '#478981', '#c29346'][index % 3] },
        })
          .png()
          .toBuffer(),
      })),
    );
  const dropdown = (page: Page, scope: Locator, label: string) =>
    scope.locator('.filter-multi').filter({
      has: page
        .locator('.mu-field')
        .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),
    });
  const choose = async (page: Page, scope: Locator, label: string, option: string) => {
    const field = dropdown(page, scope, label);
    await field.locator('.filter-multi-trigger').click();
    await field.getByRole('button', { name: option, exact: true }).click();
    await expect(field.locator('.filter-multi-trigger')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
  };
  const open = async (page: Page, id: number, admin: boolean, trade = false) => {
    await page.goto(admin ? '/en/admin/buyback' : `/en/services/${trade ? 'trade' : 'sell'}`);
    await page.getByRole('button', { name: new RegExp(`TM${id} ·`) }).click();
    await expect(page.locator('#buyback-detail')).toBeVisible();
    return page.locator('#buyback-detail');
  };
  const submit = async (page: Page, id: number, endpoint: string, button: Locator) => {
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/buyback/${id}/${endpoint}`),
    );
    await button.click();
    const saved = await response;
    const result = await body(saved);
    expect(saved.ok(), JSON.stringify(result)).toBeTruthy();
    return result;
  };
  const form = (scope: Locator, name: string) =>
    scope.locator('form').filter({ has: scope.page().getByRole('button', { name, exact: true }) });
  const quoteToStock = async (admin: Page, customer: Page, id: number, trade = false) => {
    let detail = await open(admin, id, true);
    const preliminary = form(detail, b.preliminaryOffer);
    await preliminary
      .locator('textarea[name=details]')
      .fill('DEMO browser: exact approved combination and preliminary appraisal.');
    await submit(admin, id, 'actions', preliminary.getByRole('button', { name: b.preliminaryOffer, exact: true }));
    detail = await open(customer, id, false, trade);
    const inbound = form(detail, b.sendItem);
    await inbound.locator('input[name=inboundReference]').fill(`DEMO-HANDOVER-${id}`);
    await submit(customer, id, 'actions', inbound.getByRole('button', { name: b.sendItem, exact: true }));
    detail = await open(admin, id, true);
    const receiving = form(detail, b.inspect);
    await receiving
      .locator('textarea[name=details]')
      .fill('DEMO physical handover verified; actual condition matches the declared combination.');
    await receiving.locator('input[name=handoverVerified]').check();
    await submit(admin, id, 'actions', receiving.getByRole('button', { name: b.inspect, exact: true }));
    const final = form(detail, b.finalOffer);
    await final.locator('input[type=file]').setInputFiles(await photos(`inspection-${id}`, 1));
    await final
      .locator('textarea[name=details]')
      .fill('DEMO inspection confirmed against the exact approved SKU; no second defect deduction.');
    await final.locator('input[name=conditionMatchesApproved]').check();
    await expect(final.getByRole('button', { name: b.finalOffer, exact: true })).toBeEnabled();
    let row = await submit(admin, id, 'actions', final.getByRole('button', { name: b.finalOffer, exact: true }));
    if (row.tradeQuote?.differenceVnd < 0) {
      await submit(
        admin,
        id,
        'actions',
        detail.getByRole('button', { name: /Approve.*refund|Approve.*pay|Approve.*back/i }),
      );
    }
    detail = await open(customer, id, false, trade);
    await submit(customer, id, 'actions', detail.getByRole('button', { name: b.accept, exact: true }));
    detail = await open(admin, id, true);
    const payout = form(detail, b.pay);
    await payout.locator('input[name=externalReference]').fill(`DEMO-BROWSER-SETTLE-${id}`);
    await payout
      .locator('textarea[name=details]')
      .fill('DEMO verified settlement only; no real payment or bank service.');
    await payout.locator('input[name=moneyVerified]').check();
    row = await submit(admin, id, 'payout', payout.getByRole('button', { name: b.pay, exact: true }));
    const productId = row.conditionCase.productId;
    const before = await body(await admin.request.get(`/api/admin/products/${productId}`));
    const quality = form(detail, qc.submit);
    const picker = quality.locator('input[placeholder]');
    await picker.fill(before.sku);
    await quality.getByRole('button', { name: new RegExp(`^${productId} -`) }).click();
    for (const check of await quality.locator('input[type=checkbox]:enabled').all()) await check.check();
    await quality
      .locator('textarea[name=details]')
      .fill('DEMO independent source QC and settlement checked for this request.');
    row = await submit(admin, id, 'qc', quality.getByRole('button', { name: qc.submit, exact: true }));
    expect(row.qcReview.result, JSON.stringify(row.qcReview)).toBe('passed');
    const intake = form(detail, qc.intake);
    await intake.locator('textarea[name=details]').fill('DEMO receive this inspected source into the exact SKU once.');
    await intake.locator('input[name=actualPhotosVerified]').check();
    row = await submit(admin, id, 'intake', intake.getByRole('button', { name: qc.intake, exact: true }));
    const after = await body(await admin.request.get(`/api/admin/products/${productId}`));
    expect(after.stock).toBe(before.stock + 1);
    expect(
      after.stockReceipts.filter(
        (receipt: { sourceType: string; sourceId: string }) =>
          receipt.sourceType === 'buyback' && receipt.sourceId === String(id),
      ),
    ).toHaveLength(1);
    if (row.listing.isArchived)
      await submit(admin, id, 'publish', detail.getByRole('button', { name: qc.publish, exact: true }));
    return productId;
  };

  test('cascades replace exclusive choices; the unknown combination never displays a zero quote', async ({
    page,
    context,
  }) => {
    await login(context, false);
    await page.goto('/en/services/sell?mau=5');
    const row = page.locator('.sb-row').first();
    await expect(row.locator('.service-combinations-options')).toBeVisible();
    await row.locator('.service-condition-custom > summary').click();
    await choose(page, row, 'Box', 'Damaged box');
    await choose(page, row, 'Damaged box · details (optional)', 'Dented box');
    await choose(page, row, 'Box', 'Missing box');
    await expect(row.locator('.condition-cascade.is-detail').filter({ hasText: 'Damaged box' })).toHaveCount(0);
    await expect(dropdown(page, row, 'Box').locator('.filter-multi-trigger')).toContainText('Missing box');
    await choose(page, row, 'Accessories', 'Missing accessories');
    await choose(page, row, 'Missing accessories · details (optional)', 'Missing shield');
    await row.locator('.service-condition-other > summary').click();
    await row
      .getByRole('textbox', { name: 'Other condition', exact: true })
      .fill('DEMO: an unlisted LED fault for individual inspection.');
    await expect(row.locator('.service-condition-notice')).toContainText('quote separately after receiving');
    await expect(page.locator('.qv-amount')).toHaveText(basket.afterQuote);
    await expect(row.locator('.condition-tree-picker')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath('condition-service-mobile.png'), fullPage: true });
  });

  test('multi-model sell, new combination/evidence approval, restock and trade complete by real clicks', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext(),
      customerContext = await browser.newContext();
    await login(adminContext, true);
    await login(customerContext, false);
    const admin = await adminContext.newPage(),
      customer = await customerContext.newPage();
    admin.setDefaultTimeout(15000);
    customer.setDefaultTimeout(15000);
    // Approve the simulated inbound policy through its actual Admin UI, in the disposable demo only.
    await admin.goto('/en/admin/commerce/policies');
    await admin.getByRole('tab', { name: /buy.?back/i }).click();
    const policies = await body(await admin.request.get('/api/admin/commerce/policies'));
    if (!policies.some((policy: { name: string }) => policy.name === 'buyback')) {
      await admin.locator('select[name=inboundCod]').selectOption('not_supported');
      await admin.locator('textarea[name=reason]').fill('DEMO UI journey only: simulated handover without COD.');
      await admin.locator('input[name=confirmApproval]').check();
      const approved = admin.waitForResponse(
        (r) => r.url().endsWith('/api/admin/commerce/policies/buyback/approve') && r.request().method() === 'POST',
      );
      await admin.locator('form').getByRole('button', { name: en.policy.approve, exact: true }).click();
      expect((await approved).ok()).toBeTruthy();
    }
    await customer.goto('/en/services/sell?mau=5');
    const addModel = async () => {
      await customer.getByRole('combobox', { name: basket.addAnother }).fill('CD-01');
      await customer.getByRole('option').first().click();
    };
    await expect(customer.locator('.sb-row')).toHaveCount(1);
    await addModel();
    await addModel();
    const rows = customer.locator('.sb-row');
    await expect(rows).toHaveCount(3);
    const unknown = rows.nth(2);
    await unknown.getByRole('radio', { name: '2hand', exact: true }).click();
    await unknown.locator('.service-condition-custom > summary').click();
    await choose(customer, unknown, 'Box', 'Missing box');
    await choose(customer, unknown, 'Accessories', 'Missing accessories');
    await choose(customer, unknown, 'Missing accessories · details (optional)', 'Missing shield');
    const nodes = await body(await customer.request.get('/api/product-condition-tree'));
    const source = await body(await admin.request.get('/api/admin/products/5'));
    const existing = await body(
      await customer.request.get(`/api/product-condition-tree/families/${source.modelFamilyId}/combinations`),
    );
    const node = (key: string) => nodes.find((item: { key: string }) => item.key === key);
    const base = [node('missing-box').id, node('missing-shield').id];
    const extras = ['missing-base', 'missing-hands', 'missing-manual', 'missing-decals'].map(node);
    let selectedExtras: any[] | undefined;
    for (let mask = 0; mask < 16; mask++) {
      const picked = extras.filter((_: unknown, index: number) => mask & (1 << index));
      const ids = [...base, ...picked.map((item: { id: number }) => item.id)].sort((a, b) => a - b).join(',');
      if (
        !existing.some(
          (item: { itemTypeKey: string; conditionNodeIds: number[] }) =>
            item.itemTypeKey === 'preowned' && [...item.conditionNodeIds].sort((a, b) => a - b).join(',') === ids,
        )
      ) {
        selectedExtras = picked;
        break;
      }
    }
    expect(selectedExtras, 'Use a fresh isolated demo if all fixture combinations have been exercised.').toBeDefined();
    for (const extra of selectedExtras!)
      await choose(customer, unknown, 'Missing accessories · details (optional)', extra.nameEn);
    const createBatch = async (count: number, kind: 'sell' | 'trade') => {
      const created: any[] = [];
      const collect = async (response: any) => {
        if (
          new URL(response.url()).pathname === '/api/buyback' &&
          response.request().method() === 'POST' &&
          response.ok()
        )
          created.push(await body(response));
      };
      customer.on('response', collect);
      await customer.locator('.qv-result').getByRole('button', { name: basket[kind].action, exact: true }).click();
      const sections = customer
        .locator('.service-request-panel .service-form-section')
        .filter({ has: customer.locator('.evidence-uploader') });
      for (let index = 0; index < count; index++) {
        await sections
          .nth(index)
          .locator('input[type=file]')
          .setInputFiles(await photos(`customer-${index}`));
        await expect(sections.nth(index).locator('.evidence-grid li')).toHaveCount(4);
      }
      await customer.locator('.service-form-agree input[type=checkbox]').check();
      await customer.locator('.service-form-submit button').click();
      await expect.poll(() => created.length).toBe(count);
      customer.off('response', collect);
      return created;
    };
    const created = await createBatch(3, 'sell');
    expect(created.map((row) => row.conditionCase.itemTypeKey)).toEqual(['preowned', 'new', 'preowned']);
    const pending = created[2];
    expect(pending.conditionCaseStatus).toBe('pending');
    let detail = await open(admin, pending.id, true);
    let panel = detail.locator('.service-condition-case');
    await panel
      .getByRole('textbox', { name: 'Review / evidence request / rejection reason' })
      .fill('DEMO need a close-up of the shield mounting point.');
    await submit(
      admin,
      pending.id,
      'condition-case',
      panel.getByRole('button', { name: 'Request evidence', exact: true }),
    );
    detail = await open(customer, pending.id, false);
    panel = detail.locator('.service-condition-case');
    await panel.locator('input[type=file]').setInputFiles(await photos('additional-shield', 1));
    await submit(
      customer,
      pending.id,
      'actions',
      panel.getByRole('button', { name: 'Send additional evidence', exact: true }),
    );
    detail = await open(admin, pending.id, true);
    panel = detail.locator('.service-condition-case');
    await panel.getByRole('spinbutton', { name: 'Real selling price S for the new combination' }).fill('650000');
    await panel
      .getByRole('textbox', { name: 'Review / evidence request / rejection reason' })
      .fill('DEMO mapped exact missing box and missing shield; approve this combination at its own S.');
    const approved = await submit(
      admin,
      pending.id,
      'condition-case',
      panel.getByRole('button', { name: 'Approve · stock 0', exact: true }),
    );
    expect((await body(await admin.request.get(`/api/admin/products/${approved.conditionCase.productId}`))).stock).toBe(
      0,
    );
    await quoteToStock(admin, customer, created[0].id);
    await quoteToStock(admin, customer, created[1].id);
    await quoteToStock(admin, customer, pending.id);
    // Cover all three settlement directions: customer pays, shop pays, and an even exchange.
    for (const scenario of [
      { incoming: 5, shop: 1, direction: 'customer_pays' },
      { incoming: 1, shop: 5, direction: 'shop_pays' },
      { incoming: 2, shop: 4, direction: 'even' },
    ]) {
      await customer.goto(`/en/services/trade?mau=${scenario.incoming}`);
      await customer.getByRole('combobox', { name: basket.addItem }).fill('CD-01');
      await customer.locator(`[role=option][id$="-option-${scenario.shop}"]`).click();
      const trade = (await createBatch(1, 'trade'))[0];
      expect(trade.tradeProductId).toBe(scenario.shop);
      const stockBefore = (await body(await admin.request.get(`/api/admin/products/${trade.tradeProductId}`))).stock;
      const receivedId = await quoteToStock(admin, customer, trade.id, true);
      const completed = await body(await admin.request.get(`/api/admin/buyback/${trade.id}`));
      expect(completed.tradeQuote.status).toBe('settled');
      if (scenario.direction === 'even') expect(completed.tradeQuote.differenceVnd).toBe(0);
      else expect(completed.payout.direction).toBe(scenario.direction);
      expect((await body(await admin.request.get(`/api/admin/products/${trade.tradeProductId}`))).stock).toBe(
        stockBefore - 1 + (receivedId === trade.tradeProductId ? 1 : 0),
      );
    }
    await admin.screenshot({ path: test.info().outputPath('completed-intake-admin.png'), fullPage: true });
    await adminContext.close();
    await customerContext.close();
  });

  test('rejecting an unsupported proposal and cancelling the request leave sellable stock unchanged', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext(),
      customerContext = await browser.newContext();
    await login(adminContext, true);
    await login(customerContext, false);
    const admin = await adminContext.newPage(),
      customer = await customerContext.newPage();
    admin.setDefaultTimeout(15000);
    customer.setDefaultTimeout(15000);
    const before = await body(await admin.request.get('/api/admin/products/5'));
    let detail = await open(admin, 1, true);
    const panel = detail.locator('.service-condition-case');
    await panel
      .getByRole('textbox', { name: 'Review / evidence request / rejection reason' })
      .fill('DEMO cannot verify the declared custom electronic fault; no stock intake is permitted.');
    const rejected = await submit(
      admin,
      1,
      'condition-case',
      panel.getByRole('button', { name: 'Reject', exact: true }),
    );
    expect(rejected.conditionCaseStatus).toBe('rejected');
    detail = await open(customer, 1, false);
    const cancellation = form(detail, b.cancelRequest);
    await cancellation
      .locator('textarea[name=details]')
      .fill('DEMO customer cancels the unsupported proposal before sending the item.');
    const cancelled = await submit(
      customer,
      1,
      'actions',
      cancellation.getByRole('button', { name: b.cancelRequest, exact: true }),
    );
    expect(cancelled.status).toBe('cancelled');
    const after = await body(await admin.request.get('/api/admin/products/5'));
    expect(after.stock).toBe(before.stock);
    expect(after.stockReceipts.length).toBe(before.stockReceipts.length);
    await adminContext.close();
    await customerContext.close();
  });
});
