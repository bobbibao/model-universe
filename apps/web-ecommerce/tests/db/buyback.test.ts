import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import BuybackService from '../../src/core/server/services/BuybackService';
import CommercePolicyService from '../../src/core/server/services/CommercePolicyService';
import ProductService from '../../src/core/server/services/ProductService';
import OrderService from '../../src/core/server/services/OrderService';
import LoyaltyService from '../../src/core/server/services/LoyaltyService';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import EvidenceModel from '../../src/core/server/database/client/models/Evidence.Model';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductImageModel from '../../src/core/server/database/client/models/ProductImage.Model';
import BuybackPayoutModel from '../../src/core/server/database/client/models/BuybackPayout.Model';
import BuybackEventModel from '../../src/core/server/database/client/models/BuybackEvent.Model';
import LoyaltyLedgerModel from '../../src/core/server/database/client/models/LoyaltyLedger.Model';
import PricingApprovalService from '../../src/core/server/services/PricingApprovalService';
import { LISTING_QC_CHECKS } from '../../src/shared/listing-qc';
import { DEPOSIT, prepay } from './support/checkout';

describe('buyback inspection, agreement, payout and source intake', () => {
  let db: Sequelize,
    userId: number,
    otherId: number,
    adminId: number,
    uploadRoot: string,
    sequence = 0;
  const service = new BuybackService(),
    policy = new CommercePolicyService();
  const asset = {
    name: 'Inspected Strike Freedom custom',
    modelCode: 'FIXTURE-SF-01',
    version: 'Actual inspected custom version',
    assemblyState: 'painted',
    boxCondition: 'Original box absent',
    accessories: 'Stand included; no additional accessories',
    defects: 'Paint wear on the shield',
    repairHistory: 'Custom paint; no reported repairs',
  };
  const photos = ['strike-freedom-custom.webp', 'strike-freedom-custom-side.webp', 'strike-freedom-custom-detail.webp'];
  const create = async (extra: Record<string, unknown> = {}) => {
    const evidenceIds: number[] = [];
    for (const [index, name] of photos.entries())
      evidenceIds.push(
        (
          await EvidenceModel.create({
            ownerUserId: userId,
            purpose: 'buyback',
            diskKey: `${crypto.randomUUID()}.webp`,
            originalName: name,
            mimeType: 'image/webp',
            sizeBytes: 100,
            sha256: crypto.createHash('sha256').update(`${sequence}:${index}`).digest('hex'),
          })
        ).id,
      );
    evidenceIds.push(
      (
        await EvidenceModel.create({
          ownerUserId: userId,
          purpose: 'buyback',
          diskKey: `${crypto.randomUUID()}.mp4`,
          originalName: 'walkaround.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 100,
          sha256: crypto.createHash('sha256').update(`${sequence}:video`).digest('hex'),
        })
      ).id,
    );
    const data = { requestKey: `buyback-fixture-${++sequence}`, asset, evidenceIds, confirmations: true, ...extra };
    return { data, row: await service.create(userId, data) };
  };
  const readyForDecision = async (extra: Record<string, unknown> = {}) => {
    let { row } = await create(extra);
    row = await service.act(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        action: 'preliminary_offer',
        amountVnd: 900000,
        details: 'Fixture photo-based quote',
      },
      true,
    );
    row = await service.act(row.id, userId, {
      expectedVersion: row.version,
      action: 'send_item',
      inboundReference: 'FIXTURE-INBOUND-001',
      inboundCod: false,
    });
    row = await service.act(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        action: 'received',
        details: 'Actual fixture inspected; shield wear differs from photos',
        handoverVerified: true,
      },
      true,
    );
    const recording = await EvidenceModel.create({
      ownerUserId: adminId,
      purpose: 'buyback_inspection',
      diskKey: `${crypto.randomUUID()}.mp4`,
      originalName: 'unboxing.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 100,
      sha256: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0'),
    });
    return service.act(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        action: 'final_offer',
        amountVnd: 850000,
        details: 'Fixture final quote reduced for verified shield wear',
        inspectionEvidenceIds: [recording.id],
      },
      true,
    );
  };
  const readyForPayout = async (extra: Record<string, unknown> = {}) => {
    const row = await readyForDecision(extra);
    return service.act(row.id, userId, { expectedVersion: row.version, action: 'accept' });
  };
  beforeAll(async () => {
    db = await seedTestDatabase();
    [userId, otherId] = (
      await UserModel.findAll({ where: { role: 'USER', isActive: true }, limit: 2, order: [['id', 'ASC']] })
    ).map((user) => user.id);
    adminId = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!.id;
    const root = path.resolve('../../.artifacts/model-universe');
    await fs.mkdir(root, { recursive: true });
    uploadRoot = await fs.mkdtemp(path.join(root, 'buyback-test-uploads-'));
    process.env.UPLOAD_DIR = uploadRoot;
  }, 600000);
  afterAll(async () => {
    delete process.env.UPLOAD_DIR;
    await db?.close();
  });

  it('keeps evidence owned, exact submission retries stable, and inbound policy explicitly gated', async () => {
    const { row, data } = await create();
    expect((await service.create(userId, data)).id).toBe(row.id);
    await expect(
      service.create(userId, { ...data, asset: { ...asset, defects: 'Changed terms' } }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.detail(row.id, otherId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.detail(row.id, otherId, true)).rejects.toMatchObject({ statusCode: 403 });
    const quoted = await service.act(
      row.id,
      adminId,
      { expectedVersion: 0, action: 'preliminary_offer', amountVnd: 900000, details: 'Photo-only fixture quote' },
      true,
    );
    await expect(
      service.act(row.id, userId, {
        expectedVersion: quoted.version,
        action: 'send_item',
        inboundReference: 'FIXTURE-INBOUND-002',
        inboundCod: false,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'POLICY_APPROVAL_REQUIRED' });
    await policy.approve(
      'buyback',
      { inboundCod: 'not_supported' },
      0,
      adminId,
      'Isolated regression policy fixture, not an owner approval',
    );
    await expect(
      service.act(row.id, userId, {
        expectedVersion: quoted.version,
        action: 'send_item',
        inboundReference: 'FIXTURE-INBOUND-002',
        inboundCod: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const result = await service.detail(row.id, userId);
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence[0].get({ plain: true })).not.toHaveProperty('diskKey');
    const repeated = await Promise.all(
      [1, 2, 3].map(() =>
        EvidenceModel.create({
          ownerUserId: userId,
          purpose: 'buyback',
          diskKey: `${crypto.randomUUID()}.webp`,
          originalName: 'Repeated view.webp',
          mimeType: 'image/webp',
          sizeBytes: 10,
          sha256: 'a'.repeat(64),
        }),
      ),
    );
    await expect(
      service.create(userId, {
        requestKey: 'duplicate-views-fixture',
        asset,
        evidenceIds: repeated.map((file) => file.id),
        confirmations: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('requires inspected current-version agreement, exact executed payout, and keeps immutable money', async () => {
    let row = await readyForDecision();
    const stale = row.version;
    row = await service.act(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        action: 'final_offer',
        amountVnd: 800000,
        details: 'Fixture second final quote with revised disclosure',
      },
      true,
    );
    await expect(service.act(row.id, userId, { expectedVersion: stale, action: 'accept' })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      service.payout(row.id, adminId, {
        expectedVersion: row.version,
        amountVnd: 800000,
        externalReference: 'BUYBACK-EARLY-PAYOUT',
        details: 'Fixture verification',
        moneyVerified: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await service.act(row.id, userId, { expectedVersion: row.version, action: 'accept' });
    await expect(
      service.act(
        row.id,
        adminId,
        { expectedVersion: row.version, action: 'final_offer', amountVnd: 790000, details: 'Unilateral revision' },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    const data = {
      expectedVersion: row.version,
      amountVnd: 800000,
      externalReference: 'BUYBACK-VERIFIED-PAYOUT',
      details: 'Fixture actual bank payout',
      moneyVerified: true,
    };
    await expect(service.payout(row.id, adminId, { ...data, moneyVerified: false })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.payout(row.id, adminId, { ...data, amountVnd: 799999 })).rejects.toMatchObject({
      statusCode: 409,
    });
    const completed = await service.payout(row.id, adminId, data);
    await service.payout(row.id, adminId, data);
    expect(completed.status).toBe('completed');
    expect(completed.ownershipTransferredAt).toBeTruthy();
    expect(await BuybackPayoutModel.count({ where: { buybackRequestId: row.id } })).toBe(1);
    expect(await BuybackEventModel.count({ where: { buybackRequestId: row.id, action: 'payout' } })).toBe(1);
    await expect(db.query('UPDATE buyback_payout SET "amountVnd"=1')).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM buyback_event WHERE action='payout'")).rejects.toThrow(/append-only/);
  });
  it('takes one actual photographed preowned SKU into stock after ownership and QC, once, then publishes it', async () => {
    let row = await readyForPayout();
    const original = (await ProductModel.findOne({ order: [['id', 'ASC']] }))!.get({ plain: true });
    const publicUrls: string[] = [];
    await fs.mkdir(path.join(uploadRoot, 'products'), { recursive: true });
    for (const name of photos) {
      const diskName = `${crypto.randomUUID()}.webp`;
      await fs.copyFile(path.resolve('public/images/catalog', name), path.join(uploadRoot, 'products', diskName));
      publicUrls.push(`/uploads/products/${diskName}`);
    }
    const draft = await ProductModel.create({
      ...original,
      id: undefined,
      uuid: undefined,
      slug: undefined,
      parentProductId: null,
      pricingReferenceMemberVnd: 1_500_000,
      targetPriceApprovedAt: null,
      sku: `BUYBACK-ACTUAL-${row.id}`,
      name: asset.name,
      modelCode: asset.modelCode,
      stock: 0,
      sold: 0,
      condition: 'preowned',
      assemblyState: asset.assemblyState,
      isArchived: true,
      imageUrl: publicUrls[0],
      defects: [asset.defects],
      includedAccessories: [asset.accessories],
      supplierId: null,
    });
    await ProductImageModel.bulkCreate(
      publicUrls.slice(1).map((url, sortOrder) => ({ productId: draft.id, url, sortOrder })),
    );
    const data = {
      expectedVersion: row.version,
      productId: draft.id,
      actualPhotosVerified: true,
      details: 'Fixture public condition reconciled with accepted inspection',
    };
    await expect(service.intake(row.id, adminId, data)).rejects.toMatchObject({ statusCode: 409 });
    row = await service.payout(row.id, adminId, {
      expectedVersion: row.version,
      amountVnd: 850000,
      externalReference: 'BUYBACK-INTAKE-PAYOUT',
      details: 'Fixture executed payout',
      moneyVerified: true,
    });
    // No stock intake before a passed pre-listing QC of this exact listing (owner specification of 2026-10-25, §12-§13).
    await expect(service.intake(row.id, adminId, { ...data, expectedVersion: row.version })).rejects.toMatchObject({
      code: 'QC_REQUIRED',
    });
    const allChecks = Object.fromEntries(LISTING_QC_CHECKS.map((check) => [check, true]));
    const review = (checks: Record<string, boolean>) =>
      service.qcReview(row.id, adminId, {
        expectedVersion: row.version,
        productId: draft.id,
        checks,
        details: 'Fixture QC',
      });
    // A system check cannot be ticked: the draft's target price S is not approved yet.
    row = await review(allChecks);
    expect(row.qcReview).toMatchObject({ result: 'failed', failed: ['QC10'] });
    await new PricingApprovalService().approveTarget(draft.id, adminId);
    row = await review({ ...allChecks, QC05: false });
    expect(row.qcReview).toMatchObject({ result: 'failed', failed: ['QC05'] });
    row = await review(allChecks);
    expect(row.qcReview).toMatchObject({ result: 'passed', failed: [] });
    // Editing the listing after the review voids it.
    await draft.update({ conditionNote: 'Edited after QC' });
    await expect(service.intake(row.id, adminId, { ...data, expectedVersion: row.version })).rejects.toMatchObject({
      code: 'QC_REQUIRED',
    });
    row = await review(allChecks);
    await service.intake(row.id, adminId, { ...data, expectedVersion: row.version });
    await service.intake(row.id, adminId, data);
    expect((await draft.reload()).stock).toBe(1);
    expect(draft.importPrice).toBe(850000);
    // A DRAFT listing: still hidden until the publication check.
    expect(draft.isArchived).toBe(true);
    expect(await BuybackEventModel.count({ where: { buybackRequestId: row.id, action: 'intake' } })).toBe(1);
    row = await service.detail(row.id, adminId, true);
    row = await service.publish(row.id, adminId, { expectedVersion: row.version });
    expect((await draft.reload()).isArchived).toBe(false);
    expect(row.listing).toMatchObject({ id: draft.id, isArchived: false, stock: 1 });
    await expect(service.publish(row.id, adminId, { expectedVersion: row.version })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(ProductModel.destroy({ where: { id: draft.id } })).rejects.toThrow(/foreign key/);
    expect((await new ProductService().remove(draft.id)).archived).toBe(true);
  });
  it('returns a rejected model only under customer-accepted delivery and cost terms', async () => {
    let row = await readyForDecision();
    row = await service.act(row.id, userId, {
      expectedVersion: row.version,
      action: 'reject',
      details: 'Fixture final amount not accepted',
    });
    row = await service.act(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        action: 'return_offer',
        details: 'Fixture shop pays return shipment to agreed customer address',
      },
      true,
    );
    await expect(
      service.act(
        row.id,
        adminId,
        {
          expectedVersion: row.version,
          action: 'return_dispatched',
          inboundReference: 'FIXTURE-RETURN-001',
          handoverVerified: true,
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await service.act(row.id, userId, { expectedVersion: row.version, action: 'accept_return' });
    await expect(
      service.act(
        row.id,
        adminId,
        {
          expectedVersion: row.version,
          action: 'return_offer',
          details: 'Customer now pays unilateral shipping change',
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await service.act(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        action: 'return_dispatched',
        inboundReference: 'FIXTURE-RETURN-001',
        handoverVerified: true,
      },
      true,
    );
    expect(row.status).toBe('cancelled');
    expect(row.returnTerms?.tracking).toBe('FIXTURE-RETURN-001');
    expect(row.ownershipTransferredAt).toBeNull();
    expect(row.payout).toBeNull();
  });
  it('serializes two payouts and prevents a COD proof from funding a buyback or refund', async () => {
    const row = await readyForPayout();
    const results = await Promise.allSettled(
      ['BUYBACK-CONCURRENT-A', 'BUYBACK-CONCURRENT-B'].map((externalReference) =>
        service.payout(row.id, adminId, {
          expectedVersion: row.version,
          amountVnd: 850000,
          externalReference,
          details: 'Fixture verified payout',
          moneyVerified: true,
        }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await BuybackPayoutModel.count({ where: { buybackRequestId: row.id } })).toBe(1);
    const orders = new OrderService(),
      product = (await ProductModel.findOne({
        where: { condition: 'new', isArchived: false },
        order: [['id', 'ASC']],
      }))!;
    const order = await orders.placeOrder(userId, {
      requestKey: crypto.randomUUID(),
      items: [{ productId: product.id, quantity: 1 }],
      shipping: {
        recipientName: 'Fixture Collector',
        phone: '0901234567',
        address: '12 Fixture Road',
        city: 'Fixture City',
      },
      ...DEPOSIT,
    });
    await prepay(order, adminId);
    await orders.updateStatus(order.id, 'SHIPPED', adminId);
    await orders.updateStatus(order.id, 'DELIVERED', adminId);
    await orders.confirmCollection(order.id, adminId, {
      amountVnd: order.total - order.upfrontDueVnd,
      externalReference: 'FIXTURE-SHARED-BANK-IDENTITY',
      reason: 'Fixture verified COD remittance',
      moneyVerified: true,
    });
    await expect(
      new LoyaltyService().confirmRefund(order.id, adminId, {
        merchandiseVnd: 1,
        externalReference: 'fixture-shared-bank-identity',
        reason: 'Cannot reuse the incoming bank remittance for an outgoing refund',
        moneyVerified: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const another = await readyForPayout();
    await expect(
      service.payout(another.id, adminId, {
        expectedVersion: another.version,
        amountVnd: 850000,
        externalReference: 'fixture-shared-bank-identity',
        details: 'Cannot reuse another economic event',
        moneyVerified: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('offers S minus the margin B of an approved S only for a model the shop sells new, declared without issues', async () => {
    const product = (await ProductModel.findOne({
      where: { partnerId: null, isArchived: false, condition: 'new' },
      order: [['id', 'ASC']],
    }))!;
    await product.update({ pricingReferenceMemberVnd: 2_000_000, targetPriceApprovedAt: null });
    const declaredIssues = [
      { type: 'missing_box', quantity: 1, description: '' },
      { type: 'broken_part', quantity: 2, description: 'Left hand' },
    ];
    // S not approved yet: an admin prices it.
    let { row } = await create({ referenceProductId: product.id });
    expect(row.estimate).toMatchObject({
      estimateVnd: null,
      manualReview: 'reference_not_approved',
      ruleVersion: 'buyback-margin-2026-10-26',
    });
    await product.update({ targetPriceApprovedAt: new Date() });
    // Declared issues: no automatic deduction, an admin prices it.
    ({ row } = await create({ referenceProductId: product.id, declaredIssues }));
    expect(row.estimate).toMatchObject({
      estimateVnd: null,
      manualReview: 'issues_declared',
      issueCount: 3,
      referencePriceVnd: 2_000_000,
    });
    await expect(
      service.act(
        row.id,
        adminId,
        { expectedVersion: row.version, action: 'preliminary_offer', details: 'Formula' },
        true,
      ),
    ).rejects.toMatchObject({ code: 'MANUAL_PRICE_REQUIRED' });
    // No issue: S − 17% of S = 1,660,000 for S = 2,000,000 (above 1,150,000), offered as the formula price.
    ({ row } = await create({ referenceProductId: product.id }));
    expect(row.estimate).toMatchObject({ estimateVnd: 1_660_000, manualReview: null, baseDeductionVnd: null });
    row = await service.act(
      row.id,
      adminId,
      { expectedVersion: row.version, action: 'preliminary_offer', details: 'Formula quote' },
      true,
    );
    expect(row.preliminaryOffer).toMatchObject({ amountVnd: 1_660_000, basis: 'formula' });
    row = await service.act(row.id, userId, {
      expectedVersion: row.version,
      action: 'send_item',
      inboundReference: 'FIXTURE-B17-INBOUND',
      inboundCod: false,
    });
    row = await service.act(
      row.id,
      adminId,
      { expectedVersion: row.version, action: 'received', details: 'Received and recorded', handoverVerified: true },
      true,
    );
    await expect(
      service.act(
        row.id,
        adminId,
        { expectedVersion: row.version, action: 'final_offer', details: 'No recording yet' },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INSPECTION_EVIDENCE_REQUIRED' });
    const recording = await EvidenceModel.create({
      ownerUserId: adminId,
      purpose: 'buyback_inspection',
      diskKey: `${crypto.randomUUID()}.mp4`,
      originalName: 'b17-unboxing.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 100,
      sha256: 'c'.repeat(64),
    });
    // An issue found at inspection: the formula no longer applies, an admin prices it with its reason.
    const inspection = {
      expectedVersion: row.version,
      action: 'final_offer',
      details: 'Inspection result',
      inspectionEvidenceIds: [recording.id],
      inspectedIssues: [{ type: 'broken_part', quantity: 1, description: 'Antenna' }],
    };
    await expect(service.act(row.id, adminId, inspection, true)).rejects.toMatchObject({
      code: 'MANUAL_PRICE_REQUIRED',
    });
    row = await service.act(row.id, adminId, { ...inspection, amountVnd: 300_000 }, true);
    expect(row.finalOffer).toMatchObject({ amountVnd: 300_000, basis: 'manual' });
    expect(row.comparison).toMatchObject({ newIssueCount: 1, resolvedIssueCount: 0, deductionDifferenceVnd: 0 });
    row = await service.act(row.id, userId, {
      expectedVersion: row.version,
      action: 'request_review',
      details: 'The antenna was already loose when declared',
    });
    expect(row.status).toBe('reinspection_requested');
    await expect(service.act(row.id, userId, { expectedVersion: row.version, action: 'accept' })).rejects.toMatchObject(
      { statusCode: 409 },
    );
  });
  it('quotes a trade difference D, needs an admin for a negative D, settles it and earns no points', async () => {
    const item = (await ProductModel.findOne({
      where: { partnerId: null, isArchived: false, condition: 'new' },
      order: [['id', 'DESC']],
    }))!;
    // The item is quoted at its member price: R 1,111,111 with MEMBER10 is 1,000,000.
    await item.update({ price: 1_111_111, stock: 2, inventoryStatus: 'available' });
    const points = await LoyaltyLedgerModel.count({ where: { userId } });
    // D = 1,000,000 − 850,000 = 150,000: the customer pays the difference.
    let row = await readyForDecision({ tradeProductId: item.id });
    expect(row.tradeQuote).toMatchObject({
      revision: 2,
      itemPriceVnd: 1_000_000,
      buybackVnd: 850_000,
      differenceVnd: 150_000,
      status: 'ready',
    });
    row = await service.act(row.id, userId, { expectedVersion: row.version, action: 'accept' });
    const settle = {
      expectedVersion: row.version,
      externalReference: 'TRADE-DIFFERENCE-IN',
      details: 'Fixture difference received',
      moneyVerified: true,
    };
    await expect(service.payout(row.id, adminId, { ...settle, amountVnd: 850_000 })).rejects.toMatchObject({
      statusCode: 409,
    });
    row = await service.payout(row.id, adminId, { ...settle, amountVnd: 150_000 });
    expect(row).toMatchObject({ status: 'completed', tradeQuote: { status: 'settled' } });
    expect(row.payout).toMatchObject({ amountVnd: 150_000, direction: 'customer_pays' });
    expect((await item.reload()).stock).toBe(1);
    // D < 0: the shop pays back 150,000 only after an admin approves it.
    await item.update({ price: 777_778 }); // member price 700,000
    row = await readyForDecision({ tradeProductId: item.id });
    expect(row.tradeQuote).toMatchObject({ differenceVnd: -150_000, refundApprovedByUserId: null });
    await expect(service.act(row.id, userId, { expectedVersion: row.version, action: 'accept' })).rejects.toMatchObject(
      {
        code: 'TRADE_REFUND_APPROVAL',
      },
    );
    await expect(
      service.act(row.id, userId, { expectedVersion: row.version, action: 'approve_trade_refund' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    row = await service.act(row.id, adminId, { expectedVersion: row.version, action: 'approve_trade_refund' }, true);
    row = await service.act(row.id, userId, { expectedVersion: row.version, action: 'accept' });
    row = await service.payout(row.id, adminId, {
      expectedVersion: row.version,
      amountVnd: 150_000,
      externalReference: 'TRADE-DIFFERENCE-OUT',
      details: 'Fixture difference paid back',
      moneyVerified: true,
    });
    expect(row.payout).toMatchObject({ direction: 'shop_pays' });
    expect((await item.reload()).stock).toBe(0);
    expect(await LoyaltyLedgerModel.count({ where: { userId } })).toBe(points);
  });
});
