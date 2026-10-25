'use client';

import { catalogPricing } from '@/shared/sale-pricing';

import { useLocale, useTranslations } from 'next-intl';
import { ASSEMBLY_STATES, CONDITIONS } from '@/shared/gunpla';
import TextField from '@/components/FormElements/TextField';
import TextAreaField from '@/components/FormElements/TextAreaField';
import SelectField from '@/components/FormElements/SelectField';
import { formatVND } from '@/shared/server/utils/utils';
import type { Category } from '@/shared/types/product';
import type { SupplierOption } from '@/core/client/api/Supplier';
import { INVENTORY_STATUS_VALUES, ProductFormErrors, ProductFormValues } from './productForm';
import type { InventoryStatus } from '@/shared/types/product';

interface SectionProps {
  values: ProductFormValues;
  errors: ProductFormErrors;
  onChange: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void;
}

// The model itself. A condition option shows its listing's model read-only (`readOnly`): it is edited on the listing.
export const BasicInfoFields = ({
  values,
  errors,
  onChange,
  categories,
  readOnly = false,
  withCondition = true,
  withDescriptions = true,
}: SectionProps & {
  categories: Category[];
  readOnly?: boolean;
  withCondition?: boolean;
  withDescriptions?: boolean;
}) => {
  const t = useTranslations('adminProducts'),
    catalog = useTranslations('catalog');
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {readOnly && <p className="text-sm text-body md:col-span-2">{t('inheritedNote')}</p>}
      <TextField
        label={t('name')}
        name="name"
        className="md:col-span-2"
        required
        value={values.name}
        readOnly={readOnly}
        onChange={(event) => onChange('name', event.target.value)}
        error={errors.name ? t(`validation.${errors.name}`) : undefined}
      />
      <TextField
        label={t('brand')}
        name="brandName"
        required
        value={values.brandName}
        readOnly={readOnly}
        onChange={(event) => onChange('brandName', event.target.value)}
        error={errors.brandName ? t(`validation.${errors.brandName}`) : undefined}
      />
      <TextField
        label={catalog('modelCode')}
        name="modelCode"
        value={values.modelCode}
        readOnly={readOnly}
        onChange={(event) => onChange('modelCode', event.target.value)}
      />
      <div>
        <SelectField
          label={t('category')}
          name="categoryId"
          disabled={readOnly}
          placeholder={t('noCategory')}
          options={categories.map((category) => ({ value: String(category.id), label: category.name }))}
          value={values.categoryId}
          onChange={(event) => onChange('categoryId', event.target.value)}
        />
        <p className="mt-1 text-xs text-body">{t('categoryHint')}</p>
      </div>
      <TextField
        label={catalog('scale')}
        name="scale"
        value={values.scale}
        readOnly={readOnly}
        onChange={(event) => onChange('scale', event.target.value)}
      />
      {withCondition && (
        <fieldset className="grid grid-cols-1 gap-5 rounded-lg border border-stroke p-4 md:col-span-2 md:grid-cols-2 dark:border-dark-3">
          <legend className="px-1 text-sm font-semibold text-black dark:text-white">{t('conditionSection')}</legend>
          <ConditionFields values={values} errors={errors} onChange={onChange} />
        </fieldset>
      )}
      {withDescriptions && (
        <div className="md:col-span-2">
          <DescriptionFields values={values} errors={errors} onChange={onChange} readOnly={readOnly} />
        </div>
      )}
    </div>
  );
};

export const DescriptionFields = ({ values, onChange, readOnly = false }: SectionProps & { readOnly?: boolean }) => {
  const t = useTranslations('adminProducts'),
    catalog = useTranslations('catalog');
  return (
    <div className="grid gap-5">
      {readOnly && <p className="form-field-hint">{t('inheritedNote')}</p>}
      {(['descriptionVi', 'descriptionEn', 'description'] as const).map((field) => (
        <TextAreaField
          key={field}
          label={field === 'description' ? t('description') : catalog(field)}
          name={field}
          rows={field === 'description' ? 5 : 3}
          value={values[field]}
          readOnly={readOnly}
          onChange={(event) => onChange(field, event.target.value)}
        />
      ))}
    </div>
  );
};

// The condition of one unit: what a customer chooses between on the product page. Incomplete and defective units must
// list what is missing or wrong.
export const ConditionFields = ({
  values,
  errors,
  onChange,
  lockedCondition = false,
}: SectionProps & { lockedCondition?: boolean }) => {
  const catalog = useTranslations('catalog'),
    t = useTranslations('adminProducts');
  const listField = (field: 'includedAccessories' | 'missingAccessories' | 'defects', label: string) => (
    <TextAreaField
      key={field}
      className="md:col-span-2"
      label={label}
      name={field}
      hint={t('fieldGuide.listLines')}
      value={values[field]}
      required={
        (field === 'missingAccessories' && values.condition === 'incomplete') ||
        (field === 'defects' && values.condition === 'defective')
      }
      error={errors[field] ? t(`validation.${errors[field]}`) : undefined}
      onChange={(event) => onChange(field, event.target.value)}
    />
  );
  return (
    <>
      <div>
        <SelectField
          label={catalog('condition')}
          name="condition"
          disabled={lockedCondition}
          hint={
            lockedCondition ? t('fieldGuide.conditionLocked') : catalog(`conditionDescriptions.${values.condition}`)
          }
          options={CONDITIONS.map((value) => ({ value, label: catalog(value) }))}
          value={values.condition}
          onChange={(event) => onChange('condition', event.target.value as ProductFormValues['condition'])}
        />
      </div>
      <SelectField
        label={catalog('assembly')}
        name="assemblyState"
        options={ASSEMBLY_STATES.map((value) => ({ value, label: catalog(value) }))}
        value={values.assemblyState}
        onChange={(event) => onChange('assemblyState', event.target.value as ProductFormValues['assemblyState'])}
      />
      <TextField
        label={catalog('box')}
        name="boxCondition"
        value={values.boxCondition}
        onChange={(event) => onChange('boxCondition', event.target.value)}
      />
      <TextAreaField
        rows={2}
        label={t('conditionNote')}
        name="conditionNote"
        value={values.conditionNote}
        onChange={(event) => onChange('conditionNote', event.target.value)}
      />
      {values.condition === 'incomplete' && listField('missingAccessories', t('missingAccessories'))}
      {(values.condition === 'defective' || values.defects.trim() !== '') && listField('defects', t('defectsList'))}
      {listField('includedAccessories', t('includedAccessories'))}
    </>
  );
};

export const PricingFields = ({ values, errors, onChange }: SectionProps) => {
  const t = useTranslations('adminProducts'),
    locale = useLocale(),
    en = locale === 'en';
  let result: ReturnType<typeof catalogPricing> | undefined;
  let formulaError = '';
  if (values.pricingReferenceMemberVnd) {
    try {
      result = catalogPricing(Number(values.pricingReferenceMemberVnd), Number(values.pricingIssueCount));
    } catch (error) {
      formulaError = en
        ? 'The reference price or condition needs appraisal under the standard buyback table.'
        : (error as Error).message;
    }
  }
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextField
        label={en ? 'Market reference · member price S (VND)' : 'Tham chiếu thị trường · giá thành viên S (đ)'}
        name="pricingReferenceMemberVnd"
        required={!values.price}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        hint={t('fieldGuide.money')}
        error={errors.price ? t(`validation.${errors.price}`) : undefined}
        value={values.pricingReferenceMemberVnd}
        placeholder="1100000"
        onChange={(e) => onChange('pricingReferenceMemberVnd', e.target.value)}
      />
      <TextField
        label={en ? 'Ordinary issues (50,000 VND each)' : 'Số lỗi thông thường (50.000đ/lỗi)'}
        name="pricingIssueCount"
        disabled={!values.pricingReferenceMemberVnd}
        hint={!values.pricingReferenceMemberVnd ? t('fieldGuide.referenceFirst') : undefined}
        error={errors.pricingIssueCount ? t(`validation.${errors.pricingIssueCount}`) : undefined}
        type="number"
        step={1}
        required
        min={0}
        max={100}
        value={values.pricingIssueCount}
        onChange={(e) => onChange('pricingIssueCount', e.target.value)}
      />
      <div className="md:col-span-2">
        <TextField
          label={
            en ? 'Actual cost C · from the purchase / intake record' : 'Giá vốn thực tế C · theo chứng từ nhập/thu'
          }
          name="importPrice"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={values.importPrice}
          onChange={(e) => onChange('importPrice', e.target.value)}
          error={errors.importPrice ? t(`validation.${errors.importPrice}`) : undefined}
        />
        <p className="mt-2 text-xs leading-6 text-body">
          {en
            ? 'Actual cost is kept separately from the calculated buyback offer. It determines whether sale and voucher combinations are safe.'
            : 'Giá vốn đã chi giữ riêng với giá thu dự kiến. Hệ thống dùng giá vốn để kiểm tra sale và voucher có thể cộng dồn.'}
        </p>
      </div>
      <div className="rounded-xl border border-stroke bg-gray p-4 dark:border-store-card dark:bg-store-panel md:col-span-2">
        <p className="text-sm font-semibold">
          {en ? 'Calculated prices · outputs cannot be edited' : 'Giá theo công thức · không nhập đè kết quả'}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-body">{en ? 'Expected buyback B' : 'Giá thu dự kiến B'}</dt>
            <dd className="mt-1 font-bold">
              {result?.buybackPriceVnd != null
                ? formatVND(result.buybackPriceVnd, locale)
                : result
                  ? en
                    ? 'Appraisal'
                    : 'Cần thẩm định'
                  : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-body">{en ? 'Public list price R' : 'Giá niêm yết R'}</dt>
            <dd className="mt-1 font-bold">{formatVND(result?.listPriceVnd || Number(values.price) || 0, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-body">{en ? 'After an eligible 10% code' : 'Sau mã 10% hợp lệ'}</dt>
            <dd className="mt-1 font-bold">{result ? formatVND(result.referenceMemberVnd, locale) : '—'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-6 text-body">
          {en
            ? 'B = S − tier deduction − 50,000 × issues. R ≈ S ÷ 0.9. Above 5 million R still follows S, but a buyback is appraised (no formula B) and issues cannot be priced.'
            : 'B = S − khoản trừ theo bậc − 50.000 × số lỗi. R ≈ S ÷ 0,9. Trên 5 triệu, R vẫn theo S nhưng giá thu cần thẩm định (không có B theo công thức) và không áp số lỗi.'}
        </p>
        {formulaError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {formulaError}
          </p>
        )}
      </div>
    </div>
  );
};

export const InventoryFields = ({
  values,
  errors,
  onChange,
  readOnly = false,
  maxStock,
}: SectionProps & { readOnly?: boolean; maxStock?: number }) => {
  const t = useTranslations('adminProducts');
  const hasPackaging = [values.packLengthCm, values.packWidthCm, values.packHeightCm, values.packWeightGram].some(
    (value) => value.trim(),
  );
  return (
    <div className="product-form-sections">
      <fieldset className="product-form-section">
        <legend>{t('fieldGuide.stockIdentity')}</legend>
        <div className="grid gap-5 md:grid-cols-3">
          <TextField
            label="SKU"
            name="sku"
            required
            value={values.sku}
            onChange={(event) => onChange('sku', event.target.value)}
            error={errors.sku ? t(`validation.${errors.sku}`) : undefined}
          />
          <TextField
            label={t('stock')}
            name="stock"
            type="number"
            min={0}
            max={maxStock ?? (values.condition === 'preowned' ? 1 : undefined)}
            step={1}
            required
            inputMode="numeric"
            value={values.stock}
            hint={maxStock !== undefined ? t('fieldGuide.uniqueStock') : t('fieldGuide.stock')}
            onChange={(event) => onChange('stock', event.target.value)}
            error={errors.stock ? t(`validation.${errors.stock}`) : undefined}
          />
          <TextField
            label={t('receivedDate')}
            name="productionDate"
            type="date"
            error={errors.productionDate ? t(`validation.${errors.productionDate}`) : undefined}
            value={values.productionDate}
            hint={t('receivedDateHint')}
            onChange={(event) => onChange('productionDate', event.target.value)}
          />
        </div>
      </fieldset>
      <fieldset className="product-form-section">
        <legend>
          {t('packaging.title')}
          {readOnly && <small>{t('fieldGuide.inherited')}</small>}
        </legend>
        <p className="form-section-hint">{readOnly ? t('inheritedNote') : t('packaging.hint')}</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(
            [
              ['packLengthCm', 'lengthCm'],
              ['packWidthCm', 'widthCm'],
              ['packHeightCm', 'heightCm'],
              ['packWeightGram', 'weightGram'],
            ] as const
          ).map(([key, label]) => (
            <TextField
              key={key}
              label={t(`packaging.${label}`)}
              name={key}
              type="number"
              min={1}
              max={key === 'packWeightGram' ? 50000 : 200}
              step={1}
              inputMode="numeric"
              required={hasPackaging && !readOnly}
              readOnly={readOnly}
              value={values[key]}
              error={errors[key] ? t(`validation.${errors[key]}`) : undefined}
              onChange={(event) => onChange(key, event.target.value)}
            />
          ))}
          <label className="product-form-check col-span-2">
            <input
              type="checkbox"
              disabled={readOnly || !hasPackaging}
              checked={values.packFragile}
              onChange={(event) => onChange('packFragile', event.target.checked)}
            />
            <span>{t('packaging.fragile')}</span>
          </label>
          <label className="product-form-check col-span-2">
            <input
              type="checkbox"
              disabled={readOnly || !hasPackaging}
              checked={values.packAnyOrientation}
              onChange={(event) => onChange('packAnyOrientation', event.target.checked)}
            />
            <span>{t('packaging.anyOrientation')}</span>
          </label>
        </div>
      </fieldset>
      <fieldset className="product-form-section">
        <legend>
          {t('fieldGuide.displayMetadata')}
          {readOnly && <small>{t('fieldGuide.inherited')}</small>}
        </legend>
        <p className="form-section-hint">{t('fieldGuide.displayMetadataHint')}</p>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label={t('weight')}
            name="weight"
            placeholder={t('weightExample')}
            readOnly={readOnly}
            value={values.weight}
            onChange={(event) => onChange('weight', event.target.value)}
          />
          <TextField
            label={t('fieldGuide.displayDimensions')}
            name="dimensions"
            placeholder={t('dimensionsExample')}
            readOnly={readOnly}
            value={values.dimensions}
            onChange={(event) => onChange('dimensions', event.target.value)}
          />
        </div>
      </fieldset>
    </div>
  );
};

export const SupplierField = ({
  values,
  onChange,
  suppliers,
  readOnly = false,
}: Omit<SectionProps, 'errors'> & { suppliers: SupplierOption[]; readOnly?: boolean }) => {
  const t = useTranslations('adminProducts');
  return (
    <SelectField
      label={t('supplier')}
      name="supplierId"
      disabled={readOnly}
      hint={readOnly ? t('inheritedNote') : undefined}
      placeholder={t('noSupplier')}
      options={suppliers.map((supplier) => ({
        value: String(supplier.id),
        label: `${supplier.id} - ${supplier.name}`,
      }))}
      value={values.supplierId}
      onChange={(event) => onChange('supplierId', event.target.value)}
    />
  );
};

export const StatusFields = ({ values, onChange }: Omit<SectionProps, 'errors'>) => {
  const t = useTranslations('adminProducts');
  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label={t('inventoryStatus')}
        name="inventoryStatus"
        options={INVENTORY_STATUS_VALUES.map((value) => ({ value, label: t(`inventoryStates.${value}`) }))}
        value={values.inventoryStatus}
        onChange={(event) => onChange('inventoryStatus', event.target.value as InventoryStatus)}
      />
      {values.inventoryStatus !== 'available' && <p className="-mt-2 text-sm text-body">{t('heldNote')}</p>}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-brand-hover"
          checked={values.isArchived}
          onChange={(event) => onChange('isArchived', event.target.checked)}
        />
        <span>
          <span className="block font-medium text-black dark:text-white">{t('archived')}</span>
          <span className="text-sm text-body">{t('hiddenNote')}</span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-brand-hover"
          checked={values.isFeatured}
          onChange={(event) => onChange('isFeatured', event.target.checked)}
        />
        <span>
          <span className="block font-medium text-black dark:text-white">{t('featured')}</span>
          <span className="text-sm text-body">{t('featuredNote')}</span>
        </span>
      </label>
    </div>
  );
};
