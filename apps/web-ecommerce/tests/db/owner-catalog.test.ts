import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import { MIGRATIONS } from '../../src/core/server/database/migrations';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductSourceModel from '../../src/core/server/database/client/models/ProductSource.Model';
import PromotionAuditModel from '../../src/core/server/database/client/models/PromotionAudit.Model';
import RestockSubscriptionModel from '../../src/core/server/database/client/models/RestockSubscription.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import {
  demoStock,
  loadOwnerCatalog,
  syncOwnerCatalog,
} from '../../src/core/server/database/client/seeders/OwnerCatalog';
import ProductService from '../../src/core/server/services/ProductService';
import CartService from '../../src/core/server/services/CartService';

// The owner's workbook made the shop's whole own catalogue (migration 2026-10-25-45), and one model sold in several
// conditions (condition options under a main listing).
describe("owner's catalogue and condition options", () => {
  let db: Sequelize;
  const rows = loadOwnerCatalog();
  const shopOwned = { partnerId: null, isArchived: false };
  const sync = () => db.transaction((transaction) => syncOwnerCatalog(rows, transaction));
  beforeAll(async () => {
    db = await seedTestDatabase();
  }, 600_000);
  afterAll(async () => {
    await db.close();
  });

  it('seeds the workbook with demo stock, which the migration leaves to the seed', async () => {
    const seeded = await ProductModel.findAll({ where: shopOwned });
    expect(seeded.map((product) => product.name).sort()).toEqual(rows.map((row) => row.name).sort());
    const first = seeded.find((product) => product.name === rows[0].name)!;
    expect(first.stock).toBe(demoStock(rows[0]));
    await MIGRATIONS.find((m) => m.name === '2026-10-25-45-owner-catalog')!.up({ context: { sequelize: db } } as never);
    expect((await first.reload()).stock).toBe(demoStock(rows[0]));
  });

  it('makes an existing shop exactly the workbook, retires the rest and is idempotent', async () => {
    // Products of an existing shop that are not in the workbook: one nothing refers to, one a customer follows.
    const base = {
      brandName: 'Synthetic fixture brand',
      price: 300_000,
      importPrice: 100_000,
      stock: 4,
      imageUrl: '/images/store/product-placeholder.svg',
      availableSizes: [],
    };
    const orphan = await ProductModel.create({ ...base, sku: 'OWNER-SYNC-ORPHAN', name: 'Synthetic retired fixture' });
    const followed = await ProductModel.create({
      ...base,
      sku: 'OWNER-SYNC-FOLLOWED',
      name: 'Synthetic followed fixture',
    });
    const userId = (await UserModel.findOne({ where: { role: 'USER' } }))!.id;
    await RestockSubscriptionModel.create({ userId, productId: followed.id });
    expect(await sync()).toMatchObject({ created: 0, deleted: 1, archived: 1 });
    expect(await ProductModel.findByPk(orphan.id)).toBeNull();
    expect((await followed.reload()).get({ plain: true })).toMatchObject({ isArchived: true, stock: 0 });

    const listings = await ProductModel.findAll({ where: shopOwned });
    expect(listings).toHaveLength(rows.length);
    expect(listings.map((product) => product.name).sort()).toEqual(rows.map((row) => row.name).sort());
    expect(listings.reduce((sum, product) => sum + product.stock, 0)).toBe(26);
    expect(listings.every((product) => product.categoryId === null && product.parentProductId === null)).toBe(true);
    // Retired products keep their history, hidden and without stock.
    expect(await ProductModel.count({ where: { partnerId: null, isArchived: true, stock: { [Op.gt]: 0 } } })).toBe(0);
    // Researched models keep their identity (SKU, images, provenance); new ones are keyed by their name.
    const researched = (await ProductSourceModel.findOne({ where: { catalogKey: 'mn-mnp-xh01-ban-thuong' } }))!;
    expect((await ProductModel.findByPk(researched.productId))!.sku).toBe('MU-MN-MNP-XH01-BAN-THUONG');
    expect(await ProductSourceModel.count({ where: { catalogKey: { [Op.like]: 'owner-%' } } })).toBe(
      rows.filter((row) => row.key.startsWith('owner-')).length,
    );
    const columns = await db.getQueryInterface().describeTable('product');
    expect('grade' in columns || 'series' in columns).toBe(false);

    const audits = await PromotionAuditModel.count({ where: { action: 'owner_catalog_sync' } });
    const before = (await ProductModel.findAll({ order: [['id', 'ASC']] })).map((product) =>
      product.get({ plain: true }),
    );
    expect(await sync()).toMatchObject({ created: 0, updated: 0, archived: 0, deleted: 0, unchanged: rows.length });
    expect(await PromotionAuditModel.count({ where: { action: 'owner_catalog_sync' } })).toBe(audits);
    expect(
      (await ProductModel.findAll({ order: [['id', 'ASC']] })).map((product) => product.get({ plain: true })),
    ).toEqual(before);
  });

  it('reports the inventory figures of the owner sheet', async () => {
    const { totals, brands } = await new ProductService().inventoryStats();
    expect(totals).toMatchObject({
      listings: 100,
      options: 0,
      stock: 26,
      unitsInStock: 15,
      brands: 6,
      costValue: 18_550_000,
      memberValue: 23_900_000,
      marginValue: 5_350_000,
    });
    expect(brands.find((row) => row.brand === 'Motor Nuclear')).toMatchObject({
      listings: 39,
      unitsInStock: 8,
      stock: 13,
    });
  });

  it('sells one model in several conditions, each with its own price, stock and SKU', async () => {
    const products = new ProductService();
    const listing = (await ProductModel.findOne({
      where: { ...shopOwned, name: 'MNP-XH04 - Ne Zha / Na Tra (màu gốc)' },
    }))!;
    await expect(
      products.createConditionOption(listing.id, {
        condition: 'incomplete',
        pricingReferenceMemberVnd: 500_000,
        stock: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const incomplete = await products.createConditionOption(listing.id, {
      condition: 'incomplete',
      missingAccessories: ['Fixture spear'],
      conditionNote: 'Synthetic fixture: box opened for inspection',
      pricingReferenceMemberVnd: 500_000,
      pricingIssueCount: 0,
      importPrice: 300_000,
      stock: 2,
    });
    expect(incomplete).toMatchObject({
      parentProductId: listing.id,
      sku: `${listing.sku}-TPK1`,
      name: listing.name,
      imageUrl: listing.imageUrl,
      stock: 2,
    });
    expect(
      incomplete.units.map((unit: { condition: string; isMain: boolean }) => [unit.condition, unit.isMain]),
    ).toEqual([
      ['new', true],
      ['incomplete', false],
    ]);

    // The storefront lists the model once, found through either condition, with both conditions on its card.
    const list = await products.listPublic({ condition: 'incomplete', limit: 100, offset: 0 });
    expect(list.rows.map((row) => row.id)).toEqual([listing.id]);
    expect(
      list.rows[0].conditions.map((summary: { condition: string; stock: number }) => [
        summary.condition,
        summary.stock,
      ]),
    ).toEqual([
      ['new', 3],
      ['incomplete', 2],
    ]);
    const all = await products.listPublic({ q: 'MNP-XH04', limit: 100, offset: 0 });
    expect(all.rows.some((row) => row.id === incomplete.id)).toBe(false);

    // The option's own page opens the model with the option selected; the received date stays private.
    const detail = await products.getPublicById(incomplete.slug as string);
    expect(detail).toMatchObject({ id: listing.id, selectedOptionId: incomplete.id });
    expect(detail.conditionOptions.map((unit: { id: number }) => unit.id)).toEqual([listing.id, incomplete.id]);
    expect('productionDate' in detail).toBe(false);

    // The cart prices the option by its own price and stock.
    const { lines } = await new CartService().resolveLines([{ productId: incomplete.id, size: '', quantity: 3 }]);
    expect(lines[0]).toMatchObject({ status: 'INSUFFICIENT_STOCK', availableStock: 2 });
    expect(lines[0].product).toMatchObject({ condition: 'incomplete', price: incomplete.price });

    // The model is edited on its listing and its options follow; a listing with options on sale is not deleted.
    const body = await products.getAdminById(listing.id);
    await products.update(listing.id, {
      ...body,
      scale: '1/100 (fixture)',
      expectedStock: body.stock,
      expectedPrice: body.price,
    });
    expect((await ProductModel.findByPk(incomplete.id))!.scale).toBe('1/100 (fixture)');
    await expect(products.remove(listing.id)).rejects.toMatchObject({ code: 'CONDITION_OPTIONS_EXIST' });
    expect(await products.remove(incomplete.id)).toEqual({ archived: false });
    expect((await ProductModel.findByPk(listing.id))!.imageUrl).toBe(listing.imageUrl);
  });
});
