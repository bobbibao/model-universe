'use client';
import { useEffect, useState } from 'react';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import type { MoneyOperation } from '@/shared/types/money-operation';
import { RefundHistory } from './RefundRequest';
type Staff = { id: number; email: string; commerceScopes: string[]; isActive: boolean };
export default function MoneyOperationsWorkspace() {
  const [data, setData] = useState<{ operations: MoneyOperation[]; bankConfirmationConfigured: boolean } | null>(null);
  const [staff, setStaff] = useState<{ canAssign: boolean; staff: Staff[] } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const load = async () => {
    try {
      const [a, b] = await Promise.all([
        Api.get('/admin/commerce/money-operations'),
        Api.get('/admin/commerce/access'),
      ]);
      setData(a.data);
      setStaff(b.data);
      setError(false);
    } catch {
      setError(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Duyệt hoàn tiền & phân quyền</h2>
          <p className="mu-note">Tiền cọc là khoản phải trả. Duyệt hồ sơ không đồng nghĩa đã chuyển tiền.</p>
        </div>
        <button className="finance-button" disabled={busy} onClick={() => void load()}>
          Làm mới
        </button>
      </div>
      {error && (
        <p role="alert">
          Không tải được hàng đợi. Cần quyền Finance; nhờ chủ shop cấp quyền tại Tài chính → Duyệt hoàn tiền.
        </p>
      )}
      {data && (
        <>
          <p className="rounded-lg bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 p-3 text-sm">
            {data.bankConfirmationConfigured
              ? 'Đã cấu hình khóa tiếp nhận xác nhận ngân hàng.'
              : 'Chưa cấu hình bộ tiếp nhận ngân hàng: yêu cầu chỉ dừng ở chờ chuyển tiền, không tự ghi đã hoàn.'}
          </p>
          {!data.operations.length && <p className="mu-note">Chưa có yêu cầu hoàn tiền.</p>}
          {data.operations.map((row) => (
            <article key={row.id} className="mu-panel space-y-3 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold">
                  {
                    (
                      {
                        hold_refund: 'Cọc giữ hàng',
                        purchase_refund: 'Trả trước đơn mua',
                        pawn_credit_refund: 'Credit gia hạn cầm',
                        pawn_disposal_surplus: 'Tiền dư xử lý tài sản',
                      } as Record<string, string>
                    )[row.purpose]
                  }{' '}
                  · #{row.entityId}
                </h3>
                <b>{formatVND(Number(row.amountVnd), 'vi')}</b>
              </div>
              <RefundHistory operations={[row]} />
              <p className="text-sm">
                {row.details.account.bank} · {row.details.account.number} · {row.details.account.holder}
              </p>
              <p className="mu-note">
                {row.details.reason} · Người lập #{row.requestedBy}
              </p>
              {row.status === 'requested' && (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    setBusy(true);
                    try {
                      await Api.post(`/admin/commerce/money-operations/${row.id}/decision`, {
                        expectedVersion: row.version,
                        approved: form.get('decision') === 'approve',
                        reason: form.get('reason'),
                      });
                      await load();
                    } catch {
                      /* The shared API displays the verified server error. */
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="mu-field flex-1">
                    Lý do quyết định
                    <input name="reason" maxLength={1000} required />
                  </label>
                  <label className="mu-field">
                    Quyết định
                    <select name="decision">
                      <option value="approve">Duyệt chờ ngân hàng</option>
                      <option value="reject">Từ chối</option>
                    </select>
                  </label>
                  <button className="mu-button" disabled={busy}>
                    Lưu quyết định
                  </button>
                  <p className="mu-note w-full">Người duyệt phải khác người lập yêu cầu.</p>
                </form>
              )}
            </article>
          ))}
        </>
      )}
      {staff?.canAssign && (
        <details className="mu-panel p-4">
          <summary className="cursor-pointer font-semibold">Phân quyền Finance / Compliance</summary>
          <div className="mt-4 space-y-4">
            {staff.staff.map((person) => (
              <form
                className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"
                key={`${person.id}:${person.commerceScopes.join()}`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  try {
                    await Api.post(`/admin/commerce/access/${person.id}`, {
                      scopes: ['finance', 'compliance'].filter((s) => f.has(s)),
                      reason: f.get('reason'),
                    });
                    await load();
                  } catch {
                    /* The shared API displays the verified server error. */
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <strong className="sm:col-span-2">{person.email}</strong>
                {['finance', 'compliance'].map((scope) => (
                  <label className="flex items-center gap-2 text-sm" key={scope}>
                    <input name={scope} type="checkbox" defaultChecked={person.commerceScopes.includes(scope)} />
                    {scope === 'finance' ? 'Finance · kiểm tiền, duyệt hoàn' : 'Compliance · pháp lý, quyền sở hữu'}
                  </label>
                ))}
                <label className="mu-field">
                  Căn cứ phân quyền
                  <input name="reason" maxLength={1000} required />
                </label>
                <button className="finance-button" disabled={busy}>
                  Lưu quyền
                </button>
              </form>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
