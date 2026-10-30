const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:6050';
const EVIDENCE_DIR = path.resolve('C:/Users/ACER/.gemini/antigravity/brain/0b914c65-7392-4466-a685-a7b3bfe70f07/screen-width-1440-evidence');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '1440p_MacBook_Desktop', width: 1440, height: 900 },
  { name: '1600p_Wide_Desktop', width: 1600, height: 900 },
  { name: '1920p_FullHD_Monitor', width: 1920, height: 1080 },
  { name: '2560p_2K_QHD_Ultrawide', width: 2560, height: 1440 },
  { name: '1280p_Compact_Laptop', width: 1280, height: 800 },
  { name: '768p_Tablet_iPad', width: 768, height: 1024 },
  { name: '390p_Mobile_iPhone', width: 390, height: 844 },
];

async function run() {
  console.log('--- STARTING SCREEN WIDTH 1440px+ & RESPONSIVE UI VERIFICATION ---');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const report = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'vi-VN',
    });
    const page = await context.newPage();

    // 1. Homepage
    await page.goto(`${BASE_URL}/vi`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const homeWrapMetrics = await page.evaluate(() => {
      const el = document.querySelector('.mu-wrap');
      if (!el) return null;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        computedWidth: style.width,
        renderedWidth: rect.width,
        renderedMarginLeft: style.marginLeft,
        renderedMarginRight: style.marginRight,
      };
    });

    console.log(`[Home] .mu-wrap metrics at ${vp.width}px:`, homeWrapMetrics);

    const homeShot = path.join(EVIDENCE_DIR, `home_${vp.name}.png`);
    await page.screenshot({ path: homeShot, fullPage: false });

    // 2. Catalog / Shop Page
    await page.goto(`${BASE_URL}/vi/cua-hang`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const catalogGridMetrics = await page.evaluate(() => {
      const grid = document.querySelector('.catalog-product-grid');
      const cards = document.querySelectorAll('.catalog-product-grid > div');
      if (!grid) return null;
      const style = window.getComputedStyle(grid);
      const gridCols = style.gridTemplateColumns.split(' ').length;
      const firstCardWidth = cards[0] ? cards[0].getBoundingClientRect().width : 0;
      return {
        gridTemplateColumnsCount: gridCols,
        cardWidth: Math.round(firstCardWidth),
        totalCards: cards.length,
      };
    });

    console.log(`[Catalog] Grid metrics at ${vp.width}px:`, catalogGridMetrics);

    const catalogShot = path.join(EVIDENCE_DIR, `catalog_${vp.name}.png`);
    await page.screenshot({ path: catalogShot, fullPage: false });

    // 3. Product Detail Page
    const targetSlug = 'mnp-xh03-ao-bing-ngao-binh-mau-goc';
    await page.goto(`${BASE_URL}/vi/san-pham/${targetSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const productDetailMetrics = await page.evaluate(() => {
      const layout = document.querySelector('.product-detail-layout');
      const media = document.querySelector('.product-detail-media');
      const offer = document.querySelector('.product-detail-offer');
      return {
        layoutWidth: layout ? layout.getBoundingClientRect().width : 0,
        mediaWidth: media ? media.getBoundingClientRect().width : 0,
        offerWidth: offer ? offer.getBoundingClientRect().width : 0,
      };
    });

    console.log(`[Product Detail] Layout metrics at ${vp.width}px:`, productDetailMetrics);

    const detailShot = path.join(EVIDENCE_DIR, `product_detail_${vp.name}.png`);
    await page.screenshot({ path: detailShot, fullPage: false });

    // 4. Cart Page
    await page.goto(`${BASE_URL}/vi/cart`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const cartShot = path.join(EVIDENCE_DIR, `cart_${vp.name}.png`);
    await page.screenshot({ path: cartShot, fullPage: false });

    // 5. User Profile Page (Sign in first if needed, or view overview)
    await page.goto(`${BASE_URL}/vi/auth/signin`);
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill('bobby.le.2k3@gmail.com');
    await page.locator('input[name="password"], input[type="password"]').first().fill('Customer@123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1500);

    await page.goto(`${BASE_URL}/vi/user-profile?section=loyalty`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const profileShot = path.join(EVIDENCE_DIR, `profile_loyalty_${vp.name}.png`);
    await page.screenshot({ path: profileShot, fullPage: false });

    report.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      homeWrapMetrics,
      catalogGridMetrics,
      productDetailMetrics,
    });

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n--- ALL VIEWPORT SCREENSHOTS & METRICS CAPTURED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Viewport verification failed:', err);
  process.exit(1);
});
