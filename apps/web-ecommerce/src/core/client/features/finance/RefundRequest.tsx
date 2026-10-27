'use client';
import { useRef, useState } from 'react';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import type { MoneyOperation } from '@/shared/types/money-operation';
const labels: Record<string, string> = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt · chờ ngân hàng',
  completed: 'Ngân hàng đã xác nhận',
  rejected: 'Từ chối',
  reconciliation: 'Cần đối soát',
};
export function RefundHistory({ operations = [] }: { operations?: MoneyOperation[] }) {
  return (
    <ul className="space-y-3">
      {operations.map((row) => (
        <li key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <strong>Hoàn {formatVND(Number(row.amountVnd), 'vi')}</strong>
            <span>{labels[row.status]}</span>
          </div>
          <p className="mu-note">
            #{row.id} · {new Date(row.createdAt).toLocaleString('vi-VN')}
          </p>
          {row.providerReference && <p className="break-all">{row.providerReference}</p>}
        </li>
      ))}
    </ul>
  );
}
export default function RefundRequest({
  endpoint,
  maximum,
  onUpdated,
  extraData = {},
}: {
  endpoint: string;
  maximum: number;
  onUpdated: () => void;
  extraData?: Record<string, unknown>;
}) {
  const key = useRef<string | null>(null),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  if (maximum < 1) return null;
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">Yêu cầu hoàn tiền dư</summary>
      <p className="mu-note mt-2">
        Yêu cầu được duyệt độc lập. Chỉ hoàn tất khi ngân hàng xác nhận chuyển đúng tài khoản; không tự khấu trừ hay
        tịch thu.
      </p>
      {done ? (
        <p role="status" className="mt-3 text-sm">
          Đã gửi yêu cầu. Theo dõi trạng thái trong sổ giao dịch.
        </p>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            key.current ||= crypto.randomUUID();
            setBusy(true);
            try {
              await Api.post(endpoint, {
                ...data,
                ...extraData,
                amountVnd: Number(data.amountVnd),
                requestKey: key.current,
              });
              setDone(true);
              onUpdated();
            } catch {
              /* The shared API displays the verified server error. */
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="mu-field">
            Số tiền (VND)
            <input name="amountVnd" type="number" min="1" max={maximum} step="1" required defaultValue={maximum} />
          </label>
          <label className="mu-field">
            Ngân hàng nhận
            <input name="bankName" required maxLength={100} autoComplete="off" />
          </label>
          <label className="mu-field">
            Số tài khoản
            <input name="accountNumber" required maxLength={64} inputMode="numeric" autoComplete="off" />
          </label>
          <label className="mu-field">
            Tên chủ tài khoản
            <input name="accountHolder" required maxLength={150} />
          </label>
          <label className="mu-field sm:col-span-2">
            Lý do / hồ sơ đối soát
            <textarea name="reason" required maxLength={1000} rows={2} />
          </label>
          <button className="mu-button sm:col-span-2" disabled={busy}>
            Gửi yêu cầu hoàn tiền
          </button>
        </form>
      )}
    </details>
  );
}
