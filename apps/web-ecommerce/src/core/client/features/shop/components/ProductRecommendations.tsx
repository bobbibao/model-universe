'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import ProductApi from '@/core/client/api/Product';
import type { ProductRecommendation } from '@/shared/product-recommendations';
import ProductCard from './ProductCard';

export default function ProductRecommendations({ productId }: { productId: number }) {
  const t = useTranslations('commerceUX');
  const anchor = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<ProductRecommendation[]>();
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    let active = true;
    const load = () => {
      if (started) return;
      started = true;
      timer = setTimeout(() => controller.abort(), 8000);
      void ProductApi.getRecommendations(productId, controller.signal).then((items) => {
        // A timed-out optional section disappears; navigation/unmount never restores old results.
        if (!active || controller.signal.aborted) return;
        clearTimeout(timer);
        setRows(items.filter(({ product }) => product.id !== productId).slice(0, 4));
      });
      controller.signal.addEventListener(
        'abort',
        () => {
          if (active) setRows([]);
        },
        { once: true },
      );
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer?.disconnect();
                load();
              }
            },
            { rootMargin: '400px' },
          );
    if (observer && anchor.current) observer.observe(anchor.current);
    else load();
    return () => {
      active = false;
      observer?.disconnect();
      clearTimeout(timer);
      controller.abort();
    };
  }, [productId]);
  if (rows?.length === 0) return null;
  return (
    <section
      ref={anchor}
      className="product-recommendations"
      aria-labelledby="product-recommendations-title"
      aria-busy={!rows}
    >
      <header>
        <div>
          <h2 id="product-recommendations-title">{t('relatedProducts')}</h2>
          <p>{t('relatedProductsNote')}</p>
        </div>
        <Link href="/cua-hang">
          {t('exploreCatalog')} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <div className="product-recommendations-track">
        {rows
          ? rows.map(({ product, reason }) => (
              <div className="product-recommendation" key={product.id}>
                <p className="product-recommendation-reason">{t(`relatedReason.${reason}`)}</p>
                <ProductCard product={product} />
              </div>
            ))
          : Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="product-recommendation-skeleton" aria-hidden="true" />
            ))}
      </div>
    </section>
  );
}
