'use client';

import './product-card-hover.css';

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import PromoIcon, { type PromoIconName } from '@/components/PromoIcon';
import ProductApi from '@/core/client/api/Product';
import ProductCard from '@/core/client/features/shop/components/ProductCard';
import type { ProductQuery, ProductSummary } from '@/shared/types/product';

interface ProductRailProps {
  title: string;
  note?: string;
  icon: PromoIconName;
  tone?: 'hot' | 'new' | 'deal' | 'plain';
  href?: string;
  query?: ProductQuery;
  products?: ProductSummary[];
  ranked?: boolean;
  aside?: ReactNode;
}

// A shelf of product cards: best sellers with their rank, new arrivals, good prices, or the visitor's recently viewed
// kits. A still grid of the first five (four on narrower screens, two by two on a phone) with a link to the full list;
// nothing slides by itself. Renders nothing when the shelf would be empty. `icon` and `tone` are kept for callers.
export default function ProductRail({
  title,
  note,
  tone = 'plain',
  href,
  query,
  products: given,
  ranked = false,
  aside,
}: ProductRailProps) {
  const en = useLocale() === 'en';
  const [products, setProducts] = useState<ProductSummary[] | undefined>(given);
  const signature = JSON.stringify(query ?? null);
  useEffect(() => {
    if (given) {
      setProducts(given);
      return;
    }
    let active = true;
    void ProductApi.getProducts({ per_page: 12, ...(JSON.parse(signature) as ProductQuery) }).then((result) => {
      if (active) setProducts(result?.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [given, signature]);
  if (products && products.length === 0) return null;
  return (
    <section className={`product-rail mu-wrap is-${tone}`}>
      <header className="product-rail-head">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {aside}
        {href && (
          <Link href={href} className="product-rail-more">
            {en ? 'See all' : 'Xem tất cả'} <PromoIcon name="arrow" size={14} />
          </Link>
        )}
      </header>
      {products ? (
        <div className="product-rail-grid">
          {products.slice(0, 5).map((product, index) => (
            <div key={product.id} className="product-rail-item">
              {ranked && <span className="rail-rank">{String(index + 1).padStart(2, '0')}</span>}
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="product-rail-skeleton" aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
    </section>
  );
}
