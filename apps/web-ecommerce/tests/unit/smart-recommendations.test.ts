import {
  buildSurfaceRecommendationSections,
  buildUserAffinityProfile,
  DEFAULT_RECOMMENDATION_CONFIG,
  rankSmartRecommendations,
  sanitizeRecommendationConfig,
  type BehaviorSignalsInput,
} from '../../src/shared/smart-recommendations';
import type { ProductSummary } from '../../src/shared/types/product';

const makeProduct = (id: number, extra: Partial<ProductSummary> = {}): ProductSummary => ({
  id,
  name: `Gundam Astray Frame #${id}`,
  brandName: 'Bandai',
  scale: '1/100',
  modelCode: `MBF-P0${id}`,
  price: 1200000,
  salePrice: 1200000,
  discountPercent: 0,
  discountEndsAt: null,
  stock: 3,
  groupStock: 3,
  sold: 5,
  imageUrl: '/images/model.webp',
  rating: 4.8,
  reviewCount: 6,
  isFeatured: false,
  salesChannel: 'web',
  category: { id: 10, name: 'Master Grade', slug: 'master-grade' },
  ...extra,
});

describe('smart product recommendation engine (unit)', () => {
  it('builds a collector affinity profile with time decay, dwell boost, price band and search tokens', () => {
    const catalog = new Map<number, ProductSummary>([
      [1, makeProduct(1, { brandName: 'Bandai', scale: '1/100', salePrice: 1100000 })],
      [2, makeProduct(2, { brandName: 'Motor Nuclear', scale: '1/72', salePrice: 1500000, category: { id: 20, name: 'Metal Build', slug: 'metal-build' } })],
    ]);

    const signals: BehaviorSignalsInput = {
      purchasedProducts: [{...catalog.get(2)!,priceVnd:1500000,ageDays:2}],
      viewedProducts: [
        {...catalog.get(2)!,dwellMs:95000,ageDays:1/24},
        {...catalog.get(1)!,ageDays:20},
      ],
      searchQueries: [{query:'Motor Nuclear Bai Qi 1/72',ageDays:1/48}],
    };
    const profile = buildUserAffinityProfile(signals);

    expect(profile.isColdStart).toBe(false);
    expect(profile.totalSignalScore).toBeGreaterThan(0);
    expect(profile.purchasedProductIds.has(2)).toBe(true);
    expect(profile.viewedProductIds.has(1)).toBe(true);
    expect(profile.brandWeights['motor nuclear']).toBeGreaterThan(profile.brandWeights['bandai']);
    expect(profile.scaleWeights['1/72']).toBeGreaterThan(profile.scaleWeights['1/100']);
    expect(profile.priceProfile.hasSignal).toBe(true);
    expect(profile.priceProfile.preferredVnd).toBeGreaterThanOrEqual(1100000);
    expect(Object.keys(profile.keywordWeights)).toEqual(expect.arrayContaining(['motor', 'nuclear', 'bai', '1/72']));
  });

  it('strictly filters out-of-stock, self, cart items, explicitly excluded ids and duplicate model families', () => {
    const anchor = makeProduct(1, { modelCode: 'RX-78-2' });
    const candidates = [
      anchor,
      makeProduct(2, { modelCode: 'RX-78-2' }), // duplicate model family with anchor
      makeProduct(3, { stock: 0, groupStock: 0 }), // out of stock
      makeProduct(4, { modelCode: 'ZGMF-X10A' }), // in cart
      makeProduct(5, { modelCode: 'ZGMF-X20A' }), // explicitly excluded
      makeProduct(6, { modelCode: 'ASW-G-08' }), // valid
      makeProduct(7, { modelCode: 'ASW-G-08' }), // duplicate model family with #6
    ];

    const ranked = rankSmartRecommendations(candidates, {
      strategy: 'similar',
      sourceProduct: anchor,
      excludeProductIds: [4, 5],
      limit: 8,
    });

    expect(ranked.map((r) => r.product.id)).toEqual([6]);
  });

  it('prioritizes co-purchased and co-viewed models under the bought_together strategy', () => {
    const anchor = makeProduct(1);
    const coPurchased = makeProduct(2, {
      brandName: 'Kotobukiya',
      scale: '1/144',
      category: { id: 99, name: 'Other', slug: 'other' },
    });
    const coViewed = makeProduct(3, {
      brandName: 'Good Smile',
      scale: 'NON',
      category: { id: 98, name: 'Other 2', slug: 'other-2' },
    });
    const sameCategoryOnly = makeProduct(4);

    const ranked = rankSmartRecommendations([sameCategoryOnly, coViewed, coPurchased], {
      strategy: 'bought_together',
      sourceProduct: anchor,
      cooccurrence: {coPurchases: {2:4}, coViews: {3:6}},
      limit: 4,
    });

    expect(ranked[0].product.id).toBe(2);
    expect(ranked[0].reason).toBe('bought_together');
    expect(ranked[1].product.id).toBe(3);
    expect(ranked[1].reason).toBe('viewed_together');
  });

  it('identifies budget-friendly alternatives and in-stock pre-owned condition deals', () => {
    const anchor = makeProduct(1, { price: 2000000, salePrice: 2000000 });
    const expensive = makeProduct(2, { price: 2800000, salePrice: 2800000 });
    const cheaperNew = makeProduct(3, { price: 1400000, salePrice: 1400000 });
    const preownedDeal = makeProduct(4, {
      price: 2000000,
      salePrice: 2000000,
      stock: 0,
      groupStock: 1,
      conditions: [{ condition: 'preowned', units: 1, stock: 1, minSalePrice: 1350000 }],
    });

    const ranked = rankSmartRecommendations([expensive, cheaperNew, preownedDeal], {
      strategy: 'budget_alternative',
      sourceProduct: anchor,
      limit: 4,
    });

    const ids = ranked.map((r) => r.product.id);
    expect(ids).toContain(4);
    expect(ids).toContain(3);
    expect(ids[0]).toBe(4);
    const preownedRec = ranked.find((r) => r.product.id === 4)!;
    expect(preownedRec.reason).toBe('preowned_deal');
    expect(preownedRec.hasPreownedOption).toBe(true);
    expect(preownedRec.savingsVnd).toBe(650000);
  });

  it('recommends freeship completers in cart_addon strategy when cart is below freeshipThresholdVnd', () => {
    const cartItem = makeProduct(1, { salePrice: 200000 });
    const completer = makeProduct(2, { salePrice: 350000, modelCode: 'HG-01' });
    const farTooExpensive = makeProduct(3, { salePrice: 4500000, modelCode: 'PG-01' });

    const ranked = rankSmartRecommendations([farTooExpensive, completer], {
      strategy: 'cart_addon',
      anchorProducts: [cartItem],
      excludeProductIds: [cartItem.id],
      cartSubtotalVnd: 200000,
      limit: 4,
    });

    expect(ranked[0].product.id).toBe(2);
    expect(ranked[0].reason).toBe('freeship_completer');
  });

  it('enforces brand+scale diversity cap and backfills remaining slots cleanly', () => {
    const candidates = [
      makeProduct(2, { brandName: 'Bandai', scale: '1/100', sold: 50 }),
      makeProduct(3, { brandName: 'Bandai', scale: '1/100', sold: 40 }),
      makeProduct(4, { brandName: 'Bandai', scale: '1/100', sold: 30 }),
      makeProduct(5, { brandName: 'Motor Nuclear', scale: '1/72', sold: 25 }),
    ];

    const ranked = rankSmartRecommendations(candidates, {
      strategy: 'trending',
      config: { ...DEFAULT_RECOMMENDATION_CONFIG, maxPerBrandScale: 2 },
      limit: 3,
    });

    expect(ranked.map((r) => r.product.id)).toEqual([2, 3, 5]);
  });

  it('sanitizes admin configuration and returns empty recommendations when disabled', () => {
    const sanitized = sanitizeRecommendationConfig({
      enabled: false,
      weights: {preference:999,relevance:-20},
      maxPerBrandScale: 99,
      freeshipThresholdVnd: 450000.7,
    });

    expect(sanitized.enabled).toBe(false);
    expect(sanitized.weights.preference).toBe(100);
    expect(sanitized.weights.relevance).toBe(0);
    expect(sanitized.maxPerBrandScale).toBe(8);
    expect(sanitized.freeshipThresholdVnd).toBe(450001);

    const sections = buildSurfaceRecommendationSections('home', [makeProduct(1), makeProduct(2)], {
      config: sanitized,
    });
    expect(sections).toEqual([]);
  });
});

