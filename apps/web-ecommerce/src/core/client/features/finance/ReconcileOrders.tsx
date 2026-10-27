'use client';
import { useEffect, useState } from 'react';
import Link from '@/i18n/navigation';
import TextField, { inputClassName } from '@/components/FormElements/TextField';
import { shopDay, type FinanceOrder } from '@/shared/finance';
import { amount, financeApi, type OrderDetail, type Page } from './api';
import FinanceDialog from './FinanceDialog';
import { Pagination } from './ExpenseWorkspace';
const statuses: Record<string, string> = {
  PROCESSING: 'Đang xử lý',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};
export default function ReconcileOrders({
  range,
  onChange,
}: {
  range: { from: string; to: string };
  onChange: () => void;
}) {
  const [data, setData] = useState<Page<FinanceOrder>>(),
    [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [selected, setSelected] = useState<number>();
  useEffect(() => {
    setPage(1);
  }, [range]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    financeApi
      .orders({ ...range, page, q: search })
      .then((rows) => {
        if (current) setData(rows);
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [range, page, search, revision]);
  return (
    <div className="finance-card">
      <div className="finance-card-heading">
        <div>
          <h2>Đối soát giá vốn & chi phí</h2>
          <p>Danh sách theo ngày tạo đơn; doanh thu ở Tổng quan theo ngày giao hàng.</p>
        </div>
        <form
          className="finance-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <TextField label="Tìm mã đơn / khách hàng" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="finance-button">Tìm</button>
        </form>
      </div>
      {loading ? (
        <p role="status" className="finance-loading">
          Đang tải đơn hàng…
        </p>
      ) : error ? (
        <p className="finance-notice" role="alert">
          Chưa tải được đơn hàng.{' '}
          <button className="finance-link" onClick={() => setRevision((n) => n + 1)}>
            Thử lại
          </button>
        </p>
      ) : (
        <>
          <div className="finance-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Đơn / ngày tạo</th>
                  <th>Khách hàng</th>
                  <th>Tiền hàng sau giảm</th>
                  <th>Trạng thái</th>
                  <th>Giá vốn & chi phí</th>
                  <th>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`}>
                        <strong>#{order.id}</strong>
                      </Link>
                      <small>
                        {shopDay(order.createdAt)} · {order.salesChannel}
                      </small>
                    </td>
                    <td>{order.recipientName}</td>
                    <td>{amount(order.subtotal - order.discount)}</td>
                    <td>
                      <span className={`finance-status${order.status === 'DELIVERED' ? ' is-ok' : ''}`}>
                        {statuses[order.status]}
                      </span>
                    </td>
                    <td>
                      <span className={`finance-status${order.review?.costsReviewed ? ' is-ok' : ' is-warning'}`}>
                        {order.review?.costsReviewed ? 'Đã rà soát' : 'Chưa đối soát'}
                      </span>
                    </td>
                    <td>
                      <button className="finance-link" onClick={() => setSelected(order.id)}>
                        Đối soát
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.rows.length && <p className="finance-empty">Không có đơn tạo trong khoảng đã chọn.</p>}
          </div>
          <Pagination page={page} count={data?.count ?? 0} setPage={setPage} />
        </>
      )}
      {selected !== undefined && (
        <OrderReconcile
          id={selected}
          onClose={() => setSelected(undefined)}
          onSaved={() => {
            setSelected(undefined);
            setRevision((n) => n + 1);
            onChange();
          }}
        />
      )}
    </div>
  );
}
function OrderReconcile({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const [order, setOrder] = useState<OrderDetail>(),
    [costs, setCosts] = useState<Record<number, string>>({}),
    [checked, setChecked] = useState(false),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    financeApi
      .order(id)
      .then((row) => {
        if (!current) return;
        setOrder(row);
        setCosts(
          Object.fromEntries(
            row.items.map((line) => [
              line.id,
              String(row.review?.items.find((i) => i.orderItemId === line.id)?.unitCostVnd ?? ''),
            ]),
          ),
        );
        setChecked(row.review?.costsReviewed ?? false);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [id]);
  return (
    <FinanceDialog title={`Đối soát đơn #${id}`} onClose={onClose}>
      {!order ? (
        <p role="status">{error ? 'Không tải được đơn hàng.' : 'Đang tải chi tiết…'}</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(false);
            try {
              await financeApi.reconcile(id, {
                expectedVersion: order.review?.version ?? 0,
                costsReviewed: checked,
                note,
                items: order.items.map((line) => ({
                  orderItemId: line.id,
                  unitCostVnd: costs[line.id] === '' ? null : Number(costs[line.id]),
                })),
              });
              onSaved();
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="finance-caption">
            Nhập giá mua thực tế của một sản phẩm. Không gộp tiền carton, sửa chữa hoặc phí ship vào giá vốn; ghi những
            khoản đó trong Sổ chi phí.
          </p>
          <div className="finance-reconcile-lines">
            {order.items.map((line) => (
              <div key={line.id}>
                <div>
                  <strong>{line.productName}</strong>
                  <small>
                    {line.quantity} sản phẩm · Tiền hàng {amount(line.unitPrice * line.quantity)}
                  </small>
                </div>
                <TextField
                  label={`Giá vốn / SP · dòng #${line.id}`}
                  type="number"
                  min="0"
                  max="1000000000000"
                  step="1"
                  value={costs[line.id] ?? ''}
                  onChange={(e) => {
                    setCosts({ ...costs, [line.id]: e.target.value });
                    setChecked(false);
                  }}
                  hint="Để trống nếu chưa xác minh. 0 chỉ dùng khi thực sự không có giá vốn."
                />
              </div>
            ))}
          </div>
          <div className="finance-form-total">
            <span>Tổng giá vốn đã nhập</span>
            <strong>
              {amount(order.items.reduce((sum, line) => sum + (Number(costs[line.id]) || 0) * line.quantity, 0))}
            </strong>
          </div>
          <details className="finance-method">
            <summary>Chi phí đã ghi nhận & cước tham khảo</summary>
            <ul>
              {order.expenses.map((e) => (
                <li key={e.id}>
                  {e.nameSnapshot} · {amount(e.amountVnd)}
                </li>
              ))}
            </ul>
            {!order.expenses.length && <p>Chưa có chi phí gắn với đơn.</p>}
            {order.shipments.map((s, i) => (
              <p key={i}>
                {s.trackingNumber || 'Vận đơn'} · {s.status} · Cước lúc tạo {amount(s.shippingFeeVnd)} (chưa tự tính
                thành chi phí thực tế).
              </p>
            ))}
          </details>
          <label className="finance-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={order.items.some((line) => costs[line.id] === '')}
            />
            Tôi đã kiểm tra giá vốn, phí ship shop chịu và các chi phí liên quan của đơn này.
          </label>
          <label className="finance-label">
            Căn cứ / ghi chú đối soát
            <textarea
              className={inputClassName}
              required
              maxLength={1000}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {order.revisions.length > 0 && (
            <details className="finance-method">
              <summary>Lịch sử {order.revisions.length} phiên bản</summary>
              <ol>
                {order.revisions.map((r) => (
                  <li key={r.version}>
                    v{r.version} · {r.costsReviewed ? 'Đã rà soát' : 'Chưa đủ dữ liệu'} · {r.note}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {error && (
            <p role="alert" className="finance-error">
              Chưa lưu được. Nếu người khác vừa cập nhật đơn, đóng và mở lại để lấy phiên bản mới.
            </p>
          )}
          <footer>
            <button type="button" className="finance-button" disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button className="finance-button is-primary" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu phiên bản đối soát'}
            </button>
          </footer>
        </form>
      )}
    </FinanceDialog>
  );
}
