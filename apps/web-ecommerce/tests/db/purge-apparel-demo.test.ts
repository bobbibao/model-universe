import { QueryTypes } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import { runMigrations } from '../../src/core/server/database/migrations/Migrator';
import SupplierModel from '../../src/core/server/database/client/models/Supplier.Model';
import MarketCompetitorModel from '../../src/core/server/database/client/models/MarketCompetitor.Model';
import MarketCompetitorPriceModel from '../../src/core/server/database/client/models/MarketCompetitorPrice.Model';
import MarketCompetitorCampaignModel from '../../src/core/server/database/client/models/MarketCompetitorCampaign.Model';
import MarketTrendPointModel from '../../src/core/server/database/client/models/MarketTrendPoint.Model';
import MarketEventModel from '../../src/core/server/database/client/models/MarketEvent.Model';
import AgentSettingModel from '../../src/core/server/database/client/models/AgentSetting.Model';
import AgentSettingAuditModel from '../../src/core/server/database/client/models/AgentSettingAudit.Model';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';

// 2026-11-05-63: a database seeded by the former clothing shop loses that shop's demo suppliers, competitors (with
// their prices and campaigns), trend keywords and history, event categories and the admin's surname; the shop's own
// data stays.
const MIGRATION = '2026-11-05-63-purge-apparel-demo-data';

describe('purging the clothing shop demo data', () => {
  let sequelize: Sequelize;
  beforeAll(async () => {
    sequelize = await seedTestDatabase();
  }, 600_000);
  afterAll(() => sequelize.close());

  const lastNames = async () =>
    (await sequelize.query<{ lastName: string }>(`SELECT "lastName" FROM "user"`, { type: QueryTypes.SELECT })).map(
      (row) => row.lastName,
    );

  it('removes what the clothing shop seeded and keeps the rest', async () => {
    const [product] = await ProductModel.findAll({ limit: 1 });
    const fashion = await SupplierModel.create({
      name: 'Công ty TNHH Thời trang Phương Nam',
      website: 'https://phuongnamfashion.example.com',
    });
    const footwear = await SupplierModel.create({
      name: 'Nhà phân phối Giày dép Sài Gòn',
      website: 'https://saigonfootwear.example.com',
    });
    await product.update({ supplierId: footwear.id });
    const kits = await MarketCompetitorModel.count();
    const rival = await MarketCompetitorModel.create({ name: 'Giày Việt Store', website: 'https://giayviet.example' });
    await MarketCompetitorPriceModel.create({
      competitorId: rival.id,
      ourProductId: product.id,
      url: 'https://giayviet.example/products/1',
      watch: false,
      source: 'csv',
      title: 'Giày sneaker',
      priceVnd: 500_000,
      observedAt: new Date(),
      confidence: 0.9,
    });
    await MarketCompetitorCampaignModel.create({
      competitorId: rival.id,
      title: 'Giảm 30% toàn bộ giày',
      category: 'shoes',
      discountPct: 30,
      source: 'manual',
      observedAt: new Date(),
    });
    await MarketTrendPointModel.create({ keyword: 'áo khoác', geo: 'VN', date: '2026-10-01', interest: 50, source: 'seed' });
    const christmas = await MarketEventModel.findOne({ where: { code: 'christmas' } });
    await christmas!.update({ categories: ['jackets', 'sweaters', 'boots'] });
    const setting = await AgentSettingModel.findByPk('market.trend_keywords');
    await setting!.update({ value: [{ keyword: 'áo khoác', category: 'jackets' }] });
    await sequelize.query(`UPDATE "user" SET "lastName" = 'Clothing Shop' WHERE role = 'ADMIN'`);
    await sequelize.query(`DELETE FROM "SequelizeMeta" WHERE name = :name`, { replacements: { name: MIGRATION } });

    expect(await runMigrations(sequelize)).toEqual([MIGRATION]);

    expect(await SupplierModel.findByPk(fashion.id)).toBeNull();
    // A product still refers to it: kept.
    expect(await SupplierModel.findByPk(footwear.id)).not.toBeNull();
    expect(await MarketCompetitorModel.findByPk(rival.id)).toBeNull();
    expect(await MarketCompetitorModel.count()).toBe(kits);
    expect(await MarketCompetitorPriceModel.count({ where: { competitorId: rival.id } })).toBe(0);
    expect(await MarketCompetitorCampaignModel.count({ where: { competitorId: rival.id } })).toBe(0);
    expect(await MarketTrendPointModel.count({ where: { keyword: 'áo khoác' } })).toBe(0);
    expect((await christmas!.reload()).categories).toEqual([]);
    const keywords = (await setting!.reload()).value as { keyword: string; category: string | null }[];
    expect(keywords.map((item) => item.keyword)).toContain('gunpla');
    expect(keywords.every((item) => item.category === null)).toBe(true);
    expect(await AgentSettingAuditModel.count({ where: { key: 'market.trend_keywords' } })).toBe(1);
    expect(await lastNames()).not.toContain('Clothing Shop');
    expect(await ProductModel.findByPk(product.id)).not.toBeNull();
  });
});
