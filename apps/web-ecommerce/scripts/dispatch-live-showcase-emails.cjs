const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
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
  renderServiceNoticeEmail,
  renderLoyaltyRewardEmail,
  renderAdminAlertEmail,
} = require('../dist/.next/src/core/server/services/mail/EmailTemplate');
const { commerceEmail } = require('../dist/.next/src/core/server/services/CommerceEmailService');
const Messages = require('../dist/.next/src/core/server/services/delivery/Messages');

// Read SMTP from infra/.env
const envFile = fs.readFileSync(path.join(__dirname, '../../../infra/.env'), 'utf-8');
const env = {};
envFile.split('\n').forEach((line) => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(env.SMTP_PORT) || 465,
  secure: Number(env.SMTP_PORT) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

const CUSTOMER_EMAIL = 'bobby.le.2k3@gmail.com';
const ADMIN_EMAIL = 'lehoangbao5678@gmail.com';

async function dispatchAll() {
  console.log(`\n======================================================`);
  console.log(`DISPATCHING 100% PRODUCTION EMAIL SUITE`);
  console.log(`Customer: ${CUSTOMER_EMAIL} | Admin: ${ADMIN_EMAIL}`);
  console.log(`======================================================\n`);

  const results = [];

  // 1. Pawn Update Email (Direct fix for screenshot: Contract #4 update)
  const pawnUpdate = commerceEmail('pawn_update', 4, {
    status: 'Đã hoàn tất kiểm định tài sản',
    stage: 'Chờ khách hàng ký biên bản nhận giải ngân',
  }, { firstName: 'Bobby', lastName: 'Lê' });
  const resPawn = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${pawnUpdate.subject}`,
    html: pawnUpdate.body,
  });
  console.log('✓ 1. Pawn Update Email (Screenshot Fix):', resPawn.messageId);
  results.push({ type: 'pawn_update', to: CUSTOMER_EMAIL, id: resPawn.messageId });

  // 2. Pawn Due Reminder (T-10)
  const pawnDue = commerceEmail('pawn_due', 4, {
    days: 10,
    dueAt: new Date(Date.now() + 10 * 86400000).toISOString(),
  }, { firstName: 'Bobby', lastName: 'Lê' });
  const resPawnDue = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${pawnDue.subject}`,
    html: pawnDue.body,
  });
  console.log('✓ 2. Pawn Due Reminder (T-10):', resPawnDue.messageId);
  results.push({ type: 'pawn_due', to: CUSTOMER_EMAIL, id: resPawnDue.messageId });

  // 3. Reservation Update
  const resvUpdate = commerceEmail('reservation_update', 12, {
    status: 'Mô hình đã cập bến showroom, sẵn sàng bàn giao',
  }, { firstName: 'Bobby', lastName: 'Lê' });
  const resResv = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${resvUpdate.subject}`,
    html: resvUpdate.body,
  });
  console.log('✓ 3. Reservation Update Email:', resResv.messageId);
  results.push({ type: 'reservation_update', to: CUSTOMER_EMAIL, id: resResv.messageId });

  // 4. Order Confirmation
  const orderHtml = renderOrderConfirmationEmail({
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
  });
  const resOrder = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Xác nhận đơn hàng #ORD-960 thành công',
    html: orderHtml,
  });
  console.log('✓ 4. Order Confirmation Email:', resOrder.messageId);
  results.push({ type: 'order_confirmed', to: CUSTOMER_EMAIL, id: resOrder.messageId });

  // 5. Order Cancelled & Refund
  const cancelHtml = renderOrderCancelledEmail({
    orderCode: 'ORD-961',
    reasonText: 'Khách hàng đổi ý, yêu cầu huỷ đơn',
    feeVnd: 0,
    refundVnd: 611111,
    prepaidVnd: 611111,
    orderUrl: 'http://localhost:6050/vi/user-profile?section=orders',
  });
  const resCancel = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Đơn hàng #ORD-961 đã được huỷ - Xác nhận hoàn tiền',
    html: cancelHtml,
  });
  console.log('✓ 5. Order Cancelled & Refund Email:', resCancel.messageId);
  results.push({ type: 'order_cancelled', to: CUSTOMER_EMAIL, id: resCancel.messageId });

  // 6. Shipment Tracking Email
  const shipCreated = Messages.emailShipmentCreated('ORD-960', 'Bobby Lê', {
    carrierName: 'VNPost Express',
    trackingNumber: 'VNPOST69365376VN',
    status: 'CREATED',
    codAmountVnd: 0,
    trackingUrl: 'http://localhost:6050/vi/user-profile?section=orders',
  });
  const resShip = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${shipCreated.subject}`,
    html: shipCreated.body,
  });
  console.log('✓ 6. Shipment Tracking Email:', resShip.messageId);
  results.push({ type: 'shipment_tracking', to: CUSTOMER_EMAIL, id: resShip.messageId });

  // 7. Showroom Meeting Confirmed
  const meetingConfirmed = Messages.emailMeetingConfirmed(
    'ORD-962',
    'Bobby Lê',
    'Showroom Model Universe, TP. Hồ Chí Minh',
    '15:00 - 18:00, 31/10/2026',
    411111,
  );
  const resMeeting = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${meetingConfirmed.subject}`,
    html: meetingConfirmed.body,
  });
  console.log('✓ 7. Meeting Confirmed Email:', resMeeting.messageId);
  results.push({ type: 'meeting_confirmed', to: CUSTOMER_EMAIL, id: resMeeting.messageId });

  // 8. Buyback Received
  const bbReceived = Messages.emailBuybackReceived(
    'BB-2026-0042',
    'Bobby Lê',
    'MG 1/100 Barbatos Titanium Finish (Bandai)',
    '30/10/2026 21:00',
    1850000,
  );
  const resBbRec = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${bbReceived.subject}`,
    html: bbReceived.body,
  });
  console.log('✓ 8. Buyback Received Email:', resBbRec.messageId);
  results.push({ type: 'buyback_received', to: CUSTOMER_EMAIL, id: resBbRec.messageId });

  // 9. Buyback Final Quote
  const bbQuote = Messages.emailBuybackQuote(
    'BB-2026-0042',
    'Bobby Lê',
    {
      estimateVnd: 1850000,
      declaredIssueCount: 0,
      inspectedIssueCount: 1,
      deductionDifferenceVnd: 50000,
      finalVnd: 1800000,
    },
  );
  const resBbQuote = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${bbQuote.subject}`,
    html: bbQuote.body,
  });
  console.log('✓ 9. Buyback Final Quote Email:', resBbQuote.messageId);
  results.push({ type: 'buyback_quote', to: CUSTOMER_EMAIL, id: resBbQuote.messageId });

  // 10. Loyalty Points Earned (Order)
  const loyaltyOrder = renderLoyaltyRewardEmail({
    customerName: 'Bobby Lê',
    points: 139,
    reason: 'Tích luỹ 10% điểm thưởng từ đơn hàng thành công #ORD-960',
    orderId: 960,
    balance: 539,
    actionUrl: 'http://localhost:6050/vi/user-profile?section=loyalty',
  });
  const resLoyaltyOrder = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Bạn vừa nhận được +139 điểm tích luỹ thành viên!',
    html: loyaltyOrder,
  });
  console.log('✓ 10. Loyalty Points Earned Email:', resLoyaltyOrder.messageId);
  results.push({ type: 'loyalty_order', to: CUSTOMER_EMAIL, id: resLoyaltyOrder.messageId });

  // 11. Review Reward Points (Photos & Videos)
  const loyaltyReview = renderLoyaltyRewardEmail({
    customerName: 'Bobby Lê',
    points: 100,
    reason: 'Đánh giá sản phẩm chi tiết kèm 3 hình ảnh & 1 video thực tế đã được duyệt',
    balance: 639,
    actionUrl: 'http://localhost:6050/vi/user-profile?section=loyalty',
  });
  const resLoyaltyReview = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Thưởng +100 điểm: Đánh giá mô hình kèm hình ảnh/video!',
    html: loyaltyReview,
  });
  console.log('✓ 11. Review Reward Email:', resLoyaltyReview.messageId);
  results.push({ type: 'loyalty_review', to: CUSTOMER_EMAIL, id: resLoyaltyReview.messageId });

  // 12. Profile Completed Points
  const loyaltyProfile = renderLoyaltyRewardEmail({
    customerName: 'Bobby Lê',
    points: 20,
    reason: 'Hoàn thiện 100% hồ sơ người sưu tầm và thông tin nhận hàng',
    balance: 659,
    actionUrl: 'http://localhost:6050/vi/user-profile?section=profile',
  });
  const resLoyaltyProfile = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Thưởng +20 điểm: Hoàn thiện hồ sơ thành viên!',
    html: loyaltyProfile,
  });
  console.log('✓ 12. Profile Completed Email:', resLoyaltyProfile.messageId);
  results.push({ type: 'loyalty_profile', to: CUSTOMER_EMAIL, id: resLoyaltyProfile.messageId });

  // 13. Restock Alert
  const restockHtml = renderRestockAlertEmail({
    productName: 'MNP-XH02A - Cao Ren / Tào Nhân (màu gốc)',
    stock: 10,
    productUrl: 'http://localhost:6050/vi/san-pham/motor-nuclear-mnp-xh02a-cao-ren-tao-nhan',
    priceVnd: 777778,
    imageUrl: 'http://localhost:6050/uploads/products/3a64894fcccbbb63149991d8c951c38b.webp',
  });
  const resRestock = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Mô hình bạn đăng ký theo dõi đã có hàng trở lại!',
    html: restockHtml,
  });
  console.log('✓ 13. Restock Alert Email:', resRestock.messageId);
  results.push({ type: 'restock_alert', to: CUSTOMER_EMAIL, id: resRestock.messageId });

  // 14. Voucher Expiring
  const voucherExp = Messages.emailVoucherExpiring(
    'Bobby Lê',
    'WELCOME10',
    'Giảm 10% tối đa 150.000 ₫ cho đơn hàng đầu tiên',
    '23:59 02/11/2026',
  );
  const resVoucher = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: `[Model Universe] ${voucherExp.subject}`,
    html: voucherExp.body,
  });
  console.log('✓ 14. Voucher Expiring Email:', resVoucher.messageId);
  results.push({ type: 'voucher_expiring', to: CUSTOMER_EMAIL, id: resVoucher.messageId });

  // 15. Registration OTP
  const otpHtml = renderOtpEmail({
    otp: '849201',
    ttlMinutes: 10,
    email: CUSTOMER_EMAIL,
  });
  const resOtp = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Mã xác thực đăng ký tài khoản của bạn',
    html: otpHtml,
  });
  console.log('✓ 15. Registration OTP Email:', resOtp.messageId);
  results.push({ type: 'otp_registration', to: CUSTOMER_EMAIL, id: resOtp.messageId });

  // 16. Password Reset
  const resetHtml = renderPasswordResetEmail({
    resetUrl: 'http://localhost:6050/vi/auth/reset-password#token=demo-token-123',
    ttlMinutes: 15,
    email: CUSTOMER_EMAIL,
  });
  const resReset = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: CUSTOMER_EMAIL,
    subject: '[Model Universe] Yêu cầu đặt lại mật khẩu',
    html: resetHtml,
  });
  console.log('✓ 16. Password Reset Email:', resReset.messageId);
  results.push({ type: 'password_reset', to: CUSTOMER_EMAIL, id: resReset.messageId });

  // 17. Admin Alert: New Direct Meeting Order
  const adminMeetingHtml = renderAdminAlertEmail({
    title: 'MODEL universe – ĐƠN GDTT MỚI #ORD-962',
    content: `Mã đơn: ORD-962\nKhách hàng: Bobby Lê\nSố điện thoại: 0373498729\nSản phẩm: MNP-XH03 - Ao Bing / Ngao Bính\nGiá trị đơn: 611.111 ₫\nĐã cọc: 200.000 ₫\nCòn lại: 411.111 ₫\nĐịa điểm GDTT: Showroom TP. Hồ Chí Minh\nThời gian mong muốn: 15:00 31/10/2026\nTrạng thái: Chờ xác nhận lịch giao dịch.\nXem đơn: http://localhost:6050/vi/admin/orders/962`,
    severity: 'Đơn Showroom Mới',
    actionUrl: 'http://localhost:6050/vi/admin/orders/962',
  });
  const resAdminMeeting = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: ADMIN_EMAIL,
    subject: '[Model Universe] [ADMIN] Đơn giao dịch trực tiếp mới #ORD-962',
    html: adminMeetingHtml,
  });
  console.log('✓ 17. Admin Alert: New Meeting Order:', resAdminMeeting.messageId);
  results.push({ type: 'admin_alert_meeting', to: ADMIN_EMAIL, id: resAdminMeeting.messageId });

  // 18. Admin Alert: New Pawn Appraisal Request
  const adminPawnHtml = renderAdminAlertEmail({
    title: 'MODEL universe – ĐỀ XUẤT TÌNH TRẠNG CẦM MỚI #4',
    content: `Mã hồ sơ: #4\nKhách hàng: Bobby Lê\nSố điện thoại: 0373498729\nSản phẩm tài sản: MGEX 1/100 Strike Freedom Gundam\nKhoản vay đề xuất: 2.500.000 ₫\nThời hạn: 30 ngày\nLãi suất niêm yết: 3.5%/tháng\nTrạng thái: Chờ chuyên viên thẩm định.\nXem hồ sơ: http://localhost:6050/vi/admin/pawn`,
    severity: 'Cầm cố mới',
    actionUrl: 'http://localhost:6050/vi/admin/pawn',
  });
  const resAdminPawn = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: ADMIN_EMAIL,
    subject: '[Model Universe] [ADMIN] Đề xuất tình trạng cầm mới #4',
    html: adminPawnHtml,
  });
  console.log('✓ 18. Admin Alert: New Pawn Request:', resAdminPawn.messageId);
  results.push({ type: 'admin_alert_pawn', to: ADMIN_EMAIL, id: resAdminPawn.messageId });

  console.log(`\n======================================================`);
  console.log(`SUCCESSFULLY DISPATCHED ALL 18 EMAIL SUITES LIVE!`);
  console.log(`======================================================\n`);
  
  fs.writeFileSync(
    path.join(__dirname, 'last-email-dispatch-report.json'),
    JSON.stringify({ dispatchedAt: new Date().toISOString(), total: results.length, results }, null, 2),
    'utf-8'
  );
}

dispatchAll().catch(console.error);
