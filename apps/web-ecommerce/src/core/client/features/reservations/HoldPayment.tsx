'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Api from '@/core/client/api/Api';
import type { Reservation } from '@/shared/types/reservation';
import { formatVND } from '@/shared/server/utils/utils';
interface Link {
  checkoutUrl: string;
  qrCode?: string;
  amountVnd: number;
  description: string;
  accountNumber: string;
  accountName: string;
  expiresAt: string;
}
export default function HoldPayment({ row, onUpdated }: { row: Reservation; onUpdated: () => void }) {
  const [link, setLink] = useState<Link | null>(null),
    [busy, setBusy] = useState(false);
  const remaining = row.totalVnd - row.paidVnd;
  const nextTarget =
    [20, 40, 50, 60, 70, 100].map((p) => Math.ceil((row.totalVnd * p) / 100)).find((amount) => amount > row.paidVnd) ||
    row.totalVnd;
  if (
    remaining < 1 ||
    row.disputed ||
    row.reconciliationRequired ||
    !['awaiting_payment', 'holding', 'delivery_requested'].includes(row.status)
  )
    return null;
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="font-bold">Chuyển cọc giữ hàng</h3>
      <p className="mu-note">
        Tối thiểu {formatVND(row.minimumInitialVnd, 'vi')} để kích hoạt. Ảnh giao dịch và trang chuyển hướng không xác
        nhận tiền; nếu hết hàng, khoản nhận vào đối soát.
      </p>
      {link ? (
        <div className="space-y-3">
          <strong>{formatVND(link.amountVnd, 'vi')}</strong>
          {link.qrCode && <QRCodeSVG value={link.qrCode} size={176} title="QR cọc giữ hàng" />}
          <p className="text-sm">
            {link.accountName} · {link.accountNumber}
            <br />
            Nội dung: {link.description}
          </p>
          <p className="mu-note">
            QR có hạn đến {new Date(link.expiresAt).toLocaleString('vi-VN')}. Giữ nguyên số tiền và nội dung.
          </p>
          <a href={link.checkoutUrl} target="_blank" rel="noreferrer" className="underline">
            Mở trang thanh toán
          </a>
        </div>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              setLink(
                (
                  await Api.post(`/reservations/${row.id}/payment-link`, {
                    amountVnd: Number(f.get('amountVnd')),
                    locale: 'vi',
                  })
                ).data,
              );
            } catch {
              /* The shared API displays the verified server error. */
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="mu-field flex-1">
            Số tiền chuyển (VND)
            <input
              name="amountVnd"
              type="number"
              min="1"
              max={remaining}
              step="1"
              defaultValue={Math.min(remaining, Math.max(1, nextTarget - row.paidVnd))}
              required
            />
          </label>
          <button className="mu-button" disabled={busy}>
            Tạo QR thanh toán
          </button>
        </form>
      )}
      <button
        className="text-sm font-semibold underline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await Api.post(`/reservations/${row.id}/sync-payment`, {});
            onUpdated();
          } catch {
            /* The shared API displays the verified server error. */
          } finally {
            setBusy(false);
          }
        }}
      >
        Kiểm tra tiền đã nhận
      </button>
    </section>
  );
}
