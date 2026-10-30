import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import OrderModel from '../../src/core/server/database/client/models/Order.Model';
import OrderReceiptModel from '../../src/core/server/database/client/models/OrderReceipt.Model';
import AdminListOverviewService from '../../src/core/server/services/AdminListOverviewService';
import UserService from '../../src/core/server/services/UserService';
import OrderService from '../../src/core/server/services/OrderService';

describe('customer and order operational overviews', () => {
  let db: Sequelize,
    baselineCustomers: Awaited<ReturnType<AdminListOverviewService['customers']>>,
    baselineOrders: Awaited<ReturnType<AdminListOverviewService['orders']>>;
  const overview = new AdminListOverviewService();
  beforeAll(async () => {
    db = await seedTestDatabase();
    baselineCustomers = await overview.customers();
    baselineOrders = await overview.orders();
    const users = [];
    for (let i = 0; i < 4; i++)
      users.push(
        await UserModel.create({
          email: `overview-${i}@test.example`,
          firstName: `OverviewFixture${i}`,
          lastName: 'Fixture',
          passwordHash: 'not-a-real-password',
          role: i === 3 ? 'ADMIN' : 'USER',
          isActive: i !== 2,
          createdAt: new Date(Date.now() - (i === 0 ? 40 : 2) * 86400000),
        }),
      );
    const base = {
      recipientName: 'OverviewOrderFixture',
      phone: '0900000000',
      address: 'Fixture address',
      city: 'Fixture city',
      subtotal: 100000,
      total: 100000,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      salesChannel: 'WEBSITE',
    };
    for (const userId of [users[0].id, users[0].id, users[1].id]) await OrderModel.create({ ...base, userId });
    const pending = await OrderModel.create({
      ...base,
      userId: null,
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      total: 1000000,
      prepaidVnd: 200000,
      salesChannel: 'COUNTER',
      cancelRequest: { status: 'PENDING' },
    });
    await OrderReceiptModel.create({
      orderId: pending.id,
      confirmedByUserId: users[3].id,
      amountVnd: 300000,
      externalReference: 'OVERVIEW-RECEIPT-1',
      reason: 'Synthetic test receipt',
    });
    await OrderModel.create({
      ...base,
      userId: users[1].id,
      status: 'SHIPPED',
      paymentStatus: 'PENDING',
      total: 2000000,
      prepaidVnd: 500000,
      salesChannel: 'ASSISTED',
    });
    await OrderModel.create({
      ...base,
      status: 'CANCELLED',
      paymentStatus: 'PENDING',
      total: 3000000,
      cancelRequest: { status: 'PENDING' },
    });
    await OrderModel.create({ ...base, status: 'PROCESSING', paymentStatus: 'PAID', total: 900000 });
    await OrderModel.create({
      ...base,
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      total: 800000,
      prepaidVnd: 900000,
    });
  }, 600000);
  afterAll(async () => {
    await db?.close();
  });

  test('customer KPIs count registered customers, completed purchases and returning customers', async () => {
    const result = await overview.customers();
    expect(result.total - baselineCustomers.total).toBe(3);
    expect(result.new30Days - baselineCustomers.new30Days).toBe(2);
    expect(result.purchased - baselineCustomers.purchased).toBe(2);
    expect(result.repeat - baselineCustomers.repeat).toBe(1);
  });
  test('receivables subtract verified prepayments and receipts, excluding cancelled and paid orders', async () => {
    const result = await overview.orders();
    expect(result.processing - baselineOrders.processing).toBe(3);
    expect(result.shipping - baselineOrders.shipping).toBe(1);
    expect(result.receivableVnd - baselineOrders.receivableVnd).toBe(2000000);
    expect(result.unpaidOrders - baselineOrders.unpaidOrders).toBe(2);
    expect(result.cancellationRequests - baselineOrders.cancellationRequests).toBe(1);
  });
  test('customer KPI filters match the corresponding rows and do not expose private account fields', async () => {
    const service = new UserService();
    const repeat = await service.list({ q: 'OverviewFixture', segment: 'repeat', limit: 10, offset: 0 });
    expect(repeat.count).toBe(1);
    expect(repeat.rows[0].completedOrders).toBe(2);
    expect((await service.list({ q: 'Fixture OverviewFixture0', limit: 10, offset: 0 })).count).toBe(1);
    for (const row of repeat.rows) {
      expect(row).not.toHaveProperty('passwordHash');
      expect(row).not.toHaveProperty('sessionVersion');
    }
    expect((await service.list({ q: 'OverviewFixture', segment: 'new', limit: 10, offset: 0 })).count).toBe(2);
    expect((await service.list({ q: 'OverviewFixture', role: ['USER', 'ADMIN'], limit: 10, offset: 0 })).count).toBe(4);
    expect(
      (await service.list({ q: 'OverviewFixture', role: 'USER', status: ['active'], limit: 10, offset: 0 })).count,
    ).toBe(2);
  });
  test('order KPI filters, multiple statuses and multiple channels preserve exact counts', async () => {
    const service = new OrderService();
    const query = { q: 'OverviewOrderFixture', limit: 20, offset: 0 };
    const unpaid = await service.listAdmin({ ...query, attention: 'unpaid' });
    expect(unpaid.count).toBe(2);
    expect(unpaid.rows.reduce((sum, row) => sum + Number(row.getDataValue('outstandingVnd')), 0)).toBe(2000000);
    expect((await service.listAdmin({ ...query, attention: 'cancellation' })).count).toBe(1);
    expect((await service.listAdmin({ ...query, status: ['PROCESSING', 'SHIPPED'] })).count).toBe(4);
    expect((await service.listAdmin({ ...query, channel: ['COUNTER', 'ASSISTED'] })).count).toBe(2);
  });
});
