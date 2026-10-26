import type { ProductSummary } from './types/product';

export type RecommendationReason = 'category' | 'brand' | 'scale' | 'price' | 'discover';
export type ProductRecommendation = { product: ProductSummary; reason: RecommendationReason };
type Reference = Pick<ProductSummary, 'id' | 'name' | 'brandName' | 'price' | 'salePrice'> & Partial<ProductSummary>;
const normalized = (value?: string | null) => value?.trim().toLowerCase() || '';
const family = (product: Reference) =>
  product.modelCode ? `${normalized(product.brandName)}:${normalized(product.modelCode)}` : '';
const tokens = (name: string) =>
  new Set(
    normalized(name)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2 && !['gundam', 'model', 'edition', 'mô', 'hình'].includes(word)),
  );
const priceOf = (product: Reference) => {
  const available = product.conditions?.filter((condition) => condition.stock > 0);
  return available?.length ? Math.min(...available.map((condition) => condition.minSalePrice)) : product.salePrice;
};

// Content-based related products for a catalog with little co-purchase history. No invented personalization,
// random ordering or unverified "bought together" claims. Public eligibility is enforced by the service.
export function rankRelatedProducts<T extends ProductSummary>(source: Reference, candidates: T[], limit = 4) {
  const sourceTokens = tokens(source.name);
  const sourcePrice = priceOf(source);
  const seen = new Set<string>(family(source) ? [family(source)] : []);
  const ids = new Set<number>([source.id]);
  const scored = candidates
    .filter((product) => (product.groupStock ?? product.stock) > 0)
    .map((product) => {
      const category = !!source.category?.id && source.category.id === product.category?.id;
      const brand = !!normalized(source.brandName) && normalized(source.brandName) === normalized(product.brandName);
      const scale = !!source.scale && source.scale === product.scale;
      const words = tokens(product.name);
      const overlap =
        [...sourceTokens].filter((word) => words.has(word)).length / Math.max(1, sourceTokens.size, words.size);
      const price = priceOf(product);
      const distance = sourcePrice > 0 && price > 0 ? Math.abs(Math.log(price / sourcePrice)) : Infinity;
      const score =
        Number(category) * 40 +
        Number(brand) * 25 +
        Number(scale) * 18 +
        overlap * 18 +
        Math.max(0, 12 * (1 - distance)) +
        (source.assemblyState && source.assemblyState === product.assemblyState ? 4 : 0) +
        Math.min(3, Math.log1p(Math.max(0, product.sold ?? 0)) / 3);
      const reason: RecommendationReason = category
        ? 'category'
        : brand
          ? 'brand'
          : scale
            ? 'scale'
            : distance < 0.3
              ? 'price'
              : 'discover';
      return { product, reason, score };
    })
    .sort((a, b) => b.score - a.score || a.product.id - b.product.id);
  const result: { product: T; reason: RecommendationReason }[] = [];
  for (const item of scored) {
    const key = family(item.product);
    if (ids.has(item.product.id) || (key && seen.has(key))) continue;
    ids.add(item.product.id);
    if (key) seen.add(key);
    result.push({ product: item.product, reason: item.reason });
    if (result.length >= Math.max(1, Math.min(8, limit))) break;
  }
  return result;
}
