const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const {
  renderOrderConfirmationEmail,
  renderOrderCancelledEmail,
  renderShipmentEmail,
  renderRestockAlertEmail,
  renderOtpEmail,
  renderPasswordResetEmail,
  renderPawnNoticeEmail,
  renderReservationNoticeEmail,
  renderBuybackNoticeEmail,
  renderVoucherNoticeEmail,
  renderLoyaltyRewardEmail,
  renderAdminAlertEmail,
  renderAutoFormattedEmail,
} = require('../dist/.next/src/core/server/services/mail/EmailTemplate');
const { commerceEmail } = require('../dist/.next/src/core/server/services/CommerceEmailService');

const OUTPUT_DIR = path.resolve('C:/Users/ACER/.gemini/antigravity/brain/0b914c65-7392-4466-a685-a7b3bfe70f07/email-suite-evidence');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function capture() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  const templates = [
    {
      name: '01_pawn_update_screenshot_fix',
      title: 'Hồ sơ cầm cố có cập nhật (Screenshot Fix)',
      html: commerceEmail('pawn_update', 4, {
        status: 'Đã hoàn tất kiểm định tài sản',
        stage: 'Chờ khách hàng ký biên bản nhận giải ngân',
      }, { firstName: 'Bobby', lastName: 'Lê' }).body,
    },
    {
      name: '02_pawn_due_reminder',
      title: 'Nhắc hạn hợp đồng cầm cố T-10',
      html: commerceEmail('pawn_due', 4, {
        days: 10,
        dueAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      }, { firstName: 'Bobby', lastName: 'Lê' }).body,
    },
    {
      name: '03_order_confirmed',
      title: 'Xác nhận đơn hàng thành công',
      html: renderOrderConfirmationEmail({
        orderId: 960,
        orderCode: 'ORD-960',
        customerName: 'Bobby Lê',
        totalVnd: 1388889,
        paymentMethod: 'Chuyển khoản QR payOS (Đã xác nhận)',
        shippingAddress: '789 Trần Hưng Đạo, Phường 1, Quận 5, TP. Hồ Chí Minh',
        items: [
          { name: 'MNP-XH03 - Ao Bing / Ngao Bính (màu gốc)', quantity: 1, unitPrice: 611111 },
          { name: 'MNP-XH02A - Cao Ren / Tào Nhân (màu gốc)', quantity: 1, unitPrice: 777778 },
        ],
        orderUrl: 'http://localhost:6050/vi/user-profile?section=orders',
      }),
    },
    {
      name: '04_loyalty_points_earned',
      title: 'Điểm thưởng thành viên vừa được cộng',
      html: renderLoyaltyRewardEmail({
        customerName: 'Bobby Lê',
        points: 139,
        reason: 'Tích luỹ 10% điểm thưởng từ đơn hàng thành công #ORD-960',
        orderId: 960,
        balance: 539,
        actionUrl: 'http://localhost:6050/vi/user-profile?section=loyalty',
      }),
    },
    {
      name: '05_review_reward',
      title: 'Thưởng điểm đánh giá sản phẩm kèm ảnh & video',
      html: renderLoyaltyRewardEmail({
        customerName: 'Bobby Lê',
        points: 100,
        reason: 'Đánh giá sản phẩm chi tiết kèm 3 hình ảnh & 1 video thực tế đã được duyệt',
        balance: 639,
        actionUrl: 'http://localhost:6050/vi/user-profile?section=loyalty',
      }),
    },
    {
      name: '06_shipment_tracking',
      title: 'Mã vận đơn & Tra cứu bưu kiện',
      html: renderShipmentEmail({
        orderCode: 'ORD-960',
        customerName: 'Bobby Lê',
        carrierName: 'VNPost Express',
        trackingNumber: 'VNPOST69365376VN',
        trackingUrl: 'http://localhost:6050/vi/user-profile?section=orders',
        codAmountVnd: 0,
        orderUrl: 'http://localhost:6050/vi/user-profile?section=orders',
      }),
    },
    {
      name: '07_admin_alert_pawn',
      title: 'Cảnh báo Quản trị: Hồ sơ cầm cố mới',
      html: renderAdminAlertEmail({
        title: 'MODEL universe – ĐỀ XUẤT TÌNH TRẠNG CẦM MỚI #4',
        content: `Mã hồ sơ: #4\nKhách hàng: Bobby Lê\nSố điện thoại: 0373498729\nSản phẩm tài sản: MGEX 1/100 Strike Freedom Gundam\nKhoản vay đề xuất: 2.500.000 ₫\nThời hạn: 30 ngày\nLãi suất niêm yết: 3.5%/tháng\nTrạng thái: Chờ chuyên viên thẩm định.\nXem hồ sơ: http://localhost:6050/vi/admin/pawn`,
        severity: 'Cầm cố mới',
        actionUrl: 'http://localhost:6050/vi/admin/pawn',
      }),
    },
    {
      name: '08_auto_formatted_fallback',
      title: 'Fallback tự động chuẩn hóa văn bản thô',
      html: renderAutoFormattedEmail(
        'Hồ sơ cầm cố có cập nhật',
        `Hồ sơ cầm cố có cập nhật.\nMã hồ sơ: #4.\nĐăng nhập để xem nội dung và các bước tiếp theo: http://localhost:6050/vi/user-profile?section=inbox\nKhông chia sẻ mật khẩu hoặc mã OTP. Email này không yêu cầu chuyển tiền vào tài khoản khác.`
      ),
    },
  ];

  for (const t of templates) {
    await page.setContent(t.html, { waitUntil: 'load' });
    const screenshotPath = path.join(OUTPUT_DIR, `${t.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✓ Captured preview: ${t.name}.png`);
  }

  await browser.close();
  console.log('All email previews successfully captured in:', OUTPUT_DIR);
}

capture().catch(console.error);
