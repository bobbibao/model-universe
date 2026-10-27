'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import ProductApi from '@/core/client/api/Product';
import RecommendationApi from '@/core/client/api/Recommendation';
import { trackRecommendationEvent } from '@/shared/client/behaviorTracker';
import type { ProductRecommendation } from '@/shared/product-recommendations';
import type {
  RecommendationSection,
  RecommendationStrategy,
  SmartRecommendedProduct,
} from '@/shared/smart-recommendations';
import { formatPrice } from '@/shared/client/utils/format';
import ProductCard from './ProductCard';

export default function ProductRecommendations({ productId }: { productId: number }) {
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
          { surface: 'product_detail', strategy: 'similar', productId, limit: 4 },
          controller.signal,
        ),
      ]).then(([baseItems, smartRes]) => {
        // A timed-out optional section disappears; navigation/unmount never restores old results.
        if (!active || controller.signal.aborted) return;
        clearTimeout(timer);

        const filteredBase = baseItems.filter(({ product }) => product.id !== productId).slice(0, 4);
        if (smartRes && smartRes.enabled && smartRes.sections.length > 0) {
          setSections(smartRes.sections);
          setActiveStrategy(smartRes.sections[0].strategy);
          const initialItems = smartRes.sections[0].items.slice(0, 4);
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

  const activeSmartItems: SmartRecommendedProduct[] | null = useMemo(() => {
    if (!sections.length) return null;
    const sec = sections.find((s) => s.strategy === activeStrategy) ?? sections[0];
    return sec ? sec.items.slice(0, 4) : null;
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

  return (
    <section
      ref={anchor}
      className="product-recommendations"
      aria-labelledby="product-recommendations-title"
      aria-busy={!rows}
    >
      <header className="smart-recommendations-header">
        <div>
          <h2 id="product-recommendations-title">{t('relatedProducts')}</h2>
          <p>{t('relatedProductsNote')}</p>
        </div>
        <div className="smart-recommendations-controls">
          {sections.length > 1 && (
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
                    {tSmart(`strategy.${sec.strategy}`)}
                  </button>
                );
              })}
            </div>
          )}
          <Link href="/cua-hang">
            {t('exploreCatalog')} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <div className="product-recommendations-track">
        {activeSmartItems
          ? activeSmartItems.map((item) => (
              <div
                className="product-recommendation"
                key={`${item.strategy}-${item.product.id}`}
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
                <div className="product-recommendation-badges">
                  <p className="product-recommendation-reason">{t(`relatedReason.${item.reason}`)}</p>
                  {item.savingsVnd && item.savingsVnd >= 20_000 ? (
                    <span className="smart-rec-saving-badge">
                      {tSmart('saveBadge', { amount: formatPrice(item.savingsVnd) })}
                    </span>
                  ) : null}
                  {item.hasPreownedOption ? (
                    <span className="smart-rec-preowned-badge">{tSmart('preownedBadge')}</span>
                  ) : null}
                </div>
                <ProductCard product={item.product} />
              </div>
            ))
          : rows
            ? rows.map(({ product, reason }) => (
                <div
                  className="product-recommendation"
                  key={product.id}
                  onClickCapture={() => {
                    trackRecommendationEvent({
                      eventType: 'rec_click',
                      productId: product.id,
                      sourceProductId: productId,
                      strategy: 'similar',
                      surface: 'product_detail',
                      priceVnd: product.salePrice ?? product.price,
                    });
                  }}
                >
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
