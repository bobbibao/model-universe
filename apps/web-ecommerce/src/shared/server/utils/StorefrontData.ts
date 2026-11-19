import type { PaginatedResult } from '../../types/pagination';
import type { ProductDetail, ProductSummary } from '../../types/product';
import type { ShowcasePhoto } from '../../types/showcase';
import { productPath } from '../../slug';
import { photoFacts } from './photoTone';

// Public catalog only. The custom Express server owns database initialization and the existing product endpoint.
// Never derive this origin from an incoming Host header or forward account cookies to it.
export async function getFeaturedProducts(): Promise<ProductSummary[] | undefined> {
  try {
    const port = Number(process.env.PORT || 6050);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;
    const options: RequestInit & { cache: 'no-store' } = {
      cache: 'no-store', signal: AbortSignal.timeout(2500),
    };
    const list = async (query: string) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/products?${query}`, options);
      if (!response.ok) return undefined;
      const result = await response.json() as { payload?: { data?: ProductSummary[] } };
      return Array.isArray(result.payload?.data) ? result.payload.data : undefined;
    };
    // Staff-featured models first; the home banners need photos, so in-stock best sellers fill the rest.
    const featured = await list('featured=true&per_page=8');
    if (!featured || featured.length >= 8) return featured;
    const sellers = (await list('inStock=true&sort=best_selling&per_page=16')) ?? [];
    const ids = new Set(featured.map((product) => product.id));
    return [...featured, ...sellers.filter((product) => !ids.has(product.id))].slice(0, 8);
  } catch {
    return undefined;
  }
}

// Photos the shop took itself (uploads, not supplier or placeholder images) of in-stock models, one per model, for the
// services hero and the offers page. The first one is shown large, so it is the sharpest dark studio shot found in the
// galleries of the first models (at least LEAD_MIN_PX on its short side, not a wide banner); the rest are dark shots
// before photos on a white backdrop, sharp ones (SHARP_MIN_PX and up) before small ones. Computed at most every ten
// minutes. Empty when the catalog cannot be read; the pages then show their plain fallback.
const SHOWCASE_MAX = 12;
const SHOWCASE_TTL_MS = 10 * 60_000;
const SHARP_MIN_PX = 600;
const LEAD_MIN_PX = 800;
const LEAD_GALLERIES = 8;
let showcase: { at: number; photos: ShowcasePhoto[] } | undefined;

export async function getShowcasePhotos(limit = 8): Promise<ShowcasePhoto[]> {
  if (showcase && Date.now() - showcase.at < SHOWCASE_TTL_MS) return showcase.photos.slice(0, limit);
  const products = (await getFeaturedProducts()) ?? [];
  const port = Number(process.env.PORT || 6050);
  const options: RequestInit & { cache: 'no-store' } = { cache: 'no-store', signal: AbortSignal.timeout(2500) };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/products?inStock=true&sort=best_selling&per_page=60`, options);
    if (response.ok) {
      const result = await response.json() as { payload?: { data?: ProductSummary[] } };
      products.push(...(result.payload?.data ?? []));
    }
  } catch { /* the featured list alone is enough */ }
  const seen = new Set<string>();
  const models: ProductSummary[] = [];
  for (const product of products) {
    if (!product.imageUrl?.startsWith('/uploads/') || seen.has(product.imageUrl)) continue;
    if ((product.groupStock ?? product.stock) <= 0) continue;
    seen.add(product.imageUrl);
    models.push(product);
    if (models.length >= SHOWCASE_MAX * 4) break;
  }
  const facts = await Promise.all(models.map((product) => photoFacts(product.imageUrl!)));
  const rank = (i: number) => (facts[i].light ? 2 : 0) + (Math.min(facts[i].width, facts[i].height) >= SHARP_MIN_PX ? 0 : 1);
  const order = models.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b);
  const photo = (product: ProductSummary, src = product.imageUrl!): ShowcasePhoto => ({
    src,
    alt: product.name,
    href: productPath(product),
  });

  // The large first photo: every gallery photo of the first models, dark, upright or square (height 0.75 to 1.5 times
  // the width), the most pixels on its short side first.
  let lead: { index: number; src: string; short: number; height: number } | undefined;
  const firsts = order.slice(0, LEAD_GALLERIES);
  const galleries = await Promise.all(
    firsts.map(async (i) => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/products/${models[i].id}`, options);
        return response.ok ? (((await response.json()) as { images?: unknown }).images ?? []) : [];
      } catch {
        return [];
      }
    }),
  );
  for (const [n, i] of firsts.entries()) {
    const sources = [models[i].imageUrl!, ...(Array.isArray(galleries[n]) ? galleries[n] : [])];
    for (const src of sources) {
      if (typeof src !== 'string' || !src.startsWith('/uploads/')) continue;
      const { width, height, light } = await photoFacts(src);
      const short = Math.min(width, height);
      if (light || short < LEAD_MIN_PX || height < width * 0.75 || height > width * 1.5) continue;
      if (!lead || short > lead.short || (short === lead.short && height > lead.height))
        lead = { index: i, src, short, height };
    }
  }

  const photos = [
    ...(lead ? [photo(models[lead.index], lead.src)] : []),
    ...order.filter((i) => i !== lead?.index).map((i) => photo(models[i])),
  ].slice(0, SHOWCASE_MAX);
  if (photos.length) showcase = { at: Date.now(), photos };
  return photos.slice(0, limit);
}

// Reuse the actual public endpoint; never send credentials or import database models into route bundles.
// `key`: the integer id, the public UUID or the SEO slug.
export async function getPublicProduct(key: number | string): Promise<ProductDetail | null | undefined> {
  if (typeof key === 'number' ? !Number.isSafeInteger(key) || key < 1 : !/^[a-z0-9-]{1,120}$/i.test(key)) return null;
  const port = Number(process.env.PORT || 6050);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  try {
    const options: RequestInit & { cache: 'no-store' } = { cache: 'no-store', signal: AbortSignal.timeout(2500) };
    const response = await fetch(`http://127.0.0.1:${port}/api/products/${encodeURIComponent(String(key))}`, options);
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    const product = await response.json() as ProductDetail;
    // A condition option's id opens its main listing with the option selected.
    return typeof key === 'number' ? (product.id === key || product.selectedOptionId === key ? product : undefined) : product;
  } catch { return undefined; }
}

// The storefront categories (for category landing pages and the sitemap).
export type PublicCategory = { id: number; name: string; slug: string; description?: string | null; productCount?: number };
export async function getPublicCategories(): Promise<PublicCategory[]> {
  try {
    const port = Number(process.env.PORT || 6050);
    const options: RequestInit & { cache: 'no-store' } = { cache: 'no-store', signal: AbortSignal.timeout(2500) };
    const response = await fetch(`http://127.0.0.1:${port}/api/categories`, options);
    if (!response.ok) return [];
    const data = await response.json() as unknown;
    const rows = Array.isArray(data) ? data : (data as { payload?: unknown; data?: unknown }).payload ?? (data as { data?: unknown }).data;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// A category worth indexing: it has products and is not an internal ("[DEV] ...") one.
export const isIndexableCategory = (category: PublicCategory) =>
  (category.productCount ?? 1) > 0 && !category.name.trim().startsWith('[');

type PublicProductSlug = {
  id: number;
  slug: string;
  modelFamilyId?: number | null;
  partnerId?: number | null;
  updatedAt?: string;
  imageUrl?: string;
};

// The catalog's first page as the store opens it without filters (newest first, 12 per page), rendered on the server
// so the product grid is in the HTML for crawlers that do not run JavaScript. Undefined when the listing fails.
export async function getCatalogFirstPage(category?: string): Promise<PaginatedResult<ProductSummary> | undefined> {
  try {
    const port = Number(process.env.PORT || 6050);
    const query = new URLSearchParams({ page: '1', per_page: '12', sort: 'newest', ...(category ? { category } : {}) });
    const options: RequestInit & { cache: 'no-store' } = { cache: 'no-store', signal: AbortSignal.timeout(2500) };
    const response = await fetch(`http://127.0.0.1:${port}/api/products?${query}`, options);
    if (!response.ok) return undefined;
    const result = (await response.json()) as {
      payload?: { data?: ProductSummary[]; pagination?: Record<string, unknown> };
    };
    if (!Array.isArray(result.payload?.data)) return undefined;
    // The API speaks snake_case; the client's Pagination is camelCase (the browser API layer converts it, this server
    // fetch has to do the same, or the pager reads "NaN–NaN" and offers no next page).
    const raw = result.payload.pagination ?? {};
    const pick = (camel: string, snake: string) => raw[camel] ?? raw[snake];
    return {
      data: result.payload.data,
      pagination: {
        total: Number(pick('total', 'total') ?? result.payload.data.length),
        page: Number(pick('page', 'page') ?? 1),
        perPage: Number(pick('perPage', 'per_page') ?? 12),
        totalPages: Number(pick('totalPages', 'total_pages') ?? 1),
        hasNextPage: Boolean(pick('hasNextPage', 'has_next_page')),
        hasPreviousPage: Boolean(pick('hasPreviousPage', 'has_previous_page')),
      },
    };
  } catch {
    return undefined;
  }
}

// Every published product's slug for the sitemap (paged through the public listing), with its main photo and model
// family (condition variants share one canonical page).
export async function getPublicProductSlugs(): Promise<PublicProductSlug[]> {
  const port = Number(process.env.PORT || 6050);
  const slugs: PublicProductSlug[] = [];
  try {
    for (let page = 1; page <= 50; page++) {
      const options: RequestInit & { cache: 'no-store' } = { cache: 'no-store', signal: AbortSignal.timeout(4000) };
      const response = await fetch(`http://127.0.0.1:${port}/api/products?per_page=100&page=${page}`, options);
      if (!response.ok) break;
      const result = await response.json() as { payload?: { data?: (ProductSummary & { updatedAt?: string })[]; pagination?: { total_pages?: number } } };
      for (const row of result.payload?.data || [])
        if (row.slug)
          slugs.push({
            id: row.id,
            slug: row.slug,
            modelFamilyId: row.modelFamilyId,
            partnerId: row.partnerId,
            updatedAt: row.updatedAt,
            imageUrl: row.imageUrl || undefined,
          });
      if (page >= (result.payload?.pagination?.total_pages || 1)) break;
    }
  } catch {
    /* A partial sitemap is still useful. */
  }
  return slugs;
}
