import { rankRelatedProducts } from '../../src/shared/product-recommendations';
import type { ProductSummary } from '../../src/shared/types/product';

const product = (id: number, extra: Partial<ProductSummary> = {}): ProductSummary => ({
  id,
  name: 'Astral knight',
  brandName: 'Bandai',
  scale: '1/100',
  modelCode: `CODE-${id}`,
  price: 1000000,
  salePrice: 1000000,
  discountPercent: 0,
  discountEndsAt: null,
  stock: 2,
  imageUrl: '/images/model.webp',
  rating: 0,
  reviewCount: 0,
  isFeatured: false,
  salesChannel: 'web',
  category: { id: 1, name: 'Model kits', slug: 'model-kits' },
  ...extra,
});

describe('content-based related models', () => {
  it('excludes self, duplicate ids, sold-out models and duplicate model families', () => {
    const source = product(1);
    const rows = rankRelatedProducts(source, [
      source,
      product(2),
      product(2),
      product(3, { stock: 0 }),
      product(4, { modelCode: source.modelCode }),
      product(5, { modelCode: 'CODE-2' }),
    ]);
    expect(rows.map(({ product: row }) => row.id)).toEqual([2]);
  });
  it('prefers contextual matches over unrelated popular or discounted products', () => {
    const rows = rankRelatedProducts(product(1), [
      product(2, {
        name: 'Unrelated',
        brandName: 'Other',
        category: undefined,
        scale: '1/60',
        sold: 999999,
        salePrice: 100000,
      }),
      product(3, { sold: 0 }),
    ]);
    expect(rows[0]).toMatchObject({ product: { id: 3 }, reason: 'category' });
  });
  it('ranks near prices above expensive alternatives when identities match', () => {
    expect(
      rankRelatedProducts(product(1), [product(2, { salePrice: 9000000 }), product(3, { salePrice: 1100000 })])[0]
        .product.id,
    ).toBe(3);
  });
  it('uses available condition prices and keeps models stocked only in another condition', () => {
    const conditions = [{ condition: 'preowned', units: 1, stock: 1, minSalePrice: 1000000 }];
    const rows = rankRelatedProducts(product(1), [
      product(2, { price: 9000000, salePrice: 9000000, stock: 0, groupStock: 1, conditions }),
      product(3, { salePrice: 1200000 }),
      product(4, { stock: 5, groupStock: 0 }),
    ]);
    expect(rows.map(({ product: row }) => row.id)).toEqual([2, 3]);
  });
  it('has stable tie ordering regardless of database result ordering', () => {
    const candidates = [product(8), product(3), product(5)];
    expect(rankRelatedProducts(product(1), candidates).map(({ product: row }) => row.id)).toEqual([3, 5, 8]);
    expect(rankRelatedProducts(product(1), candidates.reverse()).map(({ product: row }) => row.id)).toEqual([3, 5, 8]);
  });
  it('works with sparse attributes without NaN scores or fabricated similarity', () => {
    const source = product(1, { brandName: '', category: undefined, scale: null, price: 0, salePrice: 0 });
    expect(
      rankRelatedProducts(source, [product(2, { name: '', category: undefined, price: 0, salePrice: 0 })])[0].reason,
    ).toBe('discover');
    expect(rankRelatedProducts(source, [])).toEqual([]);
  });
  it('bounds output and never mutates catalog objects', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => Object.freeze(product(index + 2)));
    const before = JSON.stringify(candidates);
    expect(rankRelatedProducts(product(1), candidates)).toHaveLength(4);
    expect(rankRelatedProducts(product(1), candidates, 100)).toHaveLength(8);
    expect(JSON.stringify(candidates)).toBe(before);
  });
});
