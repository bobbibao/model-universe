import crypto from 'node:crypto';
import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import OrderService from '../../src/core/server/services/OrderService';
import ReservationService from '../../src/core/server/services/ReservationService';
import MoneyOperationsService from '../../src/core/server/services/MoneyOperationsService';
import CommercePolicyService from '../../src/core/server/services/CommercePolicyService';
import RefundToSourceService from '../../src/core/server/services/RefundToSourceService';
import PayOSPayoutService, { type PayoutClient } from '../../src/core/server/services/PayOSPayoutService';
import ConversionService from '../../src/core/server/services/marketing/ConversionService';
import NotificationDispatchService from '../../src/core/server/services/NotificationDispatchService';
import PaymentGatewayService, {
  setPayOSClient,
  type CounterAccount,
  type PayOSLike,
} from '../../src/core/server/services/PaymentGatewayService';
import MoneyOperationModel from '../../src/core/server/database/client/models/MoneyOperation.Model';
import OrderModel from '../../src/core/server/database/client/models/Order.Model';
import OrderPrepaymentModel from '../../src/core/server/database/client/models/OrderPrepayment.Model';
import PaymentSourceModel from '../../src/core/server/database/client/models/PaymentSource.Model';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductDiscountModel from '../../src/core/server/database/client/models/ProductDiscount.Model';
import ReservationPaymentModel from '../../src/core/server/database/client/models/ReservationPayment.Model';
import AdminAlertModel from '../../src/core/server/database/client/models/AdminAlert.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import { HOLD_RULE_VERSION, minimumHoldVnd } from '../../src/shared/reservation';
import { REFUND_TO_SOURCE_POLICY } from '../../src/shared/refund-to-source';

// payOS order codes start with the current second plus a small random salt: links made within one second may collide.
const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1_001));

const PAYER: CounterAccount = {
  counterAccountBankId: '970436',
  counterAccountBankName: 'Vietcombank',
  counterAccountName: 'NGUYEN VAN KHACH',
  counterAccountNumber: '0071000123456',
};

// payOS collections double: every link gets its own order code; a webhook "pays" one link from a given account.
const fakeCollections = () => {
  const codes: number[] = [];
  const pending: ({ orderCode: number; amount: number; reference: string } & CounterAccount)[] = [];
  const client: PayOSLike = {
    paymentRequests: {
      create: async (data) => {
        codes.push(Number(data.orderCode));
        return {
          checkoutUrl: `https://pay.payos.vn/web/${data.orderCode}`,
          paymentLinkId: `l-${data.orderCode}`,
          status: 'PENDING',
        };
      },
      get: async () => ({ status: 'PENDING', amountPaid: 0, transactions: [] }),
    },
    webhooks: {
      verify: async (body) => {
        if ((body as { signature?: string }).signature !== 'valid') throw new Error('bad signature');
        return { ...pending.shift()!, code: '00' };
      },
    },
  };
  return { client, codes, pending };
};

// payOS payouts double: records each transfer; `fail` makes the next create time out (an unknown outcome).
const fakePayouts = () => {
  const sent: { referenceId: string; amount: number; toBin: string; toAccountNumber: string }[] = [];
  const state = { failNext: false };
  const run = crypto.randomUUID().slice(0, 8); // payOS ids are unique across every payout, not per test
  const payout = (index: number) => {
    const row = sent[index];
    return {
      id: `po-${run}-${index}`,
      referenceId: row.referenceId,
      transactions: [
        {
          id: `tx-${run}-${index}`,
          referenceId: row.referenceId,
          amount: row.amount,
          toBin: row.toBin,
          toAccountNumber: row.toAccountNumber,
          state: 'SUCCEEDED',
        },
      ],
    };
  };
  const client: PayoutClient = {
    payouts: {
      create: async (data) => {
        if (state.failNext) {
          state.failNext = false;
          sent.push(data as never); // payOS received it; the response was lost.
          throw new Error('timeout');
        }
        sent.push(data as never);
        return payout(sent.length - 1) as never;
      },
      get: async (id) => payout(Number(id.split('-').at(-1))) as never,
      list: async ({ referenceId }) => ({
        data: sent.flatMap((row, index) => (row.referenceId === referenceId ? [payout(index)] : [])) as never,
      }),
    },
  };
  return { client, sent, state };
};

jest.setTimeout(120_000);

describe('refund to source: back to the account that paid, automatic within the owner limits', () => {
  let db: Sequelize, product: ProductModel, customer: number, owner: number, finance: number, total: number;
  let sequence = 0;
  const orders = new OrderService(),
    holds = new ReservationService(),
    money = new MoneyOperationsService(),
    gateway = new PaymentGatewayService();
  const key = () => `rts-${++sequence}-${crypto.randomUUID()}`;
  const shipping = { recipientName: 'Fixture', phone: '0901234567', address: '12 Test Street', city: 'Test City' };
  const collections = fakeCollections();

  // An order (1,000,000 VND per unit) whose upfront payment, the 10% deposit or the full amount, arrives through a
  // verified payOS webhook from `payer`.
  const paidOrder = async (quantity: number, plan: 'deposit' | 'full', payer: CounterAccount = PAYER) => {
    const order = await orders.placeOrder(customer, {
      items: [{ productId: product.id, quantity }],
      shipping,
      paymentPlan: plan,
      ...(plan === 'deposit' ? { depositVnd: quantity * 100_000 } : {}),
      requestKey: key(),
    });
    await nextSecond();
    await gateway.createLink(customer, order.id);
    const amount = order.upfrontDueVnd;
    collections.pending.push({ orderCode: collections.codes.at(-1)!, amount, reference: `FT${key()}`, ...payer });
    await gateway.webhook({ signature: 'valid' });
    expect((await OrderModel.findByPk(order.id))!.prepaidVnd).toBe(amount);
    return order;
  };
  const cancel = (orderId: number) => orders.updateStatus(orderId, 'CANCELLED', owner, { reason: 'out_of_stock' });

  beforeAll(async () => {
    jest.spyOn(ConversionService.prototype, 'recordPurchase').mockResolvedValue(undefined as never);
    jest.spyOn(NotificationDispatchService.prototype, 'dispatchSoon').mockReturnValue(undefined);
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
    product = (await ProductModel.findOne({
      where: { stock: { [Op.gt]: 5 }, condition: 'new', isArchived: false, partnerId: null },
      order: [['id', 'ASC']],
    }))!;
    await product.update({
      price: 1_000_000,
      stock: 200,
      inventoryStatus: 'available',
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
    setPayOSClient(collections.client);
  }, 600_000);
  afterAll(async () => {
    setPayOSClient(null);
    await db?.close();
  });
  beforeEach(async () => {
    // Each case starts with a fresh daily allowance: earlier automatic refunds are moved to a past day.
    await db.query(`ALTER TABLE money_operation DISABLE TRIGGER money_operation_protected`);
    await db.query(`UPDATE money_operation SET "createdAt" = "createdAt" - INTERVAL '3 days'`);
    await db.query(`ALTER TABLE money_operation ENABLE TRIGGER money_operation_protected`);
    RefundToSourceService.forgetSkipped();
  });

  it('keeps the paying account payOS signed, append-only', async () => {
    const order = await paidOrder(3, 'deposit');
    const source = (await PaymentSourceModel.findOne({ order: [['id', 'DESC']] }))!;
    expect(source).toMatchObject({
      bankBin: '970436',
      accountNumber: '0071000123456',
      accountName: 'NGUYEN VAN KHACH',
      amountVnd: 300_000,
      verifiedBy: 'payos_webhook',
    });
    await expect(
      db.query(`UPDATE payment_source SET "accountNumber" = '999999999' WHERE id = ${source.id}`),
    ).rejects.toThrow(/append-only/);
    await cancel(order.id);
  });

  it('a cancelled order paid by payOS is refunded to the paying account automatically, exactly once', async () => {
    const order = await paidOrder(4, 'deposit');
    await cancel(order.id);
    const alert = await AdminAlertModel.findOne({ where: { kind: 'refund_due', orderId: order.id } });
    expect(String(alert?.content)).toContain('KHÔNG chuyển khoản tay');
    const payouts = fakePayouts();
    const sweep = new RefundToSourceService(payouts.client);
    await sweep.sweep();
    await sweep.sweep(); // the next minute: nothing new, nothing sent twice
    const ops = await MoneyOperationModel.findAll({ where: { purpose: 'purchase_refund', entityId: order.id } });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ status: 'completed', approvedBy: null, requestedBy: customer, amountVnd: '400000' });
    expect(ops[0].details.autoApproval?.policy).toBe(REFUND_TO_SOURCE_POLICY.version);
    expect(ops[0].details.source?.maskedAccount).toBe('••••3456');
    const sentForOrder = payouts.sent.filter((row) => row.referenceId === ops[0].details.payout?.referenceId);
    expect(sentForOrder).toEqual([
      expect.objectContaining({ amount: 400_000, toBin: '970436', toAccountNumber: '0071000123456' }),
    ]);
    const refund = (await OrderPrepaymentModel.findOne({ where: { orderId: order.id, kind: 'refund' } }))!;
    expect(refund).toMatchObject({ amountVnd: 400_000, actorUserId: customer });
    expect(await OrderPrepaymentModel.count({ where: { orderId: order.id, kind: 'refund' } })).toBe(1);
  });

  it('above 2,000,000 VND the refund to source waits for a reviewer, then goes to the same account', async () => {
    const order = await paidOrder(3, 'full');
    await cancel(order.id);
    const payouts = fakePayouts();
    await new RefundToSourceService(payouts.client).sweep();
    const op = (await MoneyOperationModel.findOne({ where: { purpose: 'purchase_refund', entityId: order.id } }))!;
    expect(op).toMatchObject({ status: 'requested', approvedBy: null });
    expect(op.details.autoApproval).toBeUndefined();
    expect(payouts.sent.filter((row) => row.amount === 3_000_000)).toHaveLength(0);
    // The policy never sends it without a person.
    await expect(new PayOSPayoutService(payouts.client).execute(op.id, null, op.version, true)).rejects.toMatchObject({
      statusCode: 409,
    });
    const approved = await money.decide(op.id, finance, {
      expectedVersion: op.version,
      approved: true,
      reason: 'Checked',
    });
    await new PayOSPayoutService(payouts.client).execute(op.id, finance, approved.version, true);
    expect(payouts.sent.at(-1)).toMatchObject({ amount: 3_000_000, toBin: '970436', toAccountNumber: '0071000123456' });
    expect((await MoneyOperationModel.findByPk(op.id))!.status).toBe('completed');
  });

  it('stops sending automatically once the day reaches 10,000,000 VND', async () => {
    const payouts = fakePayouts();
    // Six refunds of 2,000,000 VND (the per-refund cap): five fill the 10,000,000 VND day, the sixth waits.
    const placed = [];
    for (let i = 0; i < 6; i++) placed.push(await paidOrder(2, 'full'));
    for (const order of placed) await cancel(order.id);
    await new RefundToSourceService(payouts.client).sweep();
    const ops = await MoneyOperationModel.findAll({
      where: { purpose: 'purchase_refund', entityId: placed.map((order) => order.id) },
      order: [['entityId', 'ASC']],
    });
    expect(ops.map((op) => op.status)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'requested',
    ]);
    const autoToday = ops.filter((op) => op.details.autoApproval).reduce((sum, op) => sum + Number(op.amountVnd), 0);
    expect(autoToday).toBeLessThanOrEqual(REFUND_TO_SOURCE_POLICY.dailyCapVnd);
  });

  it('without a usable paying account nothing is created automatically, and staff see why', async () => {
    const order = await paidOrder(3, 'deposit', { counterAccountBankId: null, counterAccountNumber: null });
    await cancel(order.id);
    await new RefundToSourceService(fakePayouts().client).sweep();
    expect(await MoneyOperationModel.count({ where: { purpose: 'purchase_refund', entityId: order.id } })).toBe(0);
    expect(await money.sourcePreview('purchase_refund', order.id, finance)).toMatchObject({
      ok: false,
      reason: 'missing_account',
      amountVnd: 300_000,
    });
  });

  it('REFUND_TO_SOURCE_AUTO=off sends nothing by itself: the refund to source waits for review', async () => {
    const order = await paidOrder(2, 'deposit');
    await cancel(order.id);
    const payouts = fakePayouts();
    process.env.REFUND_TO_SOURCE_AUTO = 'off';
    try {
      await new RefundToSourceService(payouts.client).sweep();
    } finally {
      delete process.env.REFUND_TO_SOURCE_AUTO;
    }
    const op = (await MoneyOperationModel.findOne({ where: { purpose: 'purchase_refund', entityId: order.id } }))!;
    expect(op).toMatchObject({ status: 'requested', approvedBy: null });
    expect(op.details.source?.maskedAccount).toBe('••••3456');
    expect(payouts.sent).toHaveLength(0);
  });

  it('a lost payout response is resolved by reconciliation, never by sending again', async () => {
    const order = await paidOrder(6, 'deposit');
    await cancel(order.id);
    const payouts = fakePayouts();
    payouts.state.failNext = true;
    await new RefundToSourceService(payouts.client).sweep();
    const op = (await MoneyOperationModel.findOne({ where: { purpose: 'purchase_refund', entityId: order.id } }))!;
    expect(op.status).toBe('approved');
    expect(op.details.payout?.state).toBe('SUBMITTING');
    await new RefundToSourceService(payouts.client).sweep(); // does not submit it again
    await new PayOSPayoutService(payouts.client).reconcilePending();
    expect(payouts.sent.filter((row) => row.referenceId === op.details.payout?.referenceId)).toHaveLength(1);
    expect((await MoneyOperationModel.findByPk(op.id))!.status).toBe('completed');
  });

  it('a cancelled hold paid by payOS is refunded to the paying account', async () => {
    const row = await holds.create(customer, {
      productId: product.id,
      quantity: 1,
      expectedTotal: total,
      requestKey: key(),
      termsAccepted: true,
      termsVersion: HOLD_RULE_VERSION,
    });
    const deposit = minimumHoldVnd(total);
    await nextSecond();
    await gateway.createHoldLink(customer, row.id, deposit);
    collections.pending.push({
      orderCode: collections.codes.at(-1)!,
      amount: deposit,
      reference: `FT${key()}`,
      ...PAYER,
    });
    await gateway.webhook({ signature: 'valid' });
    await holds.cancel(row.id, customer, { reason: 'Customer cancellation' }, true);
    await holds.cancel(row.id, owner, { reason: 'Approved cancellation, no forfeiture' });
    const payouts = fakePayouts();
    await new RefundToSourceService(payouts.client).sweep();
    const op = (await MoneyOperationModel.findOne({ where: { purpose: 'hold_refund', entityId: row.id } }))!;
    expect(op).toMatchObject({ status: 'completed', amountVnd: String(deposit) });
    expect(payouts.sent.at(-1)).toMatchObject({ amount: deposit, toAccountNumber: '0071000123456' });
    expect(await ReservationPaymentModel.count({ where: { reservationId: row.id, kind: 'refund' } })).toBe(1);
  });

  // --- Review findings of 2026-11-13 (two-person rule, key namespace, payout channel, queue starvation, kill switch). ---

  const requestBody = (requestKey: string, amountVnd: number) => ({
    amountVnd,
    requestKey,
    reason: 'Customer asked for the refund',
    bankName: 'Vietcombank',
    accountNumber: '0071000123456',
    accountHolder: 'NGUYEN VAN A',
  });

  it('the staff member who starts a refund to source cannot also approve it', async () => {
    const order = await paidOrder(3, 'full');
    await cancel(order.id);
    const { operation, auto } = await money.refundToSource('purchase_refund', order.id, {
      staffId: finance,
      payoutReady: true,
    });
    expect(auto).toBe(false); // 3,000,000 VND is above the automatic limit
    expect(operation).toMatchObject({ status: 'requested', requestedBy: customer });
    const decision = { expectedVersion: operation!.version, approved: true, reason: 'Checked' };
    await expect(money.decide(operation!.id, finance, decision)).rejects.toMatchObject({ statusCode: 403 });
    expect((await money.decide(operation!.id, owner, decision)).status).toBe('approved');
  });

  it('a client cannot claim a key the server derives for a refund to source', async () => {
    const victim = await paidOrder(2, 'deposit');
    const attacker = await paidOrder(1, 'deposit');
    await cancel(victim.id);
    await cancel(attacker.id);
    const key = `refund-to-source:purchase_refund:${victim.id}:1`;
    for (const requestKey of [key, key.toUpperCase()])
      await expect(
        money.request('purchase_refund', attacker.id, customer, requestBody(requestKey, 100_000)),
      ).rejects.toMatchObject({ statusCode: 400 });
    const payouts = fakePayouts();
    await new RefundToSourceService(payouts.client).sweep();
    const op = await MoneyOperationModel.findOne({ where: { purpose: 'purchase_refund', entityId: victim.id } });
    expect(op).toMatchObject({ status: 'completed', requestKey: key });
  });

  it('without a payout channel nothing is approved automatically, and staff are told to review', async () => {
    const order = await paidOrder(2, 'deposit');
    await cancel(order.id);
    // The test environment has no PAYOS_PAYOUT_* keys: the cancellation alert must not promise an automatic refund.
    const alert = await AdminAlertModel.findOne({ where: { kind: 'refund_due', orderId: order.id } });
    expect(String(alert?.content)).toContain('KHÔNG tự gửi');
    expect(String(alert?.content)).not.toContain('tự hoàn về đúng tài khoản đã thanh toán trong khoảng 1 phút');
    expect(await money.sourcePreview('purchase_refund', order.id, finance)).toMatchObject({
      ok: true,
      automatic: false,
    });
    const { operation, auto } = await money.refundToSource('purchase_refund', order.id); // payoutReady: from the keys
    expect(auto).toBe(false);
    expect(operation).toMatchObject({ status: 'requested', approvedBy: null });
    expect(operation!.details.autoApproval).toBeUndefined();
  });

  it('a refund stuck after submission does not hold up the automatic refunds behind it', async () => {
    const stuck = await paidOrder(1, 'deposit');
    const next = await paidOrder(2, 'deposit');
    await cancel(stuck.id);
    await cancel(next.id);
    const payouts = fakePayouts();
    payouts.state.failNext = true; // the first create is lost: that refund stays approved, state SUBMITTING
    expect((await new RefundToSourceService(payouts.client).sweep()).sent).toBe(1);
    const [first, second] = await MoneyOperationModel.findAll({
      where: { purpose: 'purchase_refund', entityId: [stuck.id, next.id] },
      order: [['entityId', 'ASC']],
    });
    expect(first).toMatchObject({ status: 'approved' });
    expect(first.details.payout?.state).toBe('SUBMITTING');
    expect(second.status).toBe('completed');
    // The submitted one is not part of the "still to send" queue any more.
    expect(await new PayOSPayoutService(payouts.client).submitAutoApproved()).toBe(0);
    await new PayOSPayoutService(payouts.client).reconcilePending();
    expect((await MoneyOperationModel.findByPk(first.id))!.status).toBe('completed');
  });

  it('REFUND_TO_SOURCE_AUTO=off also stops sending what was approved before: it goes back to review', async () => {
    const order = await paidOrder(2, 'deposit');
    await cancel(order.id);
    const created = await money.refundToSource('purchase_refund', order.id, { payoutReady: true });
    expect(created).toMatchObject({ auto: true });
    const payouts = fakePayouts();
    process.env.REFUND_TO_SOURCE_AUTO = 'off';
    try {
      expect(await new PayOSPayoutService(payouts.client).submitAutoApproved()).toBe(0);
    } finally {
      delete process.env.REFUND_TO_SOURCE_AUTO;
    }
    expect(payouts.sent).toHaveLength(0);
    const op = (await MoneyOperationModel.findByPk(created.operation!.id))!;
    expect(op).toMatchObject({ status: 'requested', approvedBy: null });
    expect(op.details.autoApproval).toBeUndefined();
    expect(op.details.history.at(-1)).toMatchObject({ action: 'returned_to_review' });
    // Switching it back on sends nothing by itself either: a person decides it now.
    expect(await new PayOSPayoutService(payouts.client).submitAutoApproved()).toBe(0);
    const approved = await money.decide(op.id, finance, { expectedVersion: op.version, approved: true, reason: 'OK' });
    await new PayOSPayoutService(payouts.client).execute(op.id, finance, approved.version, true);
    expect((await MoneyOperationModel.findByPk(op.id))!.status).toBe('completed');
    expect(payouts.sent).toHaveLength(1);
  });

  it('an automatic refund that cannot be submitted goes back to review and is reported as not sent', async () => {
    const order = await paidOrder(2, 'deposit');
    await cancel(order.id);
    const created = await money.refundToSource('purchase_refund', order.id, { payoutReady: true });
    const payouts = fakePayouts();
    const outcome = await new PayOSPayoutService(payouts.client).sendAutoApproved(
      created.operation!.id,
      created.operation!.version + 1, // the record changed since it was read
    );
    expect(outcome).toMatchObject({ sent: false });
    expect(outcome.error).toBeTruthy();
    expect(payouts.sent).toHaveLength(0);
    const op = (await MoneyOperationModel.findByPk(created.operation!.id))!;
    expect(op.status).toBe('requested');
    expect(
      await AdminAlertModel.count({ where: { dedupeKey: { [Op.like]: `money:${op.id}:returned-to-review:%` } } }),
    ).toBe(1);
    // A refund that was sent reports its real state.
    const other = await paidOrder(1, 'deposit');
    await cancel(other.id);
    const ready = await money.refundToSource('purchase_refund', other.id, { payoutReady: true });
    expect(
      await new PayOSPayoutService(payouts.client).sendAutoApproved(ready.operation!.id, ready.operation!.version),
    ).toEqual({ sent: true, state: 'SUCCEEDED' });
  });

  it('an order the refund skips is not read again every minute, so it cannot fill the batch', async () => {
    const order = await paidOrder(2, 'deposit');
    await cancel(order.id);
    const refund = jest.spyOn(MoneyOperationsService.prototype, 'refundToSource');
    refund.mockRejectedValueOnce(new Error('Reconcile first'));
    try {
      const sweep = new RefundToSourceService(fakePayouts().client);
      await sweep.sweep();
      const calls = () => refund.mock.calls.filter(([purpose, id]) => purpose === 'purchase_refund' && id === order.id);
      expect(calls()).toHaveLength(1);
      await sweep.sweep(); // the next minute
      expect(calls()).toHaveLength(1);
      await sweep.sweep(Date.now() + 61 * 60_000); // an hour later it is looked at again
      expect(calls()).toHaveLength(2);
    } finally {
      refund.mockRestore();
    }
    expect((await MoneyOperationModel.findOne({ where: { entityId: order.id } }))!.status).toBe('completed');
  });

  it('an order refunded by hand, or with a cancellation fee, is not a candidate and has no ready-made refund', async () => {
    const order = await paidOrder(2, 'deposit');
    await cancel(order.id);
    await OrderModel.update({ cancellationFeeVnd: 50_000 }, { where: { id: order.id } });
    expect(await money.sourcePreview('purchase_refund', order.id, finance)).toMatchObject({
      ok: false,
      reason: 'cancellation_fee',
    });
    const refund = jest.spyOn(MoneyOperationsService.prototype, 'refundToSource');
    try {
      await new RefundToSourceService(fakePayouts().client).sweep();
      expect(refund.mock.calls.some(([, id]) => id === order.id)).toBe(false);
    } finally {
      refund.mockRestore();
    }
    expect(await MoneyOperationModel.count({ where: { purpose: 'purchase_refund', entityId: order.id } })).toBe(0);
  });
});
