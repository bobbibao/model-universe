'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Api from '@/core/client/api/Api';
import ProductApi from '@/core/client/api/Product';
import ProductImage from '@/components/ProductImage';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';
import type { ProductSummary } from '@/shared/types/product';
import ServiceIcon from './ServiceIcon';

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
  familyMode = false,
  onCreateManual,
}: {
  label: string;
  value: ProductSummary | null;
  onChange: (product: ProductSummary | null) => void;
  placeholder?: string;
  showPrice?: boolean;
  inStockOnly?: boolean;
  familyMode?: boolean;
  onCreateManual?: (name: string) => void;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setItems([]);
    const timer = setTimeout(
      () => {
        const pending = familyMode
          ? Api.get('/product-condition-tree/families', { params: { q: query.trim() } }).then((response) => ({
              data: response.data.map(
                (family: {
                  id: number;
                  name: string;
                  brandName: string;
                  modelCode: string | null;
                  scale: string | null;
                  imageUrl: string;
                }) => ({
                  ...family,
                  modelFamilyId: family.id,
                  price: 0,
                  salePrice: 0,
                  stock: 0,
                  discountPercent: 0,
                  discountEndsAt: null,
                  rating: 0,
                  reviewCount: 0,
                  isFeatured: false,
                  salesChannel: 'web' as const,
                }),
              ) as ProductSummary[],
            }))
          : ProductApi.getProducts({
              ...(query.trim() ? { q: query.trim() } : { sort: 'best_selling' }),
              per_page: 20,
            });
        void pending
          .then((page) => {
            if (!alive) return;
            setItems((page?.data || []).filter((row) => !row.partnerId && (!inStockOnly || row.stock > 0)));
            setActive(0);
          })
          .catch(() => {
            if (alive) setFailed(true);
          })
          .finally(() => alive && setLoading(false));
      },
      query.trim() ? 200 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query, inStockOnly, familyMode, retry]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${items[active]?.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, items, id]);

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
    <div
      className="cc-field"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="cc-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className={`cc-box${open ? ' is-open' : ''}`}>
        <span className="cc-search-icon">
          <ServiceIcon name="search" size={18} />
        </span>
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-busy={loading}
          aria-activedescendant={open && items[active] ? `${id}-option-${items[active].id}` : undefined}
          autoComplete="off"
          maxLength={255}
          value={query}
          placeholder={placeholder ?? (en ? 'Search model name or code…' : 'Tìm tên hoặc mã mô hình…')}
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
              setActive((index) => (open ? Math.min(index + 1, Math.max(0, items.length - 1)) : 0));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => (open ? Math.max(index - 1, 0) : Math.max(0, items.length - 1)));
            } else if (event.key === 'Enter' && open && items[active]) {
              event.preventDefault();
              pick(items[active]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        <button
          className="cc-caret"
          type="button"
          aria-label={
            open
              ? en
                ? 'Close model list'
                : 'Đóng danh sách mô hình'
              : en
                ? 'Open model list'
                : 'Mở danh sách mô hình'
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen(!open)}
        >
          <ServiceIcon name="chevron" size={16} />
        </button>
      </div>
      {open && (
        <div className="cc-list">
          {!query.trim() && !loading && items.length > 0 && (
            <p className="cc-hint">{en ? 'Popular models' : 'Mẫu được quan tâm'}</p>
          )}
          {loading && items.length === 0 && (
            <p className="cc-status" role="status">
              {en ? 'Loading…' : 'Đang tải…'}
            </p>
          )}
          {failed && (
            <div className="cc-status" role="status">
              <span>{en ? 'Could not load models.' : 'Chưa tải được danh sách.'}</span>
              <button type="button" onClick={() => setRetry((count) => count + 1)}>
                {en ? 'Retry' : 'Thử lại'}
              </button>
            </div>
          )}
          {!loading && !failed && items.length === 0 && (
            <p className="cc-status">{en ? 'No matching model found.' : 'Chưa tìm thấy mô hình phù hợp.'}</p>
          )}
          <ul id={`${id}-list`} role="listbox" aria-label={label}>
            {items.map((product, index) => (
              <li
                key={product.id}
                id={`${id}-option-${product.id}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'is-active' : undefined}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(product)}
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
          {onCreateManual && (
            <button
              type="button"
              className="cc-create-manual"
              onClick={() => {
                onCreateManual(query.trim());
                setQuery('');
                setOpen(false);
              }}
            >
              <ServiceIcon name="edit" size={17} />
              <span>
                <strong>{en ? 'Model outside the catalog?' : 'Mẫu chưa có trong danh mục?'}</strong>
                <small>
                  {query.trim()
                    ? `${en ? 'Use' : 'Dùng tên'} “${query.trim()}”`
                    : en
                      ? 'Enter its name for an individual quote'
                      : 'Tự nhập tên để shop báo giá riêng'}
                </small>
              </span>
              <ServiceIcon name="arrow" size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
