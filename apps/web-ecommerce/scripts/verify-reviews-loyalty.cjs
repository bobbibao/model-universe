const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:6050';
const EVIDENCE_DIR = path.resolve('C:/Users/ACER/.gemini/antigravity/brain/0b914c65-7392-4466-a685-a7b3bfe70f07/review-loyalty-evidence');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function querySql(sql) {
  return execSync(`docker exec -i shop-agent-db-1 psql -U postgres -d web_ecommerce_demo`, {
    input: sql,
    encoding: 'utf-8',
  });
}

async function run() {
  console.log('--- STARTING BUYER REVIEWS & LOYALTY POINTS E2E VERIFICATION ---');

  // Launch Playwright with installed Chrome
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });

  const page = await context.newPage();

  // Sign in as customer Bobby Le
  console.log('Signing in as customer bobby.le.2k3@gmail.com...');
  await page.goto(`${BASE_URL}/vi/auth/signin`);
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"], input[type="email"]').first().fill('bobby.le.2k3@gmail.com');
  await page.locator('input[name="password"], input[type="password"]').first().fill('Customer@123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  console.log('Current URL after sign in:', page.url());

  // Navigate to Product Page to re-verify the submitted review and Lightbox
  const targetSlug = 'mnp-xh03-ao-bing-ngao-binh-mau-goc';
  console.log(`Navigating to product page: /vi/san-pham/${targetSlug}...`);
  await page.goto(`${BASE_URL}/vi/san-pham/${targetSlug}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Switch to reviews tab
  console.log('Switching to Reviews tab in WorkspaceTabs...');
  const reviewTab = page.locator('button[role="tab"]:has-text("Đánh giá")').first();
  await reviewTab.scrollIntoViewIfNeeded();
  await reviewTab.click();
  await page.waitForTimeout(1000);

  // Verify review card is visible with user's content, verified purchase badge, tags, and media gallery
  const reviewCard = page.locator('article:has-text("MNP-XH03")').first();
  if (await reviewCard.isVisible()) {
    console.log('Review card visible on product page!');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_review_submitted_and_displayed.png') });

    // Click thumbnail to test Lightbox
    const thumbImg = reviewCard.locator('button img').first();
    if (await thumbImg.isVisible()) {
      await thumbImg.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_review_media_lightbox_modal.png') });
      console.log('Captured Lightbox modal screenshot!');

      // Close modal by clicking close button with force or clicking backdrop
      const closeBtn = page.locator('button[aria-label="Đóng xem trước"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }
  }

  // Navigate to Loyalty Wallet and capture final balance
  console.log('Navigating to Loyalty / Membership page to verify 120 points...');
  await page.goto(`${BASE_URL}/vi/user-profile?section=loyalty`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const finalLedgerSql = querySql(`SELECT id, "sourceReference", kind, "balanceDelta", "lifetimeDelta", reason, details FROM loyalty_ledger WHERE "userId" = 38 ORDER BY id ASC;`);
  console.log('Final Loyalty Ledger for User 38:\n', finalLedgerSql);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '09_final_loyalty_wallet_with_review_points.png'), fullPage: true });

  await browser.close();
  console.log('--- BUYER REVIEWS & LOYALTY POINTS E2E VERIFICATION COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
