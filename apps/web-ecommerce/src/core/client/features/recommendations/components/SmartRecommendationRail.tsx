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
import { formatVND as formatPrice } from '@/shared/server/utils/utils';

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
  eager?: boolean;
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
  eager,
}: SmartRecommendationRailProps) {
  const t = useTranslations('commerceUX');
  const tSmart = useTranslations('smartRecs');
  const anchorRef = useRef<HTMLElement>(null);

  const initialStrategy = defaultStrategy ?? (surface === 'cart' ? 'cart_addon' : 'for_you');
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [fallbackItems, setFallbackItems] = useState<SmartRecommendedProduct[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<RecommendationStrategy>(initialStrategy);
  const [profileSummary, setProfileSummary] = useState<{
    topBrands: string[];
    topScales: string[];
    preferredPriceBand: { min: number; median: number; max: number } | null;
    signalCount: number;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trackedImpressionsRef = useRef<Set<string>>(new Set());

  const cartIdsKey = useMemo(() => (cartProductIds || []).slice(0, 16).join(','), [cartProductIds]);
  const shouldLoadEagerly = eager ?? (surface === 'catalog' || surface === 'home' || surface === 'cart');

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
          cartProductIds: cartIdsKey ? cartIdsKey.split(',').map(Number) : [],
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
            const preferred = response.sections.find((sec) => sec.strategy === (defaultStrategy ?? initialStrategy));
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

    if (shouldLoadEagerly) {
      load();
    } else {
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
              { rootMargin: '420px' },
            );

      if (observer && anchorRef.current) observer.observe(anchorRef.current);
      else load();

      return () => {
        active = false;
        observer?.disconnect();
        clearTimeout(timer);
        controller.abort();
      };
    }

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [surface, defaultStrategy, initialStrategy, shouldLoadEagerly, productId, cartIdsKey, cartSubtotalVnd, category, categoryId, q, maxPrice, limit]);

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

  const isDefaultTab = activeStrategy === initialStrategy;
  const headingTitle =
    title || (isDefaultTab ? tSmart(`surfaceTitle.${surface}`) : tSmart(`sections.${activeStrategy}.title`));
  const headingSubtitle =
    subtitle || (isDefaultTab ? tSmart(`surfaceSubtitle.${surface}`) : tSmart(`sections.${activeStrategy}.subtitle`));

  return (
    <section
      ref={anchorRef}
      className={`product-recommendations smart-recommendations-rail ${className}`.trim()}
      aria-busy={!loaded}
      data-surface={surface}
      data-strategy={activeStrategy}
    >
      <header className="smart-recommendations-header">
        <div className="smart-recommendations-copy">
          <div className="smart-recommendations-eyebrow">
            <span className="smart-rec-spark" aria-hidden="true">✦</span>
            <span>{tSmart(`sections.${activeStrategy}.eyebrow`)}</span>
            <span className="smart-rec-surface-tag">{tSmart('eyebrow')}</span>
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
          {loaded && (
            <div className="smart-signal-bar" aria-label={tSmart('eyebrow')}>
              {profileSummary && profileSummary.signalCount > 0 ? (
                <>
                  <span className="smart-signal-chip is-primary">
                    ✦ {tSmart('signalActive', { count: profileSummary.signalCount })}
                  </span>
                  {profileSummary.topBrands.length > 0 && (
                    <span className="smart-signal-chip">
                      {tSmart('brandSignal', { brands: profileSummary.topBrands.slice(0, 2).join(', ') })}
                    </span>
                  )}
                  {profileSummary.topScales.length > 0 && (
                    <span className="smart-signal-chip">
                      {tSmart('scaleSignal', { scales: profileSummary.topScales.slice(0, 2).join(', ') })}
                    </span>
                  )}
                  {profileSummary.preferredPriceBand && (
                    <span className="smart-signal-chip">
                      {tSmart('priceSignal', {
                        range: `${formatPrice(profileSummary.preferredPriceBand.min)} – ${formatPrice(profileSummary.preferredPriceBand.max)}`,
                      })}
                    </span>
                  )}
                </>
              ) : (
                <span className="smart-signal-chip is-coldstart">{tSmart('coldStartBadge')}</span>
              )}
              {q && <span className="smart-signal-chip is-filter">{tSmart('querySignal', { query: q })}</span>}
              {maxPrice !== undefined && maxPrice > 0 && (
                <span className="smart-signal-chip is-filter">
                  {tSmart('budgetSignal', { amount: formatPrice(maxPrice) })}
                </span>
              )}
            </div>
          )}
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
          {surface !== 'catalog' && (
            <Link href="/cua-hang" className="smart-explore-link">
              {t('exploreCatalog')} <span aria-hidden="true">↗</span>
            </Link>
          )}
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
                  <p className="product-recommendation-reason">
                    <span aria-hidden="true">✦</span> {t(`relatedReason.${item.reason}`)}
                  </p>
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

