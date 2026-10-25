import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import SupplierModel from '../../src/core/server/database/client/models/Supplier.Model';
import ProductService from '../../src/core/server/services/ProductService';
import ProductConditionService from '../../src/core/server/services/ProductConditionService';
import StockImportService from '../../src/core/server/services/StockImportService';

// Conditions are a list the owner extends (Admin > Products > Conditions): a new condition with its own rules is used
// like a built-in one, the built-in ones keep their rules, a retired one is not chosen for new units, and one in use
// is never removed.
describe('product conditions the owner adds', () => {
  let db: Sequelize, adminId: number, userId: number;
  const conditions = new ProductConditionService(),
    products = new ProductService();
  const listing = () =>
    ProductModel.findOne({ where: { partnerId: null, isArchived: false, parentProductId: null, condition: 'new' } });

  beforeAll(async () => {
    db = await seedTestDatabase();
    adminId = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!.id;
    userId = (await UserModel.findOne({ where: { role: 'USER', isActive: true } }))!.id;
  }, 600_000);
  afterAll(() => db.close());

  it('starts with the four built-in conditions, whose rules cannot change', async () => {
    expect((await conditions.all()).map((type) => type.key)).toEqual(['new', 'preowned', 'incomplete', 'defective']);
    await expect(conditions.update(adminId, 'preowned', { uniqueUnit: false })).rejects.toMatchObject({
      code: 'SYSTEM_CONDITION',
    });
    await expect(conditions.update(adminId, 'new', { isActive: false })).rejects.toMatchObject({
      code: 'SYSTEM_CONDITION',
    });
    await expect(conditions.remove(adminId, 'defective')).rejects.toMatchObject({ code: 'SYSTEM_CONDITION' });
    const renamed = await conditions.update(adminId, 'preowned', { nameVi: 'Đã qua sử dụng', sortOrder: 20 });
    expect(renamed).toMatchObject({ nameVi: 'Đã qua sử dụng', uniqueUnit: true });
    await expect(conditions.create(userId, { nameVi: 'X', nameEn: 'X' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('uses an added condition with its rules, then retires it for new units', async () => {
    const scratched = await conditions.create(adminId, {
      nameVi: 'Trầy xước nhẹ',
      nameEn: 'Light scratches',
      descriptionVi: 'Có vết xước nhỏ được mô tả.',
      requiresDefects: true,
      skuSuffix: 'TX',
    });
    expect(scratched).toMatchObject({ key: 'light-scratches', isSystem: false, isActive: true, sortOrder: 50 });
    await expect(
      conditions.create(adminId, { key: 'light-scratches', nameVi: 'A', nameEn: 'A' }),
    ).rejects.toMatchObject({
      code: 'CONDITION_EXISTS',
    });
    await expect(conditions.create(adminId, { key: 'Bad Key', nameVi: 'A', nameEn: 'A' })).rejects.toMatchObject({
      statusCode: 400,
    });

    const main = (await listing())!;
    const base = { condition: 'light-scratches', pricingReferenceMemberVnd: 500_000, importPrice: 300_000, stock: 1 };
    // Its rule: each defect must be described.
    await expect(products.createConditionOption(main.id, base)).rejects.toMatchObject({ statusCode: 400 });
    const option = await products.createConditionOption(main.id, { ...base, defects: ['Scratch on the left shield'] });
    expect(option).toMatchObject({ parentProductId: main.id, sku: `${main.sku}-TX1` });
    const list = await products.listPublic({ condition: 'light-scratches', limit: 100, offset: 0 });
    expect(list.rows.map((row) => row.id)).toContain(main.id);
    expect(
      list.rows
        .find((row) => row.id === main.id)!
        .conditions.map((summary: { condition: string }) => summary.condition),
    ).toContain('light-scratches');

    // Retired: kept on its unit, not chosen for a new one; in use, so never removed.
    await conditions.update(adminId, 'light-scratches', { isActive: false });
    await expect(
      products.createConditionOption(main.id, { ...base, defects: ['Another scratch'] }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(conditions.remove(adminId, 'light-scratches')).rejects.toMatchObject({ code: 'CONDITION_IN_USE' });
    expect((await conditions.list()).find((type) => type.key === 'light-scratches')).toMatchObject({
      isActive: false,
      productCount: 1,
    });
  });

  it('treats an added one-of-a-kind condition like second hand, and removes an unused added condition', async () => {
    await conditions.create(adminId, {
      key: 'display-piece',
      nameVi: 'Hàng trưng bày',
      nameEn: 'Display piece',
      uniqueUnit: true,
    });
    const main = (await listing())!;
    // One of a kind: one piece with three real uploaded photos.
    await expect(
      products.createConditionOption(main.id, {
        condition: 'display-piece',
        pricingReferenceMemberVnd: 400_000,
        importPrice: 200_000,
        stock: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const unit = await ProductModel.create({
      ...(await listing())!.get({ plain: true }),
      id: undefined,
      uuid: undefined,
      slug: undefined,
      sku: 'DISPLAY-PIECE-FIXTURE',
      parentProductId: null,
      condition: 'display-piece',
      stock: 0,
    });
    const supplierId = (await SupplierModel.findOne({ where: { isActive: true } }))!.id;
    await expect(
      new StockImportService().create(adminId, {
        supplierId,
        items: [{ productId: unit.id, quantity: 1, importPrice: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'UNIQUE_ITEM_INTAKE_REQUIRED' });
    await unit.destroy();
    expect(await conditions.remove(adminId, 'display-piece')).toEqual({ key: 'display-piece' });
    expect((await conditions.all()).map((type) => type.key)).not.toContain('display-piece');
  });
});
