import type { ProductSummary } from '@/shared/types/product';

// The kit shown large in the home hero: the fourth featured product (a dark studio shot more often than not), else the
// first one in stock with a real photo. The page preloads this same photo as its largest paint.
export function heroProduct(products: ProductSummary[] = []): ProductSummary | undefined {
  const real = (product?: ProductSummary) => Boolean(product?.imageUrl?.startsWith('/uploads/'));
  if (real(products[3])) return products[3];
  return products.find((product) => real(product) && (product.groupStock ?? product.stock) > 0);
}
