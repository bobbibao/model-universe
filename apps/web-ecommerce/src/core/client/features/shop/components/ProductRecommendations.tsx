'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import Carousel from '@/components/Carousel';
import PromoIcon from '@/components/PromoIcon';
import ProductCard from './ProductCard';
import ProductApi from '@/core/client/api/Product';
import RecommendationApi from '@/core/client/api/Recommendation';
import { trackRecommendationEvent } from '@/shared/client/behaviorTracker';
import type { ProductRecommendation } from '@/shared/product-recommendations';
import type {
  RecommendationSection,
  RecommendationStrategy,
  SmartRecommendedProduct,
} from '@/shared/smart-recommendations';

export default function ProductRecommendations({ productId }: { productId: number }) {
  const en = useLocale() === 'en';
  const t = useTranslations('commerceUX');
  const tSmart = useTranslations('smartRecs');
  const anchor = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<ProductRecommendation[]>();
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<RecommendationStrategy>('similar');
  const trackedImpressionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    let active = true;
    const load = () => {
      if (started) return;
      started = true;
      timer = setTimeout(() => controller.abort(), 8000);

      void Promise.all([
        ProductApi.getRecommendations(productId, controller.signal),
        RecommendationApi.getSmartRecommendations(
          { surface: 'product_detail', strategy: 'similar', productId, limit: 10 },
          controller.signal,
        ),
      ]).then(([baseItems, smartRes]) => {
        if (!active || controller.signal.aborted) return;
        clearTimeout(timer);

        const filteredBase = baseItems.filter(({ product }) => product.id !== productId).slice(0, 10);
        if (smartRes && smartRes.enabled && smartRes.sections.length > 0) {
          setSections(smartRes.sections);
          setActiveStrategy(smartRes.sections[0].strategy);
          const initialItems = smartRes.sections[0].items.slice(0, 10);
          setRows(
            initialItems.length > 0
              ? initialItems.map((item) => ({ product: item.product, reason: item.reason as ProductRecommendation['reason'] }))
              : filteredBase,
          );
        } else {
          setSections([]);
          setRows(filteredBase);
        }
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
            { rootMargin: '600px' },
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

  const activeSmartItems: SmartRecommendedProduct[] | null = useMemo(() => {
    if (!sections.length) return null;
    const sec = sections.find((s) => s.strategy === activeStrategy) ?? sections[0];
    return sec ? sec.items.slice(0, 10) : null;
  }, [sections, activeStrategy]);

  useEffect(() => {
    const displayed = activeSmartItems ?? rows?.map((r) => ({ product: r.product, reason: r.reason, strategy: 'similar' as const }));
    if (!displayed || displayed.length === 0) return;
    for (const item of displayed) {
      const key = `pdp:${productId}:${item.strategy}:${item.product.id}`;
      if (trackedImpressionsRef.current.has(key)) continue;
      trackedImpressionsRef.current.add(key);
      trackRecommendationEvent({
        eventType: 'rec_impression',
        productId: item.product.id,
        sourceProductId: productId,
        strategy: item.strategy,
        surface: 'product_detail',
        priceVnd: item.product.salePrice ?? item.product.price,
      });
    }
  }, [activeSmartItems, rows, productId]);

  if (rows?.length === 0 && (!activeSmartItems || activeSmartItems.length === 0)) return null;

  const headingTitle = sections.length > 0 ? tSmart(`sections.${activeStrategy}.title`) : t('relatedProducts');
  const headingSubtitle =
    sections.length > 0 ? tSmart(`sections.${activeStrategy}.subtitle`) : t('relatedProductsNote');

  const items = activeSmartItems
    ? activeSmartItems
    : rows
      ? rows.map((r) => ({
          product: r.product,
          reason: r.reason,
          strategy: 'similar' as const,
          score: 1,
          breakdown: { relevance: 1, preference: 0, recentBehavior: 0, popularity: 0, inStock: 1, marginOrBusiness: 0 },
        }))
      : null;

  return (
    <section
      ref={anchor}
      className="product-rail product-recommendations smart-recommendations-rail"
      aria-labelledby="product-recommendations-title"
      aria-busy={!items}
      data-surface="product_detail"
      data-strategy={activeStrategy}
    >
      <header className="product-rail-head smart-recommendations-head">
        <span className="product-rail-icon">
          <PromoIcon name="star" size={20} />
        </span>
        <div>
          <h2 id="product-recommendations-title">{headingTitle}</h2>
          {headingSubtitle && <p>{headingSubtitle}</p>}
        </div>
        {sections.length > 1 && (
          <div className="smart-recommendations-controls">
            <div className="smart-strategy-tabs" role="tablist" aria-label={tSmart('strategySwitcherLabel')}>
              {sections.map((sec) => {
                const isSelected = sec.strategy === activeStrategy;
                return (
                  <button
                    key={sec.strategy}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`smart-strategy-tab ${isSelected ? 'is-active' : ''}`}
                    onClick={() => setActiveStrategy(sec.strategy)}
                  >
                    {tSmart(`tabLabels.${sec.strategy}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Link href="/cua-hang" className="product-rail-more">
          {en ? 'See all' : 'Xem tất cả'} <PromoIcon name="arrow" size={14} />
        </Link>
      </header>

      {items ? (
        <Carousel
          label={headingTitle}
          className="product-rail-carousel"
          autoplayMs={4500}
          dots={false}
          loop={items.length > 5}
        >
          {items.map((item) => (
            <div
              key={`${item.strategy}-${item.product.id}`}
              className="product-rail-item"
              onClickCapture={() => {
                trackRecommendationEvent({
                  eventType: 'rec_click',
                  productId: item.product.id,
                  sourceProductId: productId,
                  strategy: item.strategy,
                  surface: 'product_detail',
                  priceVnd: item.product.salePrice ?? item.product.price,
                });
              }}
            >
              <ProductCard product={item.product} />
            </div>
          ))}
        </Carousel>
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
