const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:6050';
const ARTIFACTS_DIR = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\0b914c65-7392-4466-a685-a7b3bfe70f07\\toast-verification';

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('--- STARTING REAL TOAST SYSTEM VERIFICATION ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  try {
    // ========================================================================
    // 1. Desktop Test: Limit 3, Compact UI, & Action Navigation
    // ========================================================================
    console.log('\n[1] Testing Desktop Toast: Add to Cart with Action Pill');
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
      // Fallback: click contact copy button to trigger toast
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

    // Verify styling of toast
    const firstToast = page.locator('.Toastify__toast').first();
    const borderRadius = await firstToast.evaluate((el) => getComputedStyle(el).borderRadius);
    console.log(`Toast border radius: ${borderRadius}`);
    assert.strictEqual(borderRadius, '14px', 'Toast border-radius should be 14px');

    // Take Desktop Screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_desktop_toast_stack.png') });
    console.log('✓ Saved desktop toast screenshot');

    // Check if Action button is present
    const actionBtn = page.locator('.mu-toast-action-pill');
    const hasAction = (await actionBtn.count()) > 0;
    console.log(`Action pill button present: ${hasAction}`);
    if (hasAction) {
      const actionText = await actionBtn.first().innerText();
      console.log(`Action button text: "${actionText}"`);
      // Click action button and verify navigation
      await actionBtn.first().click();
      await page.waitForTimeout(1500);
      console.log(`Current URL after clicking action: ${page.url()}`);
      assert.ok(page.url().includes('/cart'), `Expected navigation to /cart, got: ${page.url()}`);
      console.log('✓ PASS: Action button successfully navigates to /cart');
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
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(`${BASE_URL}/vi/shop`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);

    // Click "Thêm vào giỏ" on mobile
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
    console.log('\n=== ALL TOAST SYSTEM VERIFICATION CHECKS PASSED ===');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
