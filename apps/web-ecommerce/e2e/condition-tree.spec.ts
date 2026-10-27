import { test, expect } from '@playwright/test';

// Explicitly opt in against the isolated condition demo. Never run this suite against the shop by default.
test.describe('condition catalog demo', () => {
  test.skip(process.env.CONDITION_DEMO_E2E !== 'true', 'Requires the isolated condition demo.');
  test.beforeEach(async ({ context }) => {
    const login = await context.request.post('/api/auth/login', {
      data: { email: 'admin@condition.demo', password: process.env.CONDITION_DEMO_PASSWORD ?? 'Demo@2026!' },
    });
    expect(login.ok()).toBeTruthy();
  });

  test('library has a navigable tree and global editable/select controls', async ({ page }) => {
    await page.goto('/vi/admin/products/conditions');
    await expect(page.getByRole('heading', { name: 'Cây tình trạng', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mở nhánh Hộp', exact: true }).click();
    await page.locator('.catalog-tree-node').filter({ hasText: 'Thiếu hộp' }).first().click();
    await expect(page.getByRole('textbox', { name: 'Tên tiếng Việt', exact: true })).toHaveValue('Thiếu hộp');
    await expect(page.getByLabel('Nhánh cha / di chuyển đến')).toBeEnabled();
    await expect(page.getByLabel('Vai trò của nhánh')).toHaveValue('condition');
    await expect(page.locator('.catalog-tree-editor')).toBeVisible();
  });

  test('an unused condition can be created, renamed and removed through Admin', async ({ page }) => {
    const name = `E2E condition ${Date.now()}`;
    await page.goto('/vi/admin/products/conditions');
    await page.getByRole('textbox', { name: 'Tên tiếng Việt', exact: true }).fill(name);
    await page.getByRole('button', { name: 'Lưu nhánh', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã lưu' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Tên tiếng Việt', exact: true }).fill(`${name} renamed`);
    await page.getByRole('button', { name: 'Lưu nhánh', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Tìm tình trạng', exact: true }).fill(name);
    await expect(page.locator('.catalog-tree-node').filter({ hasText: `${name} renamed` })).toBeVisible();
    await page.getByRole('button', { name: 'Xóa nhánh chưa dùng', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(page.locator('.catalog-tree-node').filter({ hasText: name })).toHaveCount(0);
  });

  test('English Admin retains English item types and readonly stock', async ({ page }) => {
    await page.goto('/en/admin/products/5');
    await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'Available stock', exact: true })).toHaveAttribute(
      'readonly',
      '',
    );
    await page.goto('/en/admin/products/5?section=conditions');
    await expect(page.locator('.condition-tree-picker')).toBeVisible();
    await page.goto('/en/shop/product/5');
    await expect(page.locator('.condition-option').first()).toContainText('2hand');
    await expect(page.getByRole('heading', { name: 'Other conditions of this model', exact: true })).toBeVisible();
  });

  test('duplicate combination points to the existing SKU and disables draft creation', async ({ page }) => {
    await page.goto('/vi/admin/products/5?section=conditions');
    await page.getByRole('button', { name: '+ Thêm tổ hợp', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Tổ hợp này đã có sản phẩm.', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Lưu nháp · tồn 0' })).toBeDisabled();
    await dialog.getByLabel('Loại hàng', { exact: true }).selectOption('new');
    await expect(dialog.getByText('Tổ hợp này đã có sản phẩm.', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Mở sản phẩm/ })).toHaveAttribute('href', /\/admin\/products\/1$/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('each SKU opens directly and switching the condition updates the URL and cart identity', async ({
    page,
    context,
  }) => {
    await context.request.post('/api/auth/login', {
      data: { email: 'customer@condition.demo', password: process.env.CONDITION_DEMO_PASSWORD ?? 'Demo@2026!' },
    });
    await page.goto('/vi/shop/product/5');
    await expect(page.locator('.condition-option')).toHaveCount(5);
    await expect(page.locator('.condition-option input:checked')).toHaveValue('5');
    const previous = page.url();
    await page
      .locator('.condition-option')
      .filter({ has: page.locator('input[value="1"]') })
      .click();
    await expect(page).not.toHaveURL(previous);
    await expect(page.locator('.condition-option input:checked')).toHaveValue('1');
    await page
      .locator('.condition-option')
      .filter({ has: page.locator('input[value="5"]') })
      .click();
    await expect(page.locator('.condition-option input:checked')).toHaveValue('5');
    await page
      .getByRole('button', { name: /Thêm.*giỏ/ })
      .first()
      .click();
    await page.goto('/vi/cart');
    await expect(page.getByText(/Thiếu hộp/).first()).toBeVisible();
    await expect(page.getByText(/Tay trái/).first()).toBeVisible();
  });

  test('item types are multi-select text rows and the picker stays open', async ({ page }) => {
    await page.goto('/vi/cua-hang');
    const picker = page.locator('.filter-multi:visible').filter({ hasText: 'Loại hàng' });
    const trigger = picker.locator('.filter-multi-trigger');
    await trigger.click();
    await picker.getByRole('button', { name: 'New', exact: true }).click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await picker.getByRole('button', { name: '2hand', exact: true }).click();
    await expect(picker.locator('[aria-pressed="true"]')).toHaveCount(2);
    await expect(picker.locator('input[type="checkbox"]')).toHaveCount(0);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('model groups list separate prices and quantities without changing stock', async ({ page }) => {
    await page.goto('/vi/admin/products');
    await page.getByRole('tab', { name: 'Nhóm theo mẫu', exact: true }).click();
    await expect(page.locator('.catalog-family-card')).toHaveCount(10);
    await page.locator('.catalog-family-card summary').first().click();
    await expect(page.locator('.catalog-family-card[open] .catalog-variant-table')).toBeVisible();
    await expect(page.locator('.catalog-family-card[open] .catalog-money').first()).not.toHaveText('');
  });

  test('mobile pages keep table overflow inside their own scrollport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      '/vi/admin/products/5?section=conditions',
      '/vi/admin/products/conditions',
      '/vi/shop/product/5',
      '/vi/cua-hang',
    ]) {
      await page.goto(path);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    }
    await page.screenshot({ path: test.info().outputPath('condition-shop-mobile.png') });
  });

  test('Admin selection toggles independently and a fully selected parent has a derived tick', async ({ page }) => {
    await page.goto('/en/admin/products/conditions');
    const box = page.locator('.catalog-tree-node').filter({ hasText: /^Box/ });
    const accessories = page.locator('.catalog-tree-node').filter({ hasText: /^Accessories/ });
    await box.click();
    await accessories.click();
    await expect(box).toHaveAttribute('aria-pressed', 'true');
    await expect(accessories).toHaveAttribute('aria-pressed', 'true');
    await accessories.click();
    await expect(accessories).toHaveAttribute('aria-pressed', 'false');
    await expect(box).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Guidance')).toHaveCount(0);
    await expect(page.locator('.catalog-tree-add')).toHaveCount(0);
    await page.goto('/en/admin/products/5?section=conditions');
    await page.getByRole('button', { name: '+ Add combination', exact: true }).click();
    const picker = page.getByRole('dialog').locator('.condition-tree-picker');
    await picker.getByRole('button', { name: 'Damaged box', exact: true }).click();
    await picker.getByRole('button', { name: 'Expand Damaged box', exact: true }).click();
    for (const name of ['Dented box', 'Torn box', 'Water-damaged box'])
      await picker.getByRole('button', { name, exact: true }).click();
    await expect(picker.getByRole('button', { name: 'Damaged box', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await picker.getByRole('button', { name: 'Torn box', exact: true }).click();
    await expect(picker.getByRole('button', { name: 'Damaged box', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await picker.getByRole('button', { name: 'Torn box', exact: true }).click();
    await picker.getByRole('button', { name: 'Damaged box', exact: true }).click();
    await expect(picker.getByRole('button', { name: 'Damaged box', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(picker.locator('.condition-tree-choice').filter({ hasText: '+' })).toHaveCount(0);
  });
});
