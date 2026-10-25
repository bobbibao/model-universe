import { test, expect, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { signSessionToken } from '../src/shared/server/utils/JwtUtils';
import type { ProductDetail } from '../src/shared/types/product';
import vi from '../src/messages/vi.json';
import en from '../src/messages/en.json';

// UI mutations are intercepted. Only the public catalog is read from the local stack.
const previewUrl = process.env.E2E_BASE_URL || 'http://localhost:6050';
const localPreview = /^http:\/\/(localhost|127\.0\.0\.1):605[03]$/.test(previewUrl);
let model: ProductDetail;
test.beforeAll(async ({ request }) => {
  test.skip(!localPreview, 'This fixture suite runs only against the local development stack.');
  loadEnvConfig(process.cwd());
  const catalog = await (await request.get('/api/products?per_page=1&inStock=true')).json();
  expect(catalog.payload.data.length, 'Requires one existing public model; never seeds the shop').toBeGreaterThan(0);
  model = await (await request.get(`/api/products/${catalog.payload.data[0].id}`)).json();
});

async function fixture(page: Page, admin = false, complex = false, partnerId: number | null = null, soldOut = false) {
  const product = {
    ...model,
    partnerId,
    stock: 3,
    groupStock: 3,
    condition: 'new',
    imageUrl: '/images/store/product-placeholder.svg',
    images: ['/images/store/product-placeholder.svg', '/images/store/product-placeholder.svg'],
    conditionOptions: [
      {
        ...model,
        partnerId,
        id: model.id,
        isMain: true,
        stock: 3,
        condition: 'new',
        imageUrl: '/images/store/product-placeholder.svg',
        images: [] as string[],
        missingAccessories: [] as string[],
        defects: [] as string[],
        includedAccessories: [] as string[],
      },
    ],
    isArchived: false,
    inventoryStatus: 'available',
    importPrice: 500000,
  };
  if (complex) {
    product.name = `${model.name} — Collector Edition with alternate armor and extended accessories`;
    product.descriptionVi = product.descriptionEn = 'MODEL-LONG-CONTENT\n' + 'Detailed model information. '.repeat(500);
    product.conditionOptions.push({
      ...product.conditionOptions[0],
      id: model.id + 900000,
      isMain: false,
      condition: 'defective',
      sku: 'UI-DAMAGED-UNIT',
      stock: 2,
      defects: ['Cracked armor'],
      missingAccessories: ['Missing stand'],
      conditionNote: 'Inspect the damaged armor before purchase.',
      price: 450000,
      salePrice: 400000,
      discountPercent: 11,
      images: ['/images/store/product-placeholder.svg?angle=2'],
    });
  }
  if (soldOut) {
    product.stock = 0;
    product.groupStock = 0;
    product.conditionOptions.forEach((unit) => (unit.stock = 0));
  }
  const requests: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== 'GET' && path !== '/api/admin/agent/server/threads/search') requests.push(path);
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          user: admin
            ? { id: 900001, role: 'ADMIN', firstName: 'UI', lastName: 'Preview', email: 'ui@example.test' }
            : null,
        },
      });
    if (path === '/api/products/filters')
      return route.fulfill({
        json: { brands: [model.brandName], scales: [model.scale || '1/100'], priceRange: { min: 0, max: 10000000 } },
      });
    if (path === '/api/categories' || path === '/api/admin/categories') return route.fulfill({ json: [] });
    if (path === '/api/products' || path === '/api/admin/products') {
      const rows =
        url.searchParams.get('q') === 'no-match'
          ? []
          : complex && admin
            ? Array.from({ length: 10 }, (_, index) => ({
                ...product,
                id: product.id + index,
                sku: `UI-ROW-${index}`,
                name: `${product.name} ${index + 1}`,
              }))
            : [product];
      return route.fulfill({
        json: {
          payload: {
            data: rows,
            pagination: {
              total: rows.length,
              page: 1,
              perPage: 12,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
        },
      });
    }
    if (
      path === `/api/products/${model.slug}` ||
      path === `/api/products/${model.id}` ||
      path === `/api/admin/products/${model.id}`
    )
      return route.fulfill({ json: product });
    if (path.includes('/reviews'))
      return route.fulfill({ json: { payload: { data: [], pagination: { total: 0, page: 1, totalPages: 1 } } } });
    if (path === '/api/admin/products/stats')
      return route.fulfill({
        json: {
          totals: {
            stock: 36,
            listings: 12,
            names: 12,
            options: 0,
            unitsInStock: 12,
            unitsOutOfStock: 0,
            brands: 1,
            costValue: 18000000,
            memberValue: 21600000,
            listValue: 24000000,
            marginValue: 3600000,
            averageDaysInStock: 12,
            missingCost: 0,
          },
          brands: [],
          conditions: [],
        },
      });
    if (path === '/api/vouchers/evaluate')
      return route.fulfill({ json: { options: [], best: null, bestFreeship: null } });
    if (path === '/api/vouchers') return route.fulfill({ json: { vouchers: [], monthly: null } });
    if (path === '/api/cart/quote')
      return route.fulfill({ json: { lines: [], itemCount: 0, subtotal: 0, hasIssues: false } });
    // Every other endpoint stays inside the fixture, including accidental writes.
    return route.fulfill({ json: [] });
  });
  return requests;
}

async function capture(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow').toBe(
    true,
  );
  await page.screenshot({ path: `../../.artifacts/model-universe/commerce-experience/${name}.png` });
}

for (const locale of ['vi', 'en'] as const) {
  for (const width of [1440, 390]) {
    test(`${locale} ${width}: direct sales select exact units, require real receipts and keep retry identity`, async ({
      page,
      context,
    }) => {
      await fixture(page, true);
      const m = (locale === 'vi' ? vi : en).directSales;
      await context.addCookies([
        { name: 'access_token', value: await signSessionToken(900001, 'ADMIN'), url: previewUrl, httpOnly: true },
      ]);
      await page.addInitScript(
        (theme) => localStorage.setItem('color-theme', JSON.stringify(theme)),
        width === 1440 ? 'light' : 'dark',
      );
      await page.setViewportSize({ width, height: 1000 });
      const payloads: Record<string, unknown>[] = [];
      let salePrice = 1100000;
      await page.route('**/api/admin/orders/direct-sale**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/products'))
          return route.fulfill({
            json: [
              {
                id: 801001,
                name: 'MG Gundam Ver.3.0',
                sku: 'TEST-2HAND',
                condition: 'preowned',
                conditionNote: 'Inspected, original box',
                stock: 1,
                salePrice,
                imageUrl: '/images/store/product-placeholder.svg',
              },
            ],
          });
        if (path.endsWith('/customers'))
          return route.fulfill({
            json: [{ id: 801002, name: 'Test Collector', phone: '0901234567', email: 'collector@example.test' }],
          });
        payloads.push(route.request().postDataJSON());
        return route.fulfill({ status: 409, json: { statusCode: 409, userMessages: ['Fixture retry test'] } });
      });
      await page.goto(`/${locale}/admin/orders/new`);
      const form = page.getByRole('form', { name: m.title });
      await expect(form.getByRole('button', { name: m.complete })).toBeDisabled();
      await form
        .getByRole('button', {
          name: m.addProduct.replace('{name}', 'MG Gundam Ver.3.0').replace('{sku}', 'TEST-2HAND'),
        })
        .click();
      await expect(form.locator('input[name="quantity-801001"]')).toHaveAttribute('max', '1');
      await expect(
        form.getByRole('button', {
          name: m.addProduct.replace('{name}', 'MG Gundam Ver.3.0').replace('{sku}', 'TEST-2HAND'),
        }),
      ).toBeDisabled();
      await form.locator('input[name="externalReference"]').fill('CASH-UI-00001');
      await form.locator('input[name="moneyVerified"]').check();
      await capture(page, `direct-sale-${locale}-${width}`);
      await form.getByRole('button', { name: m.complete }).click();
      await expect(form.getByRole('alert')).toHaveText(m.failed);
      expect(payloads[0]).toMatchObject({
        customerId: null,
        payment: 'CASH',
        expectedTotal: 1100000,
        moneyVerified: true,
        items: [{ productId: 801001, quantity: 1 }],
      });
      await form.getByRole('button', { name: m.complete }).click();
      await expect.poll(() => payloads.length).toBe(2);
      expect(payloads[1].requestKey).toBe(payloads[0].requestKey);
      salePrice = 1200000;
      await form.getByRole('button', { name: m.refresh, exact: true }).click();
      await expect(form.locator('.direct-sale-total strong')).toContainText(
        locale === 'vi' ? '1.200.000' : '1,200,000',
      );
      await expect(form.locator('input[name="moneyVerified"]')).not.toBeChecked();
      await form.locator('select[name="fulfillment"]').selectOption('DELIVERY');
      await form.locator('select[name="payment"]').selectOption('UNPAID');
      await expect(form.locator('input[name="externalReference"]')).toHaveCount(0);
      await expect(form.locator('input[name="address"]')).toHaveAttribute('required', '');
      await form.locator('input[name="customerSearch"]').fill('collector');
      await form.getByRole('button', { name: /Test Collector/ }).click();
      await expect(form.locator('input[name="recipientName"]')).toHaveValue('Test Collector');
      await expect(form.locator('input[name="phone"]')).toHaveValue('0901234567');
      await form.locator('input[name="address"]').fill('12 Fixture Road');
      await form.locator('input[name="city"]').fill('HCM');
      await form.getByRole('button', { name: m.create }).click();
      await expect.poll(() => payloads.length).toBe(3);
      expect(payloads[2]).toMatchObject({
        customerId: 801002,
        expectedTotal: 1200000,
        fulfillment: 'DELIVERY',
        payment: 'UNPAID',
        moneyVerified: false,
        externalReference: '',
      });
      expect(payloads[2].requestKey).not.toBe(payloads[0].requestKey);
      await capture(page, `direct-sale-delivery-${locale}-${width}`);
    });
  }
}

async function conditionFixture(page: Page, admin = false) {
  const writes = await fixture(page, admin);
  const options = (['new', 'preowned', 'incomplete', 'defective'] as const).map((condition, index) => ({
    ...model,
    id: index === 0 ? model.id : model.id + 900000 + index,
    isMain: index === 0,
    condition,
    conditionNote: index === 0 ? null : `Inspected ${condition} unit. ${'Check the included photos. '.repeat(5)}`,
    missingAccessories: condition === 'incomplete' ? ['Missing display stand'] : [],
    defects: condition === 'defective' ? ['Cracked shoulder armor'] : [],
    includedAccessories: ['Manual', 'Original box'],
    stock: [8, 1, 0, 1][index],
    price: [1650000, 1100000, 750000, 600000][index],
    salePrice: [1650000, 1100000, 750000, 600000][index],
    importPrice: 500000,
    discountPercent: 0,
    sku: `UI-${condition.toUpperCase()}`,
    imageUrl: model.imageUrl,
    images: [],
    isArchived: false,
    inventoryStatus: 'available',
  }));
  const units = [...options, { ...options[1], id: model.id + 990000, sku: 'UI-ARCHIVED', isArchived: true, stock: 99 }];
  const product = {
    ...model,
    ...options[0],
    reviewCount: 0,
    rating: 0,
    groupStock: 10,
    conditionOptions: options,
    units,
    conditions: options.map((unit) => ({
      condition: unit.condition,
      stock: unit.stock,
      units: 1,
      minSalePrice: unit.salePrice,
    })),
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      path === `/api/products/${model.slug}` ||
      path === `/api/products/${model.id}` ||
      path === `/api/admin/products/${model.id}`
    )
      return route.fulfill({ json: product });
    if (path === '/api/admin/products')
      return route.fulfill({
        json: { payload: { data: [product], pagination: { total: 1, page: 1, totalPages: 1 } } },
      });
    const unit = units.find((item) => path === `/api/admin/products/${item.id}`);
    if (unit)
      return route.fulfill({
        json: {
          ...product,
          ...unit,
          parentProductId: model.id,
          listing: { id: model.id, name: model.name, sku: options[0].sku },
        },
      });
    return route.fallback();
  });
  return { writes, options, product };
}

for (const locale of ['vi', 'en'] as const) {
  test(`${locale}: shared field IDs preserve password recovery focus without sending email`, async ({ page }) => {
    await fixture(page);
    await page.route('**/api/auth/forgot-password', (route) => route.fulfill({ json: {} }));
    await page.goto(`/${locale}/auth/forgot-password`);
    const email = page.getByRole('textbox', { name: 'Email', exact: true });
    await email.fill('ui-preview@example.test');
    await page.locator('form button[type="submit"]').click();
    await page
      .getByRole('button', { name: locale === 'vi' ? 'Dùng email khác' : 'Use another email', exact: true })
      .click();
    await expect(email).toBeFocused();
    await expect(email).toHaveValue('ui-preview@example.test');
  });
}

for (const locale of ['vi', 'en'] as const)
  for (const width of [1440, 390]) {
    const m = locale === 'vi' ? vi : en;
    test(`${locale} ${width}: inventory inputs keep units, errors, save locks and independent metadata`, async ({
      page,
      context,
    }) => {
      const { product } = await conditionFixture(page, true);
      await page.addInitScript(
        (theme) => localStorage.setItem('color-theme', JSON.stringify(theme)),
        width === 1440 ? 'light' : 'dark',
      );
      await context.addCookies([
        { name: 'access_token', value: await signSessionToken(900001, 'ADMIN'), url: previewUrl, httpOnly: true },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${locale}/admin/products/${model.id}`);
      const editor = page.locator('.compact-admin-editor');
      await editor.getByRole('tab', { name: m.adminProducts.inventory, exact: true }).click();
      await expect(editor.locator('.product-form-section legend')).toHaveText([
        m.adminProducts.fieldGuide.stockIdentity,
        m.adminProducts.packaging.title,
        m.adminProducts.fieldGuide.displayMetadata,
      ]);
      const stock = editor.locator('input[name="stock"]');
      const length = editor.locator('input[name="packLengthCm"]');
      await expect(stock).toHaveAttribute('type', 'number');
      await expect(stock).toHaveCSS('background-color', width === 1440 ? 'rgb(255, 255, 255)' : 'rgb(32, 26, 48)');
      const receivedDate = editor.locator('input[name="productionDate"]');
      await receivedDate.fill('2026-02-30');
      await editor.getByRole('button', { name: m.adminProducts.save, exact: true }).click();
      await expect(receivedDate).toHaveAttribute('aria-invalid', 'true');
      await expect(receivedDate).toBeFocused();
      await receivedDate.fill('2024-02-29');
      await stock.fill('-2');
      await editor.getByRole('button', { name: m.adminProducts.save, exact: true }).click();
      await expect(stock).toHaveValue('-2');
      await expect(stock).toHaveAttribute('aria-invalid', 'true');
      await expect(stock).toHaveCSS('border-color', width === 1440 ? 'rgb(187, 53, 82)' : 'rgb(253, 164, 175)');
      await expect(stock).toBeFocused();
      await stock.fill('2');
      for (const name of ['packLengthCm', 'packWidthCm', 'packHeightCm', 'packWeightGram'])
        await editor.locator(`input[name="${name}"]`).fill('');
      await expect(editor.locator('.product-form-check input').first()).toBeDisabled();
      await length.fill('30.5');
      await expect(editor.locator('.product-form-check input').first()).toBeEnabled();
      await editor.getByRole('button', { name: m.adminProducts.save, exact: true }).click();
      await expect(length).toHaveValue('30.5');
      await expect(length).toHaveAttribute('aria-invalid', 'true');
      await expect(length).toBeFocused();
      expect(
        await length.evaluate((el) =>
          el
            .getAttribute('aria-describedby')
            ?.split(' ')
            .every((id) => !!document.getElementById(id)),
        ),
      ).toBe(true);
      for (const [name, value] of Object.entries({
        packLengthCm: '30',
        packWidthCm: '15',
        packHeightCm: '10',
        packWeightGram: '3000',
        weight: 'Approx. 3 kg',
        dimensions: 'Display size: 28 cm',
      }))
        await editor.locator(`input[name="${name}"]`).fill(value);
      let payload: Record<string, unknown> | undefined;
      let release: () => void = () => {};
      await page.route(`**/api/admin/products/${model.id}`, async (route) => {
        if (route.request().method() === 'GET') return route.fallback();
        payload = route.request().postDataJSON();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return route.fulfill({ json: { ...product, ...payload } });
      });
      await editor.getByRole('button', { name: m.adminProducts.save, exact: true }).click();
      await expect.poll(() => !!payload).toBe(true);
      await expect(stock).toBeDisabled();
      await expect(editor.locator('input[name="name"]')).toBeDisabled();
      await expect(editor.getByRole('button', { name: m.adminProducts.remove, exact: true })).toBeDisabled();
      expect(payload).toMatchObject({
        stock: 2,
        weight: 'Approx. 3 kg',
        dimensions: 'Display size: 28 cm',
        packaging: { lengthCm: 30, widthCm: 15, heightCm: 10, weightGram: 3000 },
      });
      release();
      await expect(editor.getByRole('button', { name: m.adminProducts.save, exact: true })).toBeEnabled();
      await expect(stock).toBeEnabled();
      await editor.getByRole('tab', { name: m.adminProducts.pricing, exact: true }).click();
      const reference = editor.locator('input[name="pricingReferenceMemberVnd"]');
      await reference.fill('');
      await expect(editor.locator('input[name="pricingIssueCount"]')).toBeDisabled();
      await reference.fill('1100000');
      await expect(editor.locator('input[name="pricingIssueCount"]')).toBeEnabled();
      await editor.getByRole('tab', { name: m.adminProducts.inventory, exact: true }).click();
      await capture(page, `${locale}-${width}-inventory-field-order`);
      await editor.getByRole('tab', { name: m.adminProducts.images, exact: true }).click();
      const replacePhoto = editor.getByLabel(m.adminProducts.changeImage, { exact: true });
      await replacePhoto.focus();
      await expect(replacePhoto).toBeFocused();
      await editor.getByRole('tab', { name: m.adminProducts.conditionSection, exact: true }).click();
      await editor.getByRole('button', { name: m.adminProducts.addCondition, exact: true }).click();
      const modal = page.getByRole('dialog');
      await expect(modal.locator('input[type="file"]').first()).not.toHaveAttribute('required');
      await expect(modal.getByLabel(m.catalog.condition, { exact: true })).toHaveValue('incomplete');
      await expect(modal.getByLabel(m.catalog.condition, { exact: true })).toHaveCSS(
        'background-color',
        width === 1440 ? 'rgb(255, 255, 255)' : 'rgb(32, 26, 48)',
      );
      await expect(modal.locator('input[name="boxCondition"]')).toHaveCSS(
        'background-color',
        width === 1440 ? 'rgb(255, 255, 255)' : 'rgb(32, 26, 48)',
      );
      for (const name of ['condition', 'assemblyState', 'boxCondition', 'conditionNote', 'includedAccessories']) {
        const ids = await page.locator(`[name="${name}"]`).evaluateAll((elements) => elements.map((el) => el.id));
        expect(new Set(ids).size, `Unique label targets for ${name}`).toBe(ids.length);
      }
      await modal.getByLabel(m.adminProducts.includedAccessories, { exact: true }).fill('Modal accessory');
      await page.keyboard.press('Escape');
      await expect(editor.locator('textarea[name="includedAccessories"]')).not.toHaveValue('Modal accessory');
    });

    test(`${locale} ${width}: inherited model fields stay readable while unit-specific fields remain editable`, async ({
      page,
      context,
    }) => {
      const { options, writes } = await conditionFixture(page, true);
      await page.addInitScript(
        (theme) => localStorage.setItem('color-theme', JSON.stringify(theme)),
        width === 1440 ? 'light' : 'dark',
      );
      await context.addCookies([
        { name: 'access_token', value: await signSessionToken(900001, 'ADMIN'), url: previewUrl, httpOnly: true },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${locale}/admin/products/${options[1].id}?section=conditions`);
      const editor = page.locator('.compact-admin-editor');
      await expect(editor.locator('#condition-fields select[name="condition"]')).toBeDisabled();
      await expect(editor.locator('#condition-fields select[name="assemblyState"]')).toBeEnabled();
      await editor.getByRole('tab', { name: m.adminProducts.basics, exact: true }).click();
      await expect(editor.locator('input[name="name"]')).toHaveAttribute('readonly', '');
      await expect(editor.locator('input[name="name"]')).toBeEnabled();
      await expect(editor.locator('select[name="categoryId"]')).toBeDisabled();
      await editor.getByRole('tab', { name: m.commerceUX.descriptionTab, exact: true }).click();
      await expect(editor.locator('textarea[name="descriptionVi"]')).toHaveAttribute('readonly', '');
      await editor.getByRole('tab', { name: m.adminProducts.inventory, exact: true }).click();
      for (const name of ['packLengthCm', 'packWidthCm', 'packHeightCm', 'packWeightGram', 'weight', 'dimensions'])
        await expect(editor.locator(`input[name="${name}"]`)).toHaveAttribute('readonly', '');
      await expect(editor.locator('input[name="packLengthCm"]')).toHaveCSS('border-style', 'dashed');
      await expect(editor.locator('input[type="checkbox"]').first()).toHaveCSS(
        'accent-color',
        width === 1440 ? 'rgb(101, 65, 183)' : 'rgb(201, 184, 251)',
      );
      await expect(editor.locator('input[type="checkbox"]').first()).toBeDisabled();
      await expect(editor.locator('input[name="sku"]')).toBeEditable();
      const stock = editor.locator('input[name="stock"]');
      await expect(stock).toBeEditable();
      await expect(stock).toHaveAttribute('max', '1');
      await stock.fill('2');
      await editor.getByRole('button', { name: m.adminProducts.save, exact: true }).click();
      await expect(stock).toHaveAttribute('aria-invalid', 'true');
      await expect(stock).toBeFocused();
      await stock.fill('1');
      await capture(page, `${locale}-${width}-inherited-field-states`);
      await editor.getByRole('tab', { name: m.adminProducts.supplierStatus, exact: true }).click();
      await expect(editor.locator('select[name="supplierId"]')).toBeDisabled();
      await expect(editor.locator('select[name="inventoryStatus"]')).toBeEnabled();
      expect(writes).toEqual([]);
    });
  }

for (const locale of ['vi', 'en'] as const)
  for (const width of [1440, 768, 390]) {
    const m = locale === 'vi' ? vi : en;
    test(`${locale} ${width}: condition cards select the priced unit, disclose issues and keep cart identity`, async ({
      page,
    }) => {
      const { writes, options } = await conditionFixture(page);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      if (width === 768) await page.addInitScript(() => localStorage.setItem('color-theme', JSON.stringify('dark')));
      await page.goto(`/${locale}/san-pham/${model.slug}`);
      const radios = page.getByRole('radio');
      await expect(radios).toHaveCount(4);
      await expect(page.locator('.condition-option .condition-chip.is-new')).toHaveCSS('color', 'rgb(22, 101, 52)');
      await radios.nth(0).focus();
      await page.keyboard.press('ArrowRight');
      await expect(radios.nth(1)).toBeChecked();
      await expect(page).toHaveURL(new RegExp(`tinh-trang=${options[1].id}`));
      const purchase = page.locator('.product-purchase');
      await radios.nth(0).check();
      await purchase.getByRole('button', { name: m.catalog.increase, exact: true }).click();
      await radios.nth(3).check();
      await expect(page.locator('.condition-details')).toContainText('Cracked shoulder armor');
      await expect(purchase.getByRole('button', { name: m.catalog.increase, exact: true })).toBeDisabled();
      await purchase.getByRole('button', { name: m.catalog.addToCart, exact: true }).click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]')[0])).toMatchObject({
        productId: options[3].id,
        quantity: 1,
        price: options[3].salePrice,
      });
      await radios.nth(2).check();
      await expect(page.locator('.condition-details')).toContainText('Missing display stand');
      await expect(page.locator('.product-purchase-quantity')).toHaveCount(0);
      await expect(purchase.getByRole('link', { name: m.customerTools.startAlert, exact: true })).toHaveAttribute(
        'href',
        new RegExp(encodeURIComponent('/shop/product/' + options[2].id)),
      );
      const tabs = page.locator('.product-information');
      await tabs.getByRole('tab', { name: m.catalog.details, exact: true }).click();
      await expect(tabs.getByRole('tabpanel')).toContainText(options[2].sku);
      await expect(tabs.getByRole('tabpanel')).toContainText('Manual, Original box');
      await page.keyboard.press('End');
      await expect(tabs.getByRole('tabpanel')).toContainText(m.catalog.noProductReviews);
      await page.keyboard.press('Home');
      await expect(tabs.locator('.product-story')).toBeVisible();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await capture(page, `${locale}-${width}-condition-picker`);
      await page.locator('.condition-picker').screenshot({
        path: `../../.artifacts/model-universe/commerce-experience/${locale}-${width}-condition-cards.png`,
      });
      expect(writes.filter((path) => path !== '/api/cart/quote')).toEqual([]);
      expect(errors).toEqual([]);
    });

    test(`${locale} ${width}: admin condition listings retain drafts, exclude archive totals and open the exact unit`, async ({
      page,
      context,
    }) => {
      const { writes, options } = await conditionFixture(page, true);
      await context.addCookies([
        { name: 'access_token', value: await signSessionToken(900001, 'ADMIN'), url: previewUrl, httpOnly: true },
      ]);
      await page.addInitScript(
        (theme) => localStorage.setItem('color-theme', JSON.stringify(theme)),
        width === 390 ? 'dark' : 'light',
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/admin/products/${model.id}?section=conditions`);
      const table = page.locator('.condition-listing-table');
      await expect(table.locator('tbody tr')).toHaveCount(5);
      await expect(page.locator('.condition-inventory-total strong')).toHaveText('10');
      expect(
        await page
          .locator('.admin-workspace')
          .evaluate((el) => getComputedStyle(el).getPropertyValue('--admin-accent').trim()),
      ).toBe(width === 390 ? '#c9b8fb' : '#6541b7');
      await expect(page.locator('.condition-inventory dd')).toHaveText(['8', '1', '0', '1']);
      await expect(table.locator('.is-current')).toContainText(m.adminProducts.editingUnit);
      await page.getByRole('button', { name: m.adminProducts.openUnit + ' · ' + options[0].sku, exact: true }).click();
      await expect(page.locator('#condition-fields select[name="condition"]')).toBeFocused();
      const note = page.locator('#condition-fields textarea[name="conditionNote"]');
      await note.fill('Retained condition draft');
      await page.getByRole('tab', { name: m.adminProducts.images, exact: true }).click();
      await page.getByRole('tab', { name: m.adminProducts.conditionSection, exact: true }).click();
      await expect(note).toHaveValue('Retained condition draft');
      await page.getByRole('button', { name: m.adminProducts.addCondition, exact: true }).click();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: m.adminProducts.createOption, exact: true }).click();
      await expect(modal).toContainText(m.adminProducts.validation.priceInvalid);
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
      await expect(page.locator('.admin-editor-actions')).toBeInViewport();
      await page.locator('.condition-table-scroll').evaluate((el) => (el.scrollLeft = 0));
      await page
        .locator('.compact-admin-editor .workspace-tab-panel:not([hidden])')
        .evaluate((el) => (el.scrollTop = 0));
      await capture(page, `${locale}-${width}-condition-admin`);
      const edit = table.getByRole('link', { name: m.adminProducts.openUnit + ' · ' + options[1].sku, exact: true });
      await edit.click();
      await expect(page).toHaveURL(new RegExp(`/admin/products/${options[1].id}\\?section=conditions`));
      await expect(page.locator('.condition-listing-table .is-current')).toContainText(options[1].sku);
      await expect(page.getByRole('tab', { name: m.adminProducts.conditionSection, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.goto(`/${locale}/admin/products`);
      await expect(page.locator('.catalog-condition-summary > div')).toHaveCount(4);
      expect(writes).toEqual([]);
    });
  }

for (const locale of ['vi', 'en'] as const)
  for (const width of [1440, 390]) {
    const messages = locale === 'vi' ? vi : en;
    test(`${locale} ${width}: applied filters preserve other choices and recover an empty search`, async ({ page }) => {
      await fixture(page);
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 });
      await page.goto(`/${locale}/cua-hang?brand=${encodeURIComponent(model.brandName)}&inStock=true&q=no-match`);
      await expect(page.locator('.catalog-empty')).toBeVisible();
      await capture(page, `${locale}-${width}-catalog-empty`);
      await page
        .getByRole('button', { name: messages.commerceUX.removeFilter.replace('{name}', '“no-match”'), exact: true })
        .click();
      await expect(page).not.toHaveURL(/q=/);
      await expect(page).toHaveURL(/inStock=true/);
      await expect(page).toHaveURL(/brand=/);
      await expect(page.locator('.product-tile')).toHaveCount(1);
      expect(
        await page
          .locator('.product-tile .product-stage-photo')
          .first()
          .evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThan(60);
      await capture(page, `${locale}-${width}-catalog`);
      await page
        .locator('.catalog-applied')
        .getByRole('button', { name: messages.commerceUX.clearFilters, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/cua-hang$`));
      await expect(page.locator('.catalog-applied')).toHaveCount(0);
    });

    test(`${locale} ${width}: gallery focus, cart feedback, stock limit and purchase return`, async ({ page }) => {
      const writes = await fixture(page, false, true);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${locale}/san-pham/${model.slug}`);
      await expect(page.locator('.product-purchase')).toBeVisible();
      const benefits = page.locator('.offer-benefits');
      await expect(benefits).not.toHaveAttribute('open', '');
      await benefits.locator('summary').click();
      await expect(benefits.locator('.offer-list')).toBeVisible();
      await benefits.locator('summary').click();
      await page.getByRole('button', { name: messages.commerceUX.enlargePhoto, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: messages.commerceUX.enlargePhoto, exact: true })).toBeFocused();
      // Duplicated URLs count as a single photograph.
      await expect(page.locator('.product-gallery-thumbnails')).toHaveCount(0);
      const purchase = page.locator('.product-purchase');
      const increase = purchase.getByRole('button', { name: messages.catalog.increase, exact: true });
      await increase.click();
      await increase.click();
      await expect(increase).toBeDisabled();
      await purchase.getByRole('button', { name: messages.catalog.addToCart, exact: true }).click();
      await expect(purchase.getByRole('status')).toContainText(messages.commerceUX.addedToCart);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]')[0].quantity)).toBe(3);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await expect(purchase).not.toBeInViewport();
      await expect(page.locator('.product-dock')).toBeVisible();
      await page.locator('.product-dock button').click();
      await expect(purchase.getByRole('button', { name: messages.catalog.addToCart, exact: true })).toBeFocused();
      await expect(purchase).toBeInViewport();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await capture(page, `${locale}-${width}-product`);
      expect(writes.filter((path) => path !== '/api/cart/quote')).toEqual([]);
      expect(errors).toEqual([]);
    });

    test(`${locale} ${width}: admin preferences persist, essential columns stay and sidebar search works`, async ({
      page,
      context,
    }) => {
      const writes = await fixture(page, true);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        (theme) => localStorage.setItem('color-theme', JSON.stringify(theme)),
        width === 1440 ? 'light' : 'dark',
      );
      await context.addCookies([
        {
          name: 'access_token',
          value: await signSessionToken(900001, 'ADMIN'),
          url: previewUrl,
          httpOnly: true,
        },
      ]);
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 });
      await page.goto(`/${locale}/admin/products`);
      await expect(page.locator('.admin-table:visible')).toHaveCount(1);
      await expect(page.locator('.admin-table:visible')).toHaveAttribute('aria-busy', 'false');
      await page.getByRole('button', { name: messages.commerceUX.compactRows, exact: true }).click();
      const picker = page.locator('.admin-column-picker');
      await picker.locator('summary').click();
      await expect(picker.getByRole('checkbox', { name: messages.adminProducts.name, exact: true })).toBeDisabled();
      await picker.getByRole('checkbox', { name: messages.adminProducts.sold, exact: true }).uncheck();
      await picker.getByRole('checkbox', { name: messages.adminProducts.price, exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(picker.locator('summary')).toBeFocused();
      await expect(
        page.locator('thead').getByRole('columnheader', { name: messages.adminProducts.sold, exact: true }),
      ).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.admin-table:visible')).toHaveCount(1);
      await expect(page.locator('.admin-table:visible')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('.admin-table:visible')).toHaveClass(/is-compact/);
      await expect(
        page.locator('thead').getByRole('columnheader', { name: messages.adminProducts.sold, exact: true }),
      ).toHaveCount(0);
      await page.getByRole('tab', { name: messages.adminProducts.stats.title, exact: true }).click();
      await expect(page.locator('.inventory-kpis')).toBeVisible();
      await page.getByRole('tab', { name: messages.adminProducts.list, exact: true }).click();
      await expect(page.locator('.admin-table:visible')).toHaveClass(/is-compact/);
      await capture(page, `${locale}-${width}-admin-products`);
      if (width < 1024) await page.locator('.admin-menu-trigger').click();
      const search = page.getByRole('searchbox', { name: messages.commerceUX.findWorkspace });
      await search.fill(locale === 'vi' ? 'san pham' : 'catalog');
      await expect(page.locator('.admin-nav-search-results a').first()).toBeVisible();
      await search.press('Escape');
      await expect(search).toHaveValue('');
      if (width < 1024) await page.locator('.admin-sidebar-close').click();
      await page.goto(`/${locale}/admin/products/${model.id}`);
      const editor = page.locator('.compact-admin-editor');
      await expect(editor).toBeVisible();
      await expect(page.locator('.admin-page-heading, .compact-model-summary, .compact-editor-caption')).toHaveCount(0);
      await expect(page.locator('.admin-header .admin-assistant-launcher')).toBeInViewport();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.adminProducts.edit);
      const nameField = editor.getByRole('textbox', { name: messages.adminProducts.name, exact: true });
      await nameField.fill('Retained model draft');
      const editorTabs = editor.getByRole('tablist');
      await editorTabs.getByRole('tab', { name: messages.adminProducts.pricing, exact: true }).click();
      await expect(editor.getByRole('tabpanel')).toBeVisible();
      await editorTabs.getByRole('tab', { name: messages.adminProducts.basics, exact: true }).click();
      await expect(nameField).toHaveValue('Retained model draft');
      await editorTabs.getByRole('tab', { name: messages.adminProducts.inventory, exact: true }).click();
      await editor.getByRole('textbox', { name: 'SKU', exact: true }).fill('');
      await editorTabs.getByRole('tab', { name: messages.adminProducts.basics, exact: true }).click();
      await editor.getByRole('button', { name: messages.adminProducts.save, exact: true }).click();
      await expect(editorTabs.getByRole('tab', { name: new RegExp(messages.adminProducts.inventory) })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(editor.getByRole('textbox', { name: 'SKU', exact: true })).toBeFocused();
      await expect(page.locator('.admin-editor-actions')).toBeInViewport();
      await capture(page, `${locale}-${width}-admin-editor`);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

for (const locale of ['vi', 'en'] as const) {
  test(`${locale}: catalog rows and create wizard keep their controls in the laptop viewport`, async ({
    page,
    context,
  }) => {
    const m = locale === 'vi' ? vi : en;
    const writes = await fixture(page, true, true);
    await context.addCookies([
      {
        name: 'access_token',
        value: await signSessionToken(900001, 'ADMIN'),
        url: previewUrl,
        httpOnly: true,
      },
    ]);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/${locale}/admin/products`);
    const table = page.locator('.admin-table-scroll');
    await expect(table.locator('tbody tr')).toHaveCount(10);
    expect(await table.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await table.locator('tbody tr').last().scrollIntoViewIfNeeded();
    await expect(page.locator('.admin-table-pagination')).toBeInViewport();
    await expect(page.locator('.admin-page-heading')).toHaveCount(0);
    await expect(page.locator('.admin-location strong')).toBeInViewport();
    await capture(page, `${locale}-1366-compact-catalog-rows`);
    await page.goto(`/${locale}/admin/products/new`);
    const create = page.locator('.compact-admin-create-card');
    await expect(create.getByRole('button', { name: m.adminProducts.next, exact: true })).toBeInViewport();
    await create.getByRole('button', { name: m.adminProducts.next, exact: true }).click();
    await expect(create.getByRole('textbox', { name: m.adminProducts.name, exact: true })).toBeFocused();
    await create.getByRole('textbox', { name: m.adminProducts.name, exact: true }).fill('Retained creation draft');
    await create.getByRole('textbox', { name: m.adminProducts.brand, exact: true }).fill('Fixture brand');
    await create.getByRole('button', { name: m.adminProducts.next, exact: true }).click();
    await create.getByRole('button', { name: m.adminProducts.next, exact: true }).click();
    await expect(create.getByLabel(m.adminProducts.chooseImage, { exact: true })).toBeFocused();
    await expect(create.getByLabel(m.adminProducts.chooseImage, { exact: true })).toHaveAttribute('required');
    await create.getByRole('button', { name: m.adminProducts.back, exact: true }).click();
    await expect(create.getByRole('textbox', { name: m.adminProducts.name, exact: true })).toHaveValue(
      'Retained creation draft',
    );
    await expect(create.getByRole('button', { name: m.adminProducts.next, exact: true })).toBeInViewport();
    await capture(page, `${locale}-1366-compact-create`);
    expect(writes).toEqual([]);
  });

  test(`${locale}: admin failure has a retry and recovers without writes`, async ({ page, context }) => {
    const m = locale === 'vi' ? vi : en;
    const writes = await fixture(page, true);
    await context.addCookies([
      {
        name: 'access_token',
        value: await signSessionToken(900001, 'ADMIN'),
        url: previewUrl,
        httpOnly: true,
      },
    ]);
    let fail = true;
    await page.route('**/api/admin/products?*', async (route) => {
      if (fail) return route.fulfill({ status: 503, json: {} });
      return route.fallback();
    });
    await page.goto(`/${locale}/admin/products`);
    await expect(page.locator('.admin-load-error')).toHaveText(
      new RegExp(m.commerceUX.loadFailed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    fail = false;
    await page.locator('.admin-load-error').getByRole('button', { name: m.commerceUX.retry }).click();
    await expect(page.locator('.admin-load-error')).toHaveCount(0);
    await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);
    expect(writes).toEqual([]);
  });

  test(`${locale}: real public catalog and product render across tablet and mobile`, async ({ page }) => {
    // Six real navigations plus images on a cold local development compiler.
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 });
      await page.goto(`/${locale}/cua-hang?inStock=true`);
      await expect(page.locator('.product-tile-action').first()).toBeVisible();
      const photo = page.locator('.product-tile .product-stage-photo').first();
      expect(await photo.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(60);
      await expect
        .poll(() =>
          photo
            .locator('img')
            .evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
        )
        .toBe(true);
      await capture(page, `${locale}-${width}-live-catalog`);
      await page.locator('.product-tile-action').first().click();
      await expect(page.locator('.product-detail-offer h1')).toBeVisible();
      await expect(page.locator('.product-purchase-actions button').first()).toBeEnabled();
      await capture(page, `${locale}-${width}-live-product`);
    }
    expect(errors).toEqual([]);
  });
}

for (const locale of ['vi', 'en'] as const) {
  const m = locale === 'vi' ? vi : en;
  test(locale + ': sold-out purchase actions offer restock subscription directly', async ({ page }) => {
    await fixture(page, true, false, null, true);
    let preferences: { productId: number; active: boolean }[] = [];
    let reads = 0;
    await page.route('**/api/notifications/restocks**', async (route) => {
      if (route.request().method() === 'GET') reads++;
      else preferences = [{ productId: model.id, active: route.request().postDataJSON().active }];
      await route.fulfill({ json: preferences });
    });
    await page.goto('/' + locale + '/cua-hang');
    const action = page.locator('.product-tile').getByRole('button', { name: m.customerTools.startAlert, exact: true });
    await action.click();
    await expect(
      page.locator('.product-tile').getByRole('button', { name: m.customerTools.stopAlert, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(reads).toBe(1);
    await page.goto('/' + locale + '/san-pham/' + model.slug);
    const purchase = page.locator('.product-purchase-actions');
    await expect(purchase.getByRole('button', { name: m.customerTools.stopAlert, exact: true })).toBeEnabled();
    await expect(purchase.getByRole('button', { name: m.catalog.soldOut, exact: true })).toHaveCount(0);
    await purchase.getByRole('button', { name: m.customerTools.stopAlert, exact: true }).click();
    await expect(purchase.getByRole('button', { name: m.customerTools.startAlert, exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await capture(page, locale + '-restock-action');
  });
  test(locale + ': guest stock alert returns through sign-in', async ({ page }) => {
    await fixture(page, false, false, null, true);
    await page.goto('/' + locale + '/san-pham/' + model.slug);
    await expect(
      page.locator('.product-purchase-actions').getByRole('link', { name: m.customerTools.startAlert, exact: true }),
    ).toHaveAttribute('href', /auth\/signin\?redirect=/);
  });
  test(locale + ': reopened QR locks the payment plan after reload and close', async ({ page }) => {
    await page.setViewportSize({ width: locale === 'vi' ? 390 : 1440, height: locale === 'vi' ? 844 : 768 });
    await fixture(page, true);
    await page.addInitScript(
      (product) =>
        localStorage.setItem(
          'cart',
          JSON.stringify([
            {
              productId: product.id,
              size: '',
              quantity: 1,
              name: product.name,
              imageUrl: product.imageUrl,
              price: product.price,
              brandName: product.brandName,
            },
          ]),
        ),
      model,
    );
    const session = {
      id: 900123,
      status: 'OPEN',
      orderId: null,
      totalVnd: 1000000,
      upfrontDueVnd: 100000,
      depositAmountVnd: 100000,
      balanceVnd: 900000,
      paymentPlan: 'deposit',
      depositVnd: 100000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      serverTime: new Date().toISOString(),
      shipping: null,
      payment: {
        amountVnd: 100000,
        qrCode: 'SYNTHETIC-QR',
        checkoutUrl: null,
        bankBin: null,
        accountNumber: 'SYNTHETIC',
        accountName: 'UI FIXTURE',
        description: 'MUC900123',
      },
    };
    await page.route('**/api/checkout/sessions**', (route) =>
      route.fulfill({ json: route.request().url().endsWith('/sessions') ? [session] : session }),
    );
    await page.goto('/' + locale + '/cart');
    await expect(page.locator('.payment-plan input[type="radio"]')).toHaveCount(2);
    for (const input of await page.locator('.payment-plan input[type="radio"]').all())
      await expect(input).toBeDisabled();
    await page
      .locator('.pending-checkout-bar')
      .getByRole('button', { name: m.checkoutPayment.openQr, exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText(m.checkoutPayment.planLocked);
    await expect(page.locator('.checkout-qr-plans')).toHaveCount(0);
    await capture(page, locale + '-locked-qr');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('.payment-plan input[type="radio"]')).toHaveCount(2);
    for (const input of await page.locator('.payment-plan input[type="radio"]').all())
      await expect(input).toBeDisabled();
    session.status = 'EXPIRED';
    await expect(page.locator('.payment-plan input[type="radio"]').first()).toBeEnabled();
  });
}

for (const locale of ['vi', 'en'])
  test(locale + ': hourly offers are absent from the promotions page and live hub', async ({ page, request }) => {
    await page.goto('/' + locale + '/uu-dai');
    await expect(page.locator('#vouchers')).toBeVisible();
    await expect(page.locator('.drop-timeline, .banner-slots')).toHaveCount(0);
    await expect(page.locator('#vouchers')).not.toContainText('Săn trưa');
    const hub = await (await request.get('/api/promotions/hub')).json();
    expect(
      hub.drops.filter(
        (drop: { code: string | null; title: string }) =>
          /^D\d{6}-(00|12|20)$/.test(drop.code || '') || /Săn trưa|Săn đêm|Freeship 0H/.test(drop.title),
      ),
    ).toEqual([]);
  });
