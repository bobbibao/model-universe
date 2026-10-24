'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatVND } from '@/shared/server/utils/utils';
import type { Category } from '@/shared/types/product';
import type { ProductFilterValues } from './ProductFilters';

// Applied values come from the URL, never the unsent search draft.
export default function AppliedFilters({
  values,
  categories,
  onRemove,
  onReset,
}: {
  values: Omit<ProductFilterValues, 'minPrice'> & { minPrice?: number };
  categories: Category[];
  onRemove: (key: keyof ProductFilterValues) => void;
  onReset: () => void;
}) {
  const t = useTranslations('catalog');
  const ux = useTranslations('commerceUX');
  const locale = useLocale();
  const chips: { key: keyof ProductFilterValues; label: string }[] = [];
  if (values.q) chips.push({ key: 'q', label: `“${values.q}”` });
  if (values.category)
    chips.push({ key: 'category', label: categories.find((c) => c.slug === values.category)?.name || values.category });
  for (const key of ['brand', 'scale'] as const) if (values[key]) chips.push({ key, label: values[key] });
  for (const key of ['condition', 'assemblyState'] as const)
    if (values[key]) chips.push({ key, label: t(values[key]) });
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
          key={chip.key}
          onClick={() => onRemove(chip.key)}
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
