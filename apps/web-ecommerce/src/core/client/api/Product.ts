'use client';

import Api from './Api';
import type { ProductRecommendation } from '@/shared/product-recommendations';
import { ADMIN_PRODUCT_API, PRODUCT_API } from './endpoint';
import type { PaginatedResult } from '@/shared/types/pagination';
import type {
  AdminProduct,
  AdminProductListItem,
  ConditionOptionPayload,
  InventoryStats,
  ProductDetail,
  ProductFilterOptions,
  ProductPayload,
  ProductQuery,
  ProductSummary,
  Review,
} from '@/shared/types/product';

export interface AdminProductListParams {
  q?: string;
  categoryId?: number | '';
  status?: '' | 'active' | 'archived' | 'featured' | 'held';
  page?: number;
  per_page?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

// Drops empty values so they are not sent as `key=` in the query string.
const compactParams = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== false),
  );

export default class ProductApi {
  static async getProducts(query: ProductQuery): Promise<PaginatedResult<ProductSummary> | undefined> {
    try {
      const response = await Api.get(PRODUCT_API.GET_PRODUCTS, { params: compactParams(query) });
      return response.data?.payload;
    } catch (error) {
      return undefined;
    }
  }

  // Optional merchandising must not trigger the shared API's blocking error toasts or auth redirects.
  static async getRecommendations(productId: number, signal: AbortSignal): Promise<ProductRecommendation[]> {
    try {
      const response = await fetch(`/api/products/${productId}/recommendations`, {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  static async getFilterOptions(): Promise<ProductFilterOptions | undefined> {
    try {
      const response = await Api.get(PRODUCT_API.GET_FILTER_OPTIONS);
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  // By id, public UUID or SEO slug.
  static async getProduct(productId: number | string): Promise<ProductDetail | undefined> {
    try {
      const response = await Api.get(PRODUCT_API.GET_PRODUCT(productId));
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async getReviews(
    productId: number,
    page: number,
    perPage: number,
  ): Promise<PaginatedResult<Review> | undefined> {
    try {
      const response = await Api.get(PRODUCT_API.GET_REVIEWS(productId), { params: { page, per_page: perPage } });
      return response.data?.payload;
    } catch (error) {
      return undefined;
    }
  }

  static async getAdminProducts(
    params: AdminProductListParams,
  ): Promise<PaginatedResult<AdminProductListItem> | undefined> {
    try {
      const response = await Api.get(ADMIN_PRODUCT_API.GET_PRODUCTS, { params: compactParams(params) });
      return response.data?.payload;
    } catch (error) {
      return undefined;
    }
  }

  static async getInventoryStats(): Promise<InventoryStats | undefined> {
    try {
      const response = await Api.get(ADMIN_PRODUCT_API.GET_STATS);
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  // Adds a condition option (pre-owned, incomplete, defective, ...) to a main listing.
  static async createConditionOption(
    listingId: number,
    payload: ConditionOptionPayload,
  ): Promise<AdminProduct | undefined> {
    try {
      const response = await Api.post(ADMIN_PRODUCT_API.CREATE_CONDITION(listingId), payload);
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async getAdminProduct(productId: number): Promise<AdminProduct | undefined> {
    try {
      const response = await Api.get(ADMIN_PRODUCT_API.GET_PRODUCT(productId));
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async createProduct(payload: ProductPayload): Promise<AdminProduct | undefined> {
    try {
      const response = await Api.post(ADMIN_PRODUCT_API.CREATE_PRODUCT, payload);
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async updateProduct(productId: number, payload: ProductPayload): Promise<AdminProduct | undefined> {
    try {
      const response = await Api.put(ADMIN_PRODUCT_API.UPDATE_PRODUCT(productId), payload);
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async deleteProduct(productId: number): Promise<boolean> {
    try {
      await Api.delete(ADMIN_PRODUCT_API.DELETE_PRODUCT(productId));
      return true;
    } catch (error) {
      return false;
    }
  }
}
