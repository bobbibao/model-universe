import crypto from 'crypto';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import EvidenceModel from '../../src/core/server/database/client/models/Evidence.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import ValuationService from '../../src/core/server/services/ValuationService';
import PawnService from '../../src/core/server/services/PawnService';
import { estimateFor } from '../../src/core/server/services/BuybackService';

// The quick valuation of the services (owner rule of 2026-10-26): a model the shop sells new gets its buyback price B,
// its pawn amount C50 with a simulated interest table, and a pawn request keeps the C50 quote for staff.
describe('quick valuation and the pawn web quote', () => {
  let db: Sequelize, userId: number;
  const valuation = new ValuationService();

  beforeAll(async () => {
    db = await seedTestDatabase();
    userId = (await UserModel.findOne({ where: { role: 'USER', isActive: true } }))!.id;
  }, 600_000);
  afterAll(() => db.close());

  it('values a catalogue model from its S, and sends a model in another condition to the shop', async () => {
    const product = (await ProductModel.findOne({
      where: { partnerId: null, isArchived: false, condition: 'new', parentProductId: null },
    }))!;
    await product.update({ pricingReferenceMemberVnd: 2_500_000, price: 2_777_778, targetPriceApprovedAt: new Date() });
    const result = await valuation.forProduct(product.id);
    expect(result.product).toMatchObject({ listPriceVnd: 2_777_778, memberPriceVnd: 2_500_000 });
    expect(result.buyback).toMatchObject({ estimateVnd: 2_075_000, manualReview: null });
    expect(result.pawn).toMatchObject({ amountVnd: 1_250_000, manualReview: null, legalReviewRequired: true });
    expect(result.pawn.simulation.map((row) => row.days)).toEqual([7, 15, 30]);

    await product.update({ condition: 'preowned' });
    const used = await valuation.forProduct(product.id);
    expect(used.buyback.estimateVnd).toBeNull();
    expect(used.pawn.amountVnd).toBeNull();
    await product.update({ condition: 'new' });
    await expect(valuation.forProduct(0)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('values a 2hand unit from S 2hand, and sends it to the shop when there is none', async () => {
    const product = (await ProductModel.findOne({
      where: { partnerId: null, isArchived: false, condition: 'new', parentProductId: null },
    }))!;
    await product.update({ pricingReferenceMemberVnd: 2_500_000, pricingReferencePreownedVnd: 1_800_000 });
    const result = await valuation.forProduct(product.id);
    expect(result.conditions.new.buyback.estimateVnd).toBe(2_075_000);
    // 1,800,000 − 17% margin 306,000; C50 = 900,000.
    expect(result.conditions.preowned.buyback).toMatchObject({ estimateVnd: 1_494_000, manualReview: null });
    expect(result.conditions.preowned.pawn).toMatchObject({ amountVnd: 900_000 });
    expect(
      (await estimateFor({ referenceProductId: product.id, referenceCondition: 'preowned' })).estimate.estimateVnd,
    ).toBe(1_494_000);
    await expect(estimateFor({ referenceProductId: product.id, referenceCondition: 'used' })).rejects.toMatchObject({
      statusCode: 400,
    });

    await product.update({ pricingReferencePreownedVnd: null });
    expect((await valuation.forProduct(product.id)).conditions.preowned.buyback).toMatchObject({
      estimateVnd: null,
      manualReview: 'no_reference_price',
    });
    await product.update({ pricingReferencePreownedVnd: 1_800_000 });
  });

  it('keeps the C50 quote of the chosen model on a pawn request', async () => {
    const product = (await ProductModel.findOne({
      where: { partnerId: null, isArchived: false, condition: 'new', parentProductId: null },
    }))!;
    const evidenceIds: number[] = [];
    for (let index = 0; index < 3; index++)
      evidenceIds.push(
        (
          await EvidenceModel.create({
            ownerUserId: userId,
            purpose: 'pawn',
            diskKey: `${crypto.randomUUID()}.webp`,
            originalName: `pawn-${index}.webp`,
            mimeType: 'image/webp',
            sizeBytes: 100,
            sha256: crypto.createHash('sha256').update(`pawn-quote:${index}`).digest('hex'),
          })
        ).id,
      );
    const asset = {
      name: product.name,
      modelCode: product.modelCode ?? 'FIXTURE',
      version: 'As sold by the shop',
      assemblyState: 'assembled',
      boxCondition: 'Original box',
      accessories: 'All accessories',
      defects: 'None',
      repairHistory: 'None',
    };
    const row = await new PawnService().create(userId, {
      requestKey: 'pawn-web-quote',
      asset,
      evidenceIds,
      referenceProductId: product.id,
    });
    expect(row).toMatchObject({
      referenceProductId: product.id,
      webQuote: { amountVnd: 1_250_000, referencePriceVnd: 2_500_000, legalReviewRequired: true },
    });
    const used = await new PawnService().create(userId, {
      requestKey: 'pawn-web-quote-2hand',
      asset,
      evidenceIds: await Promise.all(
        [0, 1, 2].map(
          async (index) =>
            (
              await EvidenceModel.create({
                ownerUserId: userId,
                purpose: 'pawn',
                diskKey: `${crypto.randomUUID()}.webp`,
                originalName: `pawn-2hand-${index}.webp`,
                mimeType: 'image/webp',
                sizeBytes: 100,
                sha256: crypto.createHash('sha256').update(`pawn-2hand:${index}`).digest('hex'),
              })
            ).id,
        ),
      ),
      referenceProductId: product.id,
      referenceCondition: 'preowned',
    });
    expect(used).toMatchObject({ referenceCondition: 'preowned', webQuote: { amountVnd: 900_000 } });
  });
});
