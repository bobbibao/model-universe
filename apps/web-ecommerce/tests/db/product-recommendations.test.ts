import type { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { seedTestDatabase, testApp } from './support/testDb';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductService from '../../src/core/server/services/ProductService';

describe('public related-product eligibility and contract', () => {
  let db: Sequelize;
  const service = new ProductService();
  beforeAll(async () => {
    db = await seedTestDatabase();
  }, 600000);
  afterAll(async () => {
    await db?.close();
  });
  const create = (sku: string, extra: Record<string, unknown> = {}) =>
    ProductModel.create({
      sku,
      name: `Recommendation fixture ${sku}`,
      brandName: "Collector's Lab",
      modelCode: sku,
      scale: '1/100',
      price: 1000000,
      importPrice: 500000,
      stock: 2,
      imageUrl: '/images/store/product-placeholder.svg',
      ...extra,
    });
  it('returns only published sellable main listings, resolving a condition key to its parent', async () => {
    const source = await create('REC-SOURCE');
    const option = await create('REC-SOURCE-OPTION', { parentProductId: source.id, condition: 'preowned' });
    const available = await create('REC-AVAILABLE');
    const alternate = await create('REC-ALTERNATE', { stock: 0 });
    await create('REC-ALTERNATE-OPTION', { parentProductId: alternate.id, condition: 'preowned', stock: 1 });
    const excluded = await Promise.all([
      create('REC-ARCHIVED', { isArchived: true }),
      create('REC-HELD', { inventoryStatus: 'quarantine' }),
      create('REC-DRAFT', { listingStatus: 'draft' }),
      create('REC-EMPTY', { stock: 0 }),
    ]);
    const rows = await service.getRecommendations(option.uuid);
    const ids = rows.map(({ product }) => product.id);
    expect(ids).toContain(available.id);
    expect(ids).toContain(alternate.id);
    for (const row of [source, option, ...excluded]) expect(ids).not.toContain(row.id);
    expect(rows.length).toBeLessThanOrEqual(4);
    for (const { product } of rows) {
      expect(product.groupStock).toBeGreaterThan(0);
      for (const field of [
        'importPrice',
        'supplierId',
        'pricingReferenceMemberVnd',
        'productionDate',
        'parentProductId',
      ])
        expect(product).not.toHaveProperty(field);
    }
    const app = await testApp('Product.Controller');
    const response = await request(app).get(`/api/products/${source.slug}/recommendations`).expect(200);
    expect(response.body.map((item: { product: { id: number } }) => item.product.id)).toEqual(ids);
    await request(app).get('/api/products/0/recommendations').expect(404);
    await request(app).get(`/api/products/${excluded[0].id}/recommendations`).expect(404);
  });
});
