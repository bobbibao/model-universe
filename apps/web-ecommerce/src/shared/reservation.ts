export const RESERVATION_STATUSES = [
  'awaiting_payment',
  'holding',
  'fully_paid',
  'PAID_IN_FULL',
  'delivery_requested',
  'fulfilling',
  'completed',
  'expired',
  'cancelled',
  'cancel_requested',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export const DAY_MS = 86_400_000;

export const HOLD_RULE_VERSION = 'hold-deposit-2026-10-28';
export const HOLD_TERMS =
  'Cọc giữ hàng tính trên tiền hàng sau ưu đãi hợp lệ, không gồm phí giao/COD chưa chốt. Dưới 20% chưa kích hoạt; 20–dưới 40%: 10 ngày; 40–dưới 50%: 15 ngày; 50–dưới 60%: 25 ngày; 60–dưới 70%: 30 ngày; 70–dưới 100%: 45 ngày; đúng 100%: đã trả đủ. Chỉ bắt đầu khi tiền hợp lệ và tồn kho đã được đặt giữ thành công; mỗi ngày là 24 giờ. Cọc thêm vượt mốc tính hạn từ lúc bắt đầu ban đầu, trong cùng mốc không đổi hạn. Tiền đến sau hạn, vượt tiền hàng hoặc khi hết tồn được đối soát, không tự kích hoạt lại. Hủy, sai SKU, shop không giao hoặc tranh chấp cần duyệt; không tự tịch thu cọc. Hoàn tiền chỉ hoàn tất khi ngân hàng xác nhận. Cọc chuyển vào đơn mua tối đa một lần; phí vận chuyển chốt riêng.';

export const minimumHoldVnd = (totalVnd: number) => Number((BigInt(totalVnd) + BigInt(4)) / BigInt(5));
// Compare integer ratios, never a rounded percentage. Zero means no timed hold (below 20% or fully paid).
export function reservationDays(totalVnd: number, paidVnd: number): number {
  if (
    !Number.isSafeInteger(totalVnd) ||
    totalVnd <= 0 ||
    !Number.isSafeInteger(paidVnd) ||
    paidVnd < 0 ||
    paidVnd > totalVnd
  )
    throw new RangeError('Invalid hold amount; overpayments require reconciliation.');
  const paid = BigInt(paidVnd) * BigInt(100),
    total = BigInt(totalVnd);
  if (paid < total * BigInt(20) || paid === total * BigInt(100)) return 0;
  if (paid < total * BigInt(40)) return 10;
  if (paid < total * BigInt(50)) return 15;
  if (paid < total * BigInt(60)) return 25;
  if (paid < total * BigInt(70)) return 30;
  return 45;
}

export function reservationDeadline(startedAt: Date, totalVnd: number, paidVnd: number, extensionDays = 0): Date {
  if (!Number.isInteger(extensionDays) || extensionDays < 0) throw new RangeError('Invalid approved extension.');
  if (!Number.isFinite(startedAt.getTime()) || reservationDays(totalVnd, paidVnd) === 0)
    throw new RangeError('No active timed hold.');
  return new Date(startedAt.getTime() + (reservationDays(totalVnd, paidVnd) + extensionDays) * DAY_MS);
}
