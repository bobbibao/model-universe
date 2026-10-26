import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { signSessionToken } from '../src/shared/server/utils/JwtUtils';
import type { ProductDetail } from '../src/shared/types/product';

const preview = process.env.E2E_BASE_URL || '';
let model: ProductDetail;
test.beforeAll(async ({ request }) => {
  test.skip(preview !== 'http://localhost:6053', 'Synthetic cart checks run only on the isolated local preview.');
  loadEnvConfig(process.cwd());
  const catalog = await (await request.get('/api/products?per_page=1&inStock=true')).json();
  model = await (await request.get(`/api/products/${catalog.payload.data[0].id}`)).json();
});

async function cart(page: Page, context: BrowserContext, role: 'ADMIN' | 'USER', locale: string, failClaim = false) {
  let claims = 0,
    wallets = 0,
    claimed = false;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addCookies([
    { name: 'access_token', value: await signSessionToken(900001, role), url: preview, httpOnly: true },
  ]);
  await page.addInitScript((product) => {
    localStorage.setItem(
      'cart',
      JSON.stringify([
        {
          productId: product.id,
          name: product.name,
          brandName: product.brandName,
          imageUrl: product.imageUrl,
          price: product.price,
          quantity: 1,
        },
      ]),
    );
  }, model);
  const wallet = () => ({
    vouchers: [],
    monthly: { available: !claimed, code: claimed ? 'MTEST-900001' : null, discountPercent: 10 },
  });
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { user: { id: 900001, role, firstName: 'UI', lastName: 'Fixture', email: 'ui@example.test' } },
      });
    if (path === '/api/cart/quote')
      return route.fulfill({
        json: {
          lines: [
            {
              productId: model.id,
              quantity: 1,
              status: 'OK',
              availableStock: 3,
              lineTotal: model.salePrice,
              product: { ...model, stock: 3 },
            },
          ],
          subtotal: model.salePrice,
          benefitSubtotalVnd: model.salePrice,
          total: model.salePrice,
          itemCount: 1,
          hasIssues: false,
        },
      });
    if (path === '/api/vouchers/evaluate')
      return route.fulfill({ json: { options: [], best: null, bestFreeship: null } });
    // Simulate even the older server advertising the offer to Admin: the frontend must still hide it.
    if (path === '/api/vouchers') {
      wallets++;
      return route.fulfill({ json: wallet() });
    }
    if (path === '/api/vouchers/monthly') {
      claims++;
      if (role === 'ADMIN')
        return route.fulfill({ status: 403, json: { errorCode: 'MEMBER_CUSTOMER_ACCOUNT_REQUIRED' } });
      if (failClaim) return route.fulfill({ status: 503, json: { userMessages: ['Temporarily unavailable'] } });
      claimed = true;
      return route.fulfill({ json: { statusCode: 200, data: wallet() } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`/${locale}/cart`);
  await expect.poll(() => wallets).toBeGreaterThan(0);
  if (role === 'USER') await expect.poll(() => claims).toBe(1);
  await page.locator('.voucher-row.is-discount:visible').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  return { claims: () => claims, errors };
}

for (const locale of ['vi', 'en']) {
  for (const role of ['ADMIN', 'USER'] as const) {
    test(`${locale} ${role}: monthly member offer respects account eligibility`, async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      const state = await cart(page, context, role, locale);
      await expect(page.locator('.picker-monthly')).toHaveCount(0);
      expect(state.claims()).toBe(role === 'USER' ? 1 : 0);
      await expect(page.locator('.Toastify__toast--error')).toHaveCount(0);
      expect(state.errors).toEqual([]);
    });
  }
}

test('customer claim failure leaves picker usable without an unhandled rejection', async ({ page, context }) => {
  const state = await cart(page, context, 'USER', 'vi', true);
  const claim = page.locator('.picker-monthly button');
  await expect(claim).toBeEnabled();
  await claim.click();
  await expect.poll(() => state.claims()).toBe(2);
  await expect(claim).toBeEnabled();
  expect(state.errors).toEqual([]);
});
