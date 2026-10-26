import express from 'express';
import request from 'supertest';
import type { Sequelize } from 'sequelize-typescript';
import { seedTestDatabase } from './support/testDb';
import { makeUser } from '../unit/support/gatewayApp';
import UserModel from '../../src/core/server/database/internal/models/User.Model';
import CouponModel from '../../src/core/server/database/client/models/Coupon.Model';
import CouponService from '../../src/core/server/services/CouponService';
import VoucherService from '../../src/core/server/services/VoucherService';

describe('monthly member voucher eligibility', () => {
  let db: Sequelize, customer: UserModel, admin: UserModel;
  const vouchers = new VoucherService();
  beforeAll(async () => {
    db = await seedTestDatabase();
    customer = (await UserModel.findOne({ where: { role: 'USER', isActive: true } }))!;
    admin = (await UserModel.findOne({ where: { role: 'ADMIN', isActive: true } }))!;
    await new CouponService().create({
      code: 'CLAIMTESTTPL',
      title: 'Monthly member fixture',
      discountPercent: 10,
      minOrderVnd: 500000,
      kind: 'member_template',
      usageLimit: null,
      startDate: new Date(Date.now() - 86400000).toISOString(),
      expirationDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    });
  }, 600000);
  afterAll(async () => {
    await db?.close();
  });

  it('does not advertise a claim that a staff account cannot perform, and keeps issuance protected', async () => {
    expect((await vouchers.wallet(admin.id)).monthly).toBeNull();
    await expect(vouchers.claimMonthly(admin.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'MEMBER_CUSTOMER_ACCOUNT_REQUIRED',
    });
    expect(await CouponModel.count({ where: { ownerUserId: admin.id, kind: 'member' } })).toBe(0);
    const { router } = await import('../../src/shared/server/decorators/controller.decorator');
    await import('../../src/app/api/Voucher.Controller');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { ...makeUser('ADMIN'), id: admin.id };
      next();
    });
    app.use('/api', router);
    const wallet = await request(app).get('/api/vouchers').expect(200);
    expect(wallet.body.monthly).toBeNull();
    const denied = await request(app).post('/api/vouchers/monthly').expect(403);
    expect(denied.body.errorCode).toBe('MEMBER_CUSTOMER_ACCOUNT_REQUIRED');
  });

  it('advertises the customer offer and issues one owned code even when claims race or retry', async () => {
    expect((await vouchers.wallet(customer.id)).monthly?.available).toBe(true);
    const [first, second] = await Promise.all([vouchers.claimMonthly(customer.id), vouchers.claimMonthly(customer.id)]);
    expect(first.monthly).toMatchObject({ available: false, discountPercent: 10 });
    expect(second.monthly?.code).toBe(first.monthly?.code);
    expect((await vouchers.claimMonthly(customer.id)).monthly?.code).toBe(first.monthly?.code);
    expect(await CouponModel.count({ where: { ownerUserId: customer.id, kind: 'member' } })).toBe(1);
  });

  it('does not allow an inactive customer to browse or claim the member offer', async () => {
    await customer.update({ isActive: false });
    try {
      await expect(vouchers.wallet(customer.id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(vouchers.claimMonthly(customer.id)).rejects.toMatchObject({ statusCode: 403 });
    } finally {
      await customer.update({ isActive: true });
    }
  });
});
