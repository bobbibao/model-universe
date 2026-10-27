'use client';

import Api from './Api';
import type {
  RecommendationConfig,
  RecommendationSection,
  RecommendationStrategy,
  RecommendationSurface,
  SmartRecommendedProduct,
} from '@/shared/smart-recommendations';
import { readClientRecommendationSignals } from '@/shared/client/behaviorTracker';

export interface GetSmartRecommendationsParams {
  surface: RecommendationSurface;
  strategy?: RecommendationStrategy;
  productId?: number | string;
  cartProductIds?: number[];
  cartSubtotalVnd?: number;
  category?: string;
  categoryId?: number;
  q?: string;
  maxPrice?: number;
  limit?: number;
}

export interface SmartRecommendationsApiResponse {
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

export interface AdminRecommendationAnalyticsResponse {
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

export default class RecommendationApi {
  static async getSmartRecommendations(
    params: GetSmartRecommendationsParams,
    signal?: AbortSignal,
  ): Promise<SmartRecommendationsApiResponse | null> {
    try {
      const clientSignals = readClientRecommendationSignals();
      const searchParams = new URLSearchParams();
      searchParams.set('surface', params.surface);
      if (params.strategy) searchParams.set('strategy', params.strategy);
      if (params.productId !== undefined && params.productId !== '') {
        searchParams.set('productId', String(params.productId));
      }
      if (clientSignals.sessionKey) {
        searchParams.set('sessionKey', clientSignals.sessionKey);
      }
      if (clientSignals.recentIds.length > 0) {
        searchParams.set('recentIds', clientSignals.recentIds.join(','));
      }
      if (clientSignals.recentQueries.length > 0) {
        searchParams.set('recentQueries', clientSignals.recentQueries.join('|'));
      }
      if (params.cartProductIds && params.cartProductIds.length > 0) {
        searchParams.set('cartProductIds', params.cartProductIds.join(','));
      }
      if (params.cartSubtotalVnd && params.cartSubtotalVnd > 0) {
        searchParams.set('cartSubtotalVnd', String(Math.round(params.cartSubtotalVnd)));
      }
      if (params.category) searchParams.set('category', params.category);
      if (params.categoryId) searchParams.set('categoryId', String(params.categoryId));
      if (params.q) searchParams.set('q', params.q);
      if (params.maxPrice && params.maxPrice > 0) searchParams.set('maxPrice', String(params.maxPrice));
      if (params.limit) searchParams.set('limit', String(params.limit));

      const response = await fetch(`/api/recommendations?${searchParams.toString()}`, {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return null;
      return (await response.json()) as SmartRecommendationsApiResponse;
    } catch {
      return null;
    }
  }

  static async getAdminAnalytics(days = 30): Promise<AdminRecommendationAnalyticsResponse | null> {
    try {
      const response = await Api.get('/admin/recommendations/analytics', { params: { days } });
      return response.data;
    } catch {
      return null;
    }
  }

  static async getAdminConfig(): Promise<RecommendationConfig | null> {
    try {
      const response = await Api.get('/admin/recommendations/config');
      return response.data;
    } catch {
      return null;
    }
  }

  static async updateAdminConfig(patch: Partial<RecommendationConfig>): Promise<RecommendationConfig | null> {
    const response = await Api.put('/admin/recommendations/config', patch);
    return response.data?.payload ?? response.data ?? null;
  }
}

