import { randomUUID } from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductImageModel from '../../src/core/server/database/client/models/ProductImage.Model';
import PartnerProfileModel from '../../src/core/server/database/client/models/PartnerProfile.Model';
import PromotionAuditModel from '../../src/core/server/database/client/models/PromotionAudit.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import ProductBulkService from '../../src/core/server/services/ProductBulkService';
import ProductConditionService from '../../src/core/server/services/ProductConditionService';
import ProductService from '../../src/core/server/services/ProductService';
import { AuthenticationMiddleware } from '../../src/core/server/middleware/Authentication.Middleware';
import { signSessionToken } from '../../src/shared/server/utils/JwtUtils';
import type { ProductBulkChanges } from '../../src/shared/product-bulk';

describe('atomic admin bulk edits', () => {
  let db: Sequelize, adminId: number, userId: number;
  let serial = 0;
  const service = new ProductBulkService();
  beforeAll(async () => {
    db = await seedTestDatabase();
    adminId = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!.id;
    userId = (await UserModel.findOne({ where: { role: 'USER', isActive: true } }))!.id;
  }, 600000);
  afterAll(async () => {
    await db?.close();
  });
  const create = (extra: Record<string, unknown> = {}) =>
    ProductModel.create({
      sku: `BULK-${++serial}`,
      name: `Bulk fixture ${serial}`,
      brandName: 'Bulk Test',
      price: 1000000,
      importPrice: 500000,
      stock: 1,
      imageUrl: '/uploads/bulk-front.jpg',
      ...extra,
    });
  const input = (rows: ProductModel[], changes: ProductBulkChanges) => ({
    requestKey: randomUUID(),
    changes,
    items: rows.map((row) => ({ id: row.id, expectedUpdatedAt: new Date(row.updatedAt).toISOString() })),
  });
  const photos = (row: ProductModel) =>
    ProductImageModel.bulkCreate([
      { productId: row.id, url: '/uploads/bulk-back.jpg', sortOrder: 0 },
      { productId: row.id, url: '/uploads/bulk-side.jpg', sortOrder: 1 },
    ]);

  it('updates only requested fields, audits each change, and deduplicates concurrent retries', async () => {
    const rows = await Promise.all([create(), create()]);
    const req = input(rows, { isFeatured: true });
    expect(await Promise.all([service.update(adminId, req), service.update(adminId, req)])).toEqual([
      { selectedCount: 2, updatedCount: 2 },
      { selectedCount: 2, updatedCount: 2 },
    ]);
    for (const row of rows) {
      const before = row.toJSON();
      await row.reload();
      expect(row).toMatchObject({
        isFeatured: true,
        price: before.price,
        stock: before.stock,
        sku: before.sku,
        condition: 'new',
      });
      expect(
        await PromotionAuditModel.count({
          where: { entityType: 'product_catalog', entityId: row.id, action: 'bulk_update' },
        }),
      ).toBe(1);
    }
    await expect(service.update(adminId, { ...req, changes: { isFeatured: false } })).rejects.toMatchObject({
      code: 'BULK_PRODUCT_CHANGED',
    });
    const noOp = await service.update(adminId, input(rows, { isFeatured: true }));
    expect(noOp).toEqual({ selectedCount: 2, updatedCount: 0 });
    expect(await service.update(adminId, input(rows, { isFeatured: false }))).toEqual({
      selectedCount: 2,
      updatedCount: 2,
    });
    for (const row of rows) expect((await row.reload()).isFeatured).toBe(false);
    const listed = await new ProductService().listAdmin({ q: rows[0].sku, limit: 10, offset: 0 });
    expect(listed.rows[0].updatedAt).toBeTruthy();
  });
  it('changes the selected physical SKU without changing its other condition options', async () => {
    const parent = await create({ missingAccessories: ['Stand'] });
    const child = await create({ parentProductId: parent.id, condition: 'defective', defects: ['Scratch'] });
    await service.update(adminId, input([parent], { condition: 'incomplete', isFeatured: true }));
    expect(await parent.reload()).toMatchObject({
      condition: 'incomplete',
      price: 1000000,
      stock: 1,
      missingAccessories: ['Stand'],
    });
    expect(await child.reload()).toMatchObject({ condition: 'defective', isFeatured: false });
  });
  it('rolls back the entire batch if any unit lacks second-hand photos or has too much stock', async () => {
    const good = await create();
    await photos(good);
    const bad = await create({ stock: 2 });
    await expect(
      service.update(adminId, input([good, bad], { condition: 'preowned', isFeatured: true })),
    ).rejects.toMatchObject({
      code: 'BULK_PRODUCT_CONDITION_INVALID',
    });
    for (const row of [good, bad]) {
      expect(await row.reload()).toMatchObject({ condition: 'new', isFeatured: false });
      expect(await PromotionAuditModel.count({ where: { entityType: 'product_catalog', entityId: row.id } })).toBe(0);
    }
    await service.update(adminId, input([good], { condition: 'preowned' }));
    expect(await good.reload()).toMatchObject({ condition: 'preowned' });
    await expect(service.update(adminId, input([good], { condition: 'new' }))).rejects.toMatchObject({
      code: 'BULK_PRODUCT_CONDITION_INVALID',
    });
  });
  it.each(['incomplete', 'defective', 'unknown-condition'])(
    'requires valid disclosures and an active target: %s',
    async (condition) => {
      const row = await create();
      await expect(service.update(adminId, input([row], { condition }))).rejects.toMatchObject({
        code: 'BULK_PRODUCT_CONDITION_INVALID',
      });
      expect((await row.reload()).condition).toBe('new');
    },
  );
  it('rejects retired custom conditions', async () => {
    const conditions = new ProductConditionService();
    const type = await conditions.create(adminId, { nameVi: 'Trưng bày', nameEn: 'Bulk Display', skuSuffix: 'BD' });
    await conditions.update(adminId, type.key, { isActive: false });
    await expect(service.update(adminId, input([await create()], { condition: type.key }))).rejects.toMatchObject({
      code: 'BULK_PRODUCT_CONDITION_INVALID',
    });
  });
  it('rejects stale versions, missing IDs, partner rows and condition options atomically', async () => {
    const good = await create();
    const stale = await create();
    const staleInput = input([good, stale], { isFeatured: true });
    await stale.update({ name: 'Changed by another editor', updatedAt: new Date(Date.now() + 1000) });
    await expect(service.update(adminId, staleInput)).rejects.toMatchObject({ code: 'BULK_PRODUCT_CHANGED' });
    const partner = await PartnerProfileModel.create({
      userId,
      requestKey: 'bulk-test',
      requestDigest: 'bulk-test',
      application: {},
      currentEvidenceIds: [],
      status: 'verified',
    });
    for (const bad of [await create({ partnerId: partner.id }), await create({ parentProductId: good.id })]) {
      await expect(service.update(adminId, input([good, bad], { isFeatured: true }))).rejects.toMatchObject({
        code: 'BULK_PRODUCT_CHANGED',
      });
    }
    const absent = input([good], { isFeatured: true });
    absent.items.push({ ...absent.items[0], id: 2147483647 });
    await expect(service.update(adminId, absent)).rejects.toMatchObject({ code: 'BULK_PRODUCT_CHANGED' });
    expect((await good.reload()).isFeatured).toBe(false);
  });
  it.each([{ isArchived: true }, { inventoryStatus: 'quarantine' }, { listingStatus: 'draft' }])(
    'does not feature unsellable rows: %j',
    async (extra) => {
      await expect(service.update(adminId, input([await create(extra)], { isFeatured: true }))).rejects.toMatchObject({
        code: 'BULK_PRODUCT_CHANGED',
      });
    },
  );
  it('enforces current admin permissions in the service and actual HTTP middleware', async () => {
    const body = input([await create()], { isFeatured: true });
    await expect(service.update(userId, body)).rejects.toMatchObject({ statusCode: 403 });
    await import('../../src/app/api/AdminProduct.Controller');
    const { router } = await import('../../src/shared/server/decorators/controller.decorator');
    const app = express();
    app.use(express.json(), cookieParser());
    app.use('/api', AuthenticationMiddleware, router);
    await request(app).post('/api/admin/products/bulk').send(body).expect(401);
    const userToken = await signSessionToken(userId, 'USER');
    await request(app)
      .post('/api/admin/products/bulk')
      .set('Cookie', `access_token=${userToken}`)
      .send(body)
      .expect(403);
    const adminToken = await signSessionToken(adminId, 'ADMIN');
    const result = await request(app)
      .post('/api/admin/products/bulk')
      .set('Cookie', `access_token=${adminToken}`)
      .send(body)
      .expect(200);
    expect(result.body.data).toEqual({ selectedCount: 1, updatedCount: 1 });
    await request(app)
      .post('/api/admin/products/bulk')
      .set('Cookie', `access_token=${adminToken}`)
      .send({ ...body, changes: { stock: 100 } })
      .expect(400);
    await UserModel.update({ isActive: false }, { where: { id: adminId } });
    try {
      await expect(service.update(adminId, body)).rejects.toMatchObject({ statusCode: 403 });
      await request(app)
        .post('/api/admin/products/bulk')
        .set('Cookie', `access_token=${adminToken}`)
        .send(body)
        .expect(401);
    } finally {
      await UserModel.update({ isActive: true }, { where: { id: adminId } });
    }
  });
});
