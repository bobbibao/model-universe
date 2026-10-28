import PawnDisposalService from '../../src/core/server/services/PawnDisposalService';
import OrderItemModel from '../../src/core/server/database/client/models/OrderItem.Model';
import OrderPrepaymentModel from '../../src/core/server/database/client/models/OrderPrepayment.Model';
import EvidenceModel from '../../src/core/server/database/client/models/Evidence.Model';
import PaymentGatewayService, {
  setPayOSClient,
  type PayOSLike,
} from '../../src/core/server/services/PaymentGatewayService';
import OrderPaymentLinkModel from '../../src/core/server/database/client/models/OrderPaymentLink.Model';
import crypto from 'node:crypto';
import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import ProductService from '../../src/core/server/services/ProductService';
import ReservationService from '../../src/core/server/services/ReservationService';
import PawnService from '../../src/core/server/services/PawnService';
import PawnReminderService from '../../src/core/server/services/PawnReminderService';
import MoneyOperationsService from '../../src/core/server/services/MoneyOperationsService';
import CommercePolicyService from '../../src/core/server/services/CommercePolicyService';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductDiscountModel from '../../src/core/server/database/client/models/ProductDiscount.Model';
import ReservationModel from '../../src/core/server/database/client/models/Reservation.Model';
import ReservationPaymentModel from '../../src/core/server/database/client/models/ReservationPayment.Model';
import PawnContractModel from '../../src/core/server/database/client/models/PawnContract.Model';
import PawnPaymentModel from '../../src/core/server/database/client/models/PawnPayment.Model';
import CommerceNotificationModel from '../../src/core/server/database/client/models/CommerceNotification.Model';
import NotificationDeliveryModel from '../../src/core/server/database/client/models/NotificationDelivery.Model';
import MoneyOperationModel from '../../src/core/server/database/client/models/MoneyOperation.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import OrderModel from '../../src/core/server/database/client/models/Order.Model';
import { HOLD_RULE_VERSION, minimumHoldVnd } from '../../src/shared/reservation';
import { PAWN_DAY_MS, type PawnInterestPolicy } from '../../src/shared/pawn-rules';
const policy: PawnInterestPolicy = {
  calculation: 'compound_0_3_v2',
  cashFlowClock: 'elapsed_24h_periods',
  legalMode: 'approved',
  legalReference: 'DISPOSABLE-TEST-LEGAL-ONLY',
  legalApprovedBy: 1,
  dailyRateBasisPoints: 30,
  dayCount: 'completed_days',
  rounding: 'nearest',
  graceDays: 2,
  interestStopEvent: 'verified_repayment',
};
describe('2026 pawn and hold money/stock invariants on disposable Postgres', () => {
  let db: Sequelize,
    product: ProductModel,
    owner: number,
    customer: number,
    finance: number,
    total: number,
    sequence = 0;
  const holds = new ReservationService(),
    pawns = new PawnService(),
    refunds = new MoneyOperationsService();
  const key = () => `new-rules-${++sequence}-${crypto.randomUUID()}`;
  const create = () =>
    holds.create(customer, {
      productId: product.id,
      quantity: 1,
      expectedTotal: total,
      requestKey: key(),
      termsAccepted: true,
      termsVersion: HOLD_RULE_VERSION,
    });
  const pay = (id: number, amountVnd: number, ref = key()) =>
    holds.confirmPayment(id, owner, {
      amountVnd,
      externalReference: ref,
      moneyVerified: true,
      bankEvidenceReference: 'TEST-VERIFIED-BANK-EXTRACT',
      reason: 'Disposable confirmed receipt',
    });
  const pawn = async (simulation = false) =>
    PawnContractModel.create({
      userId: customer,
      requestKey: key(),
      requestDigest: key(),
      status: 'in_custody',
      asset: { name: 'Fixture exact SKU' },
      terms: {
        appraisalVnd: 2000000,
        principalVnd: 1000000,
        termDays: 20,
        contractText: 'Disposable signed fixture',
        disposalAfterGrace: true,
        policyVersion: 1,
        policy: { ...policy, legalMode: simulation ? 'simulation' : 'approved' },
      },
      contractReference: key(),
      custodyAt: new Date(),
      custodyReference: key(),
      governance: { identityVerified: true, ownershipVerified: true },
    });
  const fund = async () => {
    const r = await pawn();
    return pawns.payment(
      r.id,
      owner,
      {
        expectedVersion: r.version,
        amountVnd: 1000000,
        externalReference: key(),
        moneyVerified: true,
        details: 'Verified simulated test transfer',
      },
      'disbursement',
    );
  };
  beforeAll(async () => {
    db = await seedTestDatabase();
    owner = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!.id;
    const users = await UserModel.findAll({
      where: { role: 'USER', isActive: true },
      order: [['id', 'ASC']],
      limit: 2,
    });
    customer = users[0].id;
    finance = users[1].id;
    await users[1].update({ role: 'ADMIN', commerceScopes: ['finance', 'compliance'] });
    product = (await ProductModel.findOne({ where: { stock: { [Op.gt]: 5 }, partnerId: null } }))!;
    await product.update({
      price: 1000000,
      modelCode: 'RULES-TEST',
      stock: 100,
      listPriceVerified: false,
      ownershipVerifiedAt: new Date(),
      ownershipReference: 'TEST-OWNERSHIP-ONLY',
    });
    await ProductDiscountModel.destroy({ where: { productId: product.id } });
    await new CommercePolicyService().approve(
      'reservation',
      {
        priceBasis: 'net_merchandise',
        dayCutoff: 'elapsed_24h',
        extensionMode: 'original_start_tiers',
        ruleVersion: HOLD_RULE_VERSION,
      },
      0,
      owner,
      'Disposable fixture only',
    );
    total = (await holds.quote(customer, { productId: product.id, quantity: 1 })).totalVnd;
    process.env.BANK_EVENT_SIGNING_SECRET = 'disposable-test-bank-signing-secret-at-least-32-characters';
  }, 600000);
  afterAll(async () => {
    delete process.env.BANK_EVENT_SIGNING_SECRET;
    await db?.close();
  });
  it('rejects missing terms and stock without verified ownership', async () => {
    await expect(
      holds.create(customer, { productId: product.id, quantity: 1, expectedTotal: total, requestKey: key() }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await product.update({ ownershipVerifiedAt: null });
    expect((await holds.quote(customer, { productId: product.id, quantity: 1 })).eligible).toBe(false);
    await expect(create()).rejects.toMatchObject({ statusCode: 409 });
    await product.update({ ownershipVerifiedAt: new Date() });
  });
  it('records below-threshold money without stock or clock; crossing 20% activates once', async () => {
    const row = await create(),
      stock = (await product.reload()).stock,
      min = minimumHoldVnd(total);
    const low = await pay(row.id, min - 1);
    expect(low.inventoryAllocated).toBe(false);
    expect(low.startedAt).toBeFalsy();
    expect((await product.reload()).stock).toBe(stock);
    const ref = key(),
      active = await pay(row.id, 1, ref);
    await pay(row.id, 1, ref);
    expect(active.status).toBe('holding');
    expect(active.expiresAt!.getTime() - active.startedAt!.getTime()).toBe(10 * PAWN_DAY_MS);
    expect((await product.reload()).stock).toBe(stock - 1);
  });
  it('anchors top-ups to original start and leaves same-tier deadline unchanged', async () => {
    const row = await create(),
      first = await pay(row.id, minimumHoldVnd(total));
    const same = await pay(row.id, 1);
    expect(same.expiresAt).toEqual(first.expiresAt);
    const next = await pay(row.id, Math.ceil(total * 0.4) - same.paidVnd);
    expect(next.startedAt).toEqual(first.startedAt);
    expect(next.expiresAt!.getTime() - first.startedAt!.getTime()).toBe(15 * PAWN_DAY_MS);
  });
  it('marks exactly full payment without a timed expiry and isolates excess funds', async () => {
    const row = await create(),
      full = await pay(row.id, total);
    expect(full.status).toBe('PAID_IN_FULL');
    expect(full.expiresAt).toBeNull();
    const excess = await pay(row.id, 1);
    expect(excess.paidVnd).toBe(total);
    expect(excess.unallocatedVnd).toBe(1);
    expect(excess.reconciliationRequired).toBe(true);
  });
  it('expires and releases once; late confirmed money cannot reactivate', async () => {
    const row = await create(),
      stock = (await product.reload()).stock;
    await pay(row.id, minimumHoldVnd(total));
    await ReservationModel.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: row.id } });
    await holds.expireHolds();
    await holds.expireHolds();
    expect((await product.reload()).stock).toBe(stock);
    const late = await pay(row.id, 10);
    expect(late.status).toBe('expired');
    expect(late.inventoryAllocated).toBe(false);
    expect(late.unallocatedVnd).toBe(10);
  });
  it('allows only one concurrent reservation of the last unit but records both actual payments', async () => {
    const a = await create(),
      b = await create();
    await product.update({ stock: 1 });
    await Promise.all([pay(a.id, minimumHoldVnd(total)), pay(b.id, minimumHoldVnd(total))]);
    const rows = await ReservationModel.findAll({ where: { id: [a.id, b.id] } });
    expect(rows.filter((r) => r.inventoryAllocated)).toHaveLength(1);
    expect(rows.filter((r) => r.reconciliationRequired)).toHaveLength(1);
    expect((await product.reload()).stock).toBe(0);
    await product.update({ stock: 100 });
  });
  it('transfers a deposit once, then cancellation never recreates the hold or transfer', async () => {
    const row = await create();
    await pay(row.id, minimumHoldVnd(total));
    await holds.requestDelivery(row.id, customer, {
      deliveryMethod: 'pickup',
      shipping: { recipientName: 'Fixture', phone: '0901234567', address: '12 Test Street', city: 'Test City' },
    });
    const a = await holds.confirmDelivery(row.id, owner),
      b = await holds.confirmDelivery(row.id, owner);
    expect(a.orderId).toBe(b.orderId);
    expect((await OrderModel.findByPk(a.orderId))!.prepaidVnd).toBe(minimumHoldVnd(total));
    expect(a.depositTransferredVnd).toBe(minimumHoldVnd(total));
  });
  it('requires cancellation approval and independent refund approval, then signed bank confirmation', async () => {
    const row = await create(),
      paid = minimumHoldVnd(total);
    await pay(row.id, paid);
    const requested = await holds.cancel(row.id, customer, { reason: 'Customer refund request' }, true);
    expect(requested.status).toBe('cancel_requested');
    expect(requested.inventoryAllocated).toBe(true);
    await holds.cancel(row.id, owner, { reason: 'Approved cancellation, no forfeiture' });
    const data = {
      amountVnd: paid,
      requestKey: key(),
      reason: 'Refund cancelled deposit',
      bankName: 'Test bank',
      accountNumber: '123456',
      accountHolder: 'Test customer',
    };
    const op = await refunds.request('hold_refund', row.id, customer, data);
    expect((await refunds.request('hold_refund', row.id, customer, data)).id).toBe(op.id);
    await expect(
      refunds.decide(op.id, customer, { expectedVersion: 0, approved: true, reason: 'No authority' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await refunds.decide(op.id, finance, {
      expectedVersion: 0,
      approved: true,
      reason: 'Independent ledger verification',
    });
    expect(await ReservationPaymentModel.count({ where: { reservationId: row.id, kind: 'refund' } })).toBe(0);
    const body = {
      operationId: op.id,
      amountVnd: paid,
      reference: key().toUpperCase(),
      status: 'SUCCEEDED',
      accountHash: op.details.accountHash,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: key(),
    };
    const sig = crypto
      .createHmac('sha256', process.env.BANK_EVENT_SIGNING_SECRET!)
      .update(JSON.stringify(body))
      .digest('hex');
    await expect(refunds.bankConfirmation(body, 'bad')).rejects.toMatchObject({ statusCode: 401 });
    await refunds.bankConfirmation(body, sig);
    await refunds.bankConfirmation(body, sig);
    expect(await ReservationPaymentModel.count({ where: { reservationId: row.id, kind: 'refund' } })).toBe(1);
    expect((await MoneyOperationModel.findByPk(op.id))!.status).toBe('completed');
    await expect(db.query(`UPDATE money_operation SET "amountVnd"=1 WHERE id=${op.id}`)).rejects.toThrow(/immutable/);
  });
  it('rejects real pawn payment in simulation and before documents are verified', async () => {
    const row = await pawn(true),
      data = {
        expectedVersion: row.version,
        amountVnd: 1000000,
        externalReference: key(),
        moneyVerified: true,
        details: 'Must not disburse',
      };
    await expect(pawns.payment(row.id, owner, data, 'disbursement')).rejects.toMatchObject({ statusCode: 409 });
    expect(await PawnPaymentModel.count({ where: { pawnContractId: row.id } })).toBe(0);
    await row.update({ terms: { ...row.terms!, policy }, governance: {} });
    await expect(pawns.payment(row.id, owner, data, 'disbursement')).rejects.toMatchObject({ statusCode: 409 });
  });
  it('requires confirmed incremental credit, retains principal, and replaces reminder schedules on repeated extensions', async () => {
    let row = await fund();
    const originalDue = new Date(row.dueAt!);
    row = await pawns.act(row.id, customer, {
      action: 'request_extension',
      expectedVersion: row.version,
      proposedDueAt: new Date(originalDue.getTime() + 5 * PAWN_DAY_MS).toISOString(),
      details: 'First extension',
    });
    await expect(
      pawns.act(
        row.id,
        owner,
        { action: 'extension_decision', expectedVersion: row.version, accepted: true, details: 'Unfunded credit' },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await pawns.payment(
      row.id,
      owner,
      {
        expectedVersion: row.version,
        amountVnd: row.extensionRequest!.creditDueVnd,
        externalReference: key(),
        moneyVerified: true,
        details: 'Confirmed credit transfer',
      },
      'extension_credit',
    );
    row = await pawns.act(
      row.id,
      owner,
      { action: 'extension_decision', expectedVersion: row.version, accepted: true, details: 'Credit matched' },
      true,
    );
    expect(row.terms!.principalVnd).toBe(1000000);
    expect(row.estimate.availableCreditVnd).toBeGreaterThan(0);
    const old = await CommerceNotificationModel.findAll({ where: { entityId: row.id, kind: 'pawn_due' } });
    expect(old.some((n) => n.cancelledAt)).toBe(true);
    const cancelled = await NotificationDeliveryModel.count({
      where: { sourceId: old.filter((n) => n.cancelledAt).map((n) => n.id), status: 'cancelled' },
    });
    expect(cancelled).toBeGreaterThan(0);
    row = await pawns.act(row.id, customer, {
      action: 'request_extension',
      expectedVersion: row.version,
      proposedDueAt: new Date(new Date(row.dueAt!).getTime() + 5 * PAWN_DAY_MS).toISOString(),
      details: 'Second extension',
    });
    expect(row.extensionRequest!.creditDueVnd).toBeGreaterThan(0);
  });
  it('blocks extension above 80% of V before deducting credit', async () => {
    const row = await fund();
    await PawnContractModel.update({ terms: { ...row.terms!, appraisalVnd: 1250000 } }, { where: { id: row.id } });
    await expect(
      pawns.act(row.id, customer, {
        action: 'request_extension',
        expectedVersion: row.version,
        proposedDueAt: new Date(new Date(row.dueAt!).getTime() + PAWN_DAY_MS).toISOString(),
        details: 'Over cap',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('moves due → 48h grace → review without penalty, disposal, or stock intake', async () => {
    const row = await fund(),
      due = new Date(row.dueAt!),
      reminders = new PawnReminderService(),
      stock = (await product.reload()).stock;
    await reminders.run(due);
    expect((await PawnContractModel.findByPk(row.id))!.status).toBe('DUE_GRACE');
    await reminders.run(new Date(due.getTime() + 48 * 3600000));
    expect((await PawnContractModel.findByPk(row.id))!.status).toBe('OVERDUE_REVIEW');
    expect((await product.reload()).stock).toBe(stock);
    const current = (await PawnContractModel.findByPk(row.id))!;
    await expect(
      pawns.act(
        row.id,
        owner,
        {
          action: 'dispose',
          expectedVersion: current.version,
          authorized: true,
          contractEligibilityVerified: true,
          disposalReference: key(),
          details: 'No legal approvals',
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('applies a partial principal payment without adding credit to principal and preserves append-only ledgers', async () => {
    let row = await fund();
    row = await pawns.payment(
      row.id,
      owner,
      {
        expectedVersion: row.version,
        amountVnd: 500000,
        externalReference: key(),
        moneyVerified: true,
        details: 'Confirmed partial repayment',
      },
      'redemption',
    );
    expect(row.estimate.principalOutstandingVnd).toBeLessThanOrEqual(500001);
    expect(row.status).toBe('active');
    await expect(db.query('UPDATE pawn_payment SET "amountVnd"=1')).rejects.toThrow(/append-only/);
  });
  it('verifies hold QR through the provider, locks its amount, and rejects forged webhook replay', async () => {
    const row = await create();
    let code = 0;
    const sdk: PayOSLike = {
      paymentRequests: {
        create: async (input) => {
          code = Number(input.orderCode);
          return {
            checkoutUrl: 'https://example.invalid/checkout',
            paymentLinkId: key(),
            status: 'PENDING',
            qrCode: 'TEST-ONLY',
          };
        },
        get: async () => ({ status: 'PENDING', amountPaid: 0, transactions: [] }),
      },
      webhooks: {
        verify: async (body) => {
          if (!(body as { valid?: boolean }).valid) throw new Error('bad signature');
          return { orderCode: code, amount: minimumHoldVnd(total), reference: 'PAYOS-HOLD-VERIFIED-TEST', code: '00' };
        },
      },
    };
    setPayOSClient(sdk);
    const gateway = new PaymentGatewayService();
    try {
      await gateway.createHoldLink(customer, row.id, minimumHoldVnd(total));
      await expect(gateway.createHoldLink(customer, row.id, total)).rejects.toMatchObject({ statusCode: 409 });
      await expect(gateway.webhook({ valid: false })).rejects.toMatchObject({ statusCode: 401 });
      expect((await holds.detail(row.id)).paidVnd).toBe(0);
      await gateway.webhook({ valid: true });
      await gateway.webhook({ valid: true });
      expect((await holds.detail(row.id)).inventoryAllocated).toBe(true);
      expect(await OrderPaymentLinkModel.count({ where: { reservationId: row.id, status: 'PAID' } })).toBe(1);
    } finally {
      setPayOSClient(null);
    }
  });
  it('refunds unused extension credit after early redemption without adding or repaying principal twice', async () => {
    let row = await fund();
    row = await pawns.act(row.id, customer, {
      action: 'request_extension',
      expectedVersion: row.version,
      proposedDueAt: new Date(new Date(row.dueAt!).getTime() + 5 * PAWN_DAY_MS).toISOString(),
      details: 'Extension before early redemption',
    });
    const credit = row.extensionRequest!.creditDueVnd!;
    row = await pawns.payment(
      row.id,
      owner,
      {
        expectedVersion: row.version,
        amountVnd: credit,
        externalReference: key(),
        moneyVerified: true,
        details: 'Confirmed extension credit',
      },
      'extension_credit',
    );
    row = await pawns.payment(
      row.id,
      owner,
      {
        expectedVersion: row.version,
        amountVnd: row.estimate.remainingVnd,
        externalReference: key(),
        moneyVerified: true,
        details: 'Confirmed early redemption',
      },
      'redemption',
    );
    expect(row.status).toBe('repaid');
    expect(row.estimate.surplusCreditVnd).toBeGreaterThan(0);
    expect(row.estimate.principalOutstandingVnd).toBe(0);
    const op = await refunds.request('pawn_credit_refund', row.id, customer, {
      amountVnd: row.estimate.surplusCreditVnd,
      requestKey: key(),
      reason: 'Early redemption excess credit',
      bankName: 'Test',
      accountNumber: '12345',
      accountHolder: 'Fixture',
    });
    await refunds.decide(op.id, finance, { expectedVersion: 0, approved: true, reason: 'Verified excess' });
    const body = {
        operationId: op.id,
        amountVnd: Number(op.amountVnd),
        reference: key().toUpperCase(),
        status: 'SUCCEEDED',
        accountHash: op.details.accountHash,
        timestamp: Math.floor(Date.now() / 1000),
        nonce: key(),
      },
      sig = crypto
        .createHmac('sha256', process.env.BANK_EVENT_SIGNING_SECRET!)
        .update(JSON.stringify(body))
        .digest('hex');
    await refunds.bankConfirmation(body, sig);
    row = await pawns.detail(row.id, customer);
    expect(row.estimate.availableCreditVnd).toBe(0);
    expect(row.estimate.remainingVnd).toBe(0);
  });
  it('requires notice, two independent reviews and actual title transfer before any intake', async () => {
    let row = await fund();
    await PawnContractModel.update(
      { disbursedAt: new Date(Date.now() - 30 * PAWN_DAY_MS), dueAt: new Date(Date.now() - 4 * PAWN_DAY_MS) },
      { where: { id: row.id } },
    );
    await new PawnReminderService().run();
    row = await pawns.detail(row.id, customer);
    const proof = async () =>
      EvidenceModel.create({
        ownerUserId: owner,
        purpose: 'pawn',
        diskKey: key() + '.webp',
        originalName: 'Test legal proof.webp',
        mimeType: 'image/webp',
        sizeBytes: 100,
        sha256: crypto.randomBytes(32).toString('hex'),
      });
    row = await pawns.act(
      row.id,
      owner,
      {
        action: 'record_notice',
        expectedVersion: row.version,
        servedAt: new Date(Date.now() - 3 * PAWN_DAY_MS).toISOString(),
        eligibleAt: new Date(Date.now() - PAWN_DAY_MS).toISOString(),
        noticeValidityVerified: true,
        evidenceIds: [(await proof()).id],
        details: 'Disposable proof of valid notice and legal waiting period',
      },
      true,
    );
    row = await pawns.act(
      row.id,
      owner,
      { action: 'compliance_disposal', expectedVersion: row.version, details: 'Compliance reviewed title and notice' },
      true,
    );
    await expect(
      pawns.act(
        row.id,
        owner,
        { action: 'finance_disposal', expectedVersion: row.version, details: 'Same reviewer disallowed' },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    row = await pawns.act(
      row.id,
      finance,
      { action: 'finance_disposal', expectedVersion: row.version, details: 'Independent Finance review' },
      true,
    );
    row = await pawns.act(
      row.id,
      owner,
      {
        action: 'dispose',
        expectedVersion: row.version,
        authorized: true,
        contractEligibilityVerified: true,
        disposalReference: key(),
        details: 'Authorized lawful disposal',
      },
      true,
    );
    expect(row.status).toBe('disposed');
    expect(row.governance.titleTransfer).toBeFalsy();
    row = await pawns.act(
      row.id,
      owner,
      {
        action: 'title_transfer',
        expectedVersion: row.version,
        ownershipTransferVerified: true,
        evidenceIds: [(await proof()).id],
        details: 'Completed transfer of title with actual supporting proof',
      },
      true,
    );
    expect(row.governance.titleTransfer.reference).toContain('Completed transfer');
  });
  it('keeps ownership evidence private while reporting hold eligibility', async () => {
    const visible = await new ProductService().getPublicById(product.id);
    expect(visible).not.toHaveProperty('ownershipReference');
    await product.update({ stock: 100 });
    expect((await holds.quote(customer, { productId: product.id, quantity: 1 })).eligible).toBe(true);
  });
  it('requires a consistent cash-flow policy and Compliance; simulation never retains forged legal approval', async () => {
    const policies = new CommercePolicyService();
    await expect(
      policies.approve('pawn', { ...policy, dayCount: 'started_days' }, 0, owner, 'Inconsistent clock'),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(policies.approve('pawn', policy, 0, customer, 'Customer cannot approve law')).rejects.toMatchObject({
      statusCode: 403,
    });
    const row = await policies.approve(
      'pawn',
      { ...policy, legalMode: 'simulation', legalApprovedBy: customer },
      0,
      owner,
      'Disposable simulation fixture',
    );
    expect(row.settings.legalMode).toBe('simulation');
    expect(row.settings).not.toHaveProperty('legalApprovedBy');
    expect(row.settings).not.toHaveProperty('legalReference');
  });
  it('allocates a confirmed sale under the compound contract without reopening paid principal; customer accepts continuing accrual', async () => {
    const funded = await fund(),
      row = (await PawnContractModel.findByPk(funded.id))!;
    const raw = product.get({ plain: true });
    const sku = await ProductModel.create({
      ...raw,
      id: undefined,
      uuid: undefined,
      slug: undefined,
      combinationKey: null,
      modelFamilyId: null,
      sku: key(),
      stock: 0,
      sold: 1,
    });
    await row.update({
      status: 'disposed',
      productId: sku.id,
      disbursedAt: new Date(Date.now() - PAWN_DAY_MS),
      disposedAt: new Date(Date.now() - 3600000),
      governance: {
        ...row.governance,
        titleTransfer: { by: owner, at: new Date().toISOString(), reference: 'TEST-COMPLETED-TITLE' },
      },
    });
    const order = await OrderModel.create({
      userId: customer,
      recipientName: 'Fixture',
      phone: '0901234567',
      address: '12 Test Street',
      city: 'Test City',
      subtotal: 1000000,
      discount: 0,
      shippingFee: 0,
      total: 1000000,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      paymentMethod: 'COD',
      paymentPlan: 'full',
      upfrontDueVnd: 1000000,
      prepaidVnd: 1000000,
    });
    const line = await OrderItemModel.create({
      orderId: order.id,
      productId: sku.id,
      productName: sku.name,
      imageUrl: sku.imageUrl,
      quantity: 1,
      unitPrice: 1000000,
      modelSnapshot: {},
    });
    await OrderPrepaymentModel.create({
      orderId: order.id,
      actorUserId: owner,
      kind: 'receipt',
      amountVnd: 1000000,
      externalReference: key(),
      reason: 'Actual sale receipt fixture',
    });
    const service = new PawnDisposalService();
    await service.offer(row.id, owner, {
      expectedVersion: row.version,
      orderItemId: line.id,
      costs: [],
      agreementText:
        'Quoted allocation as of stated time. Interest continues under signed compound contract until actual full settlement. Documented costs, principal, interest, customer surplus.',
    });
    await row.reload();
    const proof = await EvidenceModel.create({
      ownerUserId: customer,
      purpose: 'pawn_settlement',
      diskKey: key() + '.webp',
      originalName: 'Signed fixture.webp',
      mimeType: 'image/webp',
      sizeBytes: 100,
      sha256: crypto.randomBytes(32).toString('hex'),
    });
    const accept = {
      expectedVersion: row.version,
      decision: 'accept',
      termsAccepted: true,
      costsAccepted: true,
      evidenceIds: [proof.id],
    };
    await expect(service.decide(row.id, customer, accept)).rejects.toMatchObject({ statusCode: 400 });
    await service.decide(row.id, customer, { ...accept, accrualAcknowledged: true });
    await row.reload();
    await service.execute(row.id, owner, {
      expectedVersion: row.version,
      bilateralSignatureVerified: true,
      amendmentReference: key(),
    });
    await row.reload();
    const summary = (await service.summary(row))!;
    expect(summary.principalAppliedVnd).toBe(1000000);
    expect(summary.remainingVnd).toBeGreaterThanOrEqual(3000);
    expect(summary.remainingVnd).toBeLessThan(3100);
    expect(summary.entries[0].statement?.accrualAcknowledged).toBe(true);
  });
  it('lets Finance reject a pending extension in overdue review without leaving disposal permanently blocked', async () => {
    let row = await fund();
    row = await pawns.act(row.id, customer, {
      action: 'request_extension',
      expectedVersion: row.version,
      proposedDueAt: new Date(new Date(row.dueAt!).getTime() + PAWN_DAY_MS).toISOString(),
      details: 'Pending request fixture',
    });
    await PawnContractModel.update({ status: 'OVERDUE_REVIEW' }, { where: { id: row.id } });
    await expect(
      pawns.act(
        row.id,
        owner,
        {
          action: 'extension_decision',
          expectedVersion: row.version,
          accepted: true,
          details: 'Review cannot automatically renew',
        },
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    row = await pawns.act(
      row.id,
      owner,
      {
        action: 'extension_decision',
        expectedVersion: row.version,
        accepted: false,
        details: 'Rejected pending request; reconcile any existing credit',
      },
      true,
    );
    expect(row.status).toBe('OVERDUE_REVIEW');
    expect(row.extensionRequest).toBeNull();
  });
});
