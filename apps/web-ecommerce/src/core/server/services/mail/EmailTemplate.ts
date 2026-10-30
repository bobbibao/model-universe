/**
 * Model Universe - Professional E-Commerce Email Template Engine
 * 
 * Design Standards:
 * - Clean, modern, minimalist typography (inspired by Apple, Uniqlo, Steam)
 * - Deep neutral palette (#09090b, #18181b, #71717a, #e4e4e7, #ffffff)
 * - 100% responsive table-based layout compatible with Gmail, Apple Mail, Outlook
 * - No cheesy AI emojis, no rainbow gradients
 */

const SHOP_NAME = 'MODEL UNIVERSE';
const SHOP_TAGLINE = 'Mô hình Gunpla & Mecha Collectibles chính hãng';
const SHOP_PHONE = '0373498729';
const SHOP_EMAIL = 'support@modeluniverse.vn';
const SHOP_ADDRESS = 'Showroom Model Universe, TP. Hồ Chí Minh';
const BASE_URL = process.env.APP_URL || process.env.SHOP_PUBLIC_URL || 'http://localhost:6050';

export interface EmailBaseOptions {
  preheader?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  contentHtml: string;
  actionButton?: {
    text: string;
    url: string;
  };
  noteHtml?: string;
}

/**
 * Master responsive layout wrapper
 */
export function wrapMasterEmailTemplate(opts: EmailBaseOptions): string {
  const { preheader = '', badge, title, subtitle, contentHtml, actionButton, noteHtml } = opts;

  return `<!DOCTYPE html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: 0 !important; }
      .content-padding { padding: 24px 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <!-- Preheader text (hidden preview in inbox) -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
    ${preheader || title}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden;">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 24px 32px 20px 32px; border-bottom: 1px solid #f4f4f5; background-color: #ffffff;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <span style="font-size: 18px; font-weight: 800; letter-spacing: 1.5px; color: #09090b; text-transform: uppercase;">
                      ${SHOP_NAME}
                    </span>
                    <div style="font-size: 11px; color: #71717a; margin-top: 3px; letter-spacing: 0.3px;">
                      ${SHOP_TAGLINE}
                    </div>
                  </td>
                  ${badge ? `
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #3f3f46; background-color: #f4f4f5; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${badge}
                    </span>
                  </td>
                  ` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td class="content-padding" style="padding: 32px 32px 24px 32px; background-color: #ffffff;">
              <h1 style="margin: 0 0 10px 0; font-size: 21px; font-weight: 700; color: #09090b; line-height: 1.35;">
                ${title}
              </h1>
              ${subtitle ? `
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #52525b;">
                ${subtitle}
              </p>
              ` : '<div style="height: 16px;"></div>'}

              <!-- Body Injected Content -->
              ${contentHtml}

              <!-- Action Button -->
              ${actionButton ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 16px 0;">
                <tr>
                  <td align="center">
                    <a href="${actionButton.url}" target="_blank" style="display: inline-block; background-color: #09090b; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 28px; border-radius: 6px; letter-spacing: 0.3px; text-align: center;">
                      ${actionButton.text} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Subtle Note / Security disclaimer -->
              ${noteHtml ? `
              <div style="margin-top: 24px; padding: 12px 16px; background-color: #fafafa; border-left: 3px solid #d4d4d8; font-size: 12px; line-height: 1.5; color: #71717a; border-radius: 0 4px 4px 0;">
                ${noteHtml}
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #f4f4f5;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 12px; line-height: 1.6; color: #71717a;">
                    <strong style="color: #3f3f46;">Model Universe</strong> &bull; Hotline: <span style="color: #18181b; font-weight: 600;">${SHOP_PHONE}</span><br>
                    Địa chỉ: ${SHOP_ADDRESS}<br>
                    Email hỗ trợ: <a href="mailto:${SHOP_EMAIL}" style="color: #2563eb; text-decoration: none;">${SHOP_EMAIL}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px; font-size: 11px; line-height: 1.5; color: #a1a1aa; border-top: 1px solid #e4e4e7; margin-top: 16px;">
                    Email này được gửi tự động từ hệ thống Model Universe để phục vụ giao dịch và tài khoản của bạn. Vui lòng không chia sẻ mã xác thực hoặc mật khẩu cho bất kỳ ai.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Restock Notification Email (Thông báo hàng về)
 */
export function renderRestockAlertEmail(data: {
  productName: string;
  stock: number;
  productUrl: string;
  priceVnd?: number;
  imageUrl?: string;
}): string {
  const formattedPrice = data.priceVnd ? `${data.priceVnd.toLocaleString('vi-VN')} ₫` : 'Giá niêm yết chính hãng';
  const contentHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          ${data.imageUrl ? `
          <td width="90" valign="top" style="padding-right: 16px;">
            <img src="${data.imageUrl}" alt="${data.productName}" width="90" style="border-radius: 4px; border: 1px solid #e2e8f0; display: block; object-fit: cover;">
          </td>
          ` : ''}
          <td valign="top">
            <div style="font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.4; margin-bottom: 8px;">
              ${data.productName}
            </div>
            <div style="font-size: 14px; font-weight: 600; color: #0284c7; margin-bottom: 6px;">
              ${formattedPrice}
            </div>
            <div style="font-size: 13px; color: #475569;">
              Tình trạng kho: <span style="display: inline-block; padding: 2px 8px; background-color: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 600; border-radius: 4px;">Còn ${data.stock} sản phẩm</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Sản phẩm mô hình mà bạn quan tâm và đăng ký theo dõi hiện đã được bổ sung vào kho Model Universe. Vì số lượng mỗi đợt hàng có hạn, bạn vui lòng hoàn tất đặt hàng sớm để đảm bảo giữ được sản phẩm.
    </p>
  `;

  return wrapMasterEmailTemplate({
    preheader: `Sản phẩm ${data.productName} đã có hàng trở lại tại kho Model Universe!`,
    badge: 'Hàng mới về',
    title: 'Sản phẩm bạn theo dõi đã có hàng',
    subtitle: 'Mô hình mà bạn quan tâm vừa cập bến kho hàng chính hãng.',
    contentHtml,
    actionButton: {
      text: 'Xem chi tiết & Đặt mua ngay',
      url: data.productUrl,
    },
    noteHtml: 'Lưu ý: Đăng ký nhận thông báo không thay thế cho hình thức đặt cọc giữ hàng. Sản phẩm sẽ được phân bổ theo thứ tự đặt hàng thành công.',
  });
}

/**
 * 2. Order Confirmation Email (Xác nhận đơn hàng)
 */
export function renderOrderConfirmationEmail(data: {
  orderId: number;
  orderCode: string;
  customerName: string;
  totalVnd: number;
  paymentMethod: string;
  shippingAddress: string;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
  orderUrl: string;
}): string {
  const itemsRows = (data.items || []).map((item) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; font-weight: 500;">
        ${item.name} <span style="color: #64748b;">&times; ${item.quantity}</span>
      </td>
      <td align="right" style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #0f172a; font-weight: 600;">
        ${(item.unitPrice * item.quantity).toLocaleString('vi-VN')} ₫
      </td>
    </tr>
  `).join('');

  const contentHtml = `
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      Xin chào <strong>${data.customerName}</strong>, cảm ơn bạn đã đặt hàng tại Model Universe! Đơn hàng của bạn đã được ghi nhận trên hệ thống và nhân viên đang tiến hành chuẩn bị đơn.
    </p>

    <!-- Order summary card -->
    <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Mã đơn hàng</td>
          <td align="right" style="font-size: 14px; color: #09090b; font-weight: 700;">#${data.orderCode}</td>
        </tr>
        <tr>
          <td style="padding-top: 8px; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Hình thức</td>
          <td align="right" style="padding-top: 8px; font-size: 13px; color: #18181b; font-weight: 500;">${data.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding-top: 8px; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Nơi nhận</td>
          <td align="right" style="padding-top: 8px; font-size: 13px; color: #18181b; font-weight: 500; max-width: 250px;">${data.shippingAddress}</td>
        </tr>
      </table>

      ${data.items && data.items.length > 0 ? `
      <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          ${itemsRows}
          <tr>
            <td style="padding-top: 12px; font-size: 14px; font-weight: 700; color: #09090b;">Tổng thanh toán</td>
            <td align="right" style="padding-top: 12px; font-size: 16px; font-weight: 700; color: #09090b;">
              ${data.totalVnd.toLocaleString('vi-VN')} ₫
            </td>
          </tr>
        </table>
      </div>
      ` : `
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e4e4e7; font-size: 15px; font-weight: 700; color: #09090b; text-align: right;">
        Tổng thanh toán: ${data.totalVnd.toLocaleString('vi-VN')} ₫
      </div>
      `}
    </div>
  `;

  return wrapMasterEmailTemplate({
    preheader: `Xác nhận đơn hàng #${data.orderCode} - Model Universe`,
    badge: 'Đơn hàng mới',
    title: 'Xác nhận đặt hàng thành công',
    subtitle: `Đơn hàng #${data.orderCode} đã được tạo thành công trên hệ thống.`,
    contentHtml,
    actionButton: {
      text: 'Xem chi tiết đơn hàng',
      url: data.orderUrl,
    },
    noteHtml: 'Bạn có thể theo dõi tiến độ chuẩn bị và mã vận đơn theo thời gian thực tại mục "Đơn mua" trong trang cá nhân.',
  });
}

/**
 * 3. Shipment Tracking Email (Mã vận đơn & Vận chuyển)
 */
export function renderShipmentEmail(data: {
  orderCode: string;
  customerName: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  codAmountVnd?: number;
  orderUrl: string;
}): string {
  const contentHtml = `
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      Xin chào <strong>${data.customerName}</strong>, kiện hàng cho đơn <strong>#${data.orderCode}</strong> đã được đóng gói và bàn giao cho đối tác vận chuyển.
    </p>

    <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Đơn vị vận chuyển</td>
          <td align="right" style="font-size: 14px; color: #09090b; font-weight: 700;">${data.carrierName}</td>
        </tr>
        <tr>
          <td style="padding-top: 10px; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Mã vận đơn</td>
          <td align="right" style="padding-top: 10px; font-size: 15px; color: #2563eb; font-weight: 700; font-family: monospace;">
            ${data.trackingNumber}
          </td>
        </tr>
        ${data.codAmountVnd !== undefined && data.codAmountVnd > 0 ? `
        <tr>
          <td style="padding-top: 10px; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Thu hộ COD</td>
          <td align="right" style="padding-top: 10px; font-size: 14px; color: #09090b; font-weight: 600;">
            ${data.codAmountVnd.toLocaleString('vi-VN')} ₫
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0 0 16px 0;">
      Bạn có thể tra cứu trực tiếp hành trình bưu kiện thông qua mã vận đơn trên trang của đối tác vận chuyển hoặc ngay tại tài khoản Model Universe.
    </p>
  `;

  return wrapMasterEmailTemplate({
    preheader: `Đơn hàng #${data.orderCode} đã xuất kho với mã vận đơn ${data.trackingNumber}`,
    badge: 'Đang vận chuyển',
    title: 'Kiện hàng của bạn đang được giao',
    subtitle: `Hãng vận chuyển ${data.carrierName} đang thực hiện giao kiện hàng đến bạn.`,
    contentHtml,
    actionButton: {
      text: 'Tra cứu hành trình đơn hàng',
      url: data.trackingUrl || data.orderUrl,
    },
    noteHtml: 'Lưu ý kiểm tra kỹ kiện hàng và đối chiếu mã vận đơn khi nhận từ nhân viên bưu tá. Nếu có vấn đề phát sinh, hãy liên hệ ngay hotline 0373498729.',
  });
}

/**
 * 4. Registration OTP Email (Mã xác thực đăng ký)
 */
export function renderOtpEmail(data: {
  otp: string;
  ttlMinutes: number;
  email: string;
}): string {
  const contentHtml = `
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      Chào mừng bạn đến với Model Universe! Để hoàn tất đăng ký tài khoản cho địa chỉ email <strong>${data.email}</strong>, vui lòng nhập mã xác thực bảo mật dưới đây:
    </p>

    <div style="background-color: #fafafa; border: 1px dashed #d4d4d8; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; margin-bottom: 8px; font-weight: 600;">
        Mã xác thực của bạn (OTP)
      </div>
      <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #09090b; font-family: monospace;">
        ${data.otp}
      </div>
      <div style="font-size: 12px; color: #a1a1aa; margin-top: 8px;">
        Mã có hiệu lực trong vòng ${data.ttlMinutes} phút
      </div>
    </div>

    <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0;">
      Nếu bạn không thực hiện yêu cầu đăng ký này, xin vui lòng bỏ qua email. Tài khoản của bạn sẽ không được khởi tạo nếu chưa nhập mã.
    </p>
  `;

  return wrapMasterEmailTemplate({
    preheader: `Mã OTP xác thực đăng ký Model Universe của bạn là ${data.otp}`,
    badge: 'Bảo mật tài khoản',
    title: 'Xác thực tài khoản Model Universe',
    subtitle: 'Vui lòng sử dụng mã bảo mật dưới đây để hoàn tất đăng ký.',
    contentHtml,
    noteHtml: 'Bảo mật: Không bao giờ chia sẻ mã OTP này cho bất kỳ ai, kể cả nhân viên tự xưng từ Model Universe.',
  });
}

/**
 * 5. Password Reset Email (Đặt lại mật khẩu)
 */
export function renderPasswordResetEmail(data: {
  resetUrl: string;
  ttlMinutes: number;
  email: string;
}): string {
  const contentHtml = `
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Model Universe gắn với email <strong>${data.email}</strong>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
      Nhấn vào nút bên dưới để tiến hành thiết lập mật khẩu mới an toàn cho tài khoản của bạn:
    </p>
  `;

  return wrapMasterEmailTemplate({
    preheader: 'Yêu cầu đặt lại mật khẩu Model Universe',
    badge: 'Khôi phục tài khoản',
    title: 'Yêu cầu đặt lại mật khẩu',
    subtitle: `Liên kết đổi mật khẩu có hiệu lực trong vòng ${data.ttlMinutes} phút.`,
    contentHtml,
    actionButton: {
      text: 'Đặt lại mật khẩu',
      url: data.resetUrl,
    },
    noteHtml: 'Nếu không phải bạn yêu cầu, hãy yên tâm bỏ qua email này. Mật khẩu hiện tại của bạn vẫn được bảo vệ tuyệt đối.',
  });
}

/**
 * 6. Auto Formatted Email (Wrap plain text into modern layout automatically)
 */
export function renderAutoFormattedEmail(subject: string, text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  
  const narrativeLines: string[] = [];
  const detailRows: ServiceDetailRow[] = [];
  let extractedActionUrl: string | undefined;
  let extractedActionText: string | undefined;
  const securityNotes: string[] = [];

  // Determine badge by topic
  const lowerSub = (subject + ' ' + text).toLowerCase();
  let badge = 'Thông báo';
  if (lowerSub.includes('cầm cố') || lowerSub.includes('hợp đồng cầm') || lowerSub.includes('pawn')) {
    badge = 'Hồ sơ Cầm cố';
  } else if (lowerSub.includes('giữ hàng') || lowerSub.includes('reservation')) {
    badge = 'Đặt giữ hàng';
  } else if (lowerSub.includes('thu mua') || lowerSub.includes('định giá') || lowerSub.includes('buyback')) {
    badge = 'Thu mua mô hình';
  } else if (lowerSub.includes('vận đơn') || lowerSub.includes('vận chuyển') || lowerSub.includes('giao hàng') || lowerSub.includes('shipment')) {
    badge = 'Vận chuyển';
  } else if (lowerSub.includes('đơn hàng') || lowerSub.includes('order')) {
    badge = 'Đơn hàng';
  } else if (lowerSub.includes('điểm thưởng') || lowerSub.includes('tích luỹ') || lowerSub.includes('loyalty')) {
    badge = 'Điểm tích luỹ';
  } else if (lowerSub.includes('ưu đãi') || lowerSub.includes('voucher') || lowerSub.includes('coupon')) {
    badge = 'Ưu đãi';
  } else if (lowerSub.includes('cảnh báo') || lowerSub.includes('quản trị') || lowerSub.includes('admin')) {
    badge = 'Cảnh báo Quản trị';
  }

  for (const line of lines) {
    // 1. Check for URL
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      extractedActionUrl = urlMatch[0];
      const textBeforeUrl = line.replace(urlMatch[0], '').replace(/^[-•\s:–]+|[-•\s:–]+$/g, '').trim();
      if (textBeforeUrl.length > 3 && textBeforeUrl.length < 80) {
        extractedActionText = textBeforeUrl;
      }
      continue;
    }

    // 2. Check for security / confidential notes
    if (
      line.includes('Không chia sẻ') ||
      line.includes('mật khẩu') ||
      line.includes('mã OTP') ||
      line.includes('chuyển tiền') ||
      line.includes('bảo mật tài sản') ||
      line.includes('tuyệt đối không')
    ) {
      securityNotes.push(line);
      continue;
    }

    // 3. Check for key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40 && !line.startsWith('http')) {
      const key = line.substring(0, colonIdx).replace(/^[-•\s]+/, '').trim();
      const val = line.substring(colonIdx + 1).trim();
      if (key && val) {
        detailRows.push({
          label: key,
          value: val,
          isHighlight: key.toLowerCase().includes('mã') || key.toLowerCase().includes('tổng') || key.toLowerCase().includes('tiền') || key.toLowerCase().includes('điểm'),
        });
        continue;
      }
    }

    // 4. Narrative line
    narrativeLines.push(line);
  }

  const contentParts: string[] = [];
  if (narrativeLines.length > 0) {
    contentParts.push(
      `<p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 16px 0;">${narrativeLines.join('<br>')}</p>`
    );
  }

  if (detailRows.length > 0) {
    const rowsHtml = detailRows.map((row, idx) => `
      <tr>
        <td style="padding: ${idx === 0 ? '0' : '8px'} 0; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600; width: 42%;">
          ${row.label}
        </td>
        <td align="right" style="padding: ${idx === 0 ? '0' : '8px'} 0; font-size: 13px; color: ${row.isHighlight ? '#2563eb' : '#09090b'}; font-weight: ${row.isHighlight ? '700' : '600'};">
          ${row.value}
        </td>
      </tr>
    `).join('');

    contentParts.push(`
      <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px; margin: 18px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          ${rowsHtml}
        </table>
      </div>
    `);
  }

  const noteHtml = securityNotes.length > 0
    ? securityNotes.join(' ')
    : 'Lưu ý: Đăng nhập vào tài khoản Model Universe để xem toàn bộ thông tin chi tiết và tiến trình xử lý. Tuyệt đối không chia sẻ mật khẩu hoặc OTP.';

  return wrapMasterEmailTemplate({
    preheader: subject,
    badge,
    title: subject,
    contentHtml: contentParts.join(''),
    actionButton: extractedActionUrl ? {
      text: extractedActionText || 'Xem chi tiết tại Model Universe',
      url: extractedActionUrl,
    } : undefined,
    noteHtml,
  });
}

export interface ServiceDetailRow {
  label: string;
  value: string;
  isHighlight?: boolean;
}

export interface ServiceNoticeOptions {
  badge: string;
  title: string;
  subtitle?: string;
  preheader?: string;
  message?: string;
  details?: ServiceDetailRow[];
  actionButton?: {
    text: string;
    url: string;
  };
  note?: string;
}

/**
 * 7. Service Notice Email (Hợp đồng, Dịch vụ, Cầm đồ, Giữ hàng, Thu mua)
 */
export function renderServiceNoticeEmail(opts: ServiceNoticeOptions): string {
  const detailsHtml = opts.details && opts.details.length > 0 ? `
    <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px; margin: 20px 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        ${opts.details.map((row, idx) => `
        <tr>
          <td style="padding: ${idx === 0 ? '0' : '8px'} 0; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600; width: 45%;">
            ${row.label}
          </td>
          <td align="right" style="padding: ${idx === 0 ? '0' : '8px'} 0; font-size: 13px; color: ${row.isHighlight ? '#2563eb' : '#09090b'}; font-weight: ${row.isHighlight ? '700' : '600'};">
            ${row.value}
          </td>
        </tr>
        `).join('')}
      </table>
    </div>
  ` : '';

  const contentHtml = `
    ${opts.message ? `
    <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 16px 0;">
      ${opts.message.replace(/\n/g, '<br>')}
    </p>
    ` : ''}

    ${detailsHtml}
  `;

  return wrapMasterEmailTemplate({
    preheader: opts.preheader || opts.title,
    badge: opts.badge,
    title: opts.title,
    subtitle: opts.subtitle,
    contentHtml,
    actionButton: opts.actionButton,
    noteHtml: opts.note || 'Lưu ý: Đăng nhập vào tài khoản Model Universe để xem toàn bộ thông tin chi tiết và tiến trình xử lý hồ sơ. Tuyệt đối không chia sẻ mật khẩu hoặc OTP.',
  });
}

/**
 * 8. Pawn Contract Specific Notice (Cầm cố)
 */
export function renderPawnNoticeEmail(opts: {
  contractId: number;
  title: string;
  subtitle?: string;
  statusText?: string;
  details?: ServiceDetailRow[];
  message?: string;
  actionUrl?: string;
  note?: string;
}): string {
  const defaultDetails: ServiceDetailRow[] = [
    { label: 'Mã hợp đồng', value: `#${opts.contractId}`, isHighlight: true },
    ...(opts.statusText ? [{ label: 'Trạng thái', value: opts.statusText }] : []),
    ...(opts.details || []),
  ];

  return renderServiceNoticeEmail({
    badge: 'Hồ sơ Cầm cố',
    title: opts.title,
    subtitle: opts.subtitle || `Cập nhật thông tin cho hợp đồng cầm cố #${opts.contractId}.`,
    preheader: opts.title,
    message: opts.message || 'Hồ sơ cầm cố của bạn vừa có cập nhật mới từ hệ thống Model Universe. Bạn vui lòng kiểm tra thông tin dưới đây:',
    details: defaultDetails,
    actionButton: {
      text: 'Xem chi tiết hợp đồng',
      url: opts.actionUrl || `${BASE_URL}/vi/user-profile?section=inbox`,
    },
    note: opts.note || 'Hồ sơ cầm cố tuân thủ chính sách bảo mật tài sản tuyệt đối. Cần hỗ trợ khẩn cấp, vui lòng liên hệ hotline 0373498729.',
  });
}

/**
 * 9. Reservation Notice (Đặt giữ hàng)
 */
export function renderReservationNoticeEmail(opts: {
  reservationId: number;
  title: string;
  subtitle?: string;
  details?: ServiceDetailRow[];
  message?: string;
  actionUrl?: string;
  note?: string;
}): string {
  const defaultDetails: ServiceDetailRow[] = [
    { label: 'Mã đơn giữ hàng', value: `#${opts.reservationId}`, isHighlight: true },
    ...(opts.details || []),
  ];

  return renderServiceNoticeEmail({
    badge: 'Đặt giữ hàng',
    title: opts.title,
    subtitle: opts.subtitle || `Cập nhật trạng thái cho suất giữ hàng #${opts.reservationId}.`,
    preheader: opts.title,
    message: opts.message || 'Suất giữ hàng của bạn vừa có thông báo mới từ Model Universe:',
    details: defaultDetails,
    actionButton: {
      text: 'Xem chi tiết giữ hàng',
      url: opts.actionUrl || `${BASE_URL}/vi/reservations`,
    },
    note: opts.note || 'Suất giữ hàng được bảo lưu trong thời gian quy định theo chính sách cọc. Vui lòng hoàn tất thanh toán đúng hạn để nhận mô hình.',
  });
}

/**
 * 10. Buyback Notice (Thu mua & Định giá)
 */
export function renderBuybackNoticeEmail(opts: {
  code: string;
  title: string;
  subtitle?: string;
  details?: ServiceDetailRow[];
  message?: string;
  actionUrl?: string;
  note?: string;
}): string {
  const defaultDetails: ServiceDetailRow[] = [
    { label: 'Mã yêu cầu thu mua', value: opts.code, isHighlight: true },
    ...(opts.details || []),
  ];

  return renderServiceNoticeEmail({
    badge: 'Thu mua mô hình',
    title: opts.title,
    subtitle: opts.subtitle || `Tiến trình xử lý yêu cầu thu mua ${opts.code}.`,
    preheader: opts.title,
    message: opts.message,
    details: defaultDetails,
    actionButton: {
      text: 'Xem tiến trình thu mua',
      url: opts.actionUrl || `${BASE_URL}/vi/services/sell`,
    },
    note: opts.note || 'Quy trình kiểm định và định giá mô hình được thực hiện minh bạch qua camera giám sát và biên bản đối chiếu chi tiết.',
  });
}

/**
 * 11. Voucher Notice (Ưu đãi & Voucher)
 */
export function renderVoucherNoticeEmail(opts: {
  customerName: string;
  code: string;
  description: string;
  expireAt: string;
  actionUrl?: string;
}): string {
  return renderServiceNoticeEmail({
    badge: 'Ưu đãi dành riêng',
    title: 'Mã ưu đãi của bạn sắp hết hạn',
    subtitle: `Xin chào ${opts.customerName}, đừng bỏ lỡ ưu đãi đặc biệt này.`,
    preheader: `Mã ưu đãi ${opts.code} sắp hết hạn - Model Universe`,
    message: `Bạn đang có mã ưu đãi <strong>${opts.code}</strong> trong ví tài khoản nhưng chưa sử dụng. Hãy chọn ngay các mẫu Gunpla và Mecha yêu thích trước khi mã hết hạn!`,
    details: [
      { label: 'Mã ưu đãi', value: opts.code, isHighlight: true },
      { label: 'Giá trị ưu đãi', value: opts.description },
      { label: 'Thời hạn áp dụng', value: opts.expireAt },
    ],
    actionButton: {
      text: 'Khám phá mô hình & Áp dụng ngay',
      url: opts.actionUrl || `${BASE_URL}/vi/shop`,
    },
    note: 'Mã ưu đãi có thể kết hợp cùng quyền lợi hạng thành viên theo quy chế v6.2 của Model Universe.',
  });
}

/**
 * 12. Order Cancelled Notice (Huỷ đơn hàng & Hoàn tiền)
 */
export function renderOrderCancelledEmail(opts: {
  orderCode: string;
  reasonText: string;
  feeVnd: number;
  refundVnd: number;
  prepaidVnd: number;
  orderUrl?: string;
}): string {
  const details: ServiceDetailRow[] = [
    { label: 'Mã đơn hàng', value: `#${opts.orderCode}`, isHighlight: true },
    { label: 'Lý do huỷ', value: opts.reasonText },
    { label: 'Đã thanh toán', value: `${opts.prepaidVnd.toLocaleString('vi-VN')} ₫` },
  ];

  if (opts.feeVnd > 0) {
    details.push({ label: 'Phí giữ cọc theo quy định', value: `${opts.feeVnd.toLocaleString('vi-VN')} ₫` });
  }

  if (opts.refundVnd > 0) {
    details.push({ label: 'Khoản tiền hoàn trả', value: `${opts.refundVnd.toLocaleString('vi-VN')} ₫`, isHighlight: true });
  }

  return renderServiceNoticeEmail({
    badge: 'Huỷ đơn hàng',
    title: `Đơn hàng #${opts.orderCode} đã được huỷ`,
    subtitle: 'Thông báo xác nhận huỷ đơn và đối soát hoàn tiền.',
    preheader: `Đơn hàng #${opts.orderCode} đã được huỷ - Model Universe`,
    message: opts.refundVnd > 0
      ? `Đơn hàng #${opts.orderCode} của bạn đã được huỷ thành công. Khoản tiền hoàn trả ${opts.refundVnd.toLocaleString('vi-VN')} ₫ đang được kế toán đối soát và hoàn tiền về tài khoản ngân hàng của bạn.`
      : `Đơn hàng #${opts.orderCode} của bạn đã được huỷ thành công theo yêu cầu.`,
    details,
    actionButton: {
      text: 'Xem chi tiết đơn hàng',
      url: opts.orderUrl || `${BASE_URL}/vi/user-profile?section=orders`,
    },
    note: 'Mọi thắc mắc về đối soát và thời gian nhận tiền hoàn, vui lòng phản hồi email này hoặc liên hệ hotline 0373498729.',
  });
}

/**
 * 13. Loyalty Reward Email (Điểm thưởng thành viên)
 */
export function renderLoyaltyRewardEmail(opts: {
  customerName?: string;
  points: number;
  reason: string;
  orderId?: number;
  balance?: number;
  actionUrl?: string;
}): string {
  const details: ServiceDetailRow[] = [
    { label: 'Điểm thưởng nhận được', value: `+${opts.points.toLocaleString('vi-VN')} điểm`, isHighlight: true },
    { label: 'Nội dung tích luỹ', value: opts.reason },
    ...(opts.orderId ? [{ label: 'Mã đơn hàng liên kết', value: `#${opts.orderId}` }] : []),
    ...(opts.balance !== undefined ? [{ label: 'Tổng điểm khả dụng', value: `${opts.balance.toLocaleString('vi-VN')} điểm`, isHighlight: true }] : []),
  ];

  return renderServiceNoticeEmail({
    badge: 'Điểm tích luỹ',
    title: 'Bạn vừa nhận được điểm thưởng thành viên!',
    subtitle: opts.customerName ? `Xin chào ${opts.customerName}, tài khoản của bạn vừa được cộng điểm tích luỹ.` : 'Tài khoản của bạn vừa được cộng điểm tích luỹ.',
    preheader: `+${opts.points} điểm thưởng thành viên đã được cộng vào tài khoản Model Universe!`,
    message: 'Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng Model Universe. Hệ thống vừa ghi nhận giao dịch và cộng điểm thưởng vào ví thành viên của bạn:',
    details,
    actionButton: {
      text: 'Xem ví điểm thưởng & Quyền lợi',
      url: opts.actionUrl || `${BASE_URL}/vi/user-profile?section=loyalty`,
    },
    note: 'Điểm thưởng thành viên có thể sử dụng để giảm giá trực tiếp khi đặt hàng tiếp theo hoặc đổi lấy voucher ưu đãi đặc quyền theo chương trình khách hàng thân thiết.',
  });
}

/**
 * 14. Admin Alert Email (Thông báo dành riêng cho Ban Quản trị)
 */
export function renderAdminAlertEmail(opts: {
  title: string;
  content: string;
  severity?: string;
  actionUrl?: string;
}): string {
  const lines = opts.content.split('\n').map((l) => l.trim()).filter(Boolean);
  const narrative: string[] = [];
  const details: ServiceDetailRow[] = [];
  let buttonUrl = opts.actionUrl || `${BASE_URL}/vi/admin`;
  let buttonText = 'Mở trang quản trị Model Universe';

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      buttonUrl = urlMatch[0];
      const txt = line.replace(urlMatch[0], '').replace(/^[-•\s:–]+|[-•\s:–]+$/g, '').trim();
      if (txt && txt.length < 50) buttonText = txt;
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 35) {
      const key = line.substring(0, colonIdx).replace(/^[-•\s]+/, '').trim();
      const val = line.substring(colonIdx + 1).trim();
      if (key && val) {
        details.push({
          label: key,
          value: val,
          isHighlight: key.toLowerCase().includes('mã') || key.toLowerCase().includes('giá') || key.toLowerCase().includes('lỗi') || key.toLowerCase().includes('còn lại'),
        });
        continue;
      }
    }
    narrative.push(line);
  }

  return renderServiceNoticeEmail({
    badge: opts.severity || 'Cảnh báo Quản trị',
    title: opts.title,
    subtitle: 'Hệ thống ghi nhận sự kiện nghiệp vụ cần ban quản trị theo dõi.',
    preheader: opts.title,
    message: narrative.length > 0 ? narrative.join('<br>') : undefined,
    details,
    actionButton: {
      text: buttonText,
      url: buttonUrl,
    },
    note: 'Thông báo nội bộ dành riêng cho ban quản trị Model Universe. Mọi thao tác xử lý cần tuân thủ quy trình kiểm soát rủi ro v6.2.',
  });
}
