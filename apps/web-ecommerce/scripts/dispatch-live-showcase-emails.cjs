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

const RECIPIENT = 'bobby.le.2k3@gmail.com';

async function sendAll() {
  console.log(`\n======================================================`);
  console.log(`DISPATCHING FULL EMAIL SUITE TO GMAIL: ${RECIPIENT}`);
  console.log(`======================================================\n`);

  const results = [];

  // 1. Pawn Update Email (Direct replacement of user screenshot!)
  const pawnUpdate = commerceEmail('pawn_update', 4);
  const resPawn = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: `[Model Universe] ${pawnUpdate.subject}`,
    html: pawnUpdate.body,
  });
  console.log('✓ 1. Pawn Update Email (Screenshot Fix):', resPawn.messageId);
  results.push({ type: 'pawn_update', id: resPawn.messageId });

  // 2. Order Confirmation
  const orderHtml = renderOrderConfirmationEmail({
    orderId: 960,
    orderCode: 'ORD-960',
    customerName: 'Bobby Lê',
    totalVnd: 611111,
    paymentMethod: 'Giao hàng tận nơi (COD)',
    shippingAddress: '789 Trần Hưng Đạo, Phường 1, Quận 5, TP. Hồ Chí Minh',
    items: [
      { name: 'MNP-XH03 - Ao Bing / Ngao Bính (màu gốc)', quantity: 1, unitPrice: 611111 },
    ],
    orderUrl: 'http://localhost:6050/vi/user-profile?section=orders',
  });
  const resOrder = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: '[Model Universe] Xác nhận đơn hàng #ORD-960 thành công',
    html: orderHtml,
  });
  console.log('✓ 2. Order Confirmation Email:', resOrder.messageId);
  results.push({ type: 'order_confirmed', id: resOrder.messageId });

  // 3. Order Cancelled & Refund
  const cancelHtml = renderOrderCancelledEmail({
    orderCode: 'ORD-961',
    reasonText: 'Khách hàng đổi ý, yêu cầu huỷ đơn',
    feeVnd: 0,
    refundVnd: 200000,
    prepaidVnd: 200000,
    orderUrl: 'http://localhost:6050/vi/user-profile?section=orders',
  });
  const resCancel = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: '[Model Universe] Đơn hàng #ORD-961 đã được huỷ - Xác nhận hoàn tiền',
    html: cancelHtml,
  });
  console.log('✓ 3. Order Cancelled & Refund Email:', resCancel.messageId);
  results.push({ type: 'order_cancelled', id: resCancel.messageId });

  // 4. Shipment Created Tracking
  const shipCreated = Messages.emailShipmentCreated('ORD-960', 'Bobby Lê', {
    carrierName: 'VNPost Express',
    trackingNumber: 'VNPOST69365376VN',
    status: 'CREATED',
    codAmountVnd: 611111,
    trackingUrl: 'http://localhost:6050/vi/user-profile?section=orders',
  });
  const resShip = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: `[Model Universe] ${shipCreated.subject}`,
    html: shipCreated.body,
  });
  console.log('✓ 4. Shipment Tracking Email:', resShip.messageId);
  results.push({ type: 'shipment_tracking', id: resShip.messageId });

  // 5. Showroom Meeting Confirmed
  const meetingConfirmed = Messages.emailMeetingConfirmed(
    'ORD-962',
    'Bobby Lê',
    'Showroom Model Universe, TP. Hồ Chí Minh',
    '15:00 - 18:00, 31/10/2026',
    411111,
  );
  const resMeeting = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: `[Model Universe] ${meetingConfirmed.subject}`,
    html: meetingConfirmed.body,
  });
  console.log('✓ 5. Meeting Confirmed Email:', resMeeting.messageId);
  results.push({ type: 'meeting_confirmed', id: resMeeting.messageId });

  // 6. Buyback Received
  const bbReceived = Messages.emailBuybackReceived(
    'BB-2026-0042',
    'Bobby Lê',
    'MG 1/100 Barbatos Titanium Finish (Bandai)',
    '30/10/2026 21:00',
    1850000,
  );
  const resBbRec = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: `[Model Universe] ${bbReceived.subject}`,
    html: bbReceived.body,
  });
  console.log('✓ 6. Buyback Received Email:', resBbRec.messageId);
  results.push({ type: 'buyback_received', id: resBbRec.messageId });

  // 7. Buyback Final Quote
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
    to: RECIPIENT,
    subject: `[Model Universe] ${bbQuote.subject}`,
    html: bbQuote.body,
  });
  console.log('✓ 7. Buyback Final Quote Email:', resBbQuote.messageId);
  results.push({ type: 'buyback_quote', id: resBbQuote.messageId });

  // 8. Restock Alert
  const restockHtml = renderRestockAlertEmail({
    productName: 'MNP-XH02A - Cao Ren / Tào Nhân (màu gốc)',
    stock: 10,
    productUrl: 'http://localhost:6050/vi/san-pham/motor-nuclear-mnp-xh02a-cao-ren-tao-nhan',
    priceVnd: 777778,
    imageUrl: 'http://localhost:6050/uploads/products/3a64894fcccbbb63149991d8c951c38b.webp',
  });
  const resRestock = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: '[Model Universe] Mô hình bạn đăng ký theo dõi đã có hàng trở lại!',
    html: restockHtml,
  });
  console.log('✓ 8. Restock Alert Email:', resRestock.messageId);
  results.push({ type: 'restock_alert', id: resRestock.messageId });

  // 9. Voucher Expiring
  const voucherExp = Messages.emailVoucherExpiring(
    'Bobby Lê',
    'WELCOME10',
    'Giảm 10% tối đa 150.000 ₫ cho đơn hàng đầu tiên',
    '23:59 02/11/2026',
  );
  const resVoucher = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: `[Model Universe] ${voucherExp.subject}`,
    html: voucherExp.body,
  });
  console.log('✓ 9. Voucher Expiring Email:', resVoucher.messageId);
  results.push({ type: 'voucher_expiring', id: resVoucher.messageId });

  // 10. Registration OTP
  const otpHtml = renderOtpEmail({
    otp: '849201',
    ttlMinutes: 10,
    email: RECIPIENT,
  });
  const resOtp = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: '[Model Universe] Mã xác thực đăng ký tài khoản của bạn',
    html: otpHtml,
  });
  console.log('✓ 10. Registration OTP Email:', resOtp.messageId);
  results.push({ type: 'otp_registration', id: resOtp.messageId });

  // 11. Password Reset
  const resetHtml = renderPasswordResetEmail({
    resetUrl: 'http://localhost:6050/vi/auth/reset-password#token=demo-token-123',
    ttlMinutes: 15,
    email: RECIPIENT,
  });
  const resReset = await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: RECIPIENT,
    subject: '[Model Universe] Yêu cầu đặt lại mật khẩu',
    html: resetHtml,
  });
  console.log('✓ 11. Password Reset Email:', resReset.messageId);
  results.push({ type: 'password_reset', id: resReset.messageId });

  console.log(`\n======================================================`);
  console.log(`SUCCESSFULLY DELIVERED ALL 11 EMAIL TYPES TO GMAIL!`);
  console.log(`======================================================\n`);
}

sendAll().catch(console.error);
