import { Op } from 'sequelize';
import ReturnService from '../../src/core/server/services/ReturnService';
import ReturnRequestModel from '../../src/core/server/database/client/models/ReturnRequest.Model';
import ReturnItemModel, {
  RESTOCKABLE_CONDITIONS,
  RETURN_REASONS,
} from '../../src/core/server/database/client/models/ReturnItem.Model';
import BuybackPayoutModel from '../../src/core/server/database/client/models/BuybackPayout.Model';
import { randomUUID } from 'crypto';
import type { Sequelize } from 'sequelize-typescript';
import { useTestDatabase } from './support/testDb';
import DatabaseProvider from '../../src/core/server/database/Database.Provider';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ConditionNodeModel from '../../src/core/server/database/client/models/ConditionNode.Model';
import CatalogIntakeModel from '../../src/core/server/database/client/models/CatalogIntake.Model';
import BuybackRequestModel from '../../src/core/server/database/client/models/BuybackRequest.Model';
import BuybackEventModel from '../../src/core/server/database/client/models/BuybackEvent.Model';
import EvidenceModel from '../../src/core/server/database/client/models/Evidence.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import SupplierModel from '../../src/core/server/database/client/models/Supplier.Model';
import ProductService from '../../src/core/server/services/ProductService';
import BuybackService, { estimateFor } from '../../src/core/server/services/BuybackService';
import PawnService from '../../src/core/server/services/PawnService';
import StockImportService from '../../src/core/server/services/StockImportService';
import CatalogTreeService from '../../src/core/server/services/catalog/CatalogTreeService';
import ServiceConditionCaseService from '../../src/core/server/services/catalog/ServiceConditionCaseService';
import ConditionStockService from '../../src/core/server/services/catalog/ConditionStockService';
import CatalogMigrationService from '../../src/core/server/services/catalog/CatalogMigrationService';
import { seedConditionDemo } from '../../src/core/server/database/client/seeders/ConditionDemo';
import { LISTING_QC_CHECKS } from '../../src/shared/listing-qc';
import DirectSaleService from '../../src/core/server/services/DirectSaleService';
import OrderItemModel from '../../src/core/server/database/client/models/OrderItem.Model';

describe('condition catalog integration', () => {
  let db: Sequelize, source: ProductModel, adminId: number, customerId: number, supplierId: number;
  const tree = new CatalogTreeService(),
    products = new ProductService();
  const unique = randomUUID().slice(0, 8);
  beforeAll(async () => {
    useTestDatabase();
    process.env.DISABLE_BACKGROUND_JOBS = 'true';
    db = await DatabaseProvider.initializeDemoSchema();
    await seedConditionDemo();
    source = (await ProductModel.findOne({ where: { sku: 'DEMO-COND-01-5' } }))!;
    adminId = (await UserModel.findOne({ where: { email: 'admin@condition.demo' } }))!.id;
    customerId = (await UserModel.findOne({ where: { email: 'customer@condition.demo' } }))!.id;
    supplierId = (await SupplierModel.findOne({ where: { name: 'DEMO · Nguồn hàng kiểm thử' } }))!.id;
  }, 120000);
  afterAll(async () => {
    await db?.close();
  });
  const asset = () => ({
    name: source.name,
    modelCode: source.modelCode,
    version: 'QA',
    assemblyState: 'unassembled',
    boxCondition: 'QA',
    accessories: 'QA',
    defects: 'QA',
    repairHistory: 'QA',
  });
  const newRequest = async (conditionCase: any, overrides = {}) =>
    BuybackRequestModel.create({
      userId: customerId,
      requestKey: randomUUID(),
      requestDigest: randomUUID(),
      asset: asset(),
      conditionCase,
      conditionCaseStatus: conditionCase.salePriceVnd ? 'resolved' : 'pending',
      declaredIssues: [],
      ...overrides,
    });
  it('seeds 12 families / 64 SKUs and >50 nodes without doubling stock on rerun', async () => {
    const before = await CatalogIntakeModel.count();
    const stock = (await source.reload()).stock;
    const result = await seedConditionDemo();
    expect(result).toMatchObject({ families: 12, products: 64 });
    expect(result.nodes).toBeGreaterThanOrEqual(50);
    expect(await CatalogIntakeModel.count()).toBe(before);
    expect((await source.reload()).stock).toBe(stock);
  });
  it('matches a canonical combination despite selection order and quotes exactly S', async () => {
    const quote = await estimateFor({
      modelFamilyId: source.modelFamilyId,
      itemTypeKey: 'preowned',
      conditionNodeIds: [...source.conditionNodeIds].reverse(),
      declaredIssues: [{ type: 'missing_box', quantity: 1 }],
    });
    expect(quote.conditionCase.productId).toBe(source.id);
    expect(quote.estimate.estimateVnd).toBe(560000);
    const newNode = await tree.save(adminId, { nameVi: `Lỗi QA ${unique}`, nameEn: `QA ${unique}`, selectable: true });
    const missing = await tree.snapshot({
      modelFamilyId: source.modelFamilyId,
      itemTypeKey: 'preowned',
      conditionNodeIds: [...source.conditionNodeIds, newNode.id],
    });
    expect(missing.salePriceVnd).toBeNull();
    expect(missing.productId).toBeNull();
  });
  it('keeps one card per SKU, opens the exact SKU, and includes sibling combinations', async () => {
    const detail = await products.getPublicById(source.id);
    expect(detail.id).toBe(source.id);
    expect(detail.selectedOptionId).toBe(source.id);
    expect(detail.conditionOptions).toHaveLength(5);
    const listing = await products.listPublic({ q: source.name, limit: 100, offset: 0 });
    expect(listing.rows.filter((row) => row.modelFamilyId === source.modelFamilyId)).toHaveLength(5);
  });
  it('rejects duplicate creation and direct stock editing', async () => {
    await expect(
      products.createConditionOption(
        source.id,
        {
          itemTypeKey: 'preowned',
          conditionNodeIds: [...source.conditionNodeIds].reverse(),
          pricingReferenceMemberVnd: 700000,
        },
        adminId,
      ),
    ).rejects.toMatchObject({ code: 'COMBINATION_EXISTS' });
    const body = await products.getAdminById(source.id);
    await expect(
      products.update(source.id, { ...body, price: undefined, stock: body.stock + 1 }, adminId),
    ).rejects.toMatchObject({ code: 'STOCK_RECEIPT_REQUIRED' });
    await expect(
      products.update(source.id, { ...body, price: undefined, itemTypeKey: 'new' }, adminId),
    ).rejects.toMatchObject({ statusCode: 400 });
    const additional = await tree.save(adminId, { nameVi: `Identity lock QA ${unique}`, selectable: true });
    expect(additional.itemTypes).toEqual(['preowned']);
    await expect(
      products.update(source.id, {
        ...body, price: undefined, itemTypeKey: 'preowned',
        conditionNodeIds: [...source.conditionNodeIds, additional.id],
      }, adminId),
    ).rejects.toMatchObject({ code: 'SKU_IDENTITY_LOCKED' });
  });
  it('allows a multi-quantity supplier receipt into a 2hand combination', async () => {
    const stock = (await source.reload()).stock;
    const body = {
      requestKey: randomUUID(),
      supplierId,
      items: [{ productId: source.id, quantity: 2, importPrice: 510000 }],
    };
    const receipt = await new StockImportService().create(adminId, body);
    const retry = await new StockImportService().create(adminId, body);
    expect(retry.id).toBe(receipt.id);
    expect((await source.reload()).stock).toBe(stock + 2);
    expect(await CatalogIntakeModel.count({ where: { sourceType: 'supplier', productId: source.id } })).toBeGreaterThan(
      0,
    );
    expect(receipt).toBeTruthy();
  });
  it('approves a proposed combination into a draft SKU, without changing stock', async () => {
    const node = await tree.save(adminId, { nameVi: `LED QA ${unique}`, nameEn: `LED QA ${unique}`, selectable: true });
    const snapshot = await tree.snapshot({
      modelFamilyId: source.modelFamilyId,
      itemTypeKey: 'preowned',
      conditionNodeIds: [node.id],
      otherCondition: 'LED chập chờn',
    });
    const row = await newRequest(snapshot);
    const result = await new ServiceConditionCaseService().resolve('buyback', row.id, adminId, {
      expectedVersion: 0,
      action: 'approve',
      conditionNodeIds: [node.id],
      salePriceVnd: 650000,
      details: 'Đối chiếu LED và duyệt S, chưa nhận hàng.',
    });
    const created = (await ProductModel.findByPk(result.resolved.productId!))!;
    expect(created.stock).toBe(0);
    expect(created.isArchived).toBe(true);
    expect(created.pricingReferenceMemberVnd).toBe(650000);
    expect(await CatalogIntakeModel.count({ where: { sourceType: 'buyback', sourceId: String(row.id) } })).toBe(0);
    await expect(tree.remove(adminId, node.id, 0)).rejects.toThrow('lịch sử');
    await expect(
      new ServiceConditionCaseService().resolve('buyback', row.id, customerId, {
        expectedVersion: 1,
        action: 'approve',
        details: 'QA',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('receives two independently inspected buybacks into the existing SKU and retries only once', async () => {
    const stock = (await source.reload()).stock;
    const service = new BuybackService();
    for (let index = 0; index < 2; index++) {
      const snapshot = await tree.snapshot({
        modelFamilyId: source.modelFamilyId,
        itemTypeKey: 'preowned',
        conditionNodeIds: source.conditionNodeIds,
      });
      const row = await newRequest(snapshot, {
        status: 'completed',
        inspection: 'Kiểm hàng QA',
        finalOffer: { amountVnd: 560000, details: 'QA', basis: 'formula' },
        ownershipTransferredAt: new Date(),
      });
      await BuybackEventModel.create({
        buybackRequestId: row.id,
        actorUserId: customerId,
        action: 'accept',
        details: {},
      });
      await BuybackPayoutModel.create({
        buybackRequestId: row.id,
        actorUserId: adminId,
        amountVnd: 560000,
        externalReference: `QA-${unique}-${row.id}`,
        reason: 'Chứng từ QA đã xác nhận',
        direction: 'shop_pays',
      });
      await EvidenceModel.create({
        ownerUserId: adminId,
        purpose: 'buyback_inspection',
        entityId: row.id,
        diskKey: `test-${unique}-${row.id}`,
        originalName: 'QA.webp',
        mimeType: 'image/webp',
        sizeBytes: 100,
        sha256: randomUUID().replace(/-/g, '').padEnd(64, '0'),
      });
      await service.qcReview(row.id, adminId, {
        expectedVersion: 0,
        productId: source.id,
        checks: Object.fromEntries(LISTING_QC_CHECKS.map((check) => [check, true])),
        details: 'Kiểm tra tổ hợp và chứng từ riêng cho lần thu này',
      });
      await service.intake(row.id, adminId, {
        expectedVersion: 1,
        productId: source.id,
        actualPhotosVerified: true,
        details: 'Nhập đúng SKU sau QC và đối soát',
      });
      await service.intake(row.id, adminId, {
        expectedVersion: 1,
        productId: source.id,
        actualPhotosVerified: true,
        details: 'Retry cùng giao dịch',
      });
      expect(await CatalogIntakeModel.count({ where: { sourceType: 'buyback', sourceId: String(row.id) } })).toBe(1);
    }
    expect((await source.reload()).stock).toBe(stock + 2);
  });
  it('requires a settlement event for an even trade and receives it without a fictitious cash payout', async () => {
    const snapshot = await tree.snapshot({
      modelFamilyId: source.modelFamilyId,
      itemTypeKey: 'preowned',
      conditionNodeIds: source.conditionNodeIds,
    });
    const row = await newRequest(snapshot, {
      status: 'completed',
      inspection: 'QA physical inspection',
      ownershipTransferredAt: new Date(),
      finalOffer: { amountVnd: 560000, details: 'QA', basis: 'formula' },
      tradeQuote: {
        revision: 1,
        productId: source.id,
        itemPriceVnd: 560000,
        buybackVnd: 560000,
        differenceVnd: 0,
        status: 'settled',
        refundApprovedByUserId: null,
      },
    });
    await BuybackEventModel.create({
      buybackRequestId: row.id,
      actorUserId: customerId,
      action: 'accept',
      details: {},
    });
    await EvidenceModel.create({
      ownerUserId: adminId,
      purpose: 'buyback_inspection',
      entityId: row.id,
      diskKey: randomUUID(),
      originalName: 'QA-inspection.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      sha256: randomUUID(),
    });
    const service = new BuybackService();
    const input = {
      productId: source.id,
      checks: Object.fromEntries(LISTING_QC_CHECKS.map((key) => [key, true])),
      details: 'QA even exchange without a cash transfer.',
    };
    const missing = await service.qcReview(row.id, adminId, { ...input, expectedVersion: 0 });
    expect(missing.qcReview?.failed).toContain('QC07');
    await BuybackEventModel.create({
      buybackRequestId: row.id,
      actorUserId: adminId,
      action: 'payout',
      details: { amountVnd: 0, externalReference: `QA-EVEN-${row.id}` },
    });
    const checked = await service.qcReview(row.id, adminId, { ...input, expectedVersion: missing.version });
    expect(checked.qcReview?.result).toBe('passed');
    expect(await BuybackPayoutModel.count({ where: { buybackRequestId: row.id } })).toBe(0);
    const before = (await source.reload()).stock;
    await service.intake(row.id, adminId, {
      productId: source.id,
      expectedVersion: checked.version,
      actualPhotosVerified: true,
      details: 'QA received even exchange once.',
    });
    expect((await source.reload()).stock).toBe(before + 1);
  });
  it('cannot reuse another request QC or take pledged goods into sellable stock', async () => {
    const snapshot = await tree.snapshot({
      modelFamilyId: source.modelFamilyId,
      itemTypeKey: 'preowned',
      conditionNodeIds: source.conditionNodeIds,
    });
    const row = await newRequest(snapshot, {
      status: 'completed',
      finalOffer: { amountVnd: 560000, details: 'QA' },
      ownershipTransferredAt: new Date(),
    });
    await expect(
      new BuybackService().intake(row.id, adminId, {
        expectedVersion: 0,
        productId: source.id,
        actualPhotosVerified: true,
        details: 'No QC',
      }),
    ).rejects.toMatchObject({ code: 'QC_REQUIRED' });
    const PawnModel = (await import('../../src/core/server/database/client/models/PawnContract.Model')).default;
    const pawn = (await PawnModel.findOne({ where: { status: 'active' } }))!;
    const stock = (await source.reload()).stock;
    await expect(
      new PawnService().intake(pawn.id, adminId, {
        expectedVersion: pawn.version,
        productId: source.id,
        actualPhotosVerified: true,
        details: 'Chưa được xử lý tài sản',
      }),
    ).rejects.toThrow('disposal');
    expect((await source.reload()).stock).toBe(stock);
  });
  it('moves available quantity between combinations atomically and idempotently', async () => {
    const to = (await ProductModel.findOne({ where: { sku: 'DEMO-COND-01-4' } }))!;
    const stock = (await source.reload()).stock,
      targetStock = to.stock;
    const body = {
      requestKey: randomUUID(),
      targetProductId: to.id,
      quantity: 1,
      reason: 'Kiểm tra lại: còn hộp, chuyển sang tổ hợp chỉ lỏng khớp.',
    };
    const service = new ConditionStockService();
    await service.transfer(adminId, source.id, body);
    await service.transfer(adminId, source.id, body);
    expect((await source.reload()).stock).toBe(stock - 1);
    expect((await to.reload()).stock).toBe(targetStock + 1);
    await expect(service.transfer(adminId, source.id, { ...body, quantity: 2 })).rejects.toThrow('Mã thao tác');
  });
  it('prevents tree cycles, stale saves and destructive changes to assigned nodes', async () => {
    const parent = await tree.save(adminId, { nameVi: `Nhóm QA ${unique}`, nameEn: 'Group', selectable: false });
    const child = await tree.save(adminId, {
      nameVi: `Con QA ${unique}`,
      nameEn: 'Child',
      parentId: parent.id,
      selectable: true,
    });
    await expect(tree.save(adminId, { parentId: child.id, expectedVersion: 0 }, parent.id)).rejects.toThrow('vòng lặp');
    await tree.save(adminId, { nameVi: 'Đã đổi', expectedVersion: 0 }, child.id);
    await expect(tree.save(adminId, { nameVi: 'Ghi đè', expectedVersion: 0 }, child.id)).rejects.toMatchObject({
      code: 'CONDITION_CHANGED',
    });
    const assigned = await ConditionNodeModel.findByPk(source.conditionNodeIds[0]);
    await expect(
      tree.save(adminId, { selectable: false, expectedVersion: assigned!.version }, assigned!.id),
    ).rejects.toMatchObject({ code: 'CONDITION_IN_USE' });
  });
  it('reports without changing stock and rolls back a stale migration report', async () => {
    const service = new CatalogMigrationService();
    const stock = (await source.reload()).stock;
    const report = await service.report();
    expect((await source.reload()).stock).toBe(stock);
    await source.update({ conditionNote: `QA ${unique}` });
    await expect(service.apply(report, { products: {}, secondaryReferences: {} }, adminId)).rejects.toThrow(
      'đã thay đổi',
    );
    expect((await source.reload()).stock).toBe(stock);
  });

  it('serializes concurrent creation of the same combination into one draft', async () => {
    const node = await tree.save(adminId, {
      nameVi: `Đồng thời ${unique}`,
      nameEn: `Concurrent ${unique}`,
      selectable: true,
    });
    const input = { itemTypeKey: 'preowned', conditionNodeIds: [node.id], pricingReferenceMemberVnd: 500000 };
    const outcomes = await Promise.allSettled([
      products.createConditionOption(source.id, input, adminId),
      products.createConditionOption(source.id, input, adminId),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect(
      await ProductModel.count({
        where: { modelFamilyId: source.modelFamilyId, conditionNodeIds: { [Op.contains]: [node.id] } },
      }),
    ).toBe(1);
  });

  it('merges only reviewed legacy duplicates, retaining order IDs, old URLs and exact remaining stock', async () => {
    const base = {
      name: `Migration QA ${unique}`,
      brandName: 'QA',
      modelCode: `QA-${unique}`,
      scale: '1/100',
      condition: 'new',
      price: 555556,
      pricingReferenceMemberVnd: 500000,
      targetPriceApprovedAt: new Date(),
      importPrice: 200000,
      imageUrl: source.imageUrl,
      stock: 2,
      isArchived: false,
      listPriceVerified: true,
    };
    const canonical = await ProductModel.create({ ...base, sku: `QA-MIG-A-${unique}` });
    const alias = await ProductModel.create({ ...base, sku: `QA-MIG-B-${unique}`, stock: 3 });
    const sale = await new DirectSaleService().create(adminId, {
      requestKey: randomUUID(),
      channel: 'COUNTER',
      fulfillment: 'HANDOVER',
      customerId: null,
      recipientName: '',
      phone: '',
      address: '',
      city: '',
      note: 'QA legacy identity',
      items: [{ productId: alias.id, quantity: 1 }],
      expectedTotal: 555556,
      payment: 'CASH',
      moneyVerified: true,
      externalReference: `MIGRATION-${unique}`,
    });
    const line = (await OrderItemModel.findOne({ where: { orderId: sale.id } }))!;
    const snapshot = line.modelSnapshot;
    const migration = new CatalogMigrationService();
    const report = await migration.report();
    const decisions = {
      products: Object.fromEntries(
        report.rows.map((row) => [
          String(row.id),
          {
            itemTypeKey: (row.source.combinationKey
              ? row.source.itemTypeKey
              : row.source.condition === 'new'
                ? 'new'
                : 'preowned') as 'new' | 'preowned',
            ...(row.source.combinationKey
              ? {}
              : {
                  conditionNodeKeys:
                    row.source.assemblyState === 'assembled'
                      ? ['assembled']
                      : row.source.assemblyState === 'painted'
                        ? ['painted']
                        : row.source.assemblyState === 'partially_assembled'
                          ? ['partially-assembled']
                          : [],
                }),
            ...(row.id === alias.id ? { mergeIntoId: canonical.id } : {}),
          },
        ]),
      ),
      secondaryReferences: Object.fromEntries(
        report.secondaryReferences.map((reference) => [String(reference.productId), { action: 'ignore' as const }]),
      ),
    };
    await migration.apply(report, decisions, adminId);
    expect((await canonical.reload()).stock).toBe(4);
    expect(await alias.reload()).toMatchObject({ stock: 0, catalogCanonicalId: canonical.id, isArchived: true });
    expect((await products.getPublicById(alias.slug)).id).toBe(canonical.id);
    expect((await line.reload()).productId).toBe(alias.id);
    expect(line.modelSnapshot).toEqual(snapshot);
    const returned = await ReturnRequestModel.create({
      orderId: sale.id,
      userId: customerId,
      status: 'RECEIVED',
      receivedAt: new Date(),
    });
    const returnedItem = await ReturnItemModel.create({
      returnRequestId: returned.id,
      orderItemId: line.id,
      quantity: 1,
      reason: RETURN_REASONS[0],
      condition: RESTOCKABLE_CONDITIONS[0],
    });
    await new ReturnService().restockItem(returned.id, returnedItem.id, adminId);
    expect((await canonical.reload()).stock).toBe(5);
    expect((await alias.reload()).stock).toBe(0);
    await expect(new ReturnService().restockItem(returned.id, returnedItem.id, adminId)).rejects.toThrow('already');
    expect(await CatalogIntakeModel.count({ where: { sourceType: 'return', sourceId: String(returnedItem.id) } })).toBe(
      1,
    );
    await expect(migration.apply(report, decisions, adminId)).rejects.toThrow();
    expect((await canonical.reload()).stock).toBe(5);
  });
});
