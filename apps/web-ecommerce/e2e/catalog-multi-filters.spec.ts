import { test, expect, type Page } from '@playwright/test';
import { BUILT_IN_CONDITIONS } from '../src/shared/product-conditions';
import vi from '../src/messages/vi.json';
import en from '../src/messages/en.json';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:6050';
test.beforeAll(() => test.skip(!/^http:\/\/(localhost|127\.0\.0\.1):605[03]$/.test(baseURL), 'Local fixtures only'));
async function fixture(page: Page) {
  const queries: URLSearchParams[] = [];
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (req.method() !== 'GET') writes.push(path);
    if (path === '/api/auth/me') return route.fulfill({ json: { user: null } });
    if (path === '/api/product-conditions') return route.fulfill({ json: BUILT_IN_CONDITIONS });
    if (path === '/api/products/filters')
      return route.fulfill({
        json: { brands: ["A&B's Lab", 'Bandai'], scales: ['1/100', '1/144'], priceRange: { min: 0, max: 5000000 } },
      });
    if (path === '/api/products') {
      queries.push(url.searchParams);
      const data = ['new', 'preowned', 'new', 'defective'].map((condition, index) => ({
        id: index + 1,
        name: `Collector model ${index + 1}`,
        slug: `collector-model-${index + 1}`,
        sku: `UI-${index + 1}`,
        imageUrl: '/images/store/product-placeholder.svg',
        brandName: 'Bandai',
        scale: '1/100',
        condition,
        stock: index === 2 ? 0 : 2,
        price: 1000000,
        salePrice: 1000000,
        discountPercent: 0,
        rating: 0,
        reviewCount: 0,
        sold: 0,
      }));
      return route.fulfill({
        json: { payload: { data, pagination: { total: 4, page: 1, perPage: 12, totalPages: 1 } } },
      });
    }
    return route.fulfill({ json: [] });
  });
  return { queries, writes };
}

for (const locale of ['vi', 'en'] as const)
  for (const width of [1366, 390]) {
    test(`${locale} ${width}: multi-choice facets stay open, restore URLs and remove individual chips`, async ({
      page,
    }) => {
      const m = locale === 'vi' ? vi : en;
      const state = await fixture(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/cua-hang`);
      const sidebar = page.locator('.catalog-mobile-filters:visible');
      if (width === 390) await sidebar.locator('summary').click();
      const filters = page.locator('.catalog-filters:visible');
      const brand = filters.locator('.filter-multi').nth(1);
      const trigger = brand.getByRole('button').first();
      await trigger.click();
      await expect(brand.locator('.filter-multi-options input')).toHaveCount(0);
      const firstOption = brand.getByRole('button', { name: "A&B's Lab", exact: true });
      const row = (await firstOption.boundingBox())!;
      // The far edge and padding toggle the option, not only its text or icon.
      await firstOption.click({ position: { x: row.width - 3, y: row.height / 2 } });
      await expect(firstOption).toHaveAttribute('aria-pressed', 'true');
      await expect(firstOption.locator('svg')).toBeVisible();
      await expect(page).toHaveURL(/brand=/);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await brand.getByRole('button', { name: 'Bandai', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.getAll('brand')).toEqual(["A&B's Lab", 'Bandai']);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.screenshot({ path: `../../.artifacts/model-universe/catalog-multi-${locale}-${width}.png` });
      await brand.getByRole('button', { name: m.common.close, exact: true }).click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(brand.getByRole('button', { name: 'Bandai', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      const condition = filters.locator('.filter-multi').first();
      await condition.getByRole('button').first().click();
      await condition.getByRole('button', { name: m.catalog.new, exact: true }).click();
      await condition.getByRole('button', { name: '2hand', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.getAll('condition')).toEqual(['new', 'preowned']);
      await page.getByRole('heading', { level: 1 }).click();
      await expect(condition.getByRole('button').first()).toHaveAttribute('aria-expanded', 'false');
      await page.reload();
      if (width === 390) await sidebar.locator('summary').click();
      await trigger.click();
      await expect(brand.getByRole('button', { name: "A&B's Lab", exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(brand.getByRole('button', { name: 'Bandai', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', { name: m.commerceUX.removeFilter.replace('{name}', "A&B's Lab"), exact: true })
        .click();
      await expect.poll(() => new URL(page.url()).searchParams.getAll('brand')).toEqual(['Bandai']);
      expect(new URL(page.url()).searchParams.getAll('condition')).toEqual(['new', 'preowned']);
      await page.goBack();
      await expect.poll(() => new URL(page.url()).searchParams.getAll('brand')).toEqual(["A&B's Lab", 'Bandai']);
      await expect.poll(() => state.queries.at(-1)?.getAll('brand')).toEqual(["A&B's Lab", 'Bandai']);
      const cards = page.locator('.product-tile:visible');
      await expect(cards.locator('.tile-condition')).toHaveText([m.catalog.new, '2hand', m.catalog.new, '2hand']);
      for (const card of await cards.all()) {
        const badge = (await card.locator('.tile-condition').boundingBox())!;
        expect(badge.height).toBeGreaterThanOrEqual(26);
        for (const status of await card.locator('.tile-soldout').all()) {
          const rect = (await status.boundingBox())!;
          expect(rect.x).toBeGreaterThan(badge.x + badge.width + 4);
        }
      }
      await page.screenshot({ path: `../../.artifacts/model-universe/catalog-badges-${locale}-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(state.writes).toEqual([]);
    });
  }
