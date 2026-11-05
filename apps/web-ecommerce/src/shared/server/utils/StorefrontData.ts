import type { ProductDetail, ProductSummary } from '../../types/product';

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
