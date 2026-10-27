'use client';
import { useEffect, useState, type FormEvent } from 'react';
import TextField, { inputClassName } from '@/components/FormElements/TextField';
import SelectField from '@/components/FormElements/SelectField';
import { COST_BASES, FINANCE_CATEGORIES, shopDay, type FinanceExpense } from '@/shared/finance';
import { financeApi, amount, categoryLabels, basisLabels, type CostType, type Page } from './api';
import FinanceDialog from './FinanceDialog';

export default function ExpenseWorkspace({
  range,
  onChange,
}: {
  range: { from: string; to: string };
  onChange: () => void;
}) {
  const [types, setTypes] = useState<CostType[]>([]),
    [entries, setEntries] = useState<Page<FinanceExpense & { reversed: boolean }>>();
  const [view, setView] = useState('entries'),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const [editor, setEditor] = useState<CostType | 'new' | null>(null),
    [add, setAdd] = useState(false),
    [reverse, setReverse] = useState<FinanceExpense | null>(null);
  useEffect(() => setPage(1), [range]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    Promise.all([financeApi.types(), financeApi.expenses({ ...range, page })])
      .then(([t, e]) => {
        if (current) {
          setTypes(t);
          setEntries(e);
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [range, page, revision]);
  const saved = () => {
    setRevision((n) => n + 1);
    onChange();
    setEditor(null);
    setAdd(false);
    setReverse(null);
  };
  return (
    <div className="finance-card">
      <div className="finance-card-heading">
        <div className="finance-segment">
          <button aria-pressed={view === 'entries'} onClick={() => setView('entries')}>
            Sổ chi phí
          </button>
          <button aria-pressed={view === 'types'} onClick={() => setView('types')}>
            Loại chi phí & định mức
          </button>
        </div>
        <button
          className="finance-button is-primary"
          onClick={() => (view === 'types' ? setEditor('new') : setAdd(true))}
        >
          {view === 'types' ? '+ Thêm loại chi phí' : '+ Ghi nhận chi phí'}
        </button>
      </div>
      <p className="finance-caption">
        {view === 'types'
          ? 'Định mức chỉ gợi ý khi nhập chứng từ. Sửa đơn giá không đổi các chi phí đã ghi nhận.'
          : 'Chi phí được lấy từ chứng từ trong database. Đảo bút toán để điều chỉnh, không xóa lịch sử.'}
      </p>
      {loading ? (
        <p role="status" className="finance-loading">
          Đang tải sổ chi phí…
        </p>
      ) : failed ? (
        <p role="alert" className="finance-notice">
          Không tải được dữ liệu.{' '}
          <button className="finance-link" onClick={() => setRevision((n) => n + 1)}>
            Thử lại
          </button>
        </p>
      ) : view === 'types' ? (
        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loại chi phí</th>
                <th>Phân loại</th>
                <th>Cách ghi nhận</th>
                <th>Đơn giá mặc định</th>
                <th>Trạng thái</th>
                <th>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  <td>
                    <strong>{type.name}</strong>
                    <small>
                      Phiên bản {type.version} · {type.unit}
                    </small>
                  </td>
                  <td>{categoryLabels[type.category]}</td>
                  <td>{basisLabels[type.basis]}</td>
                  <td>{amount(type.unitCostVnd)}</td>
                  <td>
                    <span className={`finance-status ${type.isActive ? 'is-ok' : ''}`}>
                      {type.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                    </span>
                  </td>
                  <td>
                    <button className="finance-link" onClick={() => setEditor(type)} aria-label={`Sửa ${type.name}`}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!types.length && (
            <p className="finance-empty">
              Tạo loại chi phí đầu tiên: carton, chống sốc, nhân công hoặc chi phí vận hành.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="finance-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày / chứng từ</th>
                  <th>Chi phí</th>
                  <th>Đơn hàng</th>
                  <th>Lượng × đơn giá</th>
                  <th>Thành tiền</th>
                  <th>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries?.rows.map((entry) => (
                  <tr key={entry.id} className={Number(entry.amountVnd) < 0 ? 'finance-reversed' : ''}>
                    <td>
                      {shopDay(entry.incurredAt)}
                      <small>
                        #{entry.id}
                        {entry.reversesId ? ` · Đảo #${entry.reversesId}` : entry.reversed ? ' · Đã đảo' : ''}
                      </small>
                    </td>
                    <td>
                      <strong>{entry.nameSnapshot}</strong>
                      <small>{entry.note}</small>
                    </td>
                    <td>{entry.orderId ? `#${entry.orderId}` : 'Vận hành chung'}</td>
                    <td>
                      {Number(entry.quantity).toLocaleString('vi-VN')} {entry.unitSnapshot || ''} ×{' '}
                      {amount(entry.unitCostVnd)}
                    </td>
                    <td>
                      <strong>{amount(entry.amountVnd)}</strong>
                    </td>
                    <td>
                      {!entry.reversesId && !entry.reversed && (
                        <button
                          className="finance-link"
                          onClick={() => setReverse(entry)}
                          aria-label={`Đảo chi phí #${entry.id}`}
                        >
                          Đảo / sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!entries?.rows.length && (
              <p className="finance-empty">
                Chưa có chi phí ghi nhận trong kỳ. Đơn giá mặc định không tự trở thành chi phí.
              </p>
            )}
          </div>
          <Pagination page={page} count={entries?.count ?? 0} setPage={setPage} />
        </>
      )}
      {editor && (
        <TypeEditor type={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={saved} />
      )}
      {add && <ExpenseEditor types={types.filter((t) => t.isActive)} onClose={() => setAdd(false)} onSaved={saved} />}
      {reverse && <ReverseEditor entry={reverse} onClose={() => setReverse(null)} onSaved={saved} />}
    </div>
  );
}
export function Pagination({ page, count, setPage }: { page: number; count: number; setPage: (page: number) => void }) {
  return (
    <div className="finance-pagination">
      <span>
        {count} bản ghi · Trang {page}/{Math.max(1, Math.ceil(count / 30))}
      </span>
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
        ← Trước
      </button>
      <button disabled={page * 30 >= count} onClick={() => setPage(page + 1)}>
        Sau →
      </button>
    </div>
  );
}
function TypeEditor({ type, onClose, onSaved }: { type?: CostType; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: type?.name ?? '',
    unit: type?.unit ?? 'lần',
    category: type?.category ?? 'PACKAGING',
    basis: type?.basis ?? 'ORDER',
    unitCostVnd: String(type?.unitCostVnd ?? ''),
    isActive: type?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await financeApi.saveType(type?.id, {
        ...form,
        unitCostVnd: Number(form.unitCostVnd),
        expectedVersion: type?.version,
      });
      onSaved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinanceDialog title={type ? 'Chỉnh loại chi phí' : 'Thêm loại chi phí'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="finance-form-grid">
          <TextField
            label="Tên loại chi phí"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <SelectField
            label="Phân loại"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as CostType['category'] })}
            options={FINANCE_CATEGORIES.map((value) => ({ value, label: categoryLabels[value] }))}
          />
          <SelectField
            label="Cách ghi nhận"
            value={form.basis}
            onChange={(e) => setForm({ ...form, basis: e.target.value as CostType['basis'] })}
            options={COST_BASES.map((value) => ({ value, label: basisLabels[value] }))}
          />
          <TextField
            label="Đơn vị"
            required
            maxLength={30}
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <TextField
            label="Đơn giá mặc định (VND)"
            required
            type="number"
            min="0"
            max="1000000000000"
            step="1"
            value={form.unitCostVnd}
            onChange={(e) => setForm({ ...form, unitCostVnd: e.target.value })}
          />
          <label className="finance-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Đang sử dụng
          </label>
        </div>
        <p className="finance-caption">
          Ngừng dùng chỉ ẩn khỏi lựa chọn mới. Chứng từ cũ giữ nguyên tên, phân loại, đơn giá và lượng sử dụng.
        </p>
        {error && (
          <p role="alert" className="finance-error">
            Chưa lưu được. Kiểm tra thông báo lỗi và thử lại.
          </p>
        )}
        <footer>
          <button type="button" className="finance-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="finance-button is-primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu loại chi phí'}
          </button>
        </footer>
      </form>
    </FinanceDialog>
  );
}
function ExpenseEditor({ types, onClose, onSaved }: { types: CostType[]; onClose: () => void; onSaved: () => void }) {
  const [typeId, setTypeId] = useState(''),
    [unitCost, setUnitCost] = useState(''),
    [quantity, setQuantity] = useState('1'),
    [orderId, setOrderId] = useState(''),
    [day, setDay] = useState(shopDay(new Date())),
    [note, setNote] = useState('');
  const [requestKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const type = types.find((t) => t.id === Number(typeId));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await financeApi.expense({
        requestKey,
        costTypeId: Number(typeId),
        unitCostVnd: Number(unitCost),
        quantity: Number(quantity),
        orderId: orderId ? Number(orderId) : null,
        incurredAt: day,
        note,
      });
      onSaved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinanceDialog title="Ghi nhận chi phí" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="finance-form-grid">
          <SelectField
            label="Loại chi phí"
            required
            placeholder="Chọn loại chi phí"
            value={typeId}
            options={types.map((t) => ({ value: String(t.id), label: `${t.name} · ${basisLabels[t.basis]}` }))}
            onChange={(e) => {
              const chosen = types.find((t) => t.id === Number(e.target.value));
              setTypeId(e.target.value);
              setUnitCost(String(chosen?.unitCostVnd ?? ''));
              setQuantity('1');
            }}
          />
          <TextField label="Ngày phát sinh" type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          <TextField
            label={type?.basis === 'ORDER' ? 'Đơn hàng' : 'Đơn hàng (không bắt buộc)'}
            required={type?.basis === 'ORDER'}
            type="number"
            min="1"
            step="1"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            hint="Để trống với chi phí vận hành chung."
          />
          <TextField
            label={`Lượng sử dụng${type ? ` (${type.unit})` : ''}`}
            required
            type="number"
            min="0.001"
            max="1000000"
            step={type?.basis === 'QUANTITY' ? '0.001' : '1'}
            disabled={!type || type.basis === 'ORDER' || type.basis === 'ACTUAL'}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            hint={type ? basisLabels[type.basis] : 'Chọn loại chi phí trước.'}
          />
          <TextField
            label="Đơn giá thực tế (VND)"
            type="number"
            required
            min="0"
            max="1000000000000"
            step="1"
            disabled={!type}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <div className="finance-form-total">
            <span>Thành tiền · chỉ đọc</span>
            <strong>{type && unitCost !== '' ? amount(Math.round(Number(quantity) * Number(unitCost))) : '—'}</strong>
          </div>
        </div>
        <label className="finance-label">
          Chứng từ / nội dung
          <textarea
            className={inputClassName}
            required
            maxLength={1000}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="finance-caption">
          Chỉ ghi chi phí shop thực chịu. Phí ship khách trả và ưu đãi đã nằm trong doanh thu, không nhập lại ở đây.
        </p>
        {!types.length && <p className="finance-error">Thêm một loại chi phí đang dùng trước.</p>}
        {error && (
          <p role="alert" className="finance-error">
            Chưa ghi nhận được. Kiểm tra thông báo lỗi; không tạo mã mới để gửi lại.
          </p>
        )}
        <footer>
          <button className="finance-button" type="button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="finance-button is-primary" disabled={busy || !type}>
            {busy ? 'Đang ghi…' : 'Ghi nhận chi phí'}
          </button>
        </footer>
      </form>
    </FinanceDialog>
  );
}
function ReverseEditor({
  entry,
  onClose,
  onSaved,
}: {
  entry: FinanceExpense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(''),
    [requestKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <FinanceDialog title={`Điều chỉnh chi phí #${entry.id}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          try {
            await financeApi.reverse(entry.id, { requestKey, note });
            onSaved();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Đảo {amount(entry.amountVnd)} của “{entry.nameSnapshot}” vào đúng kỳ gốc. Bút toán gốc vẫn được lưu. Sau khi
          đảo, ghi nhận lại chứng từ với thông tin đúng nếu cần.
        </p>
        <TextField
          label="Lý do điều chỉnh"
          required
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p role="alert" className="finance-error">
            Chưa đảo được bút toán.
          </p>
        )}
        <footer>
          <button type="button" className="finance-button" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button className="finance-button is-primary" disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Xác nhận đảo bút toán'}
          </button>
        </footer>
      </form>
    </FinanceDialog>
  );
}
