const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:6050';
const ARTIFACTS_DIR = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\0b914c65-7392-4466-a685-a7b3bfe70f07\\toast-verification';

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('--- STARTING SENIOR MINIMALIST TOAST SYSTEM VERIFICATION ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  try {
    // ========================================================================
    // 1. Desktop Test: Limit 3, Minimalist Senior UI, No Buttons, Card Navigation
    // ========================================================================
    console.log('\n[1] Testing Desktop Toast: Senior Clean UI & Card Navigation');
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopContext.newPage();

    await page.goto(`${BASE_URL}/vi/shop`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Find and click "Thêm vào giỏ" button on a product card
    const addToBagButtons = page.locator('button').filter({ hasText: /Thêm vào giỏ|Chọn & mua/i });
    const count = await addToBagButtons.count();
    console.log(`Found ${count} purchase/cart buttons on shop page`);

    if (count > 0) {
      // Click 4 times rapidly to test Limit 3
      await addToBagButtons.first().click();
      await page.waitForTimeout(200);
      await addToBagButtons.first().click();
      await page.waitForTimeout(200);
      await addToBagButtons.first().click();
      await page.waitForTimeout(200);
      await addToBagButtons.first().click();
      await page.waitForTimeout(500);
    } else {
      await page.goto(`${BASE_URL}/vi/contact`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const copyBtn = page.locator('button').filter({ hasText: /Sao chép/i }).first();
      await copyBtn.click();
      await page.waitForTimeout(200);
      await copyBtn.click();
      await page.waitForTimeout(200);
      await copyBtn.click();
      await page.waitForTimeout(200);
      await copyBtn.click();
    }

    await page.waitForTimeout(600);

    // Verify limit: at most 3 toasts mounted
    const visibleToasts = await page.locator('.Toastify__toast').count();
    console.log(`Visible toasts count in DOM: ${visibleToasts}`);
    assert.ok(visibleToasts <= 3, `Expected at most 3 toasts, but got ${visibleToasts}`);
    console.log('✓ PASS: Limit 3 enforced (at most 3 visible simultaneously)');

    // Verify NO action buttons exist on the toast (clean minimalist requirement)
    const buttonCount = await page.locator('.Toastify__toast button:not(.mu-toast-close)').count();
    console.log(`Buttons inside toast (excluding close button): ${buttonCount}`);
    assert.strictEqual(buttonCount, 0, 'Toasts must NOT have action pill buttons inside!');
    console.log('✓ PASS: Action button completely removed as requested (no clumsy pills)');

    // Verify NO progress bar is shown
    const progressBarVisible = await page.locator('.Toastify__progress-bar').isVisible().catch(() => false);
    assert.strictEqual(progressBarVisible, false, 'Progress bar must not be visible in senior toast design');
    console.log('✓ PASS: Loud progress bar eliminated');

    // Verify NO 4px colored border stripes (clean uniform border)
    const firstToast = page.locator('.Toastify__toast').first();
    const borderLeftWidth = await firstToast.evaluate((el) => getComputedStyle(el).borderLeftWidth);
    console.log(`Toast border-left-width: ${borderLeftWidth}`);
    assert.strictEqual(borderLeftWidth, '1px', 'Toast border must be a clean, uniform 1px hairline border');
    console.log('✓ PASS: Loud color bars eliminated, clean 1px border verified');

    // Hover over the toast card and take desktop screenshot
    await firstToast.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_desktop_toast_stack.png') });
    console.log('✓ Saved desktop minimalist toast screenshot (hover state)');

    // Test Card Click-to-Navigate
    const navigableCard = page.locator('.mu-toast-wrapper.is-navigable').first();
    const hasNav = (await navigableCard.count()) > 0;
    if (hasNav) {
      console.log('Navigable toast card found, clicking card to navigate...');
      await navigableCard.click();
      await page.waitForTimeout(1500);
      console.log(`Current URL after clicking toast card: ${page.url()}`);
      assert.ok(page.url().includes('/cart'), `Expected navigation to /cart, got: ${page.url()}`);
      console.log('✓ PASS: Toast card click-to-navigate operational without clumsy buttons');
    }

    await desktopContext.close();

    // ========================================================================
    // 2. Mobile Test: Positioning, Safe Area, and Responsive non-blocking layout
    // ========================================================================
    console.log('\n[2] Testing Mobile Toast Layout (iPhone 390x844)');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(`${BASE_URL}/vi/shop`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);

    const mobileAddBtn = mobilePage.locator('button').filter({ hasText: /Thêm vào giỏ|Chọn & mua/i }).first();
    await mobileAddBtn.click();
    await mobilePage.waitForTimeout(600);

    const mobileToast = mobilePage.locator('.Toastify__toast').first();
    await mobileToast.waitFor({ state: 'visible', timeout: 5000 });

    const box = await mobileToast.boundingBox();
    console.log(`Mobile toast box:`, box);

    // Verify it is NOT sticking to top: 0 (which blocks mobile header)
    assert.ok(box.y >= 50, `Mobile toast y (${box.y}) must be >= 50px below header to not block top bar!`);
    console.log(`✓ PASS: Mobile toast top offset is ${box.y}px (clears mobile header)`);

    // Verify it is NOT 100vw width (not sticking to screen edges 0px)
    assert.ok(box.width < 390, `Mobile toast width (${box.width}px) must be less than 390px (has floating margins)`);
    assert.ok(box.x > 0, `Mobile toast x (${box.x}px) must be greater than 0 (not stuck to left edge)`);
    console.log(`✓ PASS: Mobile toast floats centered with width ${box.width}px and margins on left/right`);

    // Take Mobile Screenshot
    await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, '02_mobile_toast_floating.png') });
    console.log('✓ Saved mobile toast screenshot');

    await mobileContext.close();
    console.log('\n=== ALL SENIOR TOAST SYSTEM VERIFICATION CHECKS PASSED ===');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
