'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import Carousel from '@/components/Carousel';
import PromoIcon from '@/components/PromoIcon';
import ProductCard from '@/core/client/features/shop/components/ProductCard';
import RecommendationApi from '@/core/client/api/Recommendation';
import { trackRecommendationEvent } from '@/shared/client/behaviorTracker';
import type {
  RecommendationSection,
  RecommendationStrategy,
  RecommendationSurface,
  SmartRecommendedProduct,
} from '@/shared/smart-recommendations';

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
  limit = 10,
  title,
  className = '',
  eager,
}: SmartRecommendationRailProps) {
  const en = useLocale() === 'en';
  const tSmart = useTranslations('smartRecs');
  const anchorRef = useRef<HTMLElement>(null);

  const initialStrategy = defaultStrategy ?? (surface === 'cart' ? 'cart_addon' : 'for_you');
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [fallbackItems, setFallbackItems] = useState<SmartRecommendedProduct[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<RecommendationStrategy>(initialStrategy);
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

  const activeSection = sections.find((s) => s.strategy === activeStrategy);
  const headingTitle = title || (activeSection ? tSmart(`sections.${activeStrategy}.title`) : (en ? 'Recommended for you' : 'Gợi ý dành riêng cho bạn'));
  const headingSubtitle = activeSection ? tSmart(`sections.${activeStrategy}.subtitle`) : (en ? 'Personalized based on your browsing style & favorite kits.' : 'Tuyển chọn từ lịch sử xem và gu sưu tầm của bạn.');

  return (
    <section
      ref={anchorRef}
      className={`product-rail smart-recommendations-rail mu-wrap ${className}`.trim()}
      aria-busy={!loaded}
      data-surface={surface}
      data-strategy={activeStrategy}
    >
      <header className="product-rail-head smart-recommendations-head">
        <span className="product-rail-icon">
          <PromoIcon name="star" size={20} />
        </span>
        <div>
          <h2>{headingTitle}</h2>
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

      {loaded ? (
        <Carousel
          label={headingTitle}
          className="product-rail-carousel"
          autoplayMs={4500}
          dots={false}
          loop={activeItems.length > 5}
        >
          {activeItems.map((item) => (
            <div
              key={`${item.strategy}-${item.product.id}`}
              className="product-rail-item"
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
