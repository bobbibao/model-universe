import { test, expect, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { signSessionToken } from '../src/shared/server/utils/JwtUtils';
import type { ProductDetail } from '../src/shared/types/product';
import vi from '../src/messages/vi.json';
import en from '../src/messages/en.json';

// UI mutations are intercepted. Only the public catalog is read from the local stack.
const localPreview = /^http:\/\/(localhost|127\.0\.0\.1):6050$/.test(
  process.env.E2E_BASE_URL || 'http://localhost:6050',
);
let model: ProductDetail;
test.beforeAll(async ({ request }) => {
  test.skip(!localPreview, 'This fixture suite runs only against the local development stack.');
  loadEnvConfig(process.cwd());
  const catalog = await (await request.get('/api/products?per_page=1&inStock=true')).json();
  expect(catalog.payload.data.length, 'Requires one existing public model; never seeds the shop').toBeGreaterThan(0);
  model = await (await request.get(`/api/products/${catalog.payload.data[0].id}`)).json();
});

async function fixture(page: Page, admin = false, complex = false, partnerId: number | null = null) {
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
    availableSizes: [],
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

    test(`${locale} ${width}: gallery, tab keyboard navigation, stock limit and visible purchase controls`, async ({
      page,
    }) => {
      const writes = await fixture(page);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 });
      await page.goto(`/${locale}/san-pham/${model.slug}`);
      await expect(page.locator('.product-purchase')).toBeVisible();
      const tabs = page.getByRole('tablist', { name: messages.commerceUX.productInformation });
      const specsTab = tabs.getByRole('tab', { name: messages.commerceUX.specificationsTab, exact: true });
      await specsTab.focus();
      await specsTab.press('ArrowRight');
      await expect(tabs.getByRole('tab', { name: messages.catalog.condition, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('End');
      await expect(tabs.getByRole('tab', { name: new RegExp(messages.catalog.reviews) })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(specsTab).toBeFocused();
      await tabs.getByRole('tab', { name: messages.commerceUX.offersTab, exact: true }).click();
      await expect(page.locator('.offer-list')).toBeVisible();
      await specsTab.click();
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
      await page.locator('.Toastify__close-button').first().click();
      await expect(page.locator('.Toastify__toast')).toHaveCount(0);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]')[0].quantity)).toBe(3);
      await tabs.getByRole('tab', { name: messages.commerceUX.descriptionTab, exact: true }).click();
      await expect(page.locator('.product-story')).toBeVisible();
      await expect(purchase.getByRole('button', { name: messages.catalog.addToCart, exact: true })).toBeInViewport();
      await specsTab.click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      if (width >= 1024) {
        const bounds = await page.locator('.compact-product-workspace').boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(768);
      }
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
          url: 'http://localhost:6050',
          httpOnly: true,
        },
      ]);
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 });
      await page.goto(`/${locale}/admin/products`);
      await expect(page.locator('.admin-table')).toHaveAttribute('aria-busy', 'false');
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
      await expect(page.locator('.admin-table')).toHaveClass(/is-compact/);
      await expect(
        page.locator('thead').getByRole('columnheader', { name: messages.adminProducts.sold, exact: true }),
      ).toHaveCount(0);
      await page.getByRole('tab', { name: messages.adminProducts.stats.title, exact: true }).click();
      await expect(page.locator('.inventory-kpis')).toBeVisible();
      await page.getByRole('tab', { name: messages.adminProducts.list, exact: true }).click();
      await expect(page.locator('.admin-table')).toHaveClass(/is-compact/);
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
  test(`${locale}: partner identity remains visible beside the model heading`, async ({ page }) => {
    const m = locale === 'vi' ? vi : en;
    await fixture(page, false, false, 900002);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/${locale}/san-pham/${model.slug}`);
    const seller = page.locator('.compact-product-heading').getByRole('link', { name: new RegExp(m.sellerStore.view) });
    await expect(seller).toHaveAttribute('href', `/${locale}/sellers/900002`);
    await expect(seller).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.product-purchase-actions button').first()).toBeInViewport({ ratio: 1 });
    await page.getByRole('tab', { name: m.commerceUX.offersTab, exact: true }).click();
    await expect(page.getByRole('tabpanel').locator('.offer-note')).toBeVisible();
    await expect(page.getByRole('tabpanel').locator('.offer-list')).toHaveCount(0);
  });
  for (const width of [1366, 390]) {
    test(`${locale} ${width}: long model content stays in its tab and cart uses the chosen damaged unit`, async ({
      page,
    }) => {
      const m = locale === 'vi' ? vi : en;
      const writes = await fixture(page, false, true);
      await page.setViewportSize({ width, height: width > 1024 ? 768 : 844 });
      await page.goto(`/${locale}/san-pham/${model.slug}`);
      const purchase = page.locator('.product-purchase');
      const add = purchase.getByRole('button', { name: m.catalog.addToCart, exact: true });
      await expect(add).toBeInViewport({ ratio: 1 });
      await page.getByLabel(m.catalog.chooseCondition, { exact: true }).selectOption(String(model.id + 900000));
      await expect(page).toHaveURL(new RegExp(`tinh-trang=${model.id + 900000}`));
      await expect(page.locator('.compact-condition-notice')).toBeVisible();
      await page.locator('.compact-condition-notice').click();
      await expect(page.getByRole('tabpanel')).toContainText('Cracked armor');
      await expect(page.getByRole('tabpanel')).toContainText('Missing stand');
      await page.getByRole('tab', { name: m.commerceUX.descriptionTab, exact: true }).click();
      const panel = page.getByRole('tabpanel');
      expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      await panel.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await expect(add).toBeInViewport({ ratio: 1 });
      await page.getByRole('button', { name: m.commerceUX.enlargePhoto, exact: true }).click();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.product-gallery-lightbox-nav > span')).toHaveText(
        m.experience.photoPosition.replace('{current}', '2').replace('{count}', '2'),
      );
      await page.keyboard.press('Escape');
      await add.click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]')[0].productId)).toBe(
        model.id + 900000,
      );
      await capture(page, `${locale}-${width}-compact-long-product`);
      expect(writes.filter((path) => path !== '/api/cart/quote')).toEqual([]);
    });
  }

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
        url: 'http://localhost:6050',
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
    await expect(page.locator('.admin-page-heading h1')).toBeInViewport();
    await capture(page, `${locale}-1366-compact-catalog-rows`);
    await page.goto(`/${locale}/admin/products/new`);
    const create = page.locator('.compact-admin-create-card');
    await expect(create.getByRole('button', { name: m.adminProducts.next, exact: true })).toBeInViewport();
    await create.getByRole('button', { name: m.adminProducts.next, exact: true }).click();
    await expect(create.getByRole('textbox', { name: m.adminProducts.name, exact: true })).toBeFocused();
    await create.getByRole('textbox', { name: m.adminProducts.name, exact: true }).fill('Retained creation draft');
    await create.getByRole('textbox', { name: m.adminProducts.brand, exact: true }).fill('Fixture brand');
    await create.getByRole('button', { name: m.adminProducts.next, exact: true }).click();
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
        url: 'http://localhost:6050',
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
