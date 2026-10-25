import type { DirectSaleInput } from '../../../../shared/direct-sales';
import HttpError from '../../../../shared/server/utils/HttpError';
import { asTrimmedString, isValidPhone } from '../../../../shared/server/utils/ValidationUtils';

// Do not use cart normalization here: malformed or oversized sales must be refused, never silently truncated.
export function validateDirectSale(data: Record<string, unknown>): DirectSaleInput {
  const fail = (message: string): never => {
    throw HttpError.badRequest(message);
  };
  const text = (key: string, max: number) => {
    const value = asTrimmedString(data[key]);
    if (value.length > max) fail(`${key}: tối đa ${max} ký tự.`);
    return value;
  };
  const requestKey = text('requestKey', 128);
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(requestKey)) fail('Mã yêu cầu bán hàng không hợp lệ.');
  if (data.channel !== 'COUNTER' && data.channel !== 'ASSISTED') fail('Chọn nguồn đơn hàng.');
  if (data.fulfillment !== 'HANDOVER' && data.fulfillment !== 'DELIVERY') fail('Chọn cách giao hàng.');
  if (!['CASH', 'BANK_TRANSFER', 'UNPAID'].includes(String(data.payment))) fail('Chọn cách thu tiền.');
  const customerId = data.customerId ?? null;
  if (customerId !== null && (typeof customerId !== 'number' || !Number.isSafeInteger(customerId) || customerId < 1))
    fail('Khách hàng không hợp lệ.');
  const recipientName = text('recipientName', 150),
    phone = text('phone', 20);
  if (phone && !isValidPhone(phone)) fail('Số điện thoại không hợp lệ.');
  const address = text('address', 500),
    city = text('city', 150);
  if (data.fulfillment === 'DELIVERY' && (!recipientName || !phone || address.length < 4 || !city))
    fail('Đơn giao hàng cần tên, số điện thoại, địa chỉ và tỉnh/thành phố.');
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 100)
    fail('Chọn từ 1 đến 100 mặt hàng.');
  const quantities = new Map<number, number>();
  for (const item of data.items as { productId: number; quantity: number }[]) {
    if (
      !item ||
      !Number.isSafeInteger(item.productId) ||
      item.productId < 1 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999
    )
      fail('Mã sản phẩm và số lượng phải là số nguyên hợp lệ.');
    const quantity = (quantities.get(item.productId) || 0) + item.quantity;
    if (quantity > 999) fail('Mỗi mặt hàng tối đa 999 sản phẩm.');
    quantities.set(item.productId, quantity);
  }
  if (
    typeof data.expectedTotal !== 'number' ||
    !Number.isSafeInteger(data.expectedTotal) ||
    data.expectedTotal < 1 ||
    data.expectedTotal > 2_147_483_647
  )
    fail('Tổng tiền xác nhận không hợp lệ.');
  const payment = data.payment as DirectSaleInput['payment'];
  const externalReference = text('externalReference', 128).toUpperCase();
  if (payment !== 'UNPAID' && (data.moneyVerified !== true || !/^[A-Z0-9:_.-]{8,128}$/.test(externalReference)))
    fail('Xác nhận đã nhận đủ tiền và nhập mã phiếu thu hoặc mã giao dịch thực tế (8–128 ký tự).');
  if (payment === 'UNPAID' && (data.moneyVerified === true || externalReference))
    fail('Đơn chưa thu tiền không được có xác nhận hoặc mã khoản thu.');
  if (data.fulfillment === 'HANDOVER' && payment === 'UNPAID')
    fail('Bàn giao ngay tại shop cần xác nhận đã thu đủ tiền.');
  return {
    requestKey,
    channel: data.channel as DirectSaleInput['channel'],
    fulfillment: data.fulfillment as DirectSaleInput['fulfillment'],
    customerId: customerId as number | null,
    recipientName: recipientName || 'Khách lẻ',
    phone,
    address: data.fulfillment === 'HANDOVER' ? 'Nhận trực tiếp tại shop' : address,
    city: data.fulfillment === 'HANDOVER' ? '' : city,
    note: text('note', 500),
    items: [...quantities].sort(([a], [b]) => a - b).map(([productId, quantity]) => ({ productId, quantity })),
    expectedTotal: data.expectedTotal as number,
    payment,
    moneyVerified: payment !== 'UNPAID',
    externalReference,
  };
}
