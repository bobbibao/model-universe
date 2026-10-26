import type { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { seedTestDatabase, testApp } from './support/testDb';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductService from '../../src/core/server/services/ProductService';

describe('multi-facet product discovery', () => {
  let db: Sequelize, a: ProductModel, b: ProductModel, parent: ProductModel;
  const service = new ProductService();
  beforeAll(async () => {
    db = await seedTestDatabase();
    const create = (sku: string, extra: Record<string, unknown> = {}) =>
      ProductModel.create({
        sku,
        name: sku,
        brandName: "Facet A&B's Lab",
        price: 1000000,
        importPrice: 500000,
        stock: 1,
        scale: '1/100',
        imageUrl: '/images/store/product-placeholder.svg',
        ...extra,
      });
    a = await create('FACET-A');
    b = await create('FACET-B', {
      brandName: 'Facet B',
      condition: 'preowned',
      assemblyState: 'assembled',
      scale: '1/144',
    });
    parent = await create('FACET-C', { brandName: 'Facet C', scale: '1/72' });
    await create('FACET-C-DEFECT', {
      brandName: 'Facet C',
      parentProductId: parent.id,
      condition: 'defective',
      assemblyState: 'assembled',
      scale: '1/72',
    });
    await create('FACET-HIDDEN', { isArchived: true });
  }, 600000);
  afterAll(async () => {
    await db?.close();
  });
  const ids = async (filters: Parameters<ProductService['listPublic']>[0]) =>
    (await service.listPublic(filters)).rows.map((row) => row.id);
  it('ORs choices within each facet and ANDs across facets', async () => {
    expect(
      (
        await ids({
          brand: [a.brandName, b.brandName],
          condition: ['new', 'preowned'],
          scale: ['1/100', '1/144'],
          assemblyState: ['unassembled', 'assembled'],
          limit: 100,
          offset: 0,
        })
      ).sort(),
    ).toEqual([a.id, b.id].sort());
    expect(await ids({ brand: [a.brandName, b.brandName], scale: ['1/144'], limit: 100, offset: 0 })).toEqual([b.id]);
    expect(await ids({ brand: a.brandName, limit: 100, offset: 0 })).toEqual([a.id]);
  });
  it('matches all selected facets on the same sellable SKU, resolving options to their main listing', async () => {
    expect(
      await ids({
        brand: 'Facet C',
        condition: ['preowned', 'defective'],
        assemblyState: ['assembled'],
        limit: 100,
        offset: 0,
      }),
    ).toEqual([parent.id]);
    expect(
      await ids({ brand: 'Facet C', condition: ['defective'], assemblyState: ['unassembled'], limit: 100, offset: 0 }),
    ).toEqual([]);
  });
  it('supports repeated API query parameters and rejects malformed filters', async () => {
    const app = await testApp('Product.Controller');
    const query = new URLSearchParams();
    for (const value of [a.brandName, b.brandName]) query.append('brand', value);
    query.append('condition', 'new');
    query.append('condition', 'preowned');
    const result = await request(app).get(`/api/products?${query}`).expect(200);
    expect(result.body.payload.data.map((row: { id: number }) => row.id).sort()).toEqual([a.id, b.id].sort());
    await request(app).get('/api/products?brand[bad]=value').expect(400);
    await request(app).get('/api/products?assemblyState=invalid&assemblyState=assembled').expect(400);
  });
});
