import { test, expect, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { signSessionToken } from '../src/shared/server/utils/JwtUtils';
import { BUILT_IN_CONDITIONS } from '../src/shared/product-conditions';
import type { ProductBulkRequest } from '../src/shared/product-bulk';
import vi from '../src/messages/vi.json';
import en from '../src/messages/en.json';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:6050';
test.beforeAll(() => {
  test.skip(!/^http:\/\/(localhost|127\.0\.0\.1):605[03]$/.test(baseURL), 'Local UI fixtures only');
  loadEnvConfig(process.cwd());
});

async function fixture(page: Page, fail = false) {
  const attempts: ProductBulkRequest[] = [];
  let reads = 0;
  await page
    .context()
    .addCookies([{ name: 'access_token', value: await signSessionToken(900001, 'ADMIN'), url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { user: { id: 900001, role: 'ADMIN', firstName: 'UI', lastName: 'Preview', email: 'ui@example.test' } },
      });
    if (path === '/api/product-conditions') return route.fulfill({ json: BUILT_IN_CONDITIONS });
    if (path === '/api/admin/products/stats') return route.fulfill({ json: null });
    if (path === '/api/admin/products/bulk') {
      attempts.push(req.postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (fail)
        return route.fulfill({
          status: 409,
          json: {
            statusCode: 409,
            errorCode: 'BULK_PRODUCT_CONDITION_INVALID',
            errorParams: { blockedProducts: JSON.stringify([{ id: 101, reason: 'missingAccessories' }]) },
          },
        });
      return route.fulfill({
        json: { data: { selectedCount: attempts.at(-1)!.items.length, updatedCount: attempts.at(-1)!.items.length } },
      });
    }
    if (path === '/api/admin/products') {
      reads++;
      const current = Number(url.searchParams.get('page') || 1);
      const rows = (current === 1 ? [101, 102, 103] : [104]).map((id) => ({
        id,
        name: `Bulk model ${id}`,
        sku: `BULK-${id}`,
        brandName: 'Bandai',
        price: 1000000,
        salePrice: 1000000,
        stock: 1,
        sold: 0,
        condition: 'new',
        conditions: [],
        partnerId: id === 103 ? 55 : null,
        inventoryStatus: 'available',
        isArchived: false,
        isFeatured: false,
        imageUrl: '/images/store/product-placeholder.svg',
        updatedAt: '2026-10-26T08:00:00.000Z',
      }));
      return route.fulfill({
        json: {
          payload: {
            data: rows,
            pagination: {
              total: 4,
              page: current,
              perPage: 3,
              totalPages: 2,
              hasNextPage: current === 1,
              hasPreviousPage: current === 2,
            },
          },
        },
      });
    }
    // Every unhandled API, including writes, remains inside the fixture.
    return route.fulfill({ json: [] });
  });
  return { attempts, reads: () => reads };
}

for (const locale of ['vi', 'en'] as const) {
  for (const width of [1366, 390]) {
    test(`${locale} ${width}: selected rows across pages, two opt-in fields and protected busy state`, async ({
      page,
    }) => {
      const m = locale === 'vi' ? vi : en,
        t = m.productBulk;
      const state = await fixture(page);
      if (locale === 'en') await page.addInitScript(() => localStorage.setItem('color-theme', JSON.stringify('light')));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/admin/products`);
      const table = page.locator('.admin-table:visible');
      await expect(table).toHaveAttribute('aria-busy', 'false');
      await expect(
        table.getByRole('checkbox', { name: t.selectProduct.replace('{name}', 'Bulk model 103'), exact: true }),
      ).toBeDisabled();
      await table
        .getByRole('checkbox', { name: t.selectProduct.replace('{name}', 'Bulk model 101'), exact: true })
        .check();
      await expect(table.getByRole('checkbox', { name: t.selectPage, exact: true })).toHaveJSProperty(
        'indeterminate',
        true,
      );
      await table.getByRole('checkbox', { name: t.selectPage, exact: true }).check();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/products/?$`));
      await table.getByRole('button', { name: m.dataTable.next, exact: true }).click();
      await table
        .getByRole('checkbox', { name: t.selectProduct.replace('{name}', 'Bulk model 104'), exact: true })
        .check();
      await expect(page.locator('.product-bulk-toolbar')).toContainText(t.selected.replace('{count}', '3'));
      await page.getByRole('button', { name: t.edit, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('combobox')).toHaveCount(2);
      for (const combo of await dialog.getByRole('combobox').all()) await expect(combo).toBeDisabled();
      const apply = dialog.getByRole('button', { name: t.apply.replace('{count}', '3'), exact: true });
      await expect(apply).toBeDisabled();
      await dialog.getByRole('checkbox', { name: t.fields.isFeatured, exact: true }).check();
      await dialog
        .getByRole('combobox', { name: t.value.replace('{field}', t.fields.isFeatured), exact: true })
        .selectOption('false');
      await dialog.getByRole('checkbox', { name: t.fields.condition, exact: true }).check();
      await dialog
        .getByRole('combobox', { name: t.value.replace('{field}', t.fields.condition), exact: true })
        .selectOption('defective');
      await expect(dialog).toContainText(t.requirements.defects);
      await page.screenshot({ path: `../../.artifacts/model-universe/bulk-${locale}-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await apply.click();
      await expect(dialog.getByRole('button', { name: t.saving, exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(page.locator('.product-bulk-toolbar')).toHaveCount(0);
      expect(state.attempts).toHaveLength(1);
      expect(state.attempts[0].changes).toEqual({ isFeatured: false, condition: 'defective' });
      expect(state.attempts[0].items).toEqual(
        [101, 102, 104].map((id) => ({ id, expectedUpdatedAt: '2026-10-26T08:00:00.000Z' })),
      );
      expect(state.attempts[0].requestKey).toMatch(/^[0-9a-f-]{36}$/);
      expect(state.reads()).toBeGreaterThanOrEqual(3);
    });
  }
}

test('failed condition edit retains choices, gives repair links, reuses retry key; filters clear selection', async ({
  page,
}) => {
  const t = vi.productBulk;
  const state = await fixture(page, true);
  await page.goto('/vi/admin/products');
  const row = page.getByRole('checkbox', { name: t.selectProduct.replace('{name}', 'Bulk model 101'), exact: true });
  await row.check();
  await page.getByRole('button', { name: t.edit, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: t.fields.condition, exact: true }).check();
  await dialog
    .getByRole('combobox', { name: t.value.replace('{field}', t.fields.condition), exact: true })
    .selectOption('incomplete');
  const apply = dialog.getByRole('button', { name: t.apply.replace('{count}', '1'), exact: true });
  await apply.click();
  await expect(dialog.getByRole('alert')).toContainText(t.issues.missingAccessories);
  await expect(dialog.getByRole('link', { name: '#101', exact: true })).toHaveAttribute(
    'href',
    /\/vi\/admin\/products\/101/,
  );
  await expect(dialog.getByRole('checkbox', { name: t.fields.condition, exact: true })).toBeChecked();
  await apply.click();
  await expect(apply).toBeEnabled();
  expect(state.attempts).toHaveLength(2);
  expect(state.attempts[0]).toEqual(state.attempts[1]);
  expect(state.attempts[0].changes).toEqual({ condition: 'incomplete' });
  await dialog.getByRole('button', { name: t.reload, exact: true }).click();
  await expect(page.locator('.product-bulk-toolbar')).toHaveCount(0);
  await row.check();
  await page.getByRole('textbox', { name: vi.adminProducts.search, exact: true }).fill('Bulk');
  await expect(page.locator('.product-bulk-toolbar')).toHaveCount(0);
});
