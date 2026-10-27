import { LRUCache } from 'lru-cache';
import { Op } from 'sequelize';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  RECOMMENDATION_EVENT_TYPES,
  RECOMMENDATION_STRATEGIES,
  RECOMMENDATION_SURFACES,
  buildSurfaceRecommendationSections,
  buildUserAffinityProfile,
  effectiveCustomerPrice as effectivePrice,
  rankSmartRecommendations,
  sanitizeRecommendationConfig,
  type ProductSignalRef as AffinityProductSignal,
  type RecommendationConfig,
  type RecommendationEventType,
  type SmartRecommendationSection as RecommendationSection,
  type RecommendationStrategy,
  type RecommendationSurface,
  type SmartRecommendationItem as SmartRecommendedProduct,
  type UserAffinityProfile,
} from '../../../shared/smart-recommendations';
import type { ProductDetail, ProductSummary } from '../../../shared/types/product';
import HttpError from '../../../shared/server/utils/HttpError';
import { asTrimmedString, toInteger } from '../../../shared/server/utils/ValidationUtils';
import ConfigModel from '../database/internal/models/Config.Model';
import CategoryModel from '../database/client/models/Category.Model';
import OrderModel from '../database/client/models/Order.Model';
import OrderItemModel from '../database/client/models/OrderItem.Model';
import ProductModel from '../database/client/models/Product.Model';
import PromotionAuditModel from '../database/client/models/PromotionAudit.Model';
import RecommendationEventModel from '../database/client/models/RecommendationEvent.Model';
import WishlistItemModel from '../database/client/models/WishlistItem.Model';
import ProductService from './ProductService';

export const RECOMMENDATION_CONFIG_KEY = 'recommendation.config.v1';

export interface SmartRecommendationQuery {
  surface?: string;
  strategy?: string;
  productId?: number | string;
  sessionKey?: string;
  recentIds?: number[];
  recentQueries?: string[];
  cartProductIds?: number[];
  cartSubtotalVnd?: number;
  category?: string;
  categoryId?: number;
  q?: string;
  maxPrice?: number;
  limit?: number;
}

export interface SmartRecommendationResponse {
  surface: RecommendationSurface;
  strategy: RecommendationStrategy;
  isColdStart: boolean;
  enabled: boolean;
  profileSummary: {
    topBrands: string[];
    topScales: string[];
    topCategories: string[];
    preferredPriceBand: { min: number; median: number; max: number } | null;
    signalCount: number;
  };
  items: SmartRecommendedProduct[];
  sections: RecommendationSection[];
}

export interface RecordRecommendationEventInput {
  sessionKey?: unknown;
  eventType?: unknown;
  productId?: unknown;
  sourceProductId?: unknown;
  categoryId?: unknown;
  categorySlug?: unknown;
  searchQuery?: unknown;
  strategy?: unknown;
  surface?: unknown;
  dwellMs?: unknown;
  priceVnd?: unknown;
  metadata?: unknown;
}

export interface RecommendationAdminAnalytics {
  windowDays: number;
  config: RecommendationConfig;
  totals: {
    impressions: number;
    clicks: number;
    addToCarts: number;
    ctrPercent: number;
    addToCartRatePercent: number;
    behaviorSignals: number;
    uniqueSessions: number;
  };
  byStrategy: Array<{
    strategy: RecommendationStrategy;
    impressions: number;
    clicks: number;
    addToCarts: number;
    ctrPercent: number;
    conversionPercent: number;
  }>;
  bySurface: Array<{
    surface: RecommendationSurface;
    impressions: number;
    clicks: number;
    addToCarts: number;
    ctrPercent: number;
  }>;
  topProducts: Array<{
    productId: number;
    name: string;
    slug: string;
    brandName: string | null;
    scale: string | null;
    price: number;
    stock: number;
    impressions: number;
    clicks: number;
    addToCarts: number;
    ctrPercent: number;
  }>;
  topSearchQueries: Array<{
    query: string;
    count: number;
  }>;
}

const dedupeCache = new LRUCache<string, number>({
  max: 2000,
  ttl: 5_000,
});

const trendingCache = new LRUCache<string, Record<number, number>>({
  max: 10,
  ttl: 30_000,
});

const parseIdList = (input: unknown, maxItems = 24): number[] => {
  if (Array.isArray(input)) {
    return [...new Set(input.map((v) => toInteger(v)).filter((v): v is number => v != null && v > 0))].slice(0, maxItems);
  }
  if (typeof input === 'string' && input.trim()) {
    return [
      ...new Set(
        input
          .split(',')
          .map((part) => toInteger(part.trim()))
          .filter((v): v is number => v != null && v > 0),
      ),
    ].slice(0, maxItems);
  }
  return [];
};

const parseQueryList = (input: unknown, maxItems = 10): string[] => {
  if (Array.isArray(input)) {
    return [...new Set(input.map((v) => asTrimmedString(v)).filter(Boolean))].slice(0, maxItems);
  }
  if (typeof input === 'string' && input.trim()) {
    return [
      ...new Set(
        input
          .split('|')
          .map((part) => asTrimmedString(part))
          .filter(Boolean),
      ),
    ].slice(0, maxItems);
  }
  return [];
};

const sanitizeSessionKey = (raw: unknown): string => {
  const value = asTrimmedString(raw).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return value || 'anon-session';
};

const validSurface = (value: unknown): RecommendationSurface => {
  const str = asTrimmedString(value) as RecommendationSurface;
  return RECOMMENDATION_SURFACES.includes(str) ? str : 'home';
};

const validStrategy = (value: unknown, surface: RecommendationSurface): RecommendationStrategy => {
  const str = asTrimmedString(value) as RecommendationStrategy;
  if (RECOMMENDATION_STRATEGIES.includes(str)) return str;
  switch (surface) {
    case 'product_detail':
      return 'similar';
    case 'cart':
      return 'cart_addon';
    case 'wishlist':
      return 'for_you';
    case 'catalog':
      return 'for_you';
    case 'home':
    default:
      return 'for_you';
  }
};

export default class RecommendationService {
  private productService = new ProductService();

  static clearCache() {
    dedupeCache.clear();
    trendingCache.clear();
  }

  async getConfig(): Promise<RecommendationConfig> {
    const row = await ConfigModel.findOne({ where: { configKey: RECOMMENDATION_CONFIG_KEY } });
    if (!row || !row.configValue) {
      return { ...DEFAULT_RECOMMENDATION_CONFIG, weights: { ...DEFAULT_RECOMMENDATION_CONFIG.weights } };
    }
    try {
      const parsed = JSON.parse(row.configValue);
      return sanitizeRecommendationConfig(parsed);
    } catch {
      return { ...DEFAULT_RECOMMENDATION_CONFIG, weights: { ...DEFAULT_RECOMMENDATION_CONFIG.weights } };
    }
  }

  async updateConfig(patch: unknown, actorUserId: number | null = null): Promise<RecommendationConfig> {
    const previous = await this.getConfig();
    const mergedInput =
      patch && typeof patch === 'object'
        ? {
            ...previous,
            ...(patch as Record<string, unknown>),
            weights: {
              ...previous.weights,
              ...((patch as { weights?: Record<string, unknown> }).weights ?? {}),
            },
          }
        : previous;
    const next = sanitizeRecommendationConfig(mergedInput);
    const serialized = JSON.stringify(next);

    const existing = await ConfigModel.findOne({ where: { configKey: RECOMMENDATION_CONFIG_KEY } });
    if (existing) {
      await existing.update({ configValue: serialized });
    } else {
      await ConfigModel.create({
        configKey: RECOMMENDATION_CONFIG_KEY,
        configValue: serialized,
      });
    }

    await PromotionAuditModel.create({
      actorUserId,
      entityType: 'recommendation_config',
      entityId: existing?.id ?? 1,
      action: 'update_config',
      oldValue: previous as unknown as Record<string, unknown>,
      newValue: next as unknown as Record<string, unknown>,
    });

    RecommendationService.clearCache();
    return next;
  }

  private async resolveMainProductId(rawId: unknown): Promise<{ id: number; categoryId: number | null; price: number } | null> {
    const parsed = toInteger(rawId);
    if (!parsed || parsed <= 0) return null;
    const product = await ProductModel.findByPk(parsed, {
      attributes: ['id', 'parentProductId', 'categoryId', 'price'],
    });
    if (!product) return null;
    if (product.parentProductId) {
      const parent = await ProductModel.findByPk(product.parentProductId, {
        attributes: ['id', 'categoryId', 'price'],
      });
      if (parent) {
        return { id: parent.id, categoryId: parent.categoryId ?? null, price: parent.price };
      }
    }
    return { id: product.id, categoryId: product.categoryId ?? null, price: product.price };
  }

  async recordEvent(input: RecordRecommendationEventInput, userId: number | null = null) {
    const eventType = asTrimmedString(input.eventType) as RecommendationEventType;
    if (!RECOMMENDATION_EVENT_TYPES.includes(eventType)) {
      throw HttpError.badRequest('Loại sự kiện gợi ý không hợp lệ.');
    }

    const sessionKey = sanitizeSessionKey(input.sessionKey);
    const resolvedProduct = await this.resolveMainProductId(input.productId);
    const resolvedSource = await this.resolveMainProductId(input.sourceProductId);

    let categoryId = toInteger(input.categoryId);
    if (!categoryId && input.categorySlug) {
      const slug = asTrimmedString(input.categorySlug);
      if (slug) {
        const category = await CategoryModel.findOne({ where: { slug }, attributes: ['id'] });
        if (category) categoryId = category.id;
      }
    }
    if (!categoryId && resolvedProduct?.categoryId) {
      categoryId = resolvedProduct.categoryId;
    }

    const searchQuery = asTrimmedString(input.searchQuery).slice(0, 120) || null;
    const strategyRaw = asTrimmedString(input.strategy);
    const strategy = RECOMMENDATION_STRATEGIES.includes(strategyRaw as RecommendationStrategy) ? strategyRaw : null;
    const surfaceRaw = asTrimmedString(input.surface);
    const surface = RECOMMENDATION_SURFACES.includes(surfaceRaw as RecommendationSurface) ? surfaceRaw : null;

    const rawDwell = toInteger(input.dwellMs);
    const dwellMs = rawDwell != null && rawDwell >= 0 ? Math.min(600_000, rawDwell) : null;

    const rawPrice = toInteger(input.priceVnd);
    const priceVnd =
      rawPrice != null && rawPrice > 0
        ? Math.min(500_000_000, rawPrice)
        : resolvedProduct?.price ?? null;

    let metadata: Record<string, unknown> | null = null;
    if (input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)) {
      const entries = Object.entries(input.metadata as Record<string, unknown>).slice(0, 12);
      metadata = Object.fromEntries(
        entries.map(([k, v]) => [
          String(k).slice(0, 40),
          typeof v === 'string' ? v.slice(0, 160) : typeof v === 'number' || typeof v === 'boolean' ? v : null,
        ]),
      );
    }

    // Deduplicate rapid identical telemetry bursts within 5 seconds per session.
    const dedupeKey = `${sessionKey}:${userId ?? 0}:${eventType}:${resolvedProduct?.id ?? 0}:${resolvedSource?.id ?? 0}:${strategy ?? ''}:${surface ?? ''}:${searchQuery ?? ''}`;
    if (eventType === 'rec_impression' || eventType === 'product_view') {
      if (dedupeCache.has(dedupeKey)) {
        return { recorded: false, deduplicated: true };
      }
      dedupeCache.set(dedupeKey, Date.now());
    }

    const created = await RecommendationEventModel.create({
      userId: userId ?? null,
      sessionKey,
      eventType,
      productId: resolvedProduct?.id ?? null,
      sourceProductId: resolvedSource?.id ?? null,
      categoryId: categoryId ?? null,
      searchQuery,
      strategy,
      surface,
      dwellMs,
      priceVnd,
      metadata,
    });

    trendingCache.clear();
    return {
      recorded: true,
      id: created.id,
      eventType: created.eventType,
      productId: created.productId,
    };
  }

  private async computeTrendingScores(candidateIds: number[]): Promise<Record<number, number>> {
    if (!candidateIds.length) return {};
    const cacheKey = 'trending:14d';
    const cached = trendingCache.get(cacheKey);
    if (cached && process.env.NODE_ENV !== 'test') return cached;

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const events = await RecommendationEventModel.findAll({
      attributes: ['productId', 'eventType'],
      where: {
        productId: { [Op.in]: candidateIds },
        createdAt: { [Op.gte]: since },
        eventType: { [Op.in]: ['product_view', 'rec_click', 'add_to_cart', 'rec_add_to_cart', 'wishlist_add'] },
      },
      limit: 2500,
    });

    const rawScores = new Map<number, number>();
    for (const ev of events) {
      if (!ev.productId) continue;
      const weight =
        ev.eventType === 'add_to_cart' || ev.eventType === 'rec_add_to_cart'
          ? 3.0
          : ev.eventType === 'wishlist_add'
            ? 2.2
            : ev.eventType === 'rec_click'
              ? 1.8
              : 1.0;
      rawScores.set(ev.productId, (rawScores.get(ev.productId) ?? 0) + weight);
    }

    const maxScore = Math.max(1, ...rawScores.values());
    const normalized: Record<number, number> = {};
    for (const [productId, score] of rawScores.entries()) {
      normalized[productId] = Number(Math.min(1, score / maxScore).toFixed(4));
    }

    trendingCache.set(cacheKey, normalized);
    return normalized;
  }

  private async computeCoOccurrences(anchorProductIds: number[]): Promise<{
    coPurchaseCounts: Record<number, number>;
    coViewCounts: Record<number, number>;
  }> {
    const cleanAnchors = [...new Set(anchorProductIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 12);
    if (!cleanAnchors.length) {
      return { coPurchaseCounts: {}, coViewCounts: {} };
    }

    const coPurchaseCounts: Record<number, number> = {};
    const coViewCounts: Record<number, number> = {};

    // 1. Co-purchases from OrderItemModel (orders sharing any anchor product)
    const matchingOrderItems = await OrderItemModel.findAll({
      attributes: ['orderId', 'productId'],
      where: { productId: { [Op.in]: cleanAnchors } },
      limit: 300,
    });
    const orderIds = [...new Set(matchingOrderItems.map((item) => item.orderId))];
    if (orderIds.length > 0) {
      const siblingOrderItems = await OrderItemModel.findAll({
        attributes: ['orderId', 'productId', 'quantity'],
        where: {
          orderId: { [Op.in]: orderIds },
          productId: { [Op.notIn]: cleanAnchors },
        },
        limit: 1000,
      });
      for (const item of siblingOrderItems) {
        if (!item.productId) continue;
        coPurchaseCounts[item.productId] = (coPurchaseCounts[item.productId] ?? 0) + Math.max(1, item.quantity || 1);
      }
    }

    // 2. Co-views and direct source-product transitions from RecommendationEventModel
    const directTransitions = await RecommendationEventModel.findAll({
      attributes: ['productId', 'eventType'],
      where: {
        sourceProductId: { [Op.in]: cleanAnchors },
        productId: { [Op.notIn]: cleanAnchors },
        eventType: { [Op.in]: ['rec_click', 'rec_add_to_cart', 'product_view'] },
      },
      limit: 500,
    });
    for (const ev of directTransitions) {
      if (!ev.productId) continue;
      const bonus = ev.eventType === 'rec_add_to_cart' ? 3 : ev.eventType === 'rec_click' ? 2 : 1;
      coViewCounts[ev.productId] = (coViewCounts[ev.productId] ?? 0) + bonus;
    }

    const anchorSessionEvents = await RecommendationEventModel.findAll({
      attributes: ['sessionKey'],
      where: {
        productId: { [Op.in]: cleanAnchors },
        eventType: { [Op.in]: ['product_view', 'add_to_cart', 'wishlist_add'] },
      },
      order: [['createdAt', 'DESC']],
      limit: 120,
    });
    const sessionKeys = [...new Set(anchorSessionEvents.map((e) => e.sessionKey).filter(Boolean))].slice(0, 60);
    if (sessionKeys.length > 0) {
      const sessionPeers = await RecommendationEventModel.findAll({
        attributes: ['productId', 'eventType'],
        where: {
          sessionKey: { [Op.in]: sessionKeys },
          productId: { [Op.notIn]: cleanAnchors },
          eventType: { [Op.in]: ['product_view', 'add_to_cart', 'rec_add_to_cart', 'wishlist_add'] },
        },
        limit: 800,
      });
      for (const peer of sessionPeers) {
        if (!peer.productId) continue;
        const weight = peer.eventType === 'add_to_cart' || peer.eventType === 'rec_add_to_cart' ? 2 : 1;
        coViewCounts[peer.productId] = (coViewCounts[peer.productId] ?? 0) + weight;
      }
    }

    return { coPurchaseCounts, coViewCounts };
  }

  private async buildCustomerProfile(params: {
    userId: number | null;
    sessionKey: string;
    recentIds: number[];
    recentQueries: string[];
    cartProductIds: number[];
    currentCategorySlug?: string;
    currentQuery?: string;
    candidateById: Map<number, ProductSummary>;
  }): Promise<{ profile: UserAffinityProfile; signalCount: number }> {
    const {
      userId,
      sessionKey,
      recentIds,
      recentQueries,
      cartProductIds,
      currentCategorySlug,
      currentQuery,
      candidateById,
    } = params;

    const views: AffinityProductSignal[] = [];
    const cartItems: AffinityProductSignal[] = [];
    const wishlistItems: AffinityProductSignal[] = [];
    const purchases: AffinityProductSignal[] = [];
    const searchQueries: string[] = [];
    const categorySlugs: string[] = [];

    if (currentQuery) searchQueries.push(currentQuery);
    for (const q of recentQueries) searchQueries.push(q);
    if (currentCategorySlug) categorySlugs.push(currentCategorySlug);

    const enrichSignal = (productId: number, extra: Partial<AffinityProductSignal> = {}): AffinityProductSignal => {
      const candidate = candidateById.get(productId);
      return {
        id: productId,
        brandName: extra.brandName ?? candidate?.brandName ?? null,
        scale: extra.scale ?? candidate?.scale ?? null,
        categoryId: extra.categoryId ?? candidate?.category?.id ?? null,
        priceVnd: extra.priceVnd ?? (candidate ? effectivePrice(candidate) : null),
        dwellMs: extra.dwellMs ?? null,
        weight: extra.weight,
        ageDays: extra.ageDays,
      };
    };

    // 1. Client-side recent product IDs (immediate zero-latency cold-start signal)
    recentIds.forEach((id, index) => {
      views.push(
        enrichSignal(id, {
          weight: Math.max(0.4, 1 - index * 0.08),
        }),
      );
    });

    // 2. Current cart items
    for (const id of cartProductIds) {
      cartItems.push(enrichSignal(id, { weight: 1.2 }));
    }

    // 3. Persistent behavioral events from RecommendationEventModel (by userId or sessionKey)
    const eventWhere =
      userId && sessionKey
        ? { [Op.or]: [{ userId }, { sessionKey }] }
        : userId
          ? { userId }
          : { sessionKey };

    const recentEvents = await RecommendationEventModel.findAll({
      where: eventWhere,
      order: [['createdAt', 'DESC']],
      limit: 120,
    });

    const missingProductIds = new Set<number>();
    for (const ev of recentEvents) {
      if (ev.productId && !candidateById.has(ev.productId)) {
        missingProductIds.add(ev.productId);
      }
    }

    let fallbackProductsMap = new Map<
      number,
      { id: number; parentProductId: number | null; brandName: string | null; scale?: string | null; categoryId: number | null; price: number }
    >();
    if (missingProductIds.size > 0) {
      const rows = await ProductModel.findAll({
        attributes: ['id', 'parentProductId', 'brandName', 'scale', 'categoryId', 'price'],
        where: { id: { [Op.in]: [...missingProductIds] } },
      });
      fallbackProductsMap = new Map(rows.map((r) => [r.id, r]));
    }

    for (const ev of recentEvents) {
      if (ev.searchQuery) {
        searchQueries.push(ev.searchQuery);
      }
      if (!ev.productId) continue;
      const fallback = fallbackProductsMap.get(ev.productId);
      const mainId = fallback?.parentProductId ?? ev.productId;
      const signal = enrichSignal(mainId, {
        brandName: fallback?.brandName ?? undefined,
        scale: fallback?.scale ?? undefined,
        categoryId: ev.categoryId ?? fallback?.categoryId ?? undefined,
        priceVnd: ev.priceVnd ?? fallback?.price ?? undefined,
        dwellMs: ev.dwellMs ?? null,
        ageDays: Math.max(0,(Date.now()-new Date(ev.createdAt).getTime())/86400000),
      });

      if (ev.eventType === 'add_to_cart' || ev.eventType === 'rec_add_to_cart') {
        cartItems.push(signal);
      } else if (ev.eventType === 'wishlist_add') {
        wishlistItems.push(signal);
      } else if (ev.eventType === 'product_view' || ev.eventType === 'dwell' || ev.eventType === 'rec_click') {
        views.push(signal);
      }
    }

    // 4. Authenticated customer signals: Wishlist + Order history
    if (userId) {
      try {
        const wishRows = await WishlistItemModel.findAll({
          where: { userId },
          order: [['createdAt', 'DESC']],
          limit: 40,
        });
        for (const w of wishRows) {
          wishlistItems.push(
            enrichSignal(w.productId, { ageDays: Math.max(0, (Date.now() - new Date(w.createdAt).getTime()) / 86400000) }),
          );
        }
      } catch {
        /* Ignore optional wishlist lookup errors */
      }

      try {
        const orders = await OrderModel.findAll({
          attributes: ['id', 'createdAt', 'status'],
          where: {
            userId,
            status: { [Op.ne]: 'CANCELLED' },
          },
          include: [
            {
              model: OrderItemModel,
              as: 'items',
              attributes: ['productId', 'unitPrice', 'quantity'],
            },
          ],
          order: [['createdAt', 'DESC']],
          limit: 25,
        });

        for (const order of orders) {
          const items = (order.get('items') as OrderItemModel[] | undefined) ?? [];
          for (const item of items) {
            if (!item.productId) continue;
            const candidate = candidateById.get(item.productId);
            purchases.push(
              enrichSignal(item.productId, {
                priceVnd: item.unitPrice || (candidate ? effectivePrice(candidate) : null),
                weight: Math.min(2, Math.max(1, item.quantity || 1)),
                ageDays: Math.max(0, (Date.now() - new Date(order.createdAt).getTime()) / 86400000),
              }),
            );
          }
        }
      } catch {
        /* Ignore optional order history lookup errors */
      }
    }

    const profile = buildUserAffinityProfile({
      viewedProducts: views,
      cartProducts: cartItems,
      wishlistProducts: wishlistItems,
      purchasedProducts: purchases,
      searchQueries: searchQueries.map(query => ({query})),
    });

    const signalCount =
      views.length + cartItems.length + wishlistItems.length + purchases.length + searchQueries.length + categorySlugs.length;

    return { profile, signalCount };
  }

  async getSmartRecommendations(
    rawQuery: SmartRecommendationQuery,
    userId: number | null = null,
  ): Promise<SmartRecommendationResponse> {
    const config = await this.getConfig();
    const surface = validSurface(rawQuery.surface);
    const strategy = validStrategy(rawQuery.strategy, surface);
    const sessionKey = sanitizeSessionKey(rawQuery.sessionKey);
    const limit = Math.max(1, Math.min(24, toInteger(rawQuery.limit) ?? config.defaultLimit));

    if (!config.enabled) {
      return {
        surface,
        strategy,
        isColdStart: true,
        enabled: false,
        profileSummary: {
          topBrands: [],
          topScales: [],
          topCategories: [],
          preferredPriceBand: null,
          signalCount: 0,
        },
        items: [],
        sections: [],
      };
    }

    const candidates = await this.productService.getSellableCandidatePool(180);
    const candidateById = new Map<number, ProductSummary>(candidates.map((c) => [c.id, c]));

    let anchorProduct: ProductDetail | null = null;
    if (rawQuery.productId !== undefined && rawQuery.productId !== null && String(rawQuery.productId).trim() !== '') {
      try {
        const key = /^\d+$/.test(String(rawQuery.productId)) ? Number(rawQuery.productId) : rawQuery.productId;
        const detail = (await this.productService.getPublicById(key)) as unknown as ProductDetail;
        const activeUnits = detail.conditionOptions?.filter((u) => u.stock > 0) ?? [];
        anchorProduct = {
          ...detail,
          salePrice: activeUnits.length ? Math.min(...activeUnits.map((u) => u.salePrice)) : detail.salePrice,
        };
      } catch {
        anchorProduct = null;
      }
    }

    const recentIds = parseIdList(rawQuery.recentIds, 20);
    const recentQueries = parseQueryList(rawQuery.recentQueries, 10);
    const cartProductIds = parseIdList(rawQuery.cartProductIds, 24);
    const cartSubtotalVnd = Math.max(0, toInteger(rawQuery.cartSubtotalVnd) ?? 0);
    const currentCategorySlug = asTrimmedString(rawQuery.category) || undefined;
    const currentQuery = asTrimmedString(rawQuery.q) || undefined;
    const maxBudgetVnd = toInteger(rawQuery.maxPrice);

    let currentCategoryId = toInteger(rawQuery.categoryId);
    if (!currentCategoryId && currentCategorySlug) {
      const matchedCandidate = candidates.find((c) => c.category?.slug === currentCategorySlug);
      if (matchedCandidate?.category?.id) {
        currentCategoryId = matchedCandidate.category.id;
      } else {
        const cat = await CategoryModel.findOne({ where: { slug: currentCategorySlug }, attributes: ['id'] });
        if (cat) currentCategoryId = cat.id;
      }
    }

    const { profile, signalCount } = await this.buildCustomerProfile({
      userId,
      sessionKey,
      recentIds,
      recentQueries,
      cartProductIds,
      currentCategorySlug,
      currentQuery,
      candidateById,
    });

    const coAnchorIds = [
      ...(anchorProduct ? [anchorProduct.id] : []),
      ...cartProductIds,
      ...recentIds.slice(0, 4),
    ];

    const [{ coPurchaseCounts, coViewCounts }, trendingScores] = await Promise.all([
      this.computeCoOccurrences(coAnchorIds),
      this.computeTrendingScores(candidates.map((c) => c.id)),
    ]);

    const context = {
      strategy,
      surface,
      sourceProduct: anchorProduct,
      profile,
      excludeProductIds: cartProductIds,
      anchorProducts: cartProductIds.map(id => candidateById.get(id)).filter((p): p is ProductSummary => !!p).map(p => ({...p, categoryId: p.category?.id, priceVnd: effectivePrice(p)})),
      cartSubtotalVnd,
      activeCategoryId: currentCategoryId,
      activeSearchQuery: currentQuery ?? null,
      maxBudgetVnd: maxBudgetVnd && maxBudgetVnd > 0 ? maxBudgetVnd : null,
      cooccurrence: { coPurchases: coPurchaseCounts, coViews: coViewCounts, recentViews: trendingScores },
      config,
      limit,
    };

    const items = rankSmartRecommendations(candidates, context);
    const sections = buildSurfaceRecommendationSections(surface, candidates, context);

    const topBrands = Object.entries(profile.brandWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);
    const topScales = Object.entries(profile.scaleWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([scale]) => scale);
    const topCategories = Object.entries(profile.categoryWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([slug]) => slug);

    return {
      surface,
      strategy,
      isColdStart: profile.isColdStart,
      enabled: config.enabled,
      profileSummary: {
        topBrands,
        topScales,
        topCategories,
        preferredPriceBand: profile.priceProfile.hasSignal ? {min:profile.priceProfile.minVnd,median:profile.priceProfile.preferredVnd,max:profile.priceProfile.maxVnd} : null,
        signalCount,
      },
      items,
      sections,
    };
  }

  async getAdminAnalytics(days = 30): Promise<RecommendationAdminAnalytics> {
    const windowDays = Math.max(1, Math.min(365, toInteger(days) ?? 30));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const config = await this.getConfig();

    const events = await RecommendationEventModel.findAll({
      where: {
        createdAt: { [Op.gte]: since },
      },
      order: [['createdAt', 'DESC']],
      limit: 10_000,
    });

    let impressions = 0;
    let clicks = 0;
    let addToCarts = 0;
    let behaviorSignals = 0;
    const sessionSet = new Set<string>();

    const strategyStats = new Map<
      RecommendationStrategy,
      { impressions: number; clicks: number; addToCarts: number }
    >();
    for (const s of RECOMMENDATION_STRATEGIES) {
      strategyStats.set(s, { impressions: 0, clicks: 0, addToCarts: 0 });
    }

    const surfaceStats = new Map<
      RecommendationSurface,
      { impressions: number; clicks: number; addToCarts: number }
    >();
    for (const sf of RECOMMENDATION_SURFACES) {
      surfaceStats.set(sf, { impressions: 0, clicks: 0, addToCarts: 0 });
    }

    const productMap = new Map<
      number,
      { impressions: number; clicks: number; addToCarts: number }
    >();
    const searchQueryCounts = new Map<string, number>();

    for (const ev of events) {
      if (ev.sessionKey) sessionSet.add(ev.sessionKey);
      const strat = RECOMMENDATION_STRATEGIES.includes(ev.strategy as RecommendationStrategy)
        ? (ev.strategy as RecommendationStrategy)
        : null;
      const surf = RECOMMENDATION_SURFACES.includes(ev.surface as RecommendationSurface)
        ? (ev.surface as RecommendationSurface)
        : null;

      if (ev.eventType === 'rec_impression') {
        impressions += 1;
        if (strat) strategyStats.get(strat)!.impressions += 1;
        if (surf) surfaceStats.get(surf)!.impressions += 1;
        if (ev.productId) {
          const prev = productMap.get(ev.productId) ?? { impressions: 0, clicks: 0, addToCarts: 0 };
          prev.impressions += 1;
          productMap.set(ev.productId, prev);
        }
      } else if (ev.eventType === 'rec_click') {
        clicks += 1;
        if (strat) strategyStats.get(strat)!.clicks += 1;
        if (surf) surfaceStats.get(surf)!.clicks += 1;
        if (ev.productId) {
          const prev = productMap.get(ev.productId) ?? { impressions: 0, clicks: 0, addToCarts: 0 };
          prev.clicks += 1;
          productMap.set(ev.productId, prev);
        }
      } else if (ev.eventType === 'rec_add_to_cart') {
        addToCarts += 1;
        if (strat) strategyStats.get(strat)!.addToCarts += 1;
        if (surf) surfaceStats.get(surf)!.addToCarts += 1;
        if (ev.productId) {
          const prev = productMap.get(ev.productId) ?? { impressions: 0, clicks: 0, addToCarts: 0 };
          prev.addToCarts += 1;
          productMap.set(ev.productId, prev);
        }
      } else {
        behaviorSignals += 1;
        if (ev.eventType === 'search' && ev.searchQuery) {
          const normalized = ev.searchQuery.trim().toLowerCase();
          if (normalized) {
            searchQueryCounts.set(normalized, (searchQueryCounts.get(normalized) ?? 0) + 1);
          }
        }
      }
    }

    const rate = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0);

    const byStrategy = RECOMMENDATION_STRATEGIES.map((strategy) => {
      const st = strategyStats.get(strategy)!;
      return {
        strategy,
        impressions: st.impressions,
        clicks: st.clicks,
        addToCarts: st.addToCarts,
        ctrPercent: rate(st.clicks, st.impressions),
        conversionPercent: rate(st.addToCarts, Math.max(1, st.clicks || st.impressions)),
      };
    });

    const bySurface = RECOMMENDATION_SURFACES.map((surface) => {
      const sf = surfaceStats.get(surface)!;
      return {
        surface,
        impressions: sf.impressions,
        clicks: sf.clicks,
        addToCarts: sf.addToCarts,
        ctrPercent: rate(sf.clicks, sf.impressions),
      };
    });

    const topProductIds = [...productMap.entries()]
      .sort((a, b) => b[1].addToCarts * 5 + b[1].clicks * 2 + b[1].impressions - (a[1].addToCarts * 5 + a[1].clicks * 2 + a[1].impressions))
      .slice(0, 10)
      .map(([id]) => id);

    const productRows = topProductIds.length
      ? await ProductModel.findAll({
          attributes: ['id', 'name', 'slug', 'brandName', 'scale', 'price', 'stock'],
          where: { id: { [Op.in]: topProductIds } },
        })
      : [];
    const productDetailsMap = new Map(productRows.map((p) => [p.id, p]));

    const topProducts = topProductIds
      .map((productId) => {
        const stats = productMap.get(productId)!;
        const p = productDetailsMap.get(productId);
        if (!p) return null;
        return {
          productId,
          name: p.name,
          slug: p.slug,
          brandName: p.brandName ?? null,
          scale: p.scale ?? null,
          price: p.price,
          stock: p.stock,
          impressions: stats.impressions,
          clicks: stats.clicks,
          addToCarts: stats.addToCarts,
          ctrPercent: rate(stats.clicks, stats.impressions),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const topSearchQueries = [...searchQueryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      windowDays,
      config,
      totals: {
        impressions,
        clicks,
        addToCarts,
        ctrPercent: rate(clicks, impressions),
        addToCartRatePercent: rate(addToCarts, Math.max(1, clicks || impressions)),
        behaviorSignals,
        uniqueSessions: sessionSet.size,
      },
      byStrategy,
      bySurface,
      topProducts,
      topSearchQueries,
    };
  }
}

