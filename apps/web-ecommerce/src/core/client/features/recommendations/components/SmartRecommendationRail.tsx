'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import RecommendationApi from '@/core/client/api/Recommendation';
import { trackRecommendationEvent } from '@/shared/client/behaviorTracker';
import type {
  RecommendationSection,
  RecommendationStrategy,
  RecommendationSurface,
  SmartRecommendedProduct,
} from '@/shared/smart-recommendations';
import ProductCard from '@/core/client/features/shop/components/ProductCard';
import { formatPrice } from '@/shared/client/utils/format';

export interface SmartRecommendationRailProps {
  surface: RecommendationSurface;
  defaultStrategy?: RecommendationStrategy;
  productId?: number | string;
  cartProductIds?: number[];
  cartSubtotalVnd?: number;
  category?: string;
  categoryId?: number;
  q?: string;
  maxPrice?: number;
  limit?: number;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function SmartRecommendationRail({
  surface,
  defaultStrategy,
  productId,
  cartProductIds,
  cartSubtotalVnd,
  category,
  categoryId,
  q,
  maxPrice,
  limit = 4,
  title,
  subtitle,
  className = '',
}: SmartRecommendationRailProps) {
  const t = useTranslations('commerceUX');
  const tSmart = useTranslations('smartRecs');
  const anchorRef = useRef<HTMLElement>(null);

  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [fallbackItems, setFallbackItems] = useState<SmartRecommendedProduct[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<RecommendationStrategy>(
    defaultStrategy ?? (surface === 'cart' ? 'cart_addon' : 'for_you'),
  );
  const [profileSummary, setProfileSummary] = useState<{
    topBrands: string[];
    topScales: string[];
    preferredPriceBand: { min: number; median: number; max: number } | null;
    signalCount: number;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trackedImpressionsRef = useRef<Set<string>>(new Set());

  const cartIdsKey = useMemo(() => (cartProductIds || []).slice(0, 16).join(','), [cartProductIds]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    let active = true;

    const load = () => {
      if (started) return;
      started = true;
      timer = setTimeout(() => controller.abort(), 8000);

      void RecommendationApi.getSmartRecommendations(
        {
          surface,
          strategy: defaultStrategy,
          productId,
          cartProductIds,
          cartSubtotalVnd,
          category,
          categoryId,
          q,
          maxPrice,
          limit,
        },
        controller.signal,
      ).then((response) => {
        if (!active || controller.signal.aborted) return;
        clearTimeout(timer);
        if (response && response.enabled) {
          setSections(response.sections || []);
          setFallbackItems(response.items || []);
          setProfileSummary(response.profileSummary || null);
          if (response.sections?.length) {
            const preferred = response.sections.find((sec) => sec.strategy === defaultStrategy);
            setActiveStrategy(preferred ? preferred.strategy : response.sections[0].strategy);
          } else {
            setActiveStrategy(response.strategy);
          }
        } else {
          setSections([]);
          setFallbackItems([]);
        }
        setLoaded(true);
      });

      controller.signal.addEventListener(
        'abort',
        () => {
          if (active) setLoaded(true);
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
            { rootMargin: '360px' },
          );

    if (observer && anchorRef.current) observer.observe(anchorRef.current);
    else load();

    return () => {
      active = false;
      observer?.disconnect();
      clearTimeout(timer);
      controller.abort();
    };
  }, [surface, defaultStrategy, productId, cartIdsKey, cartSubtotalVnd, category, categoryId, q, maxPrice, limit]);

  const activeItems = useMemo(() => {
    const sec = sections.find((s) => s.strategy === activeStrategy);
    if (sec && sec.items.length > 0) return sec.items.slice(0, limit);
    return fallbackItems.slice(0, limit);
  }, [sections, activeStrategy, fallbackItems, limit]);

  useEffect(() => {
    if (!loaded || activeItems.length === 0) return;
    for (const item of activeItems) {
      const key = `${surface}:${item.strategy}:${item.product.id}`;
      if (trackedImpressionsRef.current.has(key)) continue;
      trackedImpressionsRef.current.add(key);
      trackRecommendationEvent({
        eventType: 'rec_impression',
        productId: item.product.id,
        sourceProductId: typeof productId === 'number' ? productId : null,
        strategy: item.strategy,
        surface,
        priceVnd: item.product.salePrice ?? item.product.price,
      });
    }
  }, [loaded, activeItems, surface, productId]);

  if (loaded && activeItems.length === 0) return null;

  const headingTitle = title || tSmart(`surfaceTitle.${surface}`);
  const headingSubtitle = subtitle || tSmart(`surfaceSubtitle.${surface}`);

  return (
    <section
      ref={anchorRef}
      className={`product-recommendations smart-recommendations-rail ${className}`.trim()}
      aria-busy={!loaded}
      data-surface={surface}
      data-strategy={activeStrategy}
    >
      <header className="smart-recommendations-header">
        <div>
          <div className="smart-recommendations-eyebrow">
            <span className="smart-rec-spark" aria-hidden="true">✦</span>
            <span>{tSmart('eyebrow')}</span>
            {profileSummary && profileSummary.signalCount > 0 && (
              <span className="smart-rec-personalized-pill">
                {tSmart('personalizedBadge', {
                  brand: profileSummary.topBrands[0] || profileSummary.topScales[0] || 'Gunpla',
                })}
              </span>
            )}
          </div>
          <h2>{headingTitle}</h2>
          <p>{headingSubtitle}</p>
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
          <Link href="/cua-hang" className="smart-explore-link">
            {t('exploreCatalog')} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <div className="product-recommendations-track">
        {loaded
          ? activeItems.map((item) => (
              <div
                className="product-recommendation smart-recommendation-item"
                key={`${item.strategy}-${item.product.id}`}
                onClickCapture={() => {
                  trackRecommendationEvent({
                    eventType: 'rec_click',
                    productId: item.product.id,
                    sourceProductId: typeof productId === 'number' ? productId : null,
                    strategy: item.strategy,
                    surface,
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
          : Array.from({ length: limit }, (_, index) => (
              <div key={index} className="product-recommendation-skeleton" aria-hidden="true" />
            ))}
      </div>
    </section>
  );
}

