'use client';
import ConditionTreePicker from '@/components/Store/ConditionTreePicker';

import { catalogPricing } from '@/shared/sale-pricing';
import { buybackRateBps } from '@/shared/buyback-pricing';

import { useLocale, useTranslations } from 'next-intl';
import { ASSEMBLY_STATES } from '@/shared/gunpla';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import TextField from '@/components/FormElements/TextField';
import TextAreaField from '@/components/FormElements/TextAreaField';
import SelectField from '@/components/FormElements/SelectField';
import { formatVND } from '@/shared/server/utils/utils';
import type { Category } from '@/shared/types/product';
import type { SupplierOption } from '@/core/client/api/Supplier';
import { conditionRules, INVENTORY_STATUS_VALUES, ProductFormErrors, ProductFormValues } from './productForm';
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
  const en = useLocale() === 'en';
  return (
    <>
      <SelectField
        label={en ? 'Item type' : 'Loại hàng'}
        name="itemTypeKey"
        disabled={lockedCondition}
        options={[
          { value: 'new', label: 'New' },
          { value: 'preowned', label: '2hand' },
        ]}
        value={values.condition === 'new' ? 'new' : 'preowned'}
        onChange={(event) => {
          onChange('condition', event.target.value);
          onChange('conditionNodeIds', []);
        }}
      />
      <TextAreaField
        rows={2}
        label={en ? 'Additional notes (not part of SKU identity)' : 'Ghi chú bổ sung (không tạo tổ hợp mới)'}
        name="conditionNote"
        value={values.conditionNote}
        onChange={(event) => onChange('conditionNote', event.target.value)}
      />
      <div className="md:col-span-2">
        <ConditionTreePicker
          value={values.conditionNodeIds}
          itemType={values.condition === 'new' ? 'new' : 'preowned'}
          disabled={lockedCondition}
          onChange={(ids) => onChange('conditionNodeIds', ids)}
        />
      </div>
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
      result = catalogPricing(Number(values.pricingReferenceMemberVnd));
    } catch (error) {
      formulaError = en ? 'The real selling price must be a whole VND amount above 0.' : (error as Error).message;
    }
  }
  const target = result?.referenceMemberVnd;
  const rate = target ? buybackRateBps(target) / 100 : null;
  // Owner rule of 2026-10-26: staff enter only S; R, B and C50 follow it and cannot be typed.
  const outputs: { label: string; value: number | undefined; note: string }[] = [
    {
      label: en ? 'Web price R = S ÷ 0.9' : 'Giá web R = S ÷ 0,9',
      value: result?.listPriceVnd,
      note: en ? 'Shown struck through; members pay S with MEMBER10' : 'Hiện gạch ngang; thành viên trả S với MEMBER10',
    },
    {
      label: en ? `Shop margin B${rate ? ` = ${rate}% × S` : ''}` : `Giá lời B${rate ? ` = ${rate}% × S` : ''}`,
      value: result?.buybackMarginVnd,
      note: en
        ? '30% to 500k, 20% to 1.15M, 17% above; at least 100k'
        : '30% đến 500k, 20% đến 1,15tr, 17% trên đó; tối thiểu 100k',
    },
    {
      label: en ? 'Buyback price = S − B' : 'Giá thu = S − B',
      value: result?.buybackPriceVnd,
      note: en ? 'For this exact approved combination' : 'Cho đúng tổ hợp đã duyệt này',
    },
    {
      label: en ? 'Pawn amount C50 = 50% × S' : 'Giá cầm C50 = 50% × S',
      value: result?.pawnPriceVnd,
      note: en ? 'Interest simulated until legal review' : 'Lãi chỉ mô phỏng, chờ thẩm định pháp lý',
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextField
        label={en ? 'Real selling price S (VND)' : 'Giá bán thực S (đ)'}
        name="pricingReferenceMemberVnd"
        required
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        hint={
          en
            ? 'The only price you enter: the member price customers pay.'
            : 'Giá duy nhất cần nhập: giá thành viên khách trả.'
        }
        error={errors.price ? t(`validation.${errors.price}`) : undefined}
        value={values.pricingReferenceMemberVnd}
        placeholder="1100000"
        onChange={(e) => onChange('pricingReferenceMemberVnd', e.target.value)}
      />

      <TextField
        label={en ? 'Actual cost H · from the purchase / intake record' : 'Giá vốn thực tế H · theo chứng từ nhập/thu'}
        name="importPrice"
        readOnly
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        hint={
          en
            ? 'Kept apart from the buyback price; it decides whether sales and vouchers keep their profit.'
            : 'Giữ riêng với giá thu; dùng để kiểm tra sale và voucher còn giữ lợi nhuận.'
        }
        value={values.importPrice}
        onChange={(e) => onChange('importPrice', e.target.value)}
        error={errors.importPrice ? t(`validation.${errors.importPrice}`) : undefined}
      />
      <div className="rounded-xl border border-stroke bg-gray p-4 dark:border-store-card dark:bg-store-panel md:col-span-2">
        <p className="text-sm font-semibold">
          {en ? 'Calculated from S · cannot be edited' : 'Tự tính từ S · không nhập đè'}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {outputs.map((output) => (
            <div key={output.label}>
              <dt className="text-xs text-body">{output.label}</dt>
              <dd className="mt-1 font-bold">{output.value !== undefined ? formatVND(output.value, locale) : '—'}</dd>
              <dd className="text-xs text-body">{output.note}</dd>
            </div>
          ))}
        </dl>
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
  const conditions = useProductConditions();
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
            readOnly
            step={1}
            required
            inputMode="numeric"
            value={values.stock}
            hint={t('fieldGuide.stock')}
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
  const en = useLocale() === 'en';
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-brand-hover"
          checked={values.serviceReferenceEnabled}
          onChange={(event) => onChange('serviceReferenceEnabled', event.target.checked)}
        />
        <span>
          {en ? 'Use approved S for buyback / trade / pawn estimates' : 'Dùng S đã duyệt để báo giá thu / trade / cầm'}
        </span>
      </label>
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
