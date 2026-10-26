'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatVND } from '@/shared/server/utils/utils';
import type { Category } from '@/shared/types/product';
import type { ProductFilterValues } from './ProductFilters';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';

// Applied values come from the URL, never the unsent search draft.
export default function AppliedFilters({
  values,
  categories,
  onRemove,
  onReset,
}: {
  values: Omit<ProductFilterValues, 'minPrice'> & { minPrice?: number };
  categories: Category[];
  onRemove: (key: keyof ProductFilterValues, value?: string) => void;
  onReset: () => void;
}) {
  const t = useTranslations('catalog');
  const ux = useTranslations('commerceUX');
  const locale = useLocale();
  const conditions = useProductConditions();
  const chips: { key: keyof ProductFilterValues; value?: string; label: string }[] = [];
  if (values.q) chips.push({ key: 'q', label: `“${values.q}”` });
  if (values.category)
    chips.push({ key: 'category', label: categories.find((c) => c.slug === values.category)?.name || values.category });
  for (const key of ['brand', 'scale', 'condition', 'assemblyState'] as const)
    for (const value of values[key])
      chips.push({
        key,
        value,
        label: key === 'condition' ? conditions.label(value) : key === 'assemblyState' ? t(value) : value,
      });
  if (values.minPrice) chips.push({ key: 'minPrice', label: `≥ ${formatVND(values.minPrice, locale)}` });
  if (values.maxPrice !== undefined) chips.push({ key: 'maxPrice', label: `≤ ${formatVND(values.maxPrice, locale)}` });
  if (values.inStock) chips.push({ key: 'inStock', label: t('inStock') });
  if (values.outletOnly) chips.push({ key: 'outletOnly', label: 'Outlet' });
  if (!chips.length) return null;
  return (
    <div className="catalog-applied" role="group" aria-label={ux('appliedFilters')}>
      {chips.map((chip) => (
        <button
          type="button"
          key={`${chip.key}-${chip.value ?? ''}`}
          onClick={() => onRemove(chip.key, chip.value)}
          aria-label={ux('removeFilter', { name: chip.label })}
        >
          {chip.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="catalog-clear" onClick={onReset}>
        {ux('clearFilters')}
      </button>
    </div>
  );
}
