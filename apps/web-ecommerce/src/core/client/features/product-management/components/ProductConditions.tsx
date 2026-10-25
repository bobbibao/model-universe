'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from '@/i18n/navigation';
import Modal from '@/components/Modal/Modal';
import ProductImage from '@/components/ProductImage';
import AdminIcon from '@/components/Admin/AdminIcon';
import TextField from '@/components/FormElements/TextField';
import ProductApi from '@/core/client/api/Product';
import { formatVND } from '@/shared/server/utils/utils';
import type { AdminProduct } from '@/shared/types/product';
import { CONDITIONS } from '@/shared/gunpla';
import ProductImagesField, { ImageItem, uploadPendingImages } from './ProductImagesField';
import { ConditionFields, PricingFields } from './ProductFormSections';
import {
  ProductFormErrors,
  ProductFormValues,
  conditionPayload,
  emptyProductForm,
  pricingPayload,
  validateCondition,
  validatePricing,
} from './productForm';

// The model's units in Admin: the main listing and each condition option with its own SKU, price, stock and status,
// and a dialog to add another condition (its photos default to the main listing's).
const ProductConditions = ({
  product,
  onCreated,
  onEditCurrent,
}: {
  product: AdminProduct;
  onCreated: () => void;
  onEditCurrent: () => void;
}) => {
  const t = useTranslations('adminProducts'),
    catalog = useTranslations('catalog'),
    locale = useLocale();
  const listingId = product.listing?.id ?? product.id;
  const units = product.units ?? [];
  const activeUnits = units.filter((unit) => !unit.isArchived);
  const totalStock = activeUnits.reduce((total, unit) => total + unit.stock, 0);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ProductFormValues>({ ...emptyProductForm, condition: 'incomplete' });
  const [sku, setSku] = useState('');
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [mainImage, setMainImage] = useState<ImageItem | null>(null);
  const [gallery, setGallery] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const onChange = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const start = () => {
    setValues({
      ...emptyProductForm,
      condition: 'incomplete',
      assemblyState: product.assemblyState || 'unassembled',
      includedAccessories: (product.includedAccessories || []).join('\n'),
      importPrice: String(product.importPrice || ''),
    });
    setSku('');
    setErrors({});
    setMainImage(null);
    setGallery([]);
    setOpen(true);
  };

  const create = async () => {
    const formErrors: ProductFormErrors = { ...validateCondition(values), ...validatePricing(values) };
    if (!values.pricingReferenceMemberVnd) formErrors.price = 'priceInvalid';
    if (!/^\d+$/.test(values.stock.trim())) formErrors.stock = 'stockInvalid';
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;
    setSaving(true);
    const urls = mainImage ? await uploadPendingImages([mainImage, ...gallery]) : [];
    const created = urls
      ? await ProductApi.createConditionOption(listingId, {
          ...conditionPayload(values),
          ...pricingPayload(values),
          importPrice: values.importPrice ? Number(values.importPrice) : 0,
          stock: Number(values.stock),
          productionDate: values.productionDate || null,
          ...(sku.trim() ? { sku: sku.trim() } : {}),
          ...(urls.length > 0 ? { imageUrl: urls[0], images: urls.slice(1) } : {}),
        })
      : undefined;
    setSaving(false);
    if (created) {
      setOpen(false);
      onCreated();
    }
  };

  return (
    <div className="condition-management">
      <div className="condition-listings">
        <div className="condition-listings-toolbar">
          <div>
            <h3>
              {t('conditionListings')} <span>{units.length}</span>
            </h3>
            <p>{t('conditionsHint')}</p>
          </div>
          <button type="button" onClick={start} className="condition-add-button">
            <AdminIcon name="plus" size={16} /> {t('addCondition')}
          </button>
        </div>
        <div className="condition-table-scroll" tabIndex={0} role="region" aria-label={t('conditionListings')}>
          <table className="condition-listing-table">
            <caption className="sr-only">{t('conditionListings')}</caption>
            <thead>
              <tr className="border-b border-stroke text-body dark:border-strokedark">
                <th className="py-2 pr-3 font-medium">{t('unit')}</th>
                <th className="py-2 pr-3 font-medium">{t('conditionColumn')}</th>
                <th className="py-2 pr-3 font-medium">{t('price')}</th>
                <th className="py-2 pr-3 font-medium">{t('stock')}</th>
                <th className="py-2 pr-3 font-medium">{t('status')}</th>
                <th className="py-2">
                  <span className="sr-only">{t('openUnit')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className={unit.id === product.id ? 'is-current' : ''}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-2 dark:bg-meta-4">
                        <ProductImage src={unit.imageUrl} alt={unit.sku} sizes="40px" />
                      </div>
                      <div>
                        <p className="font-medium">{unit.sku}</p>
                        <p className="text-xs text-body">{unit.isMain ? t('mainListing') : t('conditionOption')}</p>
                        {unit.id === product.id && <span className="condition-current-label">{t('editingUnit')}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`condition-chip is-${unit.condition}`}>{catalog(unit.condition)}</span>
                    {(unit.conditionNote || unit.missingAccessories.length > 0 || unit.defects.length > 0) && (
                      <p className="mt-1 max-w-[260px] text-xs text-body">
                        {[unit.conditionNote, ...unit.missingAccessories, ...unit.defects].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="condition-price-cell">
                    <strong>{formatVND(unit.salePrice, locale)}</strong>
                    {unit.salePrice < unit.price && <s>{formatVND(unit.price, locale)}</s>}
                  </td>
                  <td className="condition-stock-cell">
                    <span className={`condition-stock-value${unit.stock === 0 ? ' is-empty' : ''}`}>{unit.stock}</span>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        unit.isArchived || unit.inventoryStatus !== 'available'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {unit.isArchived
                        ? t('archived')
                        : unit.inventoryStatus !== 'available'
                          ? t(`inventoryStates.${unit.inventoryStatus}`)
                          : t('active')}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {unit.id !== product.id ? (
                      <Link
                        href={`/admin/products/${unit.id}?section=conditions`}
                        className="condition-edit-action"
                        aria-label={`${t('openUnit')} · ${unit.sku}`}
                      >
                        <AdminIcon name="edit" size={16} /> {t('openUnit')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={onEditCurrent}
                        className="condition-edit-action"
                        aria-label={`${t('openUnit')} · ${unit.sku}`}
                      >
                        <AdminIcon name="edit" size={16} /> {t('openUnit')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="condition-inventory" aria-label={t('conditionInventory')}>
        <h3>
          <AdminIcon name="box" size={18} />
          {t('conditionInventory')}
        </h3>
        <div className="condition-inventory-total">
          <span>{t('groupStock')}</span>
          <strong>{totalStock}</strong>
        </div>
        <dl>
          {CONDITIONS.filter((condition) => activeUnits.some((unit) => unit.condition === condition)).map(
            (condition) => (
              <div key={condition}>
                <dt>
                  <span className={`condition-dot is-${condition}`}>{catalog(condition)}</span>
                </dt>
                <dd>
                  {activeUnits
                    .filter((unit) => unit.condition === condition)
                    .reduce((total, unit) => total + unit.stock, 0)}
                </dd>
              </div>
            ),
          )}
        </dl>
        <p>{t('conditionInventoryHint')}</p>
      </aside>

      <Modal
        open={open}
        title={`${t('addCondition')} · ${product.listing?.name ?? product.name}`}
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-md border border-stroke px-5 py-2 font-medium dark:border-strokedark"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="rounded-md bg-brand px-5 py-2 font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60"
            >
              {saving ? t('saving') : t('createOption')}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ConditionFields values={values} errors={errors} onChange={onChange} />
          </div>
          <PricingFields values={values} errors={errors} onChange={onChange} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TextField
              label={t('stock')}
              name="optionStock"
              inputMode="numeric"
              value={values.stock}
              onChange={(event) => onChange('stock', event.target.value.replace(/\D/g, ''))}
              error={errors.stock ? t(`validation.${errors.stock}`) : undefined}
            />
            <TextField
              label={t('optionSku')}
              name="optionSku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
            />
            <TextField
              label={t('receivedDate')}
              name="optionReceivedDate"
              type="date"
              value={values.productionDate}
              onChange={(event) => onChange('productionDate', event.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 font-medium text-black dark:text-white">{t('optionImages')}</p>
            <p className="mb-3 text-sm text-body">{t('optionImagesHint')}</p>
            <ProductImagesField
              mainImage={mainImage}
              gallery={gallery}
              onMainImageChange={setMainImage}
              onGalleryChange={setGallery}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductConditions;
