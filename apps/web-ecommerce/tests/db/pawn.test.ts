import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import CatalogTreeService from '../../src/core/server/services/catalog/CatalogTreeService';
import PawnService from '../../src/core/server/services/PawnService';
import PawnReminderService from '../../src/core/server/services/PawnReminderService';
import CommercePolicyService from '../../src/core/server/services/CommercePolicyService';
import MoneyReferenceService from '../../src/core/server/services/MoneyReferenceService';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import EvidenceModel from '../../src/core/server/database/client/models/Evidence.Model';
import PawnContractModel from '../../src/core/server/database/client/models/PawnContract.Model';
import PawnPaymentModel from '../../src/core/server/database/client/models/PawnPayment.Model';
import PawnEventModel from '../../src/core/server/database/client/models/PawnEvent.Model';
import CommerceNotificationModel from '../../src/core/server/database/client/models/CommerceNotification.Model';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductImageModel from '../../src/core/server/database/client/models/ProductImage.Model';
import { PAWN_DAY_MS } from '../../src/shared/pawn-rules';
import type { PawnInterestPolicy } from '../../src/shared/pawn-rules';

describe('pawn signed custody, verified money, redemption and eligible disposal', () => {
  let db: Sequelize,
    userId: number,
    otherId: number,
    adminId: number,
    uploadRoot: string,
    sequence = 0;
  const service = new PawnService(),
    policy = new CommercePolicyService();
  const basePolicy: PawnInterestPolicy = {
    calculation: 'compound_0_3_v2',
    cashFlowClock: 'elapsed_24h_periods',
    legalMode: 'approved',
    legalReference: 'DISPOSABLE-TEST-ONLY-LEGAL',
    dailyRateBasisPoints: 30,
    dayCount: 'completed_days',
    rounding: 'nearest',
    graceDays: 2,
    interestStopEvent: 'verified_repayment',
  };
  let referenceId: number;
  const asset = {
    name: 'Actual inspected custom model',
    modelCode: 'PAWN-FIXTURE-01',
    version: 'Custom inspected edition',
    assemblyState: 'painted',
    boxCondition: 'No original box',
    accessories: 'Stand included',
    defects: 'Shield paint wear disclosed',
    repairHistory: 'Custom paint, no reported repairs',
  };
  const photo = async (ownerUserId = userId) =>
    EvidenceModel.create({
      ownerUserId,
      purpose: 'pawn',
      diskKey: `${crypto.randomUUID()}.webp`,
      originalName: 'Actual private view.webp',
      mimeType: 'image/webp',
      sizeBytes: 100,
      sha256: crypto.randomBytes(32).toString('hex'),
    });
  const create = async () => {
    const evidenceIds = await Promise.all([1, 2, 3].map(async () => (await photo()).id));
    const data = { requestKey: `pawn-fixture-${++sequence}`, asset, evidenceIds, referenceProductId: referenceId };
    return { data, row: await service.create(userId, data) };
  };
  const approve = async (settings = basePolicy) => {
    const current = (await policy.list()).find((row) => row.name === 'pawn');
    await policy.approve(
      'pawn',
      settings,
      current?.version || 0,
      adminId,
      'Disposable test policy only; no owner/live approval',
    );
  };
  const quote = (id: number, version: number, disposalAfterGrace = false) =>
    service.act(
      id,
      adminId,
      {
        action: 'quote',
        expectedVersion: version,
        appraisalVnd: 2000000,
        principalVnd: 1400000,
        termDays: 30,
        disposalAfterGrace,
        details:
          'Fixture signed conditions: daily simple interest; explicit stop event and grace; actual eligible days; recorded extension decision; disposal only under signed permission.',
      },
      true,
    );
  const custody = async (disposalAfterGrace = false) => {
    let { row } = await create();
    row = await quote(row.id, row.version, disposalAfterGrace);
    row = await service.act(row.id, userId, {
      action: 'accept',
      expectedVersion: row.version,
      termsAccepted: true,
      disposalTermsAccepted: disposalAfterGrace,
    });
    row = await service.act(row.id, userId, {
      action: 'attach_contract',
      expectedVersion: row.version,
      evidenceIds: [(await photo()).id],
    });
    row = await service.act(
      row.id,
      adminId,
      {
        action: 'confirm_contract',
        expectedVersion: row.version,
        contractReference: `FIXTURE-CONTRACT-${row.id}`,
        bilateralSignatureVerified: true,
      },
      true,
    );
    row = await service.act(
      row.id,
      adminId,
      {
        action: 'verify_documents',
        expectedVersion: row.version,
        identityVerified: true,
        ownershipVerified: true,
        evidenceIds: [(await photo(adminId)).id],
        details: 'Disposable identity and ownership verification',
      },
      true,
    );
    return service.act(
      row.id,
      adminId,
      {
        action: 'receive_asset',
        expectedVersion: row.version,
        custodyReference: `FIXTURE-CUSTODY-${row.id}`,
        handoverVerified: true,
        conditionMatchesAgreement: true,
        details: 'Fixture actual handover checked against signed condition report',
      },
      true,
    );
  };
  const active = async (disposalAfterGrace = false) => {
    const row = await custody(disposalAfterGrace);
    return service.payment(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        amountVnd: 1400000,
        externalReference: `PAWN-DISBURSE-${row.id}`,
        moneyVerified: true,
        details: 'Fixture confirmed actual principal transfer',
      },
      'disbursement',
    );
  };
  beforeAll(async () => {
    db = await seedTestDatabase();
    [userId, otherId] = (
      await UserModel.findAll({ where: { role: 'USER', isActive: true }, limit: 2, order: [['id', 'ASC']] })
    ).map((row) => row.id);
    adminId = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!.id;
    const reference = (await ProductModel.findOne({
      where: { condition: 'new', partnerId: null, isArchived: false },
    }))!;
    referenceId = reference.id;
    await db.transaction(async (transaction) => {
      await reference.update(
        await new CatalogTreeService().selection(reference.get({ plain: true }), reference, transaction),
        { transaction },
      );
    });
    await reference.update({
      targetPriceApprovedAt: new Date(),
      serviceReferenceEnabled: true,
      pricingReferenceMemberVnd: 2000000,
      catalogReviewRequired: false,
    });
    const root = path.resolve('../../.artifacts/model-universe');
    await fs.mkdir(root, { recursive: true });
    uploadRoot = await fs.mkdtemp(path.join(root, 'pawn-test-uploads-'));
    process.env.UPLOAD_DIR = uploadRoot;
  }, 600000);
  afterAll(async () => {
    delete process.env.UPLOAD_DIR;
    await db?.close();
  });

  it('isolates owned evidence, stable retries and unresolved policy approval', async () => {
    const { row, data } = await create();
    expect((await service.create(userId, data)).id).toBe(row.id);
    await expect(
      service.create(userId, { ...data, asset: { ...asset, defects: 'Changed disclosure' } }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.detail(row.id, otherId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.detail(row.id, otherId, true)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.detail(NaN, userId)).rejects.toMatchObject({ statusCode: 400 });
    const foreign = await photo(otherId);
    await expect(
      service.create(userId, {
        ...data,
        requestKey: 'foreign-evidence-pawn',
        evidenceIds: [foreign.id, ...data.evidenceIds.slice(1)],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(quote(row.id, row.version)).rejects.toMatchObject({
      statusCode: 409,
      code: 'POLICY_APPROVAL_REQUIRED',
    });
    await expect(
      policy.approve('pawn', { ...basePolicy, interestStopEvent: undefined }, 0, adminId, 'Missing choice fixture'),
    ).rejects.toMatchObject({ statusCode: 400 });
    await approve();
    expect(row.estimate.interestVnd).toBe(0);
    expect(row.estimate.remainingVnd).toBe(0);
    expect(row.evidence[0].get({ plain: true })).not.toHaveProperty('diskKey');
  });
  it('requires the current exact offer, fresh signed scans, both signatures and custody before funding', async () => {
    let { row } = await create();
    for (const principalVnd of [999999, 1600001])
      await expect(
        service.act(
          row.id,
          adminId,
          {
            action: 'quote',
            expectedVersion: 0,
            appraisalVnd: 2000000,
            principalVnd,
            termDays: 30,
            disposalAfterGrace: false,
            details: 'Fixture invalid ratio',
          },
          true,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
    row = await quote(row.id, row.version);
    const previous = row.version;
    row = await quote(row.id, row.version);
    await expect(
      service.act(row.id, userId, {
        action: 'accept',
        expectedVersion: previous,
        termsAccepted: true,
        disposalTermsAccepted: false,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await service.act(row.id, userId, {
      action: 'accept',
      expectedVersion: row.version,
      termsAccepted: true,
      disposalTermsAccepted: false,
    });
    await expect(
      service.act(row.id, userId, {
        action: 'attach_contract',
        expectedVersion: row.version,
        evidenceIds: [row.evidence[0].id],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.act(
        row.id,
        adminId,
        {
          action: 'confirm_contract',
          expectedVersion: row.version,
          contractReference: 'UNSIGNED-FIXTURE',
          bilateralSignatureVerified: true,
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.payment(
        row.id,
        adminId,
        {
          expectedVersion: row.version,
          amountVnd: 1400000,
          externalReference: 'PAWN-NO-CUSTODY',
          moneyVerified: true,
          details: 'Fixture not disbursed',
        },
        'disbursement',
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await PawnPaymentModel.count({ where: { pawnContractId: row.id } })).toBe(0);
  });
  it('returns an unfunded asset even after an appraisal revision requires renewed consent', async () => {
    let row = await custody();
    row = await quote(row.id, row.version);
    expect(row.status).toBe('quoted');
    expect(row.contractReference).toBeNull();
    await expect(
      service.act(row.id, userId, { action: 'cancel', expectedVersion: row.version, details: 'Fixture withdrawal' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await service.act(
      row.id,
      adminId,
      {
        action: 'handback',
        expectedVersion: row.version,
        handoverVerified: true,
        details: 'Fixture unfunded actual asset returned after quote changed',
      },
      true,
    );
    expect(row.status).toBe('cancelled');
    expect(row.handbackAt).toBeTruthy();
    expect(row.disbursedAt).toBeNull();
  });
  it('confirms principal once under concurrent references and protects append-only money/history', async () => {
    const row = await custody();
    const data = {
      expectedVersion: row.version,
      amountVnd: 1400000,
      moneyVerified: true,
      details: 'Fixture actual transfer verification',
      externalReference: 'PAWN-CONCURRENT-A',
    };
    await expect(
      service.payment(row.id, adminId, { ...data, moneyVerified: false }, 'disbursement'),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.payment(row.id, adminId, { ...data, amountVnd: 1399999 }, 'disbursement'),
    ).rejects.toMatchObject({ statusCode: 409 });
    const results = await Promise.allSettled(
      ['PAWN-CONCURRENT-A', 'PAWN-CONCURRENT-B'].map((externalReference) =>
        service.payment(row.id, adminId, { ...data, externalReference }, 'disbursement'),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const payment = (await PawnPaymentModel.findOne({ where: { pawnContractId: row.id } }))!;
    await service.payment(
      row.id,
      adminId,
      { ...data, externalReference: payment.externalReference.toLowerCase() },
      'disbursement',
    );
    expect(await PawnPaymentModel.count({ where: { pawnContractId: row.id } })).toBe(1);
    expect(await PawnEventModel.count({ where: { pawnContractId: row.id, action: 'disbursement' } })).toBe(1);
    await expect(db.query('UPDATE pawn_payment SET "amountVnd"=1')).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM pawn_event WHERE action='disbursement'")).rejects.toThrow(/append-only/);
    await expect(
      db.transaction((transaction) =>
        MoneyReferenceService.lock(payment.externalReference, 'buyback_payout', transaction),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PAYMENT_REFERENCE_REUSED' });
  });
  it('charges actual eligible early days and stops at verified payment only under that signed choice', async () => {
    let row = await active();
    await PawnContractModel.update(
      { disbursedAt: new Date(Date.now() - 5.5 * PAWN_DAY_MS) },
      { where: { id: row.id } },
    );
    row = await service.detail(row.id, userId);
    expect(row.estimate.interestVnd).toBeGreaterThan(23000);
    expect(row.estimate.interestVnd).toBeLessThan(24000);
    const data = {
      expectedVersion: row.version,
      amountVnd: row.estimate.remainingVnd,
      externalReference: 'PAWN-EARLY-REPAY',
      moneyVerified: true,
      details: 'Fixture early actual repayment',
    };
    row = await service.payment(row.id, adminId, data, 'redemption');
    await service.payment(row.id, adminId, data, 'redemption');
    expect(row.status).toBe('repaid');
    expect(row.handbackAt).toBeNull();
    expect(row.estimate.remainingVnd).toBe(0);
    await PawnContractModel.update({ paidAt: new Date(Date.now() - 2 * PAWN_DAY_MS) }, { where: { id: row.id } });
    expect((await service.detail(row.id, userId)).estimate.remainingVnd).toBe(0);
    row = await service.act(
      row.id,
      adminId,
      {
        action: 'handback',
        expectedVersion: row.version,
        handoverVerified: true,
        details: 'Fixture actual redeemed model returned',
      },
      true,
    );
    expect(row.status).toBe('returned');
    expect(row.handbackAt).toBeTruthy();
  });
  it('rejects superseded policy choices for new contracts and does not rewrite old snapshots', async () => {
    await expect(approve({ ...basePolicy, interestStopEvent: 'asset_handback' })).rejects.toMatchObject({
      statusCode: 400,
    });
    const row = await active();
    const original = row.terms;
    await approve({ ...basePolicy, legalMode: 'simulation' });
    expect((await service.detail(row.id, userId)).terms).toEqual(original);
    await approve();
  });
  it('persists T-10/T-5 once and cancels old schedules when a funded extension is approved', async () => {
    let row = await active(true);
    const reminder = new PawnReminderService(),
      due = new Date(row.dueAt!);
    await reminder.run();
    await reminder.run();
    expect(await CommerceNotificationModel.count({ where: { entityId: row.id, kind: 'pawn_due' } })).toBe(2);
    row = await service.act(row.id, userId, {
      action: 'request_extension',
      expectedVersion: row.version,
      proposedDueAt: new Date(due.getTime() + PAWN_DAY_MS).toISOString(),
      details: 'Confirmed extension fixture',
    });
    row = await service.payment(
      row.id,
      adminId,
      {
        expectedVersion: row.version,
        amountVnd: row.extensionRequest!.creditDueVnd,
        externalReference: 'PAWN-EXTENSION-CREDIT',
        moneyVerified: true,
        details: 'Actual credit fixture',
      },
      'extension_credit',
    );
    row = await service.act(
      row.id,
      adminId,
      { action: 'extension_decision', expectedVersion: row.version, accepted: true, details: 'Credit reconciled' },
      true,
    );
    expect(new Date(row.dueAt!).getTime()).toBe(due.getTime() + PAWN_DAY_MS);
    expect(row.extensionRequest).toBeNull();
    expect(
      await CommerceNotificationModel.count({ where: { entityId: row.id, kind: 'pawn_due', cancelledAt: null } }),
    ).toBe(2);
  });
  it('caps interest without automatic disposal, and rejects missing grace or contractual permission', async () => {
    let row = await active(false);
    await PawnContractModel.update(
      { disbursedAt: new Date(Date.now() - 5000 * PAWN_DAY_MS), dueAt: new Date(Date.now() - 5 * PAWN_DAY_MS) },
      { where: { id: row.id } },
    );
    row = await service.detail(row.id, userId);
    expect(row.status).toBe('active');
    expect(row.estimate.capped).toBe(true);
    expect(row.estimate.interestVnd).toBe(1400000);
    await expect(
      service.act(
        row.id,
        adminId,
        {
          action: 'dispose',
          expectedVersion: row.version,
          authorized: true,
          contractEligibilityVerified: true,
          disposalReference: 'FIXTURE-NO-PERMISSION',
          details: 'Interest cap is not permission',
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    const permitted = await active(true);
    await PawnContractModel.update({ dueAt: new Date(Date.now() - PAWN_DAY_MS) }, { where: { id: permitted.id } });
    await expect(
      service.act(
        permitted.id,
        adminId,
        {
          action: 'dispose',
          expectedVersion: permitted.version,
          authorized: true,
          contractEligibilityVerified: true,
          disposalReference: 'FIXTURE-IN-GRACE',
          details: 'Fixture still within signed grace',
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('activates actual photographed stock once only after explicit eligible disposal, without forgiving debt', async () => {
    let row = await active(true);
    const original = (await ProductModel.findOne({ order: [['id', 'ASC']] }))!.get({ plain: true });
    await fs.mkdir(path.join(uploadRoot, 'products'), { recursive: true });
    const urls: string[] = [];
    for (const name of [
      'strike-freedom-custom.webp',
      'strike-freedom-custom-side.webp',
      'strike-freedom-custom-detail.webp',
    ]) {
      const diskName = `${crypto.randomUUID()}.webp`;
      await fs.copyFile(path.resolve('public/images/catalog', name), path.join(uploadRoot, 'products', diskName));
      urls.push(`/uploads/products/${diskName}`);
    }
    const draft = await ProductModel.create({
      ...original,
      id: undefined,
      uuid: undefined,
      slug: undefined,
      combinationKey: null,
      modelFamilyId: null,
      sku: `PAWN-ACTUAL-${row.id}`,
      name: asset.name,
      modelCode: asset.modelCode,
      stock: 0,
      sold: 0,
      condition: 'preowned',
      assemblyState: asset.assemblyState,
      isArchived: true,
      imageUrl: urls[0],
      supplierId: null,
    });
    await db.transaction(async (transaction) => {
      await draft.update(
        await new CatalogTreeService().selection(
          { ...draft.get({ plain: true }), itemTypeKey: 'preowned', conditionNodeIds: [] },
          draft,
          transaction,
        ),
        { transaction },
      );
    });
    await ProductImageModel.bulkCreate(
      urls.slice(1).map((url, sortOrder) => ({ productId: draft.id, url, sortOrder })),
    );
    const intake = {
      expectedVersion: row.version,
      productId: draft.id,
      actualPhotosVerified: true,
      details: 'Fixture shop inspection and public photo reconciliation',
    };
    await expect(service.intake(row.id, adminId, intake)).rejects.toMatchObject({ statusCode: 409 });
    expect((await draft.reload()).stock).toBe(0);
    const overdue = new Date(Date.now() - 3 * PAWN_DAY_MS);
    await PawnContractModel.update(
      {
        status: 'OVERDUE_REVIEW',
        conditionCase: null,
        dueAt: overdue,
        governance: {
          ...row.governance,
          notice: { eligibleAt: new Date(Date.now() - PAWN_DAY_MS).toISOString(), dueAt: overdue.toISOString() },
          complianceApproval: { by: adminId },
          financeApproval: { by: adminId + 1000 },
        },
      },
      { where: { id: row.id } },
    );
    row = await service.act(
      row.id,
      adminId,
      {
        action: 'dispose',
        expectedVersion: row.version,
        authorized: true,
        contractEligibilityVerified: true,
        disposalReference: 'FIXTURE-VERIFIED-DISPOSAL',
        details: 'Fixture signed disposal eligible beyond grace, explicit authorized verification',
      },
      true,
    );
    expect(row.estimate.remainingVnd).toBeGreaterThan(0);
    row = await service.act(
      row.id,
      adminId,
      {
        action: 'title_transfer',
        expectedVersion: row.version,
        ownershipTransferVerified: true,
        evidenceIds: [(await photo(adminId)).id],
        details: 'Completed title transfer with verified evidence',
      },
      true,
    );
    await service.intake(row.id, adminId, { ...intake, expectedVersion: row.version });
    await service.intake(row.id, adminId, intake);
    expect((await draft.reload()).stock).toBe(1);
    expect(draft.importPrice).toBe(1400000);
    expect(draft.isArchived).toBe(true);
    expect(draft.ownershipVerifiedAt).toBeTruthy();
    expect(await PawnEventModel.count({ where: { pawnContractId: row.id, action: 'intake' } })).toBe(1);
    await expect(ProductModel.destroy({ where: { id: draft.id } })).rejects.toThrow(/foreign key/);
    expect((await service.detail(row.id, userId)).estimate.remainingVnd).toBeGreaterThan(0);
  });
});
