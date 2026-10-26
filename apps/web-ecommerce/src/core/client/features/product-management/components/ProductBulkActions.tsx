'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Modal from '@/components/Modal/Modal';
import ProductApi from '@/core/client/api/Product';
import Link from '@/i18n/navigation';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import type { ProductBulkChanges, ProductBulkItem, ProductBulkIssue } from '@/shared/product-bulk';

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

const fields = ['isFeatured', 'condition'] as const;
type Field = (typeof fields)[number];
const initial = { condition: '', isFeatured: '' };

export default function ProductBulkActions({
  selected,
  onClear,
  onFinished,
}: {
  selected: SelectedBulkProduct[];
  onClear: () => void;
  onFinished: () => void;
}) {
  const t = useTranslations('productBulk');
  const conditions = useProductConditions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [issues, setIssues] = useState<ProductBulkIssue[]>([]);
  const [enabled, setEnabled] = useState<Partial<Record<Field, boolean>>>({});
  const [values, setValues] = useState(initial);
  const formId = useId();
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  if (!selected.length) return null;
  const chosen = fields.filter((field) => enabled[field]);
  const ready =
    chosen.length > 0 &&
    chosen.every((field) =>
      field === 'condition'
        ? conditions.active.some((type) => type.key === values.condition)
        : ['true', 'false'].includes(values.isFeatured),
    );
  const target = conditions.active.find((type) => type.key === values.condition);
  return (
    <>
      <div className="product-bulk-toolbar">
        <span role="status">{t('selected', { count: selected.length })}</span>
        <button type="button" onClick={onClear}>
          {t('clearSelection')}
        </button>
        <button
          type="button"
          className="product-bulk-primary"
          onClick={() => {
            setValues(initial);
            setEnabled({});
            setFailed(false);
            setIssues([]);
            attempt.current = undefined;
            setOpen(true);
          }}
        >
          {t('edit')}
        </button>
      </div>
      <Modal
        open={open}
        title={t('title', { count: selected.length })}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <>
            <button type="button" disabled={busy} onClick={() => setOpen(false)}>
              {t('cancel')}
            </button>
            <button type="submit" form={formId} className="product-bulk-primary" disabled={!ready || busy}>
              {busy ? t('saving') : t('apply', { count: selected.length })}
            </button>
          </>
        }
      >
        <p className="product-bulk-note">{t('hint')}</p>
        <details className="product-bulk-selection">
          <summary>{t('reviewSelection')}</summary>
          <ul>
            {selected.map((item) => (
              <li key={item.id}>
                #{item.id} · {item.name}
              </li>
            ))}
          </ul>
        </details>
        {failed && (
          <div className="product-bulk-error" role="alert">
            <p>{t('failed')}</p>
            {issues.length > 0 && (
              <ul>
                {issues.map((issue) => (
                  <li key={`${issue.id}-${issue.reason}`}>
                    <Link href={`/admin/products/${issue.id}`} target="_blank" rel="noreferrer">
                      #{issue.id}
                    </Link>{' '}
                    · {t(`issues.${issue.reason}`)}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onFinished();
              }}
            >
              {t('reload')}
            </button>
          </div>
        )}
        <form
          id={formId}
          onSubmit={async (event) => {
            event.preventDefault();
            if (!ready || busy) return;
            const changes: ProductBulkChanges = {};
            if (enabled.isFeatured) changes.isFeatured = values.isFeatured === 'true';
            if (enabled.condition) changes.condition = values.condition;
            const items = selected.map(({ id, expectedUpdatedAt }) => ({ id, expectedUpdatedAt }));
            const signature = JSON.stringify({ items, changes });
            if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
            setBusy(true);
            setFailed(false);
            setIssues([]);
            try {
              const response = await ProductApi.bulkUpdate({ items, changes, requestKey: attempt.current.key });
              if (response.ok) {
                toast.success(t('done', { count: response.result.selectedCount }));
                setOpen(false);
                onFinished();
              } else {
                setFailed(true);
                setIssues(response.issues ?? []);
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="product-bulk-fields" disabled={busy} aria-busy={busy}>
            <legend className="sr-only">{t('chooseFields')}</legend>
            {fields.map((field) => (
              <div className={`product-bulk-field${enabled[field] ? ' is-enabled' : ''}`} key={field}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!enabled[field]}
                    onChange={(event) => setEnabled({ ...enabled, [field]: event.target.checked })}
                  />
                  {t(`fields.${field}`)}
                </label>
                <select
                  aria-label={t('value', { field: t(`fields.${field}`) })}
                  disabled={!enabled[field]}
                  value={values[field]}
                  onChange={(event) => setValues({ ...values, [field]: event.target.value })}
                >
                  <option value="" disabled>
                    {t('chooseValue')}
                  </option>
                  {field === 'isFeatured' ? (
                    <>
                      <option value="true">{t('featuredOn')}</option>
                      <option value="false">{t('featuredOff')}</option>
                    </>
                  ) : (
                    conditions.active.map((type) => (
                      <option key={type.key} value={type.key}>
                        {conditions.label(type.key)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ))}
          </fieldset>
        </form>
        {enabled.condition && target && (
          <div className="product-bulk-note">
            {target.uniqueUnit && <p>{t('requirements.photos')}</p>}
            {target.requiresMissingAccessories && <p>{t('requirements.missingAccessories')}</p>}
            {target.requiresDefects && <p>{t('requirements.defects')}</p>}
          </div>
        )}
        <p className="product-bulk-note">{t('protectedFields')}</p>
      </Modal>
    </>
  );
}
