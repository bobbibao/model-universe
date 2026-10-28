const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../node_modules/@playwright/test'));

async function run() {
  const screenshotsDir = 'C:/Users/ACER/.gemini/antigravity/brain/0b914c65-7392-4466-a685-a7b3bfe70f07/services-ui-screenshots';
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/ACER/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:6060/vi/services (Guest - Services Tab)...');
  await page.goto('http://localhost:6060/vi/services', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '01-services-hub-guest.png') });
  console.log('Saved 01-services-hub-guest.png');

  console.log('2. Logging in as customer1@example.com...');
  await page.goto('http://localhost:6060/vi/auth/signin?redirect=/services', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill('customer1@example.com');
  await page.locator('input[name="password"]').fill('Customer@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/services', { timeout: 10000 });
  await page.waitForTimeout(1500);

  console.log('3. Logged-in /services - Switching to Tab "Tra cứu & Lịch sử yêu cầu"...');
  const historyTabBtn = page.getByRole('button', { name: /Tra cứu & Lịch sử yêu cầu/i }).first();
  if (await historyTabBtn.isVisible()) {
    await historyTabBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(screenshotsDir, '02-services-history-tab-top.png') });
  console.log('Saved 02-services-history-tab-top.png');

  console.log('4. Navigating to http://localhost:6060/vi/services/sell (Workspace Tab: Yêu cầu của bạn)...');
  await page.goto('http://localhost:6060/vi/services/sell', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotsDir, '03-services-sell-compact-top.png') });
  console.log('Saved 03-services-sell-compact-top.png');

  console.log('5. Capturing close-up of fixed ServiceHistoryToolbar & redesigned cards...');
  const toolbarArea = page.locator('.service-history-toolbar').first();
  if (await toolbarArea.isVisible()) {
    await toolbarArea.screenshot({ path: path.join(screenshotsDir, '04-fixed-service-history-toolbar.png') });
    console.log('Saved 04-fixed-service-history-toolbar.png');
  }

  console.log('6. Searching for TM46...');
  const searchInput = page.locator('.service-history-toolbar input');
  if (await searchInput.isVisible()) {
    await searchInput.fill('TM46');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotsDir, '05-search-tm46.png') });
    console.log('Saved 05-search-tm46.png');
  }

  console.log('7. Selecting TM46 card to view details, timeline stepper & dual galleries...');
  const tm46Card = page.locator('.service-workspace button').filter({ hasText: 'TM46' }).last();
  await tm46Card.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '06-selected-tm46-detail-stepper.png') });
  console.log('Saved 06-selected-tm46-detail-stepper.png');

  // Verify Tab 1: Thẩm định & Tình trạng
  const tabInspection = page.locator('button').filter({ hasText: 'Thẩm định & Tình trạng' }).first();
  if (await tabInspection.isVisible()) {
    await tabInspection.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '11-detail-tab-inspection.png') });
    console.log('Saved 11-detail-tab-inspection.png');
  }

  // Verify Tab 2: Ảnh & Video
  const tabMedia = page.locator('button').filter({ hasText: 'Ảnh & Video' }).first();
  if (await tabMedia.isVisible()) {
    await tabMedia.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '12-detail-tab-media.png') });
    console.log('Saved 12-detail-tab-media.png');

    // Check media gallery thumbnails inside Tab 2
    const galleryThumbnails = page.locator('.service-media-gallery [role="button"]');
    const thumbCount = await galleryThumbnails.count();
    console.log(`Found ${thumbCount} media gallery thumbnails on TM46.`);

    if (thumbCount > 0) {
      console.log('Opening Lightbox on first thumbnail of TM46...');
      await galleryThumbnails.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotsDir, '07-lightbox-dark-canvas.png') });
      console.log('Saved 07-lightbox-dark-canvas.png');

      console.log('Navigating to next photo with ArrowRight in Lightbox...');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, '08-lightbox-next.png') });
      console.log('Saved 08-lightbox-next.png');

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      console.log('Closed Lightbox via Escape.');
    }
  }

  // Verify Tab 3: Thao tác & Quyết định
  const tabActions = page.locator('button').filter({ hasText: 'Thao tác & Quyết định' }).first();
  if (await tabActions.isVisible()) {
    await tabActions.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '13-detail-tab-actions.png') });
    console.log('Saved 13-detail-tab-actions.png');
  }

  console.log('8. Testing Tab "Gửi yêu cầu Thu mua" toggle...');
  const newReqTabBtn = page.getByRole('button', { name: /Gửi yêu cầu Thu mua/i }).first();
  if (await newReqTabBtn.isVisible()) {
    await newReqTabBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '09-tab-new-request-form.png') });
    console.log('Saved 09-tab-new-request-form.png');
  }

  console.log('9. Testing Mobile Viewport (iPhone 14 / 390x844)...');
  await page.goto('http://localhost:6060/vi/services/sell', { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '10-mobile-responsive-compact.png') });
  console.log('Saved 10-mobile-responsive-compact.png');

  await browser.close();
  console.log('All UI verification steps completed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
