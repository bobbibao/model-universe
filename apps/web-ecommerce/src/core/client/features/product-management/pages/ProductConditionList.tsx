'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import DataTable, { DataTableColumn } from '@/components/Tables/DataTable';
import Modal from '@/components/Modal/Modal';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import TextField from '@/components/FormElements/TextField';
import TextAreaField from '@/components/FormElements/TextAreaField';
import Api from '@/core/client/api/Api';
import { reloadProductConditions } from '@/shared/client/hooks/useProductConditions';
import type { ProductConditionType } from '@/shared/product-conditions';

type Row = ProductConditionType & { productCount: number };
type Editing = Partial<Row> & { isNew?: boolean };

const RULES = ['uniqueUnit', 'requiresMissingAccessories', 'requiresDefects'] as const;

// Admin > Products > Conditions: the conditions a unit can be sold in. Staff add new ones with the rules a unit in them
// must meet, rename, describe and order every one, retire one no longer used for new units, and remove an added one
// no product has. The four built-in conditions keep their rules.
const ProductConditionList = () => {
  const en = useLocale() === 'en';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);
  const ruleLabel: Record<(typeof RULES)[number], string> = en
    ? {
        uniqueUnit: 'One of a kind (one piece, 3 real photos, stock only through intake)',
        requiresMissingAccessories: 'Must list the missing accessories',
        requiresDefects: 'Must describe each defect',
      }
    : {
        uniqueUnit: 'Mỗi chiếc là duy nhất (1 chiếc, 3 ảnh thật, chỉ nhập kho qua thu mua/cầm)',
        requiresMissingAccessories: 'Bắt buộc liệt kê phụ kiện còn thiếu',
        requiresDefects: 'Bắt buộc mô tả từng lỗi',
      };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await Api.get('/admin/product-conditions')).data);
    } catch {
      /* The toast explains it. */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const changed = async () => {
    await reloadProductConditions();
    await load();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    const body = {
      nameVi: editing.nameVi,
      nameEn: editing.nameEn,
      descriptionVi: editing.descriptionVi ?? '',
      descriptionEn: editing.descriptionEn ?? '',
      skuSuffix: editing.skuSuffix || undefined,
      sortOrder: editing.sortOrder,
      ...(editing.isSystem ? {} : Object.fromEntries(RULES.map((rule) => [rule, !!editing[rule]]))),
      ...(editing.isNew && editing.key ? { key: editing.key } : {}),
    };
    try {
      if (editing.isNew) await Api.post('/admin/product-conditions', body);
      else await Api.put(`/admin/product-conditions/${editing.key}`, body);
      setEditing(null);
      await changed();
    } catch {
      /* The toast explains it. */
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: Row) => {
    try {
      await Api.put(`/admin/product-conditions/${row.key}`, { isActive: !row.isActive });
      await changed();
    } catch {
      /* The toast explains it. */
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await Api.delete(`/admin/product-conditions/${removing.key}`);
      await changed();
    } catch {
      /* The toast explains it. */
    } finally {
      setRemoving(null);
    }
  };

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: en ? 'Condition' : 'Tình trạng',
      className: 'min-w-[220px]',
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className={`condition-chip is-${row.key} self-start`}>{en ? row.nameEn : row.nameVi}</span>
          <small className="text-body">
            {en ? row.nameVi : row.nameEn} · <code>{row.key}</code> · SKU -{row.skuSuffix}
          </small>
        </span>
      ),
    },
    {
      key: 'rules',
      header: en ? 'Rules' : 'Quy tắc',
      render: (row) => (
        <span className="flex flex-col gap-1 text-xs">
          {RULES.filter((rule) => row[rule]).map((rule) => (
            <span key={rule}>• {ruleLabel[rule]}</span>
          ))}
          {!RULES.some((rule) => row[rule]) && <span className="text-body">—</span>}
        </span>
      ),
    },
    { key: 'productCount', header: en ? 'Products' : 'Sản phẩm' },
    { key: 'sortOrder', header: en ? 'Order' : 'Thứ tự' },
    {
      key: 'status',
      header: en ? 'Status' : 'Trạng thái',
      render: (row) =>
        row.isActive ? (
          <span className="text-success">{en ? 'In use' : 'Đang dùng'}</span>
        ) : (
          <span className="text-body">{en ? 'Retired' : 'Ngừng dùng'}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-4 whitespace-nowrap">
          <button onClick={() => setEditing({ ...row })} className="font-medium text-brand-hover hover:underline">
            {en ? 'Edit' : 'Sửa'}
          </button>
          {row.key !== 'new' && (
            <button onClick={() => void toggle(row)} className="font-medium text-body hover:underline">
              {row.isActive ? (en ? 'Retire' : 'Ngừng dùng') : en ? 'Use again' : 'Dùng lại'}
            </button>
          )}
          {!row.isSystem && row.productCount === 0 && (
            <button onClick={() => setRemoving(row)} className="font-medium text-danger hover:underline">
              {en ? 'Remove' : 'Xoá'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Breadcrumb pageName={en ? 'Product conditions' : 'Tình trạng sản phẩm'} />
      <p className="mb-4 max-w-3xl text-sm text-body">
        {en
          ? 'The conditions a unit can be sold in. Add a new one with the rules a unit in it must meet; it appears in the product form, the storefront filters and on product pages. A retired condition stays on the units that have it but cannot be chosen for new ones.'
          : 'Các tình trạng một sản phẩm có thể được bán. Thêm tình trạng mới cùng quy tắc sản phẩm đó phải đáp ứng; tình trạng sẽ xuất hiện trong form sản phẩm, bộ lọc cửa hàng và trang sản phẩm. Tình trạng ngừng dùng vẫn giữ trên các sản phẩm đang có nhưng không chọn được cho sản phẩm mới.'}
      </p>
      <DataTable
        title={en ? 'Conditions' : 'Danh sách tình trạng'}
        actions={
          <button
            onClick={() =>
              setEditing({
                isNew: true,
                nameVi: '',
                nameEn: '',
                descriptionVi: '',
                descriptionEn: '',
                sortOrder: Math.max(0, ...rows.map((row) => row.sortOrder)) + 10,
              })
            }
            className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink hover:bg-brand-hover"
          >
            + {en ? 'Add a condition' : 'Thêm tình trạng'}
          </button>
        }
        columns={columns}
        data={rows}
        rowKey={(row) => row.key}
        loading={loading}
        emptyText={en ? 'No conditions.' : 'Chưa có tình trạng.'}
      />

      <Modal
        open={!!editing}
        title={editing?.isNew ? (en ? 'Add a condition' : 'Thêm tình trạng') : en ? 'Edit condition' : 'Sửa tình trạng'}
        onClose={() => setEditing(null)}
        size="lg"
      >
        {editing && (
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2" noValidate>
            <TextField
              label={en ? 'Name (Vietnamese)' : 'Tên tiếng Việt'}
              name="nameVi"
              required
              maxLength={80}
              value={editing.nameVi ?? ''}
              onChange={(event) => setEditing({ ...editing, nameVi: event.target.value })}
              autoFocus
            />
            <TextField
              label={en ? 'Name (English)' : 'Tên tiếng Anh'}
              name="nameEn"
              required
              maxLength={80}
              value={editing.nameEn ?? ''}
              onChange={(event) => setEditing({ ...editing, nameEn: event.target.value })}
            />
            <TextAreaField
              rows={2}
              label={en ? 'Description for customers (Vietnamese)' : 'Mô tả cho khách (tiếng Việt)'}
              name="descriptionVi"
              maxLength={500}
              value={editing.descriptionVi ?? ''}
              onChange={(event) => setEditing({ ...editing, descriptionVi: event.target.value })}
            />
            <TextAreaField
              rows={2}
              label={en ? 'Description for customers (English)' : 'Mô tả cho khách (tiếng Anh)'}
              name="descriptionEn"
              maxLength={500}
              value={editing.descriptionEn ?? ''}
              onChange={(event) => setEditing({ ...editing, descriptionEn: event.target.value })}
            />
            {editing.isNew && (
              <TextField
                label={en ? 'Code (empty: from the English name)' : 'Mã (để trống: tạo từ tên tiếng Anh)'}
                name="key"
                placeholder="like-new"
                maxLength={40}
                value={editing.key ?? ''}
                onChange={(event) => setEditing({ ...editing, key: event.target.value.toLowerCase() })}
              />
            )}
            <TextField
              label={en ? 'SKU suffix' : 'Hậu tố SKU'}
              name="skuSuffix"
              placeholder="LN"
              maxLength={8}
              value={editing.skuSuffix ?? ''}
              onChange={(event) => setEditing({ ...editing, skuSuffix: event.target.value.toUpperCase() })}
            />
            <TextField
              label={en ? 'Display order' : 'Thứ tự hiển thị'}
              name="sortOrder"
              type="number"
              min={0}
              step={1}
              value={String(editing.sortOrder ?? 0)}
              onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) || 0 })}
            />
            <fieldset className="md:col-span-2">
              <legend className="mb-2 text-sm font-semibold">
                {en ? 'Rules for a unit in this condition' : 'Quy tắc cho sản phẩm ở tình trạng này'}
              </legend>
              {RULES.map((rule) => (
                <label key={rule} className="mb-2 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={editing.isSystem}
                    checked={!!editing[rule]}
                    onChange={(event) => setEditing({ ...editing, [rule]: event.target.checked })}
                  />
                  {ruleLabel[rule]}
                </label>
              ))}
              {editing.isSystem && (
                <p className="text-xs text-body">
                  {en
                    ? 'A built-in condition keeps its rules: buy-back intake, partner listings and the catalogue rely on them.'
                    : 'Tình trạng có sẵn giữ nguyên quy tắc: thu mua, tin đăng đối tác và danh mục chủ shop dựa vào chúng.'}
                </p>
              )}
            </fieldset>
            <div className="flex justify-end gap-3 md:col-span-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 font-medium text-body hover:underline"
              >
                {en ? 'Cancel' : 'Huỷ'}
              </button>
              <button
                type="submit"
                disabled={saving || !editing.nameVi?.trim() || !editing.nameEn?.trim()}
                className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? (en ? 'Saving…' : 'Đang lưu...') : en ? 'Save' : 'Lưu'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!removing}
        title={en ? 'Remove condition' : 'Xoá tình trạng'}
        message={
          <>
            {en ? 'Remove the condition' : 'Xoá tình trạng'}{' '}
            <strong>{removing && (en ? removing.nameEn : removing.nameVi)}</strong>?
          </>
        }
        confirmLabel={en ? 'Remove' : 'Xoá'}
        danger
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </>
  );
};

export default ProductConditionList;
