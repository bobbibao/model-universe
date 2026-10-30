import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import ModelFamilyModel from '../../src/core/server/database/client/models/ModelFamily.Model';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductService from '../../src/core/server/services/ProductService';

describe('admin catalog counts', () => {
  let db: Sequelize;
  const service = new ProductService();
  beforeAll(async () => {
    db = await seedTestDatabase();
    const family = await ModelFamilyModel.create({
      identityKey: 'summary-fixture',
      name: 'Summary fixture',
      brandName: 'Summary Brand',
    });
    for (let i = 0; i < 3; i++)
      await ProductModel.create({
        name: `SummaryCountFixture ${i}`,
        sku: `SUMMARY-COUNT-${i}`,
        brandName: 'Summary Brand',
        modelFamilyId: family.id,
        condition: i ? 'preowned' : 'new',
        itemTypeKey: i ? 'preowned' : 'new',
        price: 1000000,
        importPrice: 600000,
        stock: i + 1,
        imageUrl: '/uploads/fixture.jpg',
        isArchived: i === 2,
      });
  }, 600000);
  afterAll(async () => {
    await db?.close();
  });

  it('counts distinct models and all condition SKUs before pagination', async () => {
    const result = await service.listAdmin({ q: 'SummaryCountFixture', limit: 1, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.count).toBe(3);
    expect(result.summary).toEqual({ models: 1, products: 3, stock: 6 });
  });
  it('applies search and publication filters to both rows and counts', async () => {
    const result = await service.listAdmin({ q: 'SummaryCountFixture', status: 'active', limit: 10, offset: 0 });
    expect(result.count).toBe(2);
    expect(result.summary).toEqual({ models: 1, products: 2, stock: 3 });
    expect((await service.listAdmin({ q: 'SummaryCountFixture missing', limit: 10, offset: 0 })).summary).toEqual({
      models: 0,
      products: 0,
      stock: 0,
    });
  });
});
