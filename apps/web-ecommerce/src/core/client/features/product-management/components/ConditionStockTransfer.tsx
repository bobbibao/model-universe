'use client';
import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import type { AdminProduct } from '@/shared/types/product';
import { itemTypeLabel } from '@/shared/condition-tree';
import Modal from '@/components/Modal/Modal';
import SelectField from '@/components/FormElements/SelectField';
import TextField from '@/components/FormElements/TextField';
import TextAreaField from '@/components/FormElements/TextAreaField';
import Api from '@/core/client/api/Api';

export default function ConditionStockTransfer({
  product,
  onFinished,
}: {
  product: AdminProduct;
  onFinished: () => void;
}) {
  const en = useLocale() === 'en';
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(''),
    [quantity, setQuantity] = useState('1'),
    [reason, setReason] = useState('');
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const options = (product.units ?? []).filter((unit) => unit.id !== product.id);
  if (product.stock < 1 || !options.length || !product.modelFamilyId) return null;
  const save = async () => {
    const data = { targetProductId: Number(target), quantity: Number(quantity), reason };
    const signature = JSON.stringify(data);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await Api.post(`/admin/products/${product.id}/transfer-condition`, { ...data, requestKey: attempt.current.key });
      setOpen(false);
      onFinished();
    } catch {
      /* The shared API displays validation; keep the draft for retry. */
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="mu-button mu-button-secondary" type="button" onClick={() => setOpen(true)}>
        {en ? 'Transfer condition' : 'Chuyển tình trạng'}
      </button>
      <Modal
        open={open}
        title={en ? 'Move available stock to another combination' : 'Chuyển tồn sẵn bán sang tổ hợp khác'}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <>
            <button
              type="button"
              className="mu-button mu-button-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {en ? 'Cancel' : 'Hủy'}
            </button>
            <button
              type="button"
              className="mu-button"
              disabled={
                busy ||
                !target ||
                !reason.trim() ||
                !Number.isSafeInteger(Number(quantity)) ||
                Number(quantity) < 1 ||
                Number(quantity) > product.stock
              }
              onClick={() => void save()}
            >
              {en ? 'Confirm transfer' : 'Xác nhận chuyển'}
            </button>
          </>
        }
      >
        <fieldset disabled={busy} className="grid gap-4">
          <p className="catalog-form-note">
            {product.sku} · {product.stock}{' '}
            {en
              ? 'available. Prices stay unchanged; the movement is recorded.'
              : 'sẵn bán. Giá giữ nguyên; lần chuyển được lưu lịch sử.'}
          </p>
          <SelectField
            label={en ? 'Destination product' : 'Sản phẩm đích'}
            name="transferTarget"
            placeholder={en ? 'Choose a combination' : 'Chọn tổ hợp'}
            value={target}
            options={options.map((unit) => ({
              value: String(unit.id),
              label: `${unit.sku} · ${itemTypeLabel(unit.itemTypeKey ?? unit.condition)} · ${unit.conditionLabels?.join(', ') || (en ? 'No issues recorded' : 'Không ghi nhận lỗi')}`,
            }))}
            onChange={(event) => setTarget(event.target.value)}
          />
          <TextField
            label={en ? 'Quantity' : 'Số lượng'}
            name="transferQuantity"
            type="number"
            min={1}
            max={product.stock}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextAreaField
            label={en ? 'Inspection and reason' : 'Kiểm hàng và lý do chuyển'}
            name="transferReason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </fieldset>
      </Modal>
    </>
  );
}
