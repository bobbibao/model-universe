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
});
