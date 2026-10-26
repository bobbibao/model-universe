'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import SelectField from '@/components/FormElements/SelectField';
import ConditionTreePicker from '@/components/Store/ConditionTreePicker';
import Modal from '@/components/Modal/Modal';
import ProductApi from '@/core/client/api/Product';
import type { ProductBulkChanges, ProductBulkItem } from '@/shared/product-bulk';

export type SelectedBulkProduct = ProductBulkItem & { name: string };
export function BulkCheckbox({
  checked,
  mixed = false,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="product-bulk-checkbox" onClick={(event) => event.stopPropagation()}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function ProductBulkActions({
  selected,
  onClear,
  onFinished,
}: {
  selected: SelectedBulkProduct[];
  onClear: () => void;
  onFinished: () => void;
}) {
  const en = useLocale() === 'en';
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [featured, setFeatured] = useState(''),
    [type, setType] = useState('');
  const [changeConditions, setChangeConditions] = useState(false),
    [ids, setIds] = useState<number[]>([]);
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  if (!selected.length) return null;
  const changes: ProductBulkChanges = {
    ...(featured ? { isFeatured: featured === 'true' } : {}),
    ...(type ? { condition: type } : {}),
    ...(changeConditions ? { conditionNodeIds: ids } : {}),
  };
  const apply = async () => {
    const items = selected.map(({ id, expectedUpdatedAt }) => ({ id, expectedUpdatedAt }));
    const signature = JSON.stringify({ items, changes });
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    const result = await ProductApi.bulkUpdate({ items, changes, requestKey: attempt.current.key });
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      onFinished();
    }
  };
  return (
    <>
      <div className="product-bulk-toolbar">
        <span>
          {selected.length} {en ? 'selected' : 'sản phẩm đã chọn'}
        </span>
        <button type="button" onClick={onClear}>
          {en ? 'Clear' : 'Bỏ chọn'}
        </button>
        <button
          type="button"
          className="product-bulk-primary"
          onClick={() => {
            setFeatured('');
            setType('');
            setChangeConditions(false);
            setIds([]);
            setOpen(true);
          }}
        >
          {en ? 'Bulk update' : 'Cập nhật hàng loạt'}
        </button>
      </div>
      <Modal
        open={open}
        size="lg"
        title={en ? 'Bulk update' : 'Cập nhật hàng loạt'}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <>
            <button
              className="mu-button mu-button-secondary"
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {en ? 'Cancel' : 'Hủy'}
            </button>
            <button
              className="mu-button"
              type="button"
              disabled={busy || !Object.keys(changes).length}
              onClick={() => void apply()}
            >
              {busy ? '…' : en ? `Apply to ${selected.length} products` : `Áp dụng cho ${selected.length} sản phẩm`}
            </button>
          </>
        }
      >
        <fieldset disabled={busy} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={en ? 'Featured' : 'Nổi bật'}
              name="bulkFeatured"
              value={featured}
              placeholder={en ? 'Keep unchanged' : 'Giữ nguyên'}
              options={[
                { value: 'true', label: en ? 'Featured' : 'Bật nổi bật' },
                { value: 'false', label: en ? 'Not featured' : 'Tắt nổi bật' },
              ]}
              onChange={(event) => setFeatured(event.target.value)}
            />
            <SelectField
              label={en ? 'Item type' : 'Loại hàng'}
              name="bulkType"
              value={type}
              placeholder={en ? 'Keep unchanged' : 'Giữ nguyên'}
              options={[
                { value: 'new', label: 'New' },
                { value: 'preowned', label: '2hand' },
              ]}
              onChange={(event) => setType(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={changeConditions}
              onChange={(event) => setChangeConditions(event.target.checked)}
            />
            {en ? 'Replace condition selection' : 'Thay thế các tình trạng đã chọn'}
          </label>
          {changeConditions && (
            <ConditionTreePicker value={ids} itemType={type === 'new' ? 'new' : 'preowned'} onChange={setIds} />
          )}
          <div className="catalog-inline-notice">
            <strong>{en ? 'Preview' : 'Xem trước'}</strong>
            <p>
              {en
                ? 'Prices and stock remain unchanged. Duplicate combinations or identities with stock/history block the whole update.'
                : 'Giữ nguyên giá và tồn kho. Nếu trùng tổ hợp hoặc đổi định danh đang có hàng/lịch sử, toàn bộ lượt cập nhật sẽ bị chặn.'}
            </p>
            <ul>
              {selected.map((product) => (
                <li key={product.id}>
                  #{product.id} · {product.name}
                </li>
              ))}
            </ul>
          </div>
        </fieldset>
      </Modal>
    </>
  );
}
