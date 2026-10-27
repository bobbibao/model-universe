'use client';
import { useState } from 'react';
import Api from '@/core/client/api/Api';
export default function HoldReview({ id, onUpdated }: { id: number; onUpdated: () => void }) {
  const [action, setAction] = useState('dispute'),
    [busy, setBusy] = useState(false);
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">Đối soát / tranh chấp thanh toán</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await Api.post(`/admin/reservations/${id}/review`, {
              ...Object.fromEntries(f),
              action,
              amountVnd: Number(f.get('amountVnd')),
              moneyVerified: f.has('moneyVerified'),
            });
            onUpdated();
          } catch {
            /* The shared API displays the verified server error. */
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="mu-field">
          Thao tác
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="dispute">Finance · đánh dấu tranh chấp</option>
            <option value="resolve_dispute">Compliance · ghi quyết định xử lý</option>
            <option value="reverse_payment">Finance · tiền bị đảo ngược</option>
          </select>
        </label>
        {action === 'resolve_dispute' && (
          <label className="mu-field">
            Căn cứ giải quyết
            <input name="legalReference" minLength={8} maxLength={1000} required />
          </label>
        )}
        {action === 'reverse_payment' && (
          <>
            <label className="mu-field">
              Số tiền bị đảo (VND)
              <input name="amountVnd" type="number" min="1" step="1" required />
            </label>
            <label className="mu-field">
              Mã giao dịch đảo
              <input name="externalReference" minLength={8} maxLength={128} required />
            </label>
            <label className="flex gap-2 text-sm">
              <input name="moneyVerified" type="checkbox" required />
              Đã đối chiếu sự kiện ngân hàng thực tế
            </label>
          </>
        )}
        <label className="mu-field">
          Lý do / hồ sơ
          <textarea name="reason" required maxLength={1000} rows={2} />
        </label>
        <button className="mu-button" disabled={busy}>
          Lưu kiểm tra
        </button>
      </form>
    </details>
  );
}
