import { FREESHIP_TIERS } from './promotions';
import type { ProductSummary } from './types/product';

export const RECOMMENDATION_STRATEGIES = [
  'for_you',
  'similar',
  'related',
  'bought_together',
  'trending',
  'budget_alternative',
  'cart_addon',
] as const;
export type RecommendationStrategy = (typeof RECOMMENDATION_STRATEGIES)[number];

export const RECOMMENDATION_SURFACES = ['home', 'product_detail', 'cart', 'catalog', 'wishlist'] as const;
export type RecommendationSurface = (typeof RECOMMENDATION_SURFACES)[number];

export const RECOMMENDATION_EVENT_TYPES = [
  'product_view',
  'dwell',
  'search',
  'category_view',
  'add_to_cart',
  'wishlist_add',
  'rec_impression',
  'rec_click',
  'rec_add_to_cart',
] as const;
export type RecommendationEventType = (typeof RECOMMENDATION_EVENT_TYPES)[number];

export const SMART_RECOMMENDATION_REASONS = [
  'category',
  'brand',
  'scale',
  'price',
  'discover',
  'bought_together',
  'viewed_together',
  'personalized_affinity',
  'search_match',
  'budget_friendly',
  'trending_now',
  'freeship_completer',
  'preowned_deal',
] as const;
export type SmartRecommendationReason = (typeof SMART_RECOMMENDATION_REASONS)[number];

export interface RecommendationWeights {
  relevance: number;
  preference: number;
  cooccurrence: number;
  popularity: number;
  business: number;
}

export interface RecommendationSurfaceToggles {
  home: boolean;
  productDetail: boolean;
  cart: boolean;
  catalog: boolean;
  wishlist: boolean;
}

export interface RecommendationConfig {
  enabled: boolean;
  weights: RecommendationWeights;
  surfaces: RecommendationSurfaceToggles;
  maxPerBrandScale: number;
  preferInStockPreowned: boolean;
  budgetRatio: number;
  defaultLimit: number;
  enableFreeshipGapAddons: boolean;
  freeshipThresholdVnd: number;
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  enabled: true,
  weights: {
    relevance: 35,
    preference: 25,
    cooccurrence: 20,
    popularity: 10,
    business: 10,
  },
  surfaces: {
    home: true,
    productDetail: true,
    cart: true,
    catalog: true,
    wishlist: true,
  },
  maxPerBrandScale: 2,
  preferInStockPreowned: true,
  budgetRatio: 0.85,
  defaultLimit: 10,
  enableFreeshipGapAddons: true,
  freeshipThresholdVnd: FREESHIP_TIERS[0]?.minOrderVnd ?? 1000000,
};

export interface ScoreBreakdown {
  relevance: number;
  preference: number;
  cooccurrence: number;
  popularity: number;
  business: number;
}

export interface SmartRecommendationItem<T extends ProductSummary = ProductSummary> {
  product: T;
  reason: SmartRecommendationReason;
  strategy: RecommendationStrategy;
  score: number;
  savingsVnd?: number;
  hasPreownedOption?: boolean;
  priceSavingVnd?: number;
  freeshipGapVnd?: number;
  breakdown?: ScoreBreakdown;
}

export interface SmartRecommendationSection<T extends ProductSummary = ProductSummary> {
  strategy: RecommendationStrategy;
  items: SmartRecommendationItem<T>[];
}

export interface SmartRecommendationResponse<T extends ProductSummary = ProductSummary> {
  surface: RecommendationSurface;
  strategy: RecommendationStrategy;
  isColdStart: boolean;
  items: SmartRecommendationItem<T>[];
  sections: SmartRecommendationSection<T>[];
}

export interface ProductSignalRef {
  id: number;
  name?: string | null;
  brandName?: string | null;
  scale?: string | null;
  modelCode?: string | null;
  condition?: string | null;
  assemblyState?: string | null;
  categoryId?: number | null;
  priceVnd?: number | null;
  weight?: number;
  ageDays?: number;
  dwellMs?: number | null;
}

export interface BehaviorSignalsInput {
  purchasedProducts?: ProductSignalRef[];
  wishlistProducts?: ProductSignalRef[];
  cartProducts?: ProductSignalRef[];
  viewedProducts?: ProductSignalRef[];
  searchQueries?: { query: string; ageDays?: number }[];
  categoryViews?: { categoryId: number; ageDays?: number }[];
  budgetFilter?: { minPriceVnd?: number; maxPriceVnd?: number };
}

export interface UserAffinityProfile {
  categoryWeights: Record<number, number>;
  brandWeights: Record<string, number>;
  scaleWeights: Record<string, number>;
  conditionWeights: Record<string, number>;
  assemblyWeights: Record<string, number>;
  keywordWeights: Record<string, number>;
  purchasedProductIds: Set<number>;
  wishlistProductIds: Set<number>;
  cartProductIds: Set<number>;
  viewedProductIds: Set<number>;
  recentOrderedIds: number[];
  priceProfile: {
    minVnd: number;
    maxVnd: number;
    preferredVnd: number;
    hasSignal: boolean;
  };
  totalSignalScore: number;
  isColdStart: boolean;
}

export interface CooccurrenceStats {
  // Keyed by candidate productId -> count of co-purchases with anchor product(s)
  coPurchases?: Record<number, number>;
  // Keyed by candidate productId -> count of co-views / co-carts in the same session
  coViews?: Record<number, number>;
  // Recent 30-day engagement counts per candidate productId
  recentViews?: Record<number, number>;
  recentCarts?: Record<number, number>;
  recentOrders?: Record<number, number>;
}

export interface RankSmartContext {
  strategy: RecommendationStrategy;
  sourceProduct?: (Pick<ProductSummary, 'id' | 'name' | 'brandName' | 'price' | 'salePrice'> &
    Partial<ProductSummary> & { categoryId?: number | null }) | null;
  anchorProducts?: ProductSignalRef[];
  activeCategoryId?: number | null;
  activeSearchQuery?: string | null;
  activeBrand?: string | null;
  activeScale?: string | null;
  maxBudgetVnd?: number | null;
  cartSubtotalVnd?: number | null;
  excludeProductIds?: Iterable<number>;
  profile?: UserAffinityProfile;
  cooccurrence?: CooccurrenceStats;
  config?: Partial<RecommendationConfig>;
  limit?: number;
}

const STOP_WORDS = new Set([
  'gundam',
  'model',
  'edition',
  'mô',
  'hình',
  'kit',
  'bandai',
  'gunpla',
  'the',
  'and',
  'for',
  'with',
  'ver',
]);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeText = (value?: string | null): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

export const extractTokens = (text?: string | null): string[] => {
  if (!text) return [];
  const raw = text
    .trim()
    .toLowerCase()
    .split(/[^\p{L}\p{N}/-]+/u)
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
  const normalized = raw.map((word) => normalizeText(word)).filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
  return [...new Set([...raw, ...normalized])].slice(0, 16);
};

export const modelFamilyKey = (
  product: Pick<ProductSummary, 'brandName'> & { modelCode?: string | null },
): string => {
  if ('modelFamilyId' in product && product.modelFamilyId) return `family:${product.modelFamilyId}`;
  const code = normalizeText(product.modelCode);
  return code ? `${normalizeText(product.brandName)}:${code}` : '';
};

// Effective price a customer pays for a product, considering available conditions and member price on shop items.
export const effectiveCustomerPrice = (
  product: Pick<ProductSummary, 'price' | 'salePrice'> & Partial<ProductSummary>,
): number => {
  const availableConditions = product.conditions?.filter((item) => item.stock > 0);
  const conditionMin = availableConditions?.length
    ? Math.min(...availableConditions.map((item) => item.minSalePrice))
    : undefined;
  const baseSale =
    conditionMin !== undefined && conditionMin > 0
      ? Math.min(product.salePrice > 0 ? product.salePrice : conditionMin, conditionMin)
      : product.salePrice > 0
        ? product.salePrice
        : product.price;
  return Math.max(0, baseSale);
};

export const hasPreownedInStock = (product: Partial<ProductSummary>): boolean => {
  if (product.condition && product.condition !== 'new' && (product.stock ?? 0) > 0) return true;
  return Boolean(product.conditions?.some((item) => item.condition !== 'new' && item.stock > 0));
};

export function sanitizeRecommendationConfig(raw?: unknown): RecommendationConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_RECOMMENDATION_CONFIG,
      weights: { ...DEFAULT_RECOMMENDATION_CONFIG.weights },
      surfaces: { ...DEFAULT_RECOMMENDATION_CONFIG.surfaces },
    };
  }
  const input = raw as Record<string, unknown>;
  const rawWeights = (input.weights && typeof input.weights === 'object' ? input.weights : {}) as Record<
    string,
    unknown
  >;
  const rawSurfaces = (input.surfaces && typeof input.surfaces === 'object' ? input.surfaces : {}) as Record<
    string,
    unknown
  >;
  const num = (val: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
  };
  return {
    defaultLimit: Math.round(num(input.defaultLimit, DEFAULT_RECOMMENDATION_CONFIG.defaultLimit, 1, 12)),
    enableFreeshipGapAddons: typeof input.enableFreeshipGapAddons === 'boolean' ? input.enableFreeshipGapAddons : true,
    freeshipThresholdVnd: Math.round(num(input.freeshipThresholdVnd, DEFAULT_RECOMMENDATION_CONFIG.freeshipThresholdVnd, 0, 100000000)),
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_RECOMMENDATION_CONFIG.enabled,
    weights: {
      relevance: num(rawWeights.relevance, DEFAULT_RECOMMENDATION_CONFIG.weights.relevance, 0, 100),
      preference: num(rawWeights.preference, DEFAULT_RECOMMENDATION_CONFIG.weights.preference, 0, 100),
      cooccurrence: num(rawWeights.cooccurrence, DEFAULT_RECOMMENDATION_CONFIG.weights.cooccurrence, 0, 100),
      popularity: num(rawWeights.popularity, DEFAULT_RECOMMENDATION_CONFIG.weights.popularity, 0, 100),
      business: num(rawWeights.business, DEFAULT_RECOMMENDATION_CONFIG.weights.business, 0, 100),
    },
    surfaces: {
      home: typeof rawSurfaces.home === 'boolean' ? rawSurfaces.home : DEFAULT_RECOMMENDATION_CONFIG.surfaces.home,
      productDetail:
        typeof rawSurfaces.productDetail === 'boolean'
          ? rawSurfaces.productDetail
          : DEFAULT_RECOMMENDATION_CONFIG.surfaces.productDetail,
      cart: typeof rawSurfaces.cart === 'boolean' ? rawSurfaces.cart : DEFAULT_RECOMMENDATION_CONFIG.surfaces.cart,
      catalog:
        typeof rawSurfaces.catalog === 'boolean' ? rawSurfaces.catalog : DEFAULT_RECOMMENDATION_CONFIG.surfaces.catalog,
      wishlist:
        typeof rawSurfaces.wishlist === 'boolean'
          ? rawSurfaces.wishlist
          : DEFAULT_RECOMMENDATION_CONFIG.surfaces.wishlist,
    },
    maxPerBrandScale: Math.round(
      num(input.maxPerBrandScale, DEFAULT_RECOMMENDATION_CONFIG.maxPerBrandScale, 1, 8),
    ),
    preferInStockPreowned:
      typeof input.preferInStockPreowned === 'boolean'
        ? input.preferInStockPreowned
        : DEFAULT_RECOMMENDATION_CONFIG.preferInStockPreowned,
    budgetRatio: Number(num(input.budgetRatio, DEFAULT_RECOMMENDATION_CONFIG.budgetRatio, 0.5, 0.95).toFixed(2)),
  };
}

// Time-decay factor: half-life ~14 days for browsing, ~45 days for orders.
const timeDecay = (ageDays = 0, halfLifeDays = 14): number => {
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  return Math.exp((-Math.LN2 * ageDays) / Math.max(1, halfLifeDays));
};

export function buildUserAffinityProfile(signals: BehaviorSignalsInput = {}): UserAffinityProfile {
  const categoryWeights: Record<number, number> = {};
  const brandWeights: Record<string, number> = {};
  const scaleWeights: Record<string, number> = {};
  const conditionWeights: Record<string, number> = {};
  const assemblyWeights: Record<string, number> = {};
  const keywordWeights: Record<string, number> = {};

  const purchasedProductIds = new Set<number>();
  const wishlistProductIds = new Set<number>();
  const cartProductIds = new Set<number>();
  const viewedProductIds = new Set<number>();
  const recentOrderedIds: number[] = [];
  const priceSamples: { price: number; weight: number }[] = [];

  let totalSignalScore = 0;

  const addWeight = <K extends string | number>(map: Record<K, number>, key: K | null | undefined, amount: number) => {
    if (key === null || key === undefined || key === '' || amount <= 0) return;
    map[key] = (map[key] ?? 0) + amount;
  };

  const ingestProduct = (item: ProductSignalRef, baseWeight: number, halfLifeDays: number) => {
    if (!item || !Number.isSafeInteger(item.id) || item.id <= 0) return;
    const decay = timeDecay(item.ageDays ?? 0, halfLifeDays);
    const dwellBoost =
      item.dwellMs && item.dwellMs > 0 ? Math.min(2.0, Math.max(0, item.dwellMs) / 15_000) : 0;
    const w = (item.weight ?? baseWeight + dwellBoost) * decay;
    if (w <= 0) return;

    totalSignalScore += w;
    if (!recentOrderedIds.includes(item.id)) recentOrderedIds.push(item.id);

    if (item.categoryId && item.categoryId > 0) addWeight(categoryWeights, item.categoryId, w);
    const brand = normalizeText(item.brandName);
    if (brand) addWeight(brandWeights, brand, w);
    if (item.scale) addWeight(scaleWeights, item.scale.trim(), w);
    if (item.condition) addWeight(conditionWeights, item.condition.trim(), w * 0.7);
    if (item.assemblyState) addWeight(assemblyWeights, item.assemblyState.trim(), w * 0.6);

    for (const token of extractTokens(item.name)) {
      addWeight(keywordWeights, token, w * 0.6);
    }
    if (item.modelCode) {
      for (const token of extractTokens(item.modelCode)) {
        addWeight(keywordWeights, token, w * 0.8);
      }
    }
    if (item.priceVnd && item.priceVnd > 0) {
      priceSamples.push({ price: item.priceVnd, weight: w });
    }
  };

  for (const item of signals.cartProducts ?? []) {
    cartProductIds.add(item.id);
    ingestProduct(item, 4.8, 7);
  }
  for (const item of signals.wishlistProducts ?? []) {
    wishlistProductIds.add(item.id);
    ingestProduct(item, 4.0, 30);
  }
  for (const item of signals.purchasedProducts ?? []) {
    purchasedProductIds.add(item.id);
    ingestProduct(item, 5.0, 60);
  }
  for (const item of signals.viewedProducts ?? []) {
    viewedProductIds.add(item.id);
    ingestProduct(item, 1.8, 14);
  }

  for (const entry of signals.searchQueries ?? []) {
    const tokens = extractTokens(entry.query);
    if (!tokens.length) continue;
    const w = 2.6 * timeDecay(entry.ageDays ?? 0, 7);
    totalSignalScore += w;
    for (const token of tokens) {
      addWeight(keywordWeights, token, w);
    }
  }

  for (const entry of signals.categoryViews ?? []) {
    if (!entry.categoryId || entry.categoryId <= 0) continue;
    const w = 1.6 * timeDecay(entry.ageDays ?? 0, 10);
    totalSignalScore += w;
    addWeight(categoryWeights, entry.categoryId, w);
  }

  // Compute habitual price profile (weighted median & range)
  let minVnd = 0;
  let maxVnd = 0;
  let preferredVnd = 0;
  let hasPriceSignal = false;

  if (priceSamples.length > 0) {
    hasPriceSignal = true;
    const sorted = [...priceSamples].sort((a, b) => a.price - b.price);
    const totalWeight = sorted.reduce((sum, sample) => sum + sample.weight, 0);
    let cumulative = 0;
    let p20 = sorted[0].price;
    let p50 = sorted[Math.floor(sorted.length / 2)].price;
    let p85 = sorted[sorted.length - 1].price;
    for (const sample of sorted) {
      cumulative += sample.weight;
      const ratio = cumulative / Math.max(1e-6, totalWeight);
      if (ratio >= 0.2 && p20 === sorted[0].price) p20 = sample.price;
      if (ratio >= 0.5 && p50 === sorted[Math.floor(sorted.length / 2)].price) p50 = sample.price;
      if (ratio >= 0.85) {
        p85 = sample.price;
        break;
      }
    }
    preferredVnd = Math.round(p50);
    minVnd = Math.round(Math.min(p20, preferredVnd * 0.6));
    maxVnd = Math.round(Math.max(p85, preferredVnd * 1.45));
  }

  if (signals.budgetFilter?.maxPriceVnd && signals.budgetFilter.maxPriceVnd > 0) {
    maxVnd = signals.budgetFilter.maxPriceVnd;
    if (!preferredVnd || preferredVnd > maxVnd) preferredVnd = Math.round(maxVnd * 0.75);
    hasPriceSignal = true;
    totalSignalScore += 1.5;
  }
  if (signals.budgetFilter?.minPriceVnd && signals.budgetFilter.minPriceVnd > 0) {
    minVnd = signals.budgetFilter.minPriceVnd;
    if (!preferredVnd || preferredVnd < minVnd) preferredVnd = minVnd;
    hasPriceSignal = true;
  }

  return {
    categoryWeights,
    brandWeights,
    scaleWeights,
    conditionWeights,
    assemblyWeights,
    keywordWeights,
    purchasedProductIds,
    wishlistProductIds,
    cartProductIds,
    viewedProductIds,
    recentOrderedIds: recentOrderedIds.slice(0, 20),
    priceProfile: {
      minVnd,
      maxVnd,
      preferredVnd,
      hasSignal: hasPriceSignal,
    },
    totalSignalScore,
    isColdStart: totalSignalScore < 1.5,
  };
}

const maxMapValue = (map: Record<string | number, number>): number => {
  const values = Object.values(map);
  return values.length ? Math.max(...values, 1) : 1;
};

// Next freeship tier gap for a shop cart subtotal
export const nextFreeshipGap = (cartSubtotalVnd?: number | null): number | null => {
  if (cartSubtotalVnd === undefined || cartSubtotalVnd === null || cartSubtotalVnd <= 0) return null;
  const sortedTiers = [...FREESHIP_TIERS].sort((a, b) => a.minOrderVnd - b.minOrderVnd);
  const nextTier = sortedTiers.find((tier) => tier.minOrderVnd > cartSubtotalVnd);
  if (!nextTier) return null;
  return nextTier.minOrderVnd - cartSubtotalVnd;
};

/**
 * Multi-strategy smart product recommendation scorer & ranker.
 * Deterministic, fast, explainable, and safe against sparse/cold-start inputs.
 */
export function rankSmartRecommendations<T extends ProductSummary>(
  candidates: T[],
  context: RankSmartContext,
): SmartRecommendationItem<T>[] {
  const config = sanitizeRecommendationConfig(context.config);
  if (!config.enabled) return [];

  const limit = clamp(Math.round(context.limit ?? 4), 1, 12);
  const strategy = context.strategy;
  const source = context.sourceProduct ?? null;
  const profile = context.profile ?? buildUserAffinityProfile();
  const cooccurrence = context.cooccurrence ?? {};

  const sourceCategoryId = source?.category?.id ?? source?.categoryId ?? context.activeCategoryId ?? null;
  const sourceBrand = normalizeText(source?.brandName ?? context.activeBrand);
  const sourceScale = (source?.scale ?? context.activeScale ?? '').trim();
  const sourcePrice = source ? effectiveCustomerPrice(source) : profile.priceProfile.preferredVnd;
  const sourceTokens = new Set([
    ...extractTokens(source?.name),
    ...extractTokens(source?.modelCode),
    ...extractTokens(context.activeSearchQuery),
  ]);
  const searchTokens = new Set(extractTokens(context.activeSearchQuery));

  // Anchor tokens & categories from cart or recently viewed items
  const anchorCategories = new Set<number>();
  const anchorBrands = new Set<string>();
  const anchorScales = new Set<string>();
  for (const anchor of context.anchorProducts ?? []) {
    if (anchor.categoryId) anchorCategories.add(anchor.categoryId);
    if (anchor.brandName) anchorBrands.add(normalizeText(anchor.brandName));
    if (anchor.scale) anchorScales.add(anchor.scale.trim());
    for (const token of extractTokens(anchor.name)) sourceTokens.add(token);
  }

  const excludedIds = new Set<number>(context.excludeProductIds ?? []);
  if (source?.id) excludedIds.add(source.id);
  for (const cartId of profile.cartProductIds) excludedIds.add(cartId);

  const seenFamilies = new Set<string>();
  if (source) {
    const srcFamily = modelFamilyKey(source);
    if (srcFamily) seenFamilies.add(srcFamily);
  }
  for (const anchor of context.anchorProducts ?? []) {
    if (anchor.brandName && anchor.modelCode) {
      seenFamilies.add(`${normalizeText(anchor.brandName)}:${normalizeText(anchor.modelCode)}`);
    }
  }

  const maxCatWeight = maxMapValue(profile.categoryWeights);
  const maxBrandWeight = maxMapValue(profile.brandWeights);
  const maxScaleWeight = maxMapValue(profile.scaleWeights);
  const maxKeywordWeight = maxMapValue(profile.keywordWeights);
  const maxCoPurchase = maxMapValue(cooccurrence.coPurchases ?? {});
  const maxCoView = maxMapValue(cooccurrence.coViews ?? {});
  const maxRecentViews = maxMapValue(cooccurrence.recentViews ?? {});

  const freeshipGap = config.enableFreeshipGapAddons ? nextFreeshipGap(context.cartSubtotalVnd) : null;
  const budgetCeiling =
    context.maxBudgetVnd && context.maxBudgetVnd > 0
      ? context.maxBudgetVnd
      : sourcePrice > 0
        ? Math.round(sourcePrice * config.budgetRatio)
        : profile.priceProfile.maxVnd > 0
          ? profile.priceProfile.maxVnd
          : null;

  // Adjust strategy-specific weight multipliers on top of admin config weights
  const strategyMultipliers: Record<RecommendationStrategy, RecommendationWeights> = {
    for_you: { relevance: 0.9, preference: 1.6, cooccurrence: 1.2, popularity: 1.0, business: 1.0 },
    similar: { relevance: 1.8, preference: 0.6, cooccurrence: 0.8, popularity: 0.6, business: 0.8 },
    related: { relevance: 1.3, preference: 1.0, cooccurrence: 1.2, popularity: 0.9, business: 1.0 },
    bought_together: { relevance: 1.1, preference: 0.8, cooccurrence: 2.2, popularity: 0.9, business: 1.0 },
    trending: { relevance: 0.7, preference: 0.7, cooccurrence: 0.8, popularity: 2.2, business: 1.2 },
    budget_alternative: { relevance: 1.4, preference: 0.9, cooccurrence: 0.6, popularity: 0.8, business: 1.5 },
    cart_addon: { relevance: 1.2, preference: 1.0, cooccurrence: 1.6, popularity: 1.0, business: 1.8 },
  };
  const mult = strategyMultipliers[strategy];
  const rawW = {
    relevance: config.weights.relevance * mult.relevance,
    preference: config.weights.preference * mult.preference,
    cooccurrence: config.weights.cooccurrence * mult.cooccurrence,
    popularity: config.weights.popularity * mult.popularity,
    business: config.weights.business * mult.business,
  };
  const weightSum = Math.max(
    1,
    rawW.relevance + rawW.preference + rawW.cooccurrence + rawW.popularity + rawW.business,
  );

  const scoredCandidates: {
    product: T;
    score: number;
    reason: SmartRecommendationReason;
    priceSavingVnd?: number;
    freeshipGapVnd?: number;
    breakdown: ScoreBreakdown;
    brandScaleKey: string;
  }[] = [];

  for (const product of candidates) {
    const groupStock = product.groupStock ?? product.stock ?? 0;
    if (groupStock <= 0) continue;
    if (excludedIds.has(product.id)) continue;

    const candidatePrice = effectiveCustomerPrice(product);
    if (candidatePrice <= 0 && (sourcePrice > 0 || strategy === 'budget_alternative')) continue;

    // Strategy-specific hard filters
    if (strategy === 'budget_alternative') {
      // Must either be strictly cheaper than the reference/ceiling OR offer an in-stock pre-owned option below list price
      const preownedOption = hasPreownedInStock(product) && candidatePrice < product.price;
      if (budgetCeiling && candidatePrice > budgetCeiling && !preownedOption) {
        continue;
      }
      if (sourcePrice > 0 && candidatePrice >= sourcePrice && !preownedOption) {
        continue;
      }
    }

    const candCatId = product.category?.id ?? null;
    const candBrand = normalizeText(product.brandName);
    const candScale = (product.scale ?? '').trim();
    const candTokens = extractTokens(product.name);
    const candCodeTokens = extractTokens(product.modelCode);
    const allCandTokens = [...new Set([...candTokens, ...candCodeTokens])];

    // 1. Contextual Relevance Score (0..100)
    const sameCategory =
      (sourceCategoryId !== null && candCatId === sourceCategoryId) ||
      (candCatId !== null && anchorCategories.has(candCatId));
    const sameBrand =
      (Boolean(sourceBrand) && candBrand === sourceBrand) || (Boolean(candBrand) && anchorBrands.has(candBrand));
    const sameScale =
      (Boolean(sourceScale) && candScale === sourceScale) || (Boolean(candScale) && anchorScales.has(candScale));
    const sameAssembly = Boolean(source?.assemblyState && source.assemblyState === product.assemblyState);

    const tokenMatches = allCandTokens.filter((token) => sourceTokens.has(token)).length;
    const searchMatchCount = allCandTokens.filter((token) => searchTokens.has(token)).length;
    const tokenOverlap =
      sourceTokens.size > 0
        ? tokenMatches / Math.max(1, Math.min(sourceTokens.size, Math.max(1, allCandTokens.length)))
        : 0;

    const priceDistance =
      sourcePrice > 0 && candidatePrice > 0 ? Math.abs(Math.log(candidatePrice / sourcePrice)) : 0.6;
    const priceProximity = sourcePrice > 0 && candidatePrice > 0 ? Math.max(0, 1 - priceDistance) : 0.4;

    let relevanceScore =
      (sameCategory ? 36 : 0) +
      (sameBrand ? 24 : 0) +
      (sameScale ? 16 : 0) +
      clamp(tokenOverlap * 22, 0, 22) +
      priceProximity * 14 +
      (sameAssembly ? 4 : 0);

    // For 'related' strategy, slightly reward complementary scales or adjacent lines within the same universe/category
    if (strategy === 'related' && sameCategory && sameBrand && !sameScale && candScale) {
      relevanceScore += 10;
    }
    relevanceScore = clamp(relevanceScore, 0, 100);

    // 2. Personal Preference Score (0..100)
    let preferenceScore = 0;
    const catAffinity = candCatId ? (profile.categoryWeights[candCatId] ?? 0) / maxCatWeight : 0;
    const brandAffinity = candBrand ? (profile.brandWeights[candBrand] ?? 0) / maxBrandWeight : 0;
    const scaleAffinity = candScale ? (profile.scaleWeights[candScale] ?? 0) / maxScaleWeight : 0;
    let kwAffinity = 0;
    for (const token of allCandTokens) {
      kwAffinity += (profile.keywordWeights[token] ?? 0) / maxKeywordWeight;
    }
    kwAffinity = clamp(kwAffinity, 0, 1.5);

    let priceBandFit = 0.5;
    if (profile.priceProfile.hasSignal && candidatePrice > 0) {
      const { minVnd, maxVnd, preferredVnd } = profile.priceProfile;
      if (candidatePrice >= minVnd && candidatePrice <= maxVnd) {
        priceBandFit = 1.0;
      } else if (preferredVnd > 0) {
        priceBandFit = Math.max(0, 1 - Math.abs(Math.log(candidatePrice / preferredVnd)));
      }
    }

    const preownedBoost =
      hasPreownedInStock(product) && (profile.conditionWeights.preowned ?? 0) > 0 ? 10 : 0;

    if (!profile.isColdStart) {
      preferenceScore = clamp(
        catAffinity * 32 +
          brandAffinity * 28 +
          scaleAffinity * 16 +
          kwAffinity * 18 +
          priceBandFit * 14 +
          preownedBoost,
        0,
        100,
      );
    } else {
      // Cold-start fallback blends contextual relevance & price comfort
      preferenceScore = clamp(relevanceScore * 0.6 + priceBandFit * 25, 0, 100);
    }

    // 3. Co-occurrence Score (Co-purchase & Co-view Lift, 0..100)
    const coPurchaseCount = cooccurrence.coPurchases?.[product.id] ?? 0;
    const coViewCount = cooccurrence.coViews?.[product.id] ?? 0;
    const coPurchaseNorm = coPurchaseCount > 0 ? Math.min(1, coPurchaseCount / maxCoPurchase) : 0;
    const coViewNorm = coViewCount > 0 ? Math.min(1, coViewCount / maxCoView) : 0;
    // Smooth with contextual complementarity when historical co-occurrence is sparse
    const complementaritySmoothing = (sameCategory ? 0.35 : 0) + (sameBrand ? 0.25 : 0) + (sameScale ? 0.2 : 0);
    const cooccurrenceScore = clamp(
      coPurchaseNorm * 65 + coViewNorm * 35 + (coPurchaseCount === 0 && coViewCount === 0 ? complementaritySmoothing * 45 : 0),
      0,
      100,
    );

    // 4. Popularity & Velocity Score (0..100)
    const sold = Math.max(0, product.sold ?? 0);
    const recentViews = cooccurrence.recentViews?.[product.id] ?? 0;
    const recentCarts = cooccurrence.recentCarts?.[product.id] ?? 0;
    const recentOrders = cooccurrence.recentOrders?.[product.id] ?? 0;
    const rating = clamp(product.rating ?? 0, 0, 5);
    const reviewCount = Math.max(0, product.reviewCount ?? 0);

    const soldScore = Math.min(45, Math.log1p(sold) * 10);
    const velocityScore = Math.min(
      35,
      (recentViews / Math.max(1, maxRecentViews)) * 15 + Math.log1p(recentCarts * 2 + recentOrders * 4) * 8,
    );
    const ratingScore = reviewCount > 0 ? (rating / 5) * Math.min(20, 8 + Math.log1p(reviewCount) * 5) : 6;
    const popularityScore = clamp(soldScore + velocityScore + ratingScore, 0, 100);

    // 5. Business, Stock & Margin Score (0..100)
    let businessScore = 30;
    // Healthy stock availability
    if (groupStock >= 5) businessScore += 20;
    else if (groupStock >= 2) businessScore += 12;
    else businessScore += 5;

    // Shop-owned catalog items have verified 3-price margin rules
    if (!product.partnerId) businessScore += 15;
    if (product.isFeatured) businessScore += 10;
    if ((product.discountPercent ?? 0) > 0 && product.salePrice < product.price) {
      businessScore += Math.min(18, (product.discountPercent ?? 0) * 0.8);
    }
    if (config.preferInStockPreowned && hasPreownedInStock(product)) {
      businessScore += 12;
    }

    // Budget alternative bonus: reward meaningful savings while keeping high similarity
    let priceSavingVnd: number | undefined;
    if (sourcePrice > 0 && candidatePrice < sourcePrice) {
      priceSavingVnd = sourcePrice - candidatePrice;
      if (strategy === 'budget_alternative') {
        const savingRatio = clamp(priceSavingVnd / sourcePrice, 0.05, 0.65);
        businessScore += savingRatio * 45;
      }
    } else if (candidatePrice < product.price) {
      priceSavingVnd = product.price - candidatePrice;
    }

    // Cart add-on freeship threshold synergy
    let freeshipGapVnd: number | undefined;
    if (freeshipGap && freeshipGap > 0 && !product.partnerId) {
      if (candidatePrice >= freeshipGap && candidatePrice <= freeshipGap * 2.2) {
        businessScore += 30;
        freeshipGapVnd = freeshipGap;
      } else if (candidatePrice >= freeshipGap * 0.5 && candidatePrice < freeshipGap) {
        businessScore += 15;
        freeshipGapVnd = freeshipGap;
      }
    }
    businessScore = clamp(businessScore, 0, 100);

    // Penalties: already purchased single-build models get a soft demotion unless on 'bought_together' consumables
    let penalty = 0;
    if (profile.purchasedProductIds.has(product.id)) {
      penalty += 25;
    }
    if (profile.viewedProductIds.has(product.id) && strategy === 'for_you') {
      // Slight novelty boost for unseen items while still allowing high-intent re-engagement
      penalty += 3;
    }

    const totalScore =
      (rawW.relevance * relevanceScore +
        rawW.preference * preferenceScore +
        rawW.cooccurrence * cooccurrenceScore +
        rawW.popularity * popularityScore +
        rawW.business * businessScore) /
        weightSum -
      penalty;

    // Determine primary explainable reason badge
    let reason: SmartRecommendationReason = 'discover';
    if (strategy === 'cart_addon' && freeshipGapVnd) {
      reason = 'freeship_completer';
    } else if (coPurchaseCount > 0) {
      reason = 'bought_together';
    } else if (coViewCount > 0 && (strategy === 'bought_together' || strategy === 'for_you')) {
      reason = 'viewed_together';
    } else if (strategy === 'budget_alternative') {
      reason = hasPreownedInStock(product) && product.stock <= 0 ? 'preowned_deal' : 'budget_friendly';
    } else if (searchMatchCount > 0 && context.activeSearchQuery) {
      reason = 'search_match';
    } else if (
      !profile.isColdStart &&
      strategy === 'for_you' &&
      (brandAffinity >= 0.5 || catAffinity >= 0.5 || scaleAffinity >= 0.5)
    ) {
      reason = 'personalized_affinity';
    } else if (strategy === 'trending' && (sold >= 3 || recentViews >= 2 || product.isFeatured)) {
      reason = 'trending_now';
    } else if (sameCategory) {
      reason = 'category';
    } else if (sameBrand) {
      reason = 'brand';
    } else if (sameScale) {
      reason = 'scale';
    } else if (priceDistance < 0.3) {
      reason = 'price';
    }

    scoredCandidates.push({
      product,
      score: Number(totalScore.toFixed(2)),
      reason,
      ...(priceSavingVnd && priceSavingVnd > 0 ? { priceSavingVnd } : {}),
      ...(freeshipGapVnd && freeshipGapVnd > 0 ? { freeshipGapVnd } : {}),
      breakdown: {
        relevance: Math.round(relevanceScore),
        preference: Math.round(preferenceScore),
        cooccurrence: Math.round(cooccurrenceScore),
        popularity: Math.round(popularityScore),
        business: Math.round(businessScore),
      },
      brandScaleKey: `${candBrand || 'other'}:${candScale || 'any'}`,
    });
  }

  // Sort deterministically by score DESC, then id ASC
  scoredCandidates.sort((a, b) => {
    if (strategy === 'bought_together') {
      const tier = (item: typeof a) => (cooccurrence.coPurchases?.[item.product.id] ?? 0) > 0 ? 2 : (cooccurrence.coViews?.[item.product.id] ?? 0) > 0 ? 1 : 0;
      const evidence = tier(b) - tier(a);
      if (evidence) return evidence;
    }
    return b.score - a.score || a.product.id - b.product.id;
  });

  // Apply family deduplication and brand+scale diversity cap (with backfill if pool is small)
  const selected: SmartRecommendationItem<T>[] = [];
  const deferred: typeof scoredCandidates = [];
  const brandScaleCounts = new Map<string, number>();

  for (const item of scoredCandidates) {
    const fam = modelFamilyKey(item.product);
    if (excludedIds.has(item.product.id) || (fam && seenFamilies.has(fam))) continue;

    const currentClusterCount = brandScaleCounts.get(item.brandScaleKey) ?? 0;
    // Diversity cap applies primarily to discovery/personalized rails so one brand+scale doesn't monopolize all slots
    const enforceDiversity = strategy === 'for_you' || strategy === 'trending' || strategy === 'related';
    if (enforceDiversity && currentClusterCount >= config.maxPerBrandScale) {
      deferred.push(item);
      continue;
    }

    excludedIds.add(item.product.id);
    if (fam) seenFamilies.add(fam);
    brandScaleCounts.set(item.brandScaleKey, currentClusterCount + 1);
    selected.push({
      product: item.product,
      reason: item.reason,
      strategy,
      score: item.score,
      ...(item.priceSavingVnd ? { priceSavingVnd: item.priceSavingVnd } : {}),
      ...(item.freeshipGapVnd ? { freeshipGapVnd: item.freeshipGapVnd } : {}),
      savingsVnd: item.priceSavingVnd,
      hasPreownedOption: hasPreownedInStock(item.product),
      breakdown: item.breakdown,
    });
    if (selected.length >= limit) break;
  }

  // Backfill from deferred if strict diversity left slots unfilled
  if (selected.length < limit && deferred.length > 0) {
    for (const item of deferred) {
      const fam = modelFamilyKey(item.product);
      if (excludedIds.has(item.product.id) || (fam && seenFamilies.has(fam))) continue;
      excludedIds.add(item.product.id);
      if (fam) seenFamilies.add(fam);
      selected.push({
        product: item.product,
        reason: item.reason,
        strategy,
        score: item.score,
        ...(item.priceSavingVnd ? { priceSavingVnd: item.priceSavingVnd } : {}),
        ...(item.freeshipGapVnd ? { freeshipGapVnd: item.freeshipGapVnd } : {}),
        savingsVnd: item.priceSavingVnd,
      hasPreownedOption: hasPreownedInStock(item.product),
      breakdown: item.breakdown,
      });
      if (selected.length >= limit) break;
    }
  }

  return selected;
}

export function buildSurfaceRecommendationSections<T extends ProductSummary>(
  surface: RecommendationSurface,
  candidates: T[],
  baseContext: Omit<RankSmartContext, 'strategy'>,
): SmartRecommendationSection<T>[] {
  const strategiesBySurface: Record<RecommendationSurface, RecommendationStrategy[]> = {
    product_detail: ['similar', 'related', 'bought_together', 'budget_alternative', 'for_you'],
    home: ['for_you', 'trending', 'budget_alternative', 'bought_together'],
    cart: ['cart_addon', 'bought_together', 'budget_alternative', 'for_you'],
    catalog: ['for_you', 'trending', 'related', 'budget_alternative'],
    wishlist: ['for_you', 'similar', 'budget_alternative', 'bought_together'],
  };

  const strategies = strategiesBySurface[surface] ?? ['for_you', 'trending'];
  const sections: SmartRecommendationSection<T>[] = [];

  for (const strategy of strategies) {
    const items = rankSmartRecommendations(candidates, {
      ...baseContext,
      strategy,
    });
    if (items.length > 0) {
      sections.push({ strategy, items });
    }
  }

  return sections;
}


export type RecommendationSection = SmartRecommendationSection;
export type SmartRecommendedProduct = SmartRecommendationItem;
