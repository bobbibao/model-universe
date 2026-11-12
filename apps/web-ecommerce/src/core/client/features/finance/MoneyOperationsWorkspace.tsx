'use client';

import { receivingBanks } from '@/shared/banks';
import { useEffect, useMemo, useState } from 'react';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import { REFUND_TO_SOURCE_POLICY, shopDayStart } from '@/shared/refund-to-source';
import type { MoneyOperation } from '@/shared/types/money-operation';

type Staff = { id: number; email: string; commerceScopes: string[]; isActive: boolean };
type Queue = {
  operations: MoneyOperation[];
  bankConfirmationConfigured: boolean;
  payosPayoutConfigured: boolean;
  automaticRefunds?: boolean;
};
type Filter = 'open' | 'completed' | 'rejected' | 'all';

const vnd = (value: number | string) => formatVND(Number(value) || 0, 'vi');
const OPEN: MoneyOperation['status'][] = ['requested', 'approved', 'reconciliation'];
const STATUS: Record<MoneyOperation['status'], { label: string; tone: string }> = {
  requested: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Đã duyệt · chờ chuyển', tone: 'info' },
  reconciliation: { label: 'Đang đối soát', tone: 'warning' },
  completed: { label: 'Đã hoàn tiền', tone: 'ok' },
  rejected: { label: 'Từ chối / thất bại', tone: 'danger' },
};
const PURPOSE: Record<string, string> = {
  hold_refund: 'Hoàn cọc giữ hàng',
  purchase_refund: 'Hoàn trả trước đơn mua',
  pawn_credit_refund: 'Hoàn credit gia hạn cầm',
  pawn_disposal_surplus: 'Trả tiền dư xử lý tài sản',
};
const ACTION: Record<string, string> = {
  requested: 'Lập yêu cầu hoàn',
  requested_to_source: 'Tạo khoản hoàn về tài khoản đã thanh toán',
  auto_approved: 'Tự duyệt trong hạn mức',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  payos_submission_requested: 'Gửi lệnh chi payOS',
  payos_processing: 'payOS đang xử lý',
  payos_succeeded: 'payOS chuyển thành công',
  payos_failed: 'payOS báo thất bại',
  payos_cancelled: 'payOS huỷ lệnh',
  provider_confirmed: 'Ngân hàng xác nhận đã chuyển',
};
const entityHref = (row: MoneyOperation) =>
  row.purpose === 'purchase_refund'
    ? `/admin/orders/${row.entityId}`
    : row.purpose === 'hold_refund'
      ? '/admin/reservations'
      : '/admin/pawn';
const time = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
// Who opened the record: the background refund-to-source job, a staff member, or the account that asked.
const openedBy = (row: MoneyOperation) => {
  const first = row.details.history[0];
  if (first?.action === 'requested_to_source') return first.by ? `Nhân viên #${first.by}` : 'Hệ thống, sau khi huỷ';
  return `Tài khoản #${row.requestedBy}`;
};

export default function MoneyOperationsWorkspace({ onChange }: { onChange?: () => void }) {
  const [data, setData] = useState<Queue | null>(null);
  const [staff, setStaff] = useState<{ canAssign: boolean; staff: Staff[] } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [filter, setFilter] = useState<Filter>('open');
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
    onChange?.();
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; the refresh button reloads.
  }, []);

  const view = useMemo(() => {
    const rows = data?.operations ?? [];
    const sum = (list: MoneyOperation[]) => list.reduce((total, row) => total + Number(row.amountVnd), 0);
    const since30 = Date.now() - 30 * 86_400_000;
    const dayStart = shopDayStart().getTime();
    const toReview = rows.filter((row) => row.status === 'requested');
    const toSend = rows.filter((row) => row.status === 'approved' || row.status === 'reconciliation');
    const done30 = rows.filter(
      (row) => row.status === 'completed' && new Date(row.completedAt || row.createdAt).getTime() >= since30,
    );
    const autoToday = sum(
      rows.filter(
        (row) =>
          row.details.autoApproval?.policy === REFUND_TO_SOURCE_POLICY.version &&
          row.status !== 'rejected' &&
          new Date(row.createdAt).getTime() >= dayStart,
      ),
    );
    const groups: Record<Filter, MoneyOperation[]> = {
      // The work queue: oldest first, those waiting for a reviewer before those waiting for the bank.
      open: rows
        .filter((row) => OPEN.includes(row.status))
        .sort(
          (a, b) =>
            OPEN.indexOf(a.status) - OPEN.indexOf(b.status) ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      completed: rows.filter((row) => row.status === 'completed'),
      rejected: rows.filter((row) => row.status === 'rejected'),
      all: rows,
    };
    return { toReview, toSend, done30, autoToday, groups, sum };
  }, [data]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'open', label: 'Cần xử lý' },
    { key: 'completed', label: 'Đã hoàn' },
    { key: 'rejected', label: 'Từ chối / thất bại' },
    { key: 'all', label: 'Tất cả' },
  ];
  const shown = view.groups[filter];
  const autoPercent = Math.min(100, Math.round((view.autoToday / REFUND_TO_SOURCE_POLICY.dailyCapVnd) * 100));

  return (
    <div className="refund-queue">
      <header className="refund-queue-head">
        <div>
          <h2>Hoàn tiền cho khách</h2>
          <p>
            Tiền cọc và tiền trả trước là khoản shop đang nợ khách. Một hồ sơ chỉ xong khi ngân hàng xác nhận đã chuyển,
            không phải lúc được duyệt.
          </p>
        </div>
        <button className="finance-button" disabled={busy} onClick={() => void load()}>
          Làm mới
        </button>
      </header>

      {error && (
        <p role="alert" className="finance-notice">
          Không tải được hàng đợi hoàn tiền. Cần quyền Finance; nhờ chủ shop cấp quyền ở mục Phân quyền bên dưới.
        </p>
      )}

      {data && (
        <>
          <div className="refund-summary" aria-label="Tóm tắt hoàn tiền">
            <button
              type="button"
              className="refund-stat"
              data-tone={view.toReview.length ? 'warning' : undefined}
              onClick={() => setFilter('open')}
            >
              <span>Chờ duyệt</span>
              <strong>{view.toReview.length}</strong>
              <small>{vnd(view.sum(view.toReview))} · cần người thứ hai duyệt</small>
            </button>
            <button
              type="button"
              className="refund-stat"
              data-tone={view.toSend.length ? 'info' : undefined}
              onClick={() => setFilter('open')}
            >
              <span>Chờ chuyển tiền</span>
              <strong>{view.toSend.length}</strong>
              <small>{vnd(view.sum(view.toSend))} · đã duyệt, chưa có xác nhận ngân hàng</small>
            </button>
            <button type="button" className="refund-stat" onClick={() => setFilter('completed')}>
              <span>Đã hoàn 30 ngày</span>
              <strong>{view.done30.length}</strong>
              <small>{vnd(view.sum(view.done30))} · ngân hàng đã xác nhận</small>
            </button>
            <div className="refund-stat is-static">
              <span>
                Hoàn tự động hôm nay
                {data.automaticRefunds === false && (
                  <em className="refund-badge" data-tone="danger">
                    Đang tắt
                  </em>
                )}
              </span>
              <strong>{vnd(view.autoToday)}</strong>
              <div
                className="refund-meter"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={REFUND_TO_SOURCE_POLICY.dailyCapVnd}
                aria-valuenow={view.autoToday}
                aria-label="Hạn mức hoàn tự động trong ngày"
              >
                <i style={{ width: `${autoPercent}%` }} />
              </div>
              <small>
                Hạn mức {vnd(REFUND_TO_SOURCE_POLICY.dailyCapVnd)}/ngày · tối đa{' '}
                {vnd(REFUND_TO_SOURCE_POLICY.perRefundCapVnd)}/khoản
              </small>
            </div>
          </div>

          <p className="refund-channel" data-tone={data.payosPayoutConfigured ? 'ok' : 'warning'}>
            {data.payosPayoutConfigured
              ? 'payOS Chi hộ đã kết nối: lệnh chi được gửi và kiểm tra ngay trên từng hồ sơ đã duyệt.'
              : data.bankConfirmationConfigured
                ? 'Chưa có khóa payOS Chi hộ; xác nhận ngân hàng được nhận qua chữ ký riêng.'
                : 'Chưa có khóa payOS Chi hộ (PAYOS_PAYOUT_CLIENT_ID/API_KEY/CHECKSUM_KEY): chưa chuyển tiền được từ đây.'}
          </p>

          <div className="finance-segment refund-filters" role="group" aria-label="Lọc hồ sơ hoàn tiền">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label} <span>{view.groups[item.key].length}</span>
              </button>
            ))}
          </div>

          {!shown.length && (
            <p className="finance-empty refund-empty">
              {filter === 'open' ? 'Không có khoản hoàn nào đang chờ xử lý.' : 'Chưa có hồ sơ trong mục này.'}
            </p>
          )}

          <ul className="refund-list">
            {shown.map((row) => {
              const status = STATUS[row.status];
              const bank = receivingBanks.find((item) => item.value === row.details.account.bank);
              return (
                <li key={row.id} className="refund-card" data-status={row.status}>
                  <div className="refund-card-head">
                    <div>
                      <div className="refund-badges">
                        <em className="refund-badge" data-tone={status.tone}>
                          {status.label}
                        </em>
                        {row.details.autoApproval && (
                          <em className="refund-badge" data-tone="accent">
                            Tự động trong hạn mức
                          </em>
                        )}
                        {row.details.payout?.state && row.status === 'approved' && (
                          <em className="refund-badge">payOS: {row.details.payout.state}</em>
                        )}
                      </div>
                      <h3>
                        {PURPOSE[row.purpose] || row.purpose}{' '}
                        <Link href={entityHref(row)} className="finance-link">
                          #{row.entityId}
                        </Link>
                      </h3>
                      <p className="refund-meta">
                        Hồ sơ #{row.id} · {time(row.createdAt)} · {openedBy(row)}
                      </p>
                    </div>
                    <strong className="refund-amount">{vnd(row.amountVnd)}</strong>
                  </div>

                  <div className="refund-account">
                    <div>
                      <span>Ngân hàng nhận</span>
                      <b>{bank?.label || row.details.account.bank}</b>
                    </div>
                    <div>
                      <span>Số tài khoản</span>
                      <b className="refund-mono">{row.details.account.number}</b>
                    </div>
                    <div>
                      <span>Chủ tài khoản</span>
                      <b>{row.details.account.holder}</b>
                    </div>
                    {row.details.source && (
                      <p className="refund-source">
                        ✓ Đúng tài khoản đã thanh toán (payOS xác nhận {vnd(row.details.source.paidVnd)})
                      </p>
                    )}
                  </div>

                  <p className="refund-reason">{row.details.reason}</p>

                  <details className="refund-history">
                    <summary>Lịch sử ({row.details.history.length})</summary>
                    <ol>
                      {row.details.history.map((entry, index) => (
                        <li key={`${entry.action}-${index}`}>
                          <time>{time(entry.at)}</time>
                          <span>
                            {ACTION[entry.action] || entry.action}
                            {entry.by ? ` · #${entry.by}` : ''}
                            {entry.reason && !entry.reason.startsWith('refund_to_source') ? ` · ${entry.reason}` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {(row.providerReference || row.details.payout?.referenceId) && (
                      <p className="refund-mono">
                        {row.providerReference
                          ? `Mã giao dịch: ${row.providerReference}`
                          : `Mã đối soát: ${row.details.payout?.referenceId}`}
                      </p>
                    )}
                  </details>

                  {row.status === 'approved' && (
                    <form
                      className="refund-action"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const mode = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'sync';
                        setBusy(true);
                        try {
                          await Api.post(`/admin/commerce/money-operations/${row.id}/payos/${mode}`, {
                            expectedVersion: row.version,
                          });
                        } catch {
                          /* The shared API displays the verified server error. */
                        } finally {
                          await load();
                          setBusy(false);
                        }
                      }}
                    >
                      <p>
                        {row.details.payout
                          ? 'Lệnh chi đã gửi payOS. Kiểm tra để cập nhật kết quả; gửi lại luôn dùng cùng mã, không chuyển hai lần.'
                          : row.details.autoApproval
                            ? 'Hệ thống sẽ tự gửi lệnh chi trong vài phút. Chỉ gửi tay nếu khoản này đứng yên quá lâu.'
                            : `Chuyển đúng ${vnd(row.amountVnd)} vào tài khoản ở trên.`}
                      </p>
                      {!row.details.payout?.providerId && (
                        <label className="refund-confirm">
                          <input type="checkbox" required />
                          Tôi đã đối chiếu ngân hàng, số tài khoản, người nhận và số tiền.
                        </label>
                      )}
                      <div className="refund-buttons">
                        {!row.details.payout?.providerId && (
                          <button
                            value="send"
                            className="finance-button is-primary"
                            disabled={busy || !data.payosPayoutConfigured}
                          >
                            {row.details.payout ? 'Gửi lại cùng mã payOS' : 'Chuyển tiền thật qua payOS'}
                          </button>
                        )}
                        {row.details.payout && (
                          <button
                            value="sync"
                            formNoValidate
                            className="finance-button"
                            disabled={busy || !data.payosPayoutConfigured}
                          >
                            Kiểm tra payOS
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  {row.status === 'requested' && (
                    <form
                      className="refund-action refund-decision"
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
                      <label className="mu-field">
                        Lý do quyết định
                        <input name="reason" maxLength={1000} required placeholder="Ví dụ: đã đối chiếu đơn huỷ" />
                      </label>
                      <label className="mu-field">
                        Quyết định
                        <select name="decision">
                          <option value="approve">Duyệt, chờ chuyển tiền</option>
                          <option value="reject">Từ chối</option>
                        </select>
                      </label>
                      <button className="finance-button is-primary" disabled={busy}>
                        Lưu quyết định
                      </button>
                      <p className="refund-note">Người duyệt phải khác người lập yêu cầu.</p>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {data.operations.length >= 100 && (
            <p className="refund-note">Hiển thị 100 hồ sơ gần nhất; số liệu tóm tắt tính trên các hồ sơ này.</p>
          )}
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
