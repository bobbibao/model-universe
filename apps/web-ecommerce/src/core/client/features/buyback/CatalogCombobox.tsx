'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import ProductApi from '@/core/client/api/Product';
import ProductImage from '@/components/ProductImage';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';
import type { ProductSummary } from '@/shared/types/product';

// A choose-or-search list of the shop's own models (an ARIA combobox): the list opens on focus with the best sellers,
// typing filters it (the catalogue is searched as the customer types), arrows and Enter pick, Escape closes.
// `inStockOnly`: only items the shop can hand over now (a trade item).
export default function CatalogCombobox({
  label,
  value,
  onChange,
  placeholder,
  showPrice = false,
  inStockOnly = false,
}: {
  label: string;
  value: ProductSummary | null;
  onChange: (product: ProductSummary | null) => void;
  placeholder?: string;
  showPrice?: boolean;
  inStockOnly?: boolean;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(
      () => {
        void ProductApi.getProducts({
          ...(query.trim() ? { q: query.trim() } : { sort: 'best_selling' }),
          per_page: 20,
        })
          .then((page) => {
            if (!alive) return;
            setItems((page?.data || []).filter((row) => !row.partnerId && (!inStockOnly || row.stock > 0)));
            setActive(0);
          })
          .finally(() => alive && setLoading(false));
      },
      query.trim() ? 200 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query, inStockOnly]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (product: ProductSummary) => {
    onChange(product);
    setQuery('');
    setOpen(false);
  };

  if (value)
    return (
      <div className="cc-field">
        <span className="cc-label">{label}</span>
        <div className="cc-chosen">
          <span className="cc-thumb is-large">
            <ProductImage src={value.imageUrl} alt="" sizes="72px" className="object-contain" />
          </span>
          <span className="cc-chosen-copy">
            <strong>{value.name}</strong>
            <small>
              {value.brandName}
              {showPrice &&
                ` · ${en ? 'member price' : 'giá thành viên'} ${formatVND(memberPrice(value.price), locale)}`}
            </small>
          </span>
          <button type="button" className="cc-change" onClick={() => onChange(null)}>
            {en ? 'Change' : 'Đổi mẫu'}
          </button>
        </div>
      </div>
    );

  return (
    <div className="cc-field" ref={root}>
      <label className="cc-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className={`cc-box${open ? ' is-open' : ''}`}>
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${id}-option-${items[active].id}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder ?? (en ? 'Choose a model or type to search…' : 'Chọn mẫu hoặc gõ để tìm…')}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, Math.max(0, items.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open && items[active]) {
              event.preventDefault();
              pick(items[active]);
            } else if (event.key === 'Escape') setOpen(false);
          }}
        />
        <span className="cc-caret" aria-hidden="true">
          ▾
        </span>
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" className="cc-list">
          {!query.trim() && !loading && items.length > 0 && (
            <li className="cc-hint" role="presentation">
              {en ? 'Popular models' : 'Mẫu được quan tâm'}
            </li>
          )}
          {loading && items.length === 0 && (
            <li className="cc-hint" role="presentation">
              {en ? 'Loading…' : 'Đang tải…'}
            </li>
          )}
          {!loading && items.length === 0 && (
            <li className="cc-hint" role="presentation">
              {en ? 'No model of the shop matches.' : 'Không có mẫu nào của shop khớp.'}
            </li>
          )}
          {items.map((product, index) => (
            <li
              key={product.id}
              id={`${id}-option-${product.id}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'is-active' : undefined}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(product);
              }}
            >
              <span className="cc-thumb">
                <ProductImage src={product.imageUrl} alt="" sizes="44px" className="object-contain" />
              </span>
              <span className="cc-option-copy">
                <strong>{product.name}</strong>
                <small>{product.brandName}</small>
              </span>
              {showPrice && <span className="cc-option-price">{formatVND(memberPrice(product.price), locale)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
