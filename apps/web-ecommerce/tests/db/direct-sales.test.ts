import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import DirectSaleService from '../../src/core/server/services/DirectSaleService';
import OrderService from '../../src/core/server/services/OrderService';
import ProductModel from '../../src/core/server/database/client/models/Product.Model';
import ProductDiscountModel from '../../src/core/server/database/client/models/ProductDiscount.Model';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import OrderReceiptModel from '../../src/core/server/database/client/models/OrderReceipt.Model';
import OrderPrepaymentModel from '../../src/core/server/database/client/models/OrderPrepayment.Model';
import OrderModel from '../../src/core/server/database/client/models/Order.Model';
import LoyaltyLedgerModel from '../../src/core/server/database/client/models/LoyaltyLedger.Model';
import { runMigrations } from '../../src/core/server/database/migrations/Migrator';

describe('direct sales use the common ecommerce ledgers', () => {
  let db: Sequelize, product: ProductModel, adminId: number, userId: number;
  let sequence = 0;
  const service = new DirectSaleService(),
    orders = new OrderService();
  const sale = (extra: Record<string, unknown> = {}) => ({
    requestKey: `direct-sale-${++sequence}`,
    channel: 'COUNTER',
    fulfillment: 'HANDOVER',
    customerId: null,
    recipientName: '',
    phone: '',
    address: '',
    city: '',
    note: '',
    items: [{ productId: product.id, quantity: 1 }],
    expectedTotal: 1280000,
    payment: 'CASH',
    moneyVerified: true,
    externalReference: `DIRECT-CASH-${sequence}`,
    ...extra,
  });
  const delivery = {
    channel: 'ASSISTED',
    fulfillment: 'DELIVERY',
    recipientName: 'Collector',
    phone: '0901234567',
    address: '12 Fixture Road',
    city: 'HCM',
  };

  beforeAll(async () => {
    db = await seedTestDatabase();
    product = (await ProductModel.findOne({
      where: { stock: { [Op.gt]: 2 }, condition: 'new', isArchived: false, partnerId: null },
      order: [['id', 'ASC']],
    }))!;
    await product.update({
      price: 1280000,
      importPrice: 500000,
      stock: 50,
      inventoryStatus: 'available',
      listingStatus: 'published',
    });
    await ProductDiscountModel.destroy({ where: { productId: product.id } });
    adminId = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!.id;
    userId = (await UserModel.findOne({ where: { role: 'USER', isActive: true }, order: [['id', 'ASC']] }))!.id;
  }, 600_000);
  afterAll(() => db?.close());

  it('records a guest cash sale, paid handover, exact stock decrement and immutable receipt', async () => {
    const before = await product.reload(),
      stock = before.stock,
      sold = before.sold;
    const input = sale();
    const order = await service.create(adminId, input);
    expect(order).toMatchObject({
      userId: null,
      createdByUserId: adminId,
      salesChannel: 'COUNTER',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      total: 1280000,
      prepaidVnd: 0,
      paymentSource: 'CASH',
    });
    expect(order.deliveredAt).toBeTruthy();
    expect(order.get('items')).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId: product.id, unitPrice: 1280000 })]),
    );
    expect(await OrderReceiptModel.findOne({ where: { orderId: order.id } })).toMatchObject({
      amountVnd: 1280000,
      confirmedByUserId: adminId,
    });
    expect(await product.reload()).toMatchObject({ stock: stock - 1, sold: sold + 1 });
    expect(await LoyaltyLedgerModel.count({ where: { sourceReference: `order:${order.id}` } })).toBe(0);
    expect(await service.create(adminId, input)).toMatchObject({ id: order.id });
    expect((await product.reload()).stock).toBe(stock - 1);
    await expect(service.create(adminId, { ...input, note: 'different sale' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('serializes simultaneous retries and records only one order and receipt', async () => {
    const stock = (await product.reload()).stock,
      input = sale({ payment: 'BANK_TRANSFER' });
    const [a, b] = await Promise.all([service.create(adminId, input), service.create(adminId, input)]);
    expect(a.id).toBe(b.id);
    expect((await product.reload()).stock).toBe(stock - 1);
    expect(await OrderReceiptModel.count({ where: { orderId: a.id } })).toBe(1);
  });

  it('refuses stale prices, unavailable inventory, inactive customers and non-admin actors without side effects', async () => {
    const stock = (await product.reload()).stock;
    for (const extra of [
      { expectedTotal: 1 },
      { items: [{ productId: product.id, quantity: 999 }], expectedTotal: 1280000 * 999 },
      { customerId: 2147483647 },
    ])
      await expect(service.create(adminId, sale(extra))).rejects.toMatchObject({ statusCode: expect.any(Number) });
    await expect(service.create(userId, sale())).rejects.toMatchObject({ statusCode: 403 });
    expect((await product.reload()).stock).toBe(stock);
  });

  it('blocks reuse of a real transfer reference across counter receipts and advance-payment ledgers', async () => {
    const reference = `SHARED-DIRECT-${Date.now()}`;
    await service.create(adminId, sale({ externalReference: reference }));
    const stock = (await product.reload()).stock;
    await expect(service.create(adminId, sale({ externalReference: reference }))).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      service.create(adminId, sale({ ...delivery, payment: 'BANK_TRANSFER', externalReference: reference })),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await product.reload()).stock).toBe(stock);
  });

  it('supports unpaid manual delivery and restores stock once when cancelled', async () => {
    const stock = (await product.reload()).stock;
    const order = await service.create(
      adminId,
      sale({ ...delivery, payment: 'UNPAID', moneyVerified: false, externalReference: '' }),
    );
    expect(order).toMatchObject({
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      prepaidVnd: 0,
      paymentPlan: null,
      salesChannel: 'ASSISTED',
    });
    await orders.updateStatus(order.id, 'CANCELLED', adminId, {
      reason: 'out_of_stock',
      note: 'Fixture cancellation of direct sale',
    });
    expect((await product.reload()).stock).toBe(stock);
  });

  it('records delivery advances in the refundable ledger and allows existing status progression', async () => {
    const order = await service.create(adminId, sale({ ...delivery, customerId: userId, payment: 'BANK_TRANSFER' }));
    expect(order).toMatchObject({
      userId,
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      prepaidVnd: 1280000,
      paymentPlan: 'full',
    });
    expect(await OrderPrepaymentModel.count({ where: { orderId: order.id, kind: 'receipt' } })).toBe(1);
    await orders.updateStatus(order.id, 'SHIPPED', adminId);
    expect(await orders.updateStatus(order.id, 'DELIVERED', adminId)).toMatchObject({
      status: 'DELIVERED',
      paymentStatus: 'PAID',
    });
    expect((await orders.getForUser(userId, order.id)).id).toBe(order.id);
  });

  it('prevents an oversell when two sales compete for the last unit', async () => {
    const stock = (await product.reload()).stock;
    await product.update({ stock: 1 });
    const results = await Promise.allSettled([service.create(adminId, sale()), service.create(adminId, sale())]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await product.reload()).stock).toBe(0);
    await product.update({ stock: stock - 1 });
  });

  it('refunds a guest cash advance through the existing cancellation ledger without creating an account', async () => {
    const order = await service.create(adminId, sale({ ...delivery, payment: 'CASH' }));
    await orders.updateStatus(order.id, 'CANCELLED', adminId, { reason: 'out_of_stock' });
    const refunded = await orders.recordPrepayment(order.id, adminId, {
      kind: 'refund',
      amountVnd: order.total,
      externalReference: `DIRECT-REFUND-${order.id}`,
      moneyVerified: true,
      reason: 'Verified return of the cash advance to the guest customer',
    });
    expect(refunded).toMatchObject({ userId: null, status: 'CANCELLED', paymentStatus: 'PAID' });
    expect(await OrderPrepaymentModel.count({ where: { orderId: order.id, kind: 'refund' } })).toBe(1);
  });

  it('filters the common order list by source and preserves migration idempotency', async () => {
    const result = await orders.listAdmin({ channel: 'COUNTER', limit: 100, offset: 0 });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((order) => order.salesChannel === 'COUNTER')).toBe(true);
    expect(await OrderModel.count({ where: { salesChannel: 'WEBSITE' } })).toBeGreaterThan(0);
    expect(await runMigrations(db)).toEqual([]);
    const foreignKeys = await db.getQueryInterface().getForeignKeyReferencesForTable('order');
    expect((foreignKeys as { columnName: string }[]).some((key) => key.columnName === 'createdByUserId')).toBe(true);
    expect((await service.products('', String(product.id))).map(row => row.id)).toEqual([product.id]);
    await expect(service.products('', 'invalid')).rejects.toMatchObject({ statusCode: 400 });
  });
});
