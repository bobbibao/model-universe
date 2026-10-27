import type { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { seedTestDatabase, testApp } from './support/testDb';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import RecommendationEventModel from '../../src/core/server/database/client/models/RecommendationEvent.Model';
import PromotionAuditModel from '../../src/core/server/database/client/models/PromotionAudit.Model';

describe('smart recommendations API, behavioral tracking & admin governance (db)', () => {
  let db: Sequelize;

  beforeAll(async () => {
    db = await seedTestDatabase();
  }, 600000);

  afterAll(async () => {
    await db?.close();
  });

  const createFixture = (sku: string, extra: Record<string, unknown> = {}) =>
    ProductModel.create({
      sku,
      name: `Smart Rec Fixture ${sku}`,
      brandName: 'Bandai',
      modelCode: sku,
      scale: '1/100',
      price: 1200000,
      importPrice: 700000,
      stock: 3,
      imageUrl: '/images/store/product-placeholder.svg',
      ...extra,
    });

  it('records behavioral events, resolves child condition units to main listing, and deduplicates bursts', async () => {
    const main = await createFixture('SMART-MAIN-1', { brandName: 'Motor Nuclear', scale: '1/72', price: 1500000 });
    const child = await createFixture('SMART-MAIN-1-2HAND', {
      parentProductId: main.id,
      condition: 'preowned',
      price: 1100000,
      stock: 1,
    });

    const app = await testApp('Recommendation.Controller', 'AdminRecommendation.Controller');

    const first = await request(app)
      .post('/api/recommendations/events')
      .send({
        sessionKey: 'sess_collector_alpha_001',
        eventType: 'product_view',
        surface: 'product_detail',
        productId: child.id,
      })
      .expect(200);

    expect(first.body).toEqual({ recorded: true });

    const duplicate = await request(app)
      .post('/api/recommendations/events')
      .send({
        sessionKey: 'sess_collector_alpha_001',
        eventType: 'product_view',
        surface: 'product_detail',
        productId: child.id,
      })
      .expect(200);

    expect(duplicate.body).toEqual({ recorded: false });

    await request(app)
      .post('/api/recommendations/events')
      .send({
        sessionKey: 'sess_collector_alpha_001',
        eventType: 'search',
        surface: 'catalog',
        searchQuery: 'Motor Nuclear 1/72',
      })
      .expect(200);

    const savedView = await RecommendationEventModel.findOne({
      where: { sessionKey: 'sess_collector_alpha_001', eventType: 'product_view' },
    });
    expect(savedView).not.toBeNull();
    expect(savedView?.productId).toBe(main.id);
    expect(savedView?.brandName).toBe('Motor Nuclear');
  });

  it('serves multi-strategy recommendations across home, product_detail and cart surfaces without leaking internal fields', async () => {
    const anchor = await createFixture('SMART-ANCHOR-2', {
      brandName: 'Motor Nuclear',
      scale: '1/72',
      price: 1600000,
    });
    const sibling = await createFixture('SMART-SIBLING-2', {
      brandName: 'Motor Nuclear',
      scale: '1/72',
      price: 1450000,
    });
    const budgetMain = await createFixture('SMART-BUDGET-2', {
      brandName: 'Motor Nuclear',
      scale: '1/72',
      price: 1550000,
      stock: 0,
    });
    await createFixture('SMART-BUDGET-2-PREOWNED', {
      parentProductId: budgetMain.id,
      condition: 'preowned',
      price: 980000,
      stock: 1,
    });

    const app = await testApp('Recommendation.Controller', 'AdminRecommendation.Controller');

    const pdpRes = await request(app)
      .get('/api/recommendations')
      .query({
        surface: 'product_detail',
        anchorProductId: String(anchor.id),
        sessionKey: 'sess_collector_alpha_001',
        limit: '6',
      })
      .expect(200);

    expect(pdpRes.body.surface).toBe('product_detail');
    expect(Array.isArray(pdpRes.body.sections)).toBe(true);
    expect(pdpRes.body.sections.length).toBeGreaterThan(0);

    const allItems = pdpRes.body.sections.flatMap(
      (s: { items: Array<{ product: Record<string, unknown> }> }) => s.items,
    );
    const recommendedIds = allItems.map((item: { product: { id: number } }) => item.product.id);
    expect(recommendedIds).toContain(sibling.id);
    expect(recommendedIds).not.toContain(anchor.id);

    for (const item of allItems) {
      expect(item.product.groupStock).toBeGreaterThan(0);
      for (const secretField of ['importPrice', 'supplierId', 'pricingReferenceMemberVnd', 'parentProductId']) {
        expect(item.product).not.toHaveProperty(secretField);
      }
    }

    const cartRes = await request(app)
      .get('/api/recommendations')
      .query({
        surface: 'cart',
        cartProductIds: String(anchor.id),
        cartSubtotalVnd: '650000',
        limit: '4',
      })
      .expect(200);

    expect(cartRes.body.surface).toBe('cart');
    expect(cartRes.body.sections.some((s: { key: string }) => s.key === 'cart_addon')).toBe(true);
  });

  it('enforces admin RBAC and audits configuration updates', async () => {
    const app = await testApp('Recommendation.Controller', 'AdminRecommendation.Controller');

    await request(app).get('/api/admin/recommendations/analytics').expect(401);
    await request(app).get('/api/admin/recommendations/analytics').set('x-test-role', 'USER').expect(403);

    const analyticsRes = await request(app)
      .get('/api/admin/recommendations/analytics?days=30')
      .set('x-test-role', 'ADMIN')
      .expect(200);

    expect(analyticsRes.body).toHaveProperty('totals');
    expect(analyticsRes.body).toHaveProperty('byStrategy');
    expect(analyticsRes.body).toHaveProperty('config');

    const updateRes = await request(app)
      .put('/api/admin/recommendations/config')
      .set('x-test-role', 'ADMIN')
      .send({
        personalizationWeight: 42,
        coPurchaseWeight: 35,
        freeshipThresholdVnd: 1200000,
        maxPerBrandScale: 2,
        reason: 'Tune weights for weekend Gunpla event',
      })
      .expect(200);

    expect(updateRes.body.personalizationWeight).toBe(42);
    expect(updateRes.body.coPurchaseWeight).toBe(35);
    expect(updateRes.body.freeshipThresholdVnd).toBe(1200000);
    expect(updateRes.body.maxPerBrandScale).toBe(2);

    const auditEntry = await PromotionAuditModel.findOne({
      where: { entityType: 'recommendation_config', action: 'update' },
      order: [['id', 'DESC']],
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.reason).toBe('Tune weights for weekend Gunpla event');
  });
});

