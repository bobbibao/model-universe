import { formatVND } from '../../../../shared/server/utils/utils';
import { shopPublicUrl } from '../marketing/platforms';
import { renderShipmentEmail, renderServiceNoticeEmail, renderBuybackNoticeEmail, renderVoucherNoticeEmail } from '../mail/EmailTemplate';

// Texts for people are Vietnamese (the specification's templates); placeholders are filled from the committed order,
// shipment or request, never from client input.

const vnd = (amount: number) => formatVND(amount, 'vi');
const lines = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join('\n');

export const orderUrl = () => `${shopPublicUrl()}/vi/order-history`;
export const adminOrderUrl = (orderId: number) => `${shopPublicUrl()}/vi/admin/orders/${orderId}`;
export const buybackUrl = () => `${shopPublicUrl()}/vi/services/sell`;
export const formatMeetingTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
    : '';

export interface OrderFacts {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  productSummary: string;
  productTotalVnd: number;
  confirmedPaidVnd: number;
  remainingVnd: number;
}

export const adminMeetingDeposited = (
  order: OrderFacts,
  meetingAddress: string,
  requestedTime: string,
  orderId: number,
) => ({
  title: 'MODEL universe – ĐƠN GDTT MỚI',
  content: lines(
    `Mã đơn: ${order.orderCode}`,
    `Khách hàng: ${order.customerName}`,
    `Số điện thoại: ${order.customerPhone}`,
    `Sản phẩm: ${order.productSummary}`,
    `Giá trị đơn: ${vnd(order.productTotalVnd)}`,
    `Đã cọc: ${vnd(order.confirmedPaidVnd)}`,
    `Còn lại: ${vnd(order.remainingVnd)}`,
    `Địa điểm GDTT đề xuất: ${meetingAddress}`,
    `Thời gian mong muốn: ${requestedTime}`,
    'Trạng thái: Chờ xác nhận lịch giao dịch.',
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

export const adminCodDeposited = (order: OrderFacts, recipientAddress: string, orderId: number) => ({
  title: 'MODEL universe – ĐƠN SHIP COD MỚI',
  content: lines(
    `Mã đơn: ${order.orderCode}`,
    `Khách hàng: ${order.customerName}`,
    `Sản phẩm: ${order.productSummary}`,
    `Giá trị đơn: ${vnd(order.productTotalVnd)}`,
    `Đã thanh toán: ${vnd(order.confirmedPaidVnd)}`,
    `COD sản phẩm dự kiến: ${vnd(order.remainingVnd)}`,
    `Địa chỉ nhận: ${recipientAddress}`,
    'Trạng thái: Chờ tạo vận đơn.',
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

export const adminShipmentCreated = (
  order: Pick<OrderFacts, 'orderCode' | 'customerName'>,
  shipment: {
    carrierName: string;
    trackingNumber: string;
    codAmountVnd: number;
    shippingFeeVnd: number;
    status: string;
    trackingUrl: string;
  },
  orderId: number,
) => ({
  title: 'MODEL universe – TẠO VẬN ĐƠN THÀNH CÔNG',
  content: lines(
    `Mã đơn: ${order.orderCode}`,
    `Đơn vị vận chuyển: ${shipment.carrierName}`,
    `Mã vận đơn: ${shipment.trackingNumber}`,
    `Khách hàng: ${order.customerName}`,
    `COD: ${vnd(shipment.codAmountVnd)}`,
    `Phí vận chuyển: ${vnd(shipment.shippingFeeVnd)}`,
    `Trạng thái: ${shipment.status}`,
    `Theo dõi: ${shipment.trackingUrl}`,
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

export const adminShipmentFailed = (orderCode: string, error: string, orderId: number) => ({
  title: 'MODEL universe – CẢNH BÁO TẠO VẬN ĐƠN',
  content: lines(
    `Mã đơn: ${orderCode}`,
    `Lỗi: ${error}`,
    'Trạng thái: Cần nhân viên kiểm tra.',
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

export const adminDeliveryFailed = (orderCode: string, trackingNumber: string, reason: string, orderId: number) => ({
  title: 'MODEL universe – GIAO HÀNG THẤT BẠI',
  content: lines(
    `Mã đơn: ${orderCode}`,
    `Mã vận đơn: ${trackingNumber}`,
    `Lý do: ${reason}`,
    'Trạng thái: Chờ xử lý.',
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

// The carrier weighed a parcel well above its package plan (a surcharge, and usually a wrong packing size).
export const adminPackDiscrepancy = (
  orderCode: string,
  parcel: string,
  carrierGram: number,
  plannedGram: number,
  products: string,
  orderId: number,
) => ({
  title: 'MODEL universe – CÂN NẶNG KIỆN LỆCH',
  content: lines(
    `Mã đơn: ${orderCode} · ${parcel}`,
    `Hãng tính: ${carrierGram} g · Kế hoạch đóng gói: ${plannedGram} g`,
    `Kiểm tra kích thước đóng gói của: ${products}`,
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

export const adminMeetingChange = (orderCode: string, address: string, time: string, orderId: number) => ({
  title: 'MODEL universe – KHÁCH ĐỀ NGHỊ ĐỔI LỊCH GDTT',
  content: lines(
    `Mã đơn: ${orderCode}`,
    `Địa điểm đề xuất: ${address}`,
    `Thời gian đề xuất: ${time}`,
    `Xem đơn: ${adminOrderUrl(orderId)}`,
  ),
});

export const emailMeetingDeposit = (order: OrderFacts, meetingAddress: string, requestedTime: string) => {
  const subject = `Đã xác nhận cọc đơn GDTT ${order.orderCode}`;
  const body = renderServiceNoticeEmail({
    badge: 'Đơn hàng GDTT',
    title: subject,
    subtitle: `MODEL universe đã xác nhận khoản thanh toán trước cho đơn hàng ${order.orderCode}.`,
    message: `Xin chào ${order.customerName}, đơn hàng giao dịch trực tiếp tại showroom của bạn đã được ghi nhận. Shop sẽ chuẩn bị mô hình và xác nhận lịch hẹn giao dịch với bạn.`,
    details: [
      { label: 'Mã đơn hàng', value: order.orderCode, isHighlight: true },
      { label: 'Sản phẩm', value: order.productSummary },
      { label: 'Tổng giá trị', value: vnd(order.productTotalVnd) },
      { label: 'Đã thanh toán trước', value: vnd(order.confirmedPaidVnd) },
      { label: 'Số tiền còn lại', value: vnd(order.remainingVnd), isHighlight: true },
      { label: 'Địa điểm GDTT', value: meetingAddress },
      { label: 'Thời gian mong muốn', value: requestedTime },
    ],
    actionButton: {
      text: 'Xem chi tiết đơn hàng',
      url: orderUrl(),
    },
    note: 'Bạn vui lòng chỉ đến showroom sau khi lịch hẹn đã được nhân viên Model Universe xác nhận.',
  });
  return { subject, body };
};

export const emailCodDeposit = (order: OrderFacts) => {
  const subject = `Xác nhận đơn hàng ${order.orderCode}`;
  const body = renderServiceNoticeEmail({
    badge: 'Đơn hàng mới',
    title: subject,
    subtitle: `MODEL universe đã xác nhận khoản thanh toán trước cho đơn hàng ${order.orderCode}.`,
    message: `Xin chào ${order.customerName}, đơn hàng của bạn đang được chuẩn bị để đóng gói và bàn giao đơn vị vận chuyển. Mã vận đơn sẽ được gửi đến bạn ngay khi xuất kho.`,
    details: [
      { label: 'Mã đơn hàng', value: order.orderCode, isHighlight: true },
      { label: 'Sản phẩm', value: order.productSummary },
      { label: 'Tổng giá trị', value: vnd(order.productTotalVnd) },
      { label: 'Đã thanh toán trước', value: vnd(order.confirmedPaidVnd) },
      { label: 'Thu hộ COD còn lại', value: vnd(order.remainingVnd), isHighlight: true },
    ],
    actionButton: {
      text: 'Xem tiến trình đơn hàng',
      url: orderUrl(),
    },
  });
  return { subject, body };
};

export const orderTrackingUrl = (orderId?: number) =>
  `${shopPublicUrl()}/vi/order-history${orderId ? `?order=${orderId}` : ''}`;

const STATUS_TEXT: Record<string, string> = {
  CREATED: 'Đã tạo vận đơn',
  AWAITING_PICKUP: 'Chờ lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao hàng',
  DELIVERED: 'Giao hàng thành công',
  DELIVERY_FAILED: 'Giao hàng không thành công',
  RETURNING: 'Đang hoàn hàng về shop',
  RETURNED: 'Đã hoàn hàng về shop',
  CANCELLED: 'Đã hủy vận đơn',
  EXCEPTION: 'Đơn hàng gặp sự cố, shop đang xử lý',
};
export const shipmentStatusText = (status: string) => STATUS_TEXT[status] || status;

export const emailShipmentCreated = (
  orderCode: string,
  customerName: string,
  shipment: {
    carrierName: string;
    trackingNumber: string;
    status: string;
    codAmountVnd: number;
    trackingUrl: string;
    estimatedDelivery?: string | null;
  },
) => ({
  subject: `Đơn ${orderCode} đã có mã vận đơn ${shipment.carrierName} ${shipment.trackingNumber}`,
  body: renderShipmentEmail({
    orderCode,
    customerName,
    carrierName: shipment.carrierName,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    codAmountVnd: shipment.codAmountVnd,
    orderUrl: orderTrackingUrl(),
  }),
});

export const emailShipmentStatus = (
  orderCode: string,
  customerName: string,
  carrierName: string,
  trackingNumber: string,
  statusText: string,
  trackingUrl: string,
  reason?: string | null,
) => {
  const subject = `Đơn hàng #${orderCode}: ${statusText}`;
  const details = [
    { label: 'Mã đơn hàng', value: `#${orderCode}`, isHighlight: true },
    { label: 'Đơn vị vận chuyển', value: carrierName },
    { label: 'Mã vận đơn', value: trackingNumber, isHighlight: true },
    { label: 'Trạng thái kiện hàng', value: statusText },
    ...(reason ? [{ label: 'Ghi chú vận chuyển', value: reason }] : []),
  ];
  const body = renderServiceNoticeEmail({
    badge: 'Cập nhật vận chuyển',
    title: subject,
    subtitle: `Kiện hàng cho đơn #${orderCode} vừa có trạng thái mới từ đơn vị giao vận.`,
    preheader: subject,
    message: `Xin chào <strong>${customerName}</strong>, đơn hàng #${orderCode} của bạn hiện đang ở trạng thái: <strong>${statusText}</strong>.`,
    details,
    actionButton: {
      text: 'Tra cứu hành trình vận đơn',
      url: trackingUrl || orderTrackingUrl(),
    },
    note: 'Cần hỗ trợ giao lại hoặc thay đổi thông tin nhận? Hãy phản hồi email này hoặc liên hệ hotline Model Universe 0373498729.',
  });
  return { subject, body };
};

export const emailMeetingConfirmed = (
  orderCode: string,
  customerName: string,
  address: string,
  time: string,
  remainingVnd: number,
) => {
  const subject = `Xác nhận lịch giao dịch đơn #${orderCode}`;
  const body = renderServiceNoticeEmail({
    badge: 'Lịch hẹn Showroom',
    title: subject,
    subtitle: `Model Universe xác nhận lịch giao dịch trực tiếp cho đơn hàng #${orderCode}.`,
    preheader: subject,
    message: `Xin chào <strong>${customerName}</strong>, lịch giao dịch trực tiếp tại showroom của bạn đã được xác nhận. Vui lòng kiểm tra thông tin chi tiết dưới đây:`,
    details: [
      { label: 'Mã đơn hàng', value: `#${orderCode}`, isHighlight: true },
      { label: 'Địa điểm giao dịch', value: address },
      { label: 'Thời gian hẹn', value: time, isHighlight: true },
      { label: 'Số tiền thanh toán tại chỗ', value: vnd(remainingVnd) },
    ],
    actionButton: {
      text: 'Xem chi tiết đơn hàng & Mã nhận hàng',
      url: orderUrl(),
    },
    note: 'Bạn vui lòng mang theo mã đơn hàng và mã nhận hàng hiển thị trong tài khoản để nhân viên kiểm tra khi giao dịch. Nếu cần đổi lịch hẹn, vui lòng thông báo trước 2 giờ.',
  });
  return { subject, body };
};

export const emailDeliveryFailed = (
  orderCode: string,
  customerName: string,
  trackingNumber: string,
  reason: string,
) => {
  const subject = `Đơn hàng #${orderCode} chưa được giao thành công`;
  const body = renderServiceNoticeEmail({
    badge: 'Giao hàng không thành công',
    title: subject,
    subtitle: `Nhân viên giao nhận đã thử phát kiện hàng nhưng chưa thành công.`,
    preheader: subject,
    message: `Xin chào <strong>${customerName}</strong>, đơn vị vận chuyển thông báo việc giao kiện hàng cho đơn #${orderCode} gặp sự cố: <em>${reason}</em>.`,
    details: [
      { label: 'Mã đơn hàng', value: `#${orderCode}`, isHighlight: true },
      { label: 'Mã vận đơn', value: trackingNumber },
      { label: 'Lý do chưa giao được', value: reason },
    ],
    actionButton: {
      text: 'Xem chi tiết đơn hàng',
      url: orderUrl(),
    },
    note: 'Vui lòng kiểm tra số điện thoại và địa chỉ nhận hàng, hoặc phản hồi email này để chúng tôi phối hợp cùng bưu tá giao lại cho bạn.',
  });
  return { subject, body };
};

export const emailHandoverCompleted = (
  orderCode: string,
  customerName: string,
  balanceVnd: number,
) => {
  const subject = `Giao nhận thành công đơn hàng #${orderCode}`;
  const body = renderServiceNoticeEmail({
    badge: 'Giao dịch hoàn tất',
    title: subject,
    subtitle: 'Cảm ơn bạn đã ghé thăm showroom và mua sắm tại Model Universe!',
    preheader: subject,
    message: `Xin chào <strong>${customerName}</strong>, đơn hàng #${orderCode} đã được bàn giao thành công tại showroom. Chúc bạn có trải nghiệm tuyệt vời cùng mẫu mô hình mới!`,
    details: [
      { label: 'Mã đơn hàng', value: `#${orderCode}`, isHighlight: true },
      { label: 'Trạng thái', value: 'Đã nhận hàng thành công' },
      { label: 'Số tiền thanh toán tại chỗ', value: balanceVnd > 0 ? vnd(balanceVnd) : 'Đã thanh toán đủ', isHighlight: true },
    ],
    actionButton: {
      text: 'Xem chi tiết đơn hàng & Viết đánh giá',
      url: orderUrl(),
    },
    note: 'Cần hỗ trợ lắp ráp, bảo hành hoặc phụ kiện thay thế? Đừng ngần ngại liên hệ hotline Model Universe 0373498729.',
  });
  return { subject, body };
};

export const emailBuybackReceived = (
  code: string,
  customerName: string,
  productName: string,
  receivedAt: string,
  estimateVnd: number | null,
) => {
  const subject = `Đã nhận sản phẩm thu mua ${code}`;
  const body = renderBuybackNoticeEmail({
    code,
    title: subject,
    subtitle: `Model Universe đã tiếp nhận kiện hàng thu mua an toàn tại showroom.`,
    message: `Xin chào <strong>${customerName}</strong>, Model Universe đã nhận được kiện hàng liên quan đến yêu cầu thu mua <strong>${code}</strong>. Shop sẽ tiến hành quay video mở kiện, kiểm định tình trạng thực tế và đối chiếu phụ kiện.`,
    details: [
      { label: 'Mã yêu cầu', value: code, isHighlight: true },
      { label: 'Sản phẩm mô hình', value: productName },
      { label: 'Thời gian tiếp nhận', value: receivedAt },
      { label: 'Giá thu dự kiến', value: estimateVnd !== null ? vnd(estimateVnd) : 'Định giá thủ công', isHighlight: true },
    ],
    actionUrl: buybackUrl(),
  });
  return { subject, body };
};

export const emailBuybackNeedEvidence = (
  code: string,
  customerName: string,
  request: string,
) => {
  const subject = `Yêu cầu bổ sung hình ảnh/video cho đơn thu mua ${code}`;
  const body = renderBuybackNoticeEmail({
    code,
    title: subject,
    subtitle: `Model Universe cần thêm thông tin hình ảnh để thẩm định chính xác sản phẩm của bạn.`,
    message: `Xin chào <strong>${customerName}</strong>, để có thể đưa ra mức định giá chính xác và tối ưu nhất cho yêu cầu thu mua <strong>${code}</strong>, chuyên viên kiểm định cần bạn bổ sung thêm thông tin sau:`,
    details: [
      { label: 'Mã yêu cầu', value: code, isHighlight: true },
      { label: 'Nội dung cần bổ sung', value: request },
    ],
    actionUrl: buybackUrl(),
  });
  return { subject, body };
};

export const emailBuybackPreliminaryQuote = (
  code: string,
  customerName: string,
  amountVnd: number | null,
) => {
  const subject = `Báo giá sơ bộ cho yêu cầu thu mua ${code}`;
  const body = renderBuybackNoticeEmail({
    code,
    title: subject,
    subtitle: `Model Universe đã có báo giá sơ bộ dựa trên thông tin mô hình bạn cung cấp.`,
    message: `Xin chào <strong>${customerName}</strong>, chuyên viên Model Universe đã thẩm định sơ bộ yêu cầu thu mua <strong>${code}</strong>. Bạn vui lòng xem báo giá sơ bộ và gửi sản phẩm về showroom nếu đồng ý:`,
    details: [
      { label: 'Mã yêu cầu', value: code, isHighlight: true },
      { label: 'Giá thu dự kiến', value: amountVnd !== null ? vnd(amountVnd) : 'Chờ giám định trực tiếp', isHighlight: true },
    ],
    actionUrl: buybackUrl(),
  });
  return { subject, body };
};

export const emailBuybackQuote = (
  code: string,
  customerName: string,
  facts: {
    estimateVnd: number | null;
    declaredIssueCount: number;
    inspectedIssueCount: number;
    deductionDifferenceVnd: number;
    finalVnd: number;
  },
) => {
  const subject = `Kết quả kiểm định và giá thu chính thức – ${code}`;
  const body = renderBuybackNoticeEmail({
    code,
    title: subject,
    subtitle: `Model Universe đã hoàn thành việc kiểm tra sản phẩm thuộc yêu cầu thu mua ${code}.`,
    message: `Xin chào <strong>${customerName}</strong>, chuyên viên của chúng tôi đã hoàn tất quy trình kiểm tra sản phẩm thực tế kèm video mở kiện. Dưới đây là biên bản đối chiếu và giá thu chính thức:`,
    details: [
      { label: 'Mã yêu cầu', value: code, isHighlight: true },
      { label: 'Giá thu dự kiến ban đầu', value: facts.estimateVnd !== null ? vnd(facts.estimateVnd) : 'Định giá thủ công' },
      { label: 'Số lỗi khai báo', value: `${facts.declaredIssueCount}` },
      { label: 'Số lỗi thực tế ghi nhận', value: `${facts.inspectedIssueCount}` },
      { label: 'Chênh lệch khấu trừ', value: vnd(facts.deductionDifferenceVnd) },
      { label: 'Giá thu chính thức đề xuất', value: vnd(facts.finalVnd), isHighlight: true },
    ],
    actionUrl: buybackUrl(),
  });
  return { subject, body };
};

export const emailVoucherExpiring = (customerName: string, code: string, description: string, expireAt: string) => {
  const subject = `Mã ưu đãi ${code} của bạn sắp hết hạn!`;
  const body = renderVoucherNoticeEmail({
    customerName,
    code,
    description,
    expireAt,
  });
  return { subject, body };
};
