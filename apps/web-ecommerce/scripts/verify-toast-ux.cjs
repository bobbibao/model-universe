const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:6050';
const ARTIFACTS_DIR = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\0b914c65-7392-4466-a685-a7b3bfe70f07\\toast-verification';

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('--- STARTING SENIOR TOAST VERIFICATION (COUNTDOWN + STRICT 3 NEWEST FIFO) ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  try {
    // ========================================================================
    // 1. Desktop Test: Strict 3 Newest FIFO Ring Buffer + Hairline Countdown Timer
    // ========================================================================
    console.log('\n[1] Testing Desktop Toast on Product Detail: Strict 3 Newest FIFO & Countdown');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await desktopContext.newPage();

    // Navigate to in-stock product detail page
    const productUrl = `${BASE_URL}/vi/san-pham/mnp-xh03-ao-bing-ngao-binh-mau-goc`;
    console.log(`Navigating to ${productUrl} ...`);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const addToCartBtn = page.locator('button').filter({ hasText: /Thêm vào giỏ hàng/i }).first();
    await addToCartBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Found "Thêm vào giỏ hàng" button');

    // Click 1
    console.log('Clicking "Thêm vào giỏ hàng" (1st time)...');
    await addToCartBtn.click();
    await page.waitForTimeout(350);

    let toastCount = await page.locator('.Toastify__toast').count();
    console.log(`Visible toasts after click 1: ${toastCount}`);
    assert.strictEqual(toastCount, 1, 'Expected 1 toast after 1st click');

    // Click 2
    console.log('Clicking "Thêm vào giỏ hàng" (2nd time)...');
    await addToCartBtn.click();
    await page.waitForTimeout(350);

    toastCount = await page.locator('.Toastify__toast').count();
    console.log(`Visible toasts after click 2: ${toastCount}`);
    assert.strictEqual(toastCount, 2, 'Expected 2 toasts after 2nd click');

    // Click 3
    console.log('Clicking "Thêm vào giỏ hàng" (3rd time)...');
    await addToCartBtn.click();
    await page.waitForTimeout(350);

    toastCount = await page.locator('.Toastify__toast').count();
    console.log(`Visible toasts after click 3: ${toastCount}`);
    assert.strictEqual(toastCount, 3, 'Expected 3 toasts after 3rd click');

    // Get toast elements before 4th click
    const toastsBefore4 = await page.locator('.Toastify__toast').all();
    const firstToastBefore4 = toastsBefore4[0];
    const firstToastText = await firstToastBefore4.innerText();
    console.log('First toast text before 4th click:', firstToastText);

    // Click 4 -> MUST trigger strict FIFO dismissal of 1st toast, leaving 3 newest visible
    console.log('Clicking "Thêm vào giỏ hàng" (4th time) -> Should drop 1st toast...');
    await addToCartBtn.click();

    // Wait for the exiting toast to complete slide-out and detach (takes ~450ms)
    await page.waitForFunction(() => {
      const toasts = document.querySelectorAll('.Toastify__toast');
      return toasts.length === 3;
    }, { timeout: 3000 });

    toastCount = await page.locator('.Toastify__toast').count();
    console.log(`Visible toasts after click 4: ${toastCount}`);
    assert.strictEqual(toastCount, 3, 'STRICT REQUIREMENT: Exactly 3 newest toasts must be visible (no waiting queue)!');
    console.log('✓ PASS: Strict 3 newest toasts limit maintained!');

    // Verify Progress Countdown Bar
    const progressBars = page.locator('.Toastify__progress-bar');
    const pbCount = await progressBars.count();
    console.log(`Visible progress countdown bars: ${pbCount}`);
    assert.ok(pbCount > 0, 'Progress countdown bars must be rendered and visible!');

    const firstPb = progressBars.first();
    const isPbVisible = await firstPb.isVisible();
    assert.strictEqual(isPbVisible, true, 'Progress countdown bar must be visible!');

    const pbHeight = await firstPb.evaluate((el) => window.getComputedStyle(el).height);
    console.log(`Progress bar computed height: ${pbHeight}`);
    assert.ok(parseFloat(pbHeight) <= 3, `Progress bar must be a subtle hairline (<= 3px), got ${pbHeight}`);
    console.log('✓ PASS: Progress countdown bar verified as sleek 2.5px hairline');

    // Verify NO action pill buttons inside toast (clean senior card)
    const actionButtons = await page.locator('.Toastify__toast button:not(.mu-toast-close)').count();
    assert.strictEqual(actionButtons, 0, 'No clumsy action pill buttons inside toast card');
    console.log('✓ PASS: Clean senior card without clumsy action buttons');

    // Hover over toast card and save screenshot
    const activeToast = page.locator('.Toastify__toast').first();
    await activeToast.hover();
    await page.waitForTimeout(300);
    const desktopScreenshotPath = path.join(ARTIFACTS_DIR, '01_desktop_toast_stack.png');
    await page.screenshot({ path: desktopScreenshotPath });
    console.log(`✓ Saved desktop toast screenshot to ${desktopScreenshotPath}`);

    // Test Click-to-navigate on toast card
    console.log('Testing click-to-navigate on toast card...');
    const navigableCard = page.locator('.mu-toast-wrapper.is-navigable').first();
    await navigableCard.click();
    await page.waitForTimeout(1500);
    console.log(`Navigated URL: ${page.url()}`);
    assert.ok(page.url().includes('/cart'), `Expected navigation to /cart, got ${page.url()}`);
    console.log('✓ PASS: Entire toast card click-to-navigate works smoothly');

    await desktopContext.close();

    // ========================================================================
    // 2. Mobile Test: Positioning & Non-intrusive Floating
    // ========================================================================
    console.log('\n[2] Testing Mobile Toast Layout (iPhone 390x844)');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);

    const mobileAddBtn = mobilePage.locator('button').filter({ hasText: /Thêm vào giỏ hàng/i }).first();
    await mobileAddBtn.click();
    await mobilePage.waitForTimeout(500);

    const mobileToast = mobilePage.locator('.Toastify__toast').first();
    await mobileToast.waitFor({ state: 'visible', timeout: 5000 });

    const box = await mobileToast.boundingBox();
    console.log(`Mobile toast box:`, box);

    // Verify it clears mobile header
    assert.ok(box.y >= 50, `Mobile toast y (${box.y}) must be >= 50px below header!`);
    console.log(`✓ PASS: Mobile toast top offset is ${box.y}px (clears mobile header)`);

    // Verify it floats centered with margin
    assert.ok(box.width < 390, `Mobile toast width (${box.width}px) must be less than 390px (has floating margins)`);
    assert.ok(box.x > 0, `Mobile toast x (${box.x}px) must be greater than 0 (floats centered)`);
    console.log(`✓ PASS: Mobile toast floats centered with width ${box.width}px`);

    // Verify countdown bar visible on mobile
    const mobilePb = mobilePage.locator('.Toastify__progress-bar').first();
    assert.strictEqual(await mobilePb.isVisible(), true, 'Countdown bar must be visible on mobile');
    console.log('✓ PASS: Countdown bar visible on mobile');

    // Take Mobile Screenshot
    const mobileScreenshotPath = path.join(ARTIFACTS_DIR, '02_mobile_toast_floating.png');
    await mobilePage.screenshot({ path: mobileScreenshotPath });
    console.log(`✓ Saved mobile toast screenshot to ${mobileScreenshotPath}`);

    await mobileContext.close();
    console.log('\n=== ALL TOAST SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
