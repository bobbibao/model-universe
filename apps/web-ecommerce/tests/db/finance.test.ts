import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { Client } from 'pg';
import type { Sequelize } from 'sequelize-typescript';
import DatabaseProvider from '../../src/core/server/database/Database.Provider';
import FinanceService from '../../src/core/server/services/FinanceService';
import {
  FinanceExpenseModel,
  FinanceOrderReviewModel,
} from '../../src/core/server/database/client/models/Finance.Model';
import {
  seedFinanceFixture,
  type FinanceFixtureManifest,
} from '../../src/core/server/database/client/seeders/FinanceFixture';
import { useTestDatabase, testApp } from './support/testDb';

describe('finance database and immutable expense ledger', () => {
  let db: Sequelize, manifest: FinanceFixtureManifest, service: FinanceService;
  let isolatedName: string;
  const connection = () => ({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  beforeAll(async () => {
    useTestDatabase();
    isolatedName = `${process.env.DB_NAME!.slice(0, 32)}_${Date.now()}_finance_test`;
    if (!/^[a-z0-9_]+_finance_test$/.test(isolatedName)) throw new Error('Invalid isolated finance test database');
    const admin = new Client(connection());
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${isolatedName}"`);
    } finally {
      await admin.end();
    }
    process.env.DB_NAME = isolatedName;
    db = await DatabaseProvider.initializeDemoSchema();
    manifest = await seedFinanceFixture();
    service = new FinanceService();
  }, 120000);
  afterAll(async () => {
    await db?.close();
    if (isolatedName) {
      const admin = new Client(connection());
      await admin.connect();
      try {
        await admin.query(`DROP DATABASE "${isolatedName}"`);
      } finally {
        await admin.end();
      }
    }
  }, 30000);
  it('seeds linked fixtures idempotently without duplicating orders, customers or costs', async () => {
    const second = await seedFinanceFixture();
    expect(second).toEqual(manifest);
    expect(manifest.counts.orders).toBe(54);
  });
  it('queries real database records and exposes missing costs instead of invented profit', async () => {
    const report = await service.report({ from: '2026-10-01', to: '2026-10-27' });
    expect(report.current.orders).toBeGreaterThan(5);
    expect(report.current.netRevenueVnd).toBeGreaterThan(0);
    expect(report.current.profitVnd).toBeNull();
    expect(report.current.quality.missingCostUnits).toBeGreaterThan(0);
    expect(report.current.refundedOrders).toBe(2);
  });
  it('preserves expense unit prices after configuration changes and retirement', async () => {
    const type = await service.saveType(null, manifest.adminId, {
      name: 'QA · Consistency',
      category: 'PACKAGING',
      basis: 'QUANTITY',
      unit: 'm',
      unitCostVnd: 4000,
      isActive: true,
    });
    const original = await service.postExpense(manifest.adminId, {
      costTypeId: type.id,
      quantity: 1.5,
      incurredAt: '2026-10-25',
      note: 'Invoice',
      requestKey: randomUUID(),
    });
    await service.saveType(type.id, manifest.adminId, {
      name: type.name,
      category: type.category,
      basis: type.basis,
      unit: 'cuộn',
      unitCostVnd: 9000,
      isActive: false,
      expectedVersion: type.version,
    });
    await original.reload();
    expect(Number(original.unitCostVnd)).toBe(4000);
    expect(Number(original.amountVnd)).toBe(6000);
    expect(original.typeVersion).toBe(1);
    expect(original.unitSnapshot).toBe('m');
    await expect(
      service.postExpense(manifest.adminId, {
        costTypeId: type.id,
        quantity: 1,
        incurredAt: '2026-10-25',
        note: 'Invoice',
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('serializes concurrent retries and refuses reuse of a request key for different contents', async () => {
    const type = (await service.types()).find((t) => t.isActive && t.basis === 'QUANTITY')!;
    const payload = {
      costTypeId: type.id,
      quantity: 2,
      unitCostVnd: 1000,
      incurredAt: '2026-10-25',
      note: 'Retry invoice',
      requestKey: randomUUID(),
    };
    const [a, b] = await Promise.all([
      service.postExpense(manifest.adminId, payload),
      service.postExpense(manifest.adminId, payload),
    ]);
    expect(a.id).toBe(b.id);
    await expect(service.postExpense(manifest.adminId, { ...payload, unitCostVnd: 2000 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it('rounds fractional material quantities in integer VND without a floating-point half-rounding loss', async () => {
    const type = (await service.types()).find((t) => t.isActive && t.basis === 'QUANTITY')!;
    const entry = await service.postExpense(manifest.adminId, {
      costTypeId: type.id,
      quantity: 1.005,
      unitCostVnd: 100,
      incurredAt: '2026-10-25',
      note: 'Fractional material invoice',
      requestKey: randomUUID(),
    });
    expect(Number(entry.amountVnd)).toBe(101);
  });
  it('reverses once into the original accounting period and keeps source records immutable', async () => {
    const original = (await FinanceExpenseModel.findAll({ order: [['id', 'ASC']] }))[0];
    const reversal = await service.postExpense(
      manifest.adminId,
      { requestKey: randomUUID(), note: 'Correction' },
      original.id,
    );
    expect(Number(reversal.amountVnd)).toBe(-Number(original.amountVnd));
    expect(reversal.incurredAt.toISOString()).toBe(original.incurredAt.toISOString());
    await expect(
      service.postExpense(manifest.adminId, { requestKey: randomUUID(), note: 'Second reversal' }, original.id),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      db.query("UPDATE finance_expense SET note='mutated' WHERE id=:id", { replacements: { id: original.id } }),
    ).rejects.toThrow('append-only');
  });
  it('versions reconciliations, rejects stale edits and never changes price or stock', async () => {
    const id = manifest.incompleteOrderIds[0],
      order = await service.order(id);
    const input = {
      expectedVersion: order.review!.version,
      items: order.items.map((i) => ({ orderItemId: i.id, unitCostVnd: 150000 })),
      costsReviewed: true,
      note: 'Matched purchase invoices',
    };
    const revision = await service.reconcile(id, manifest.adminId, input);
    expect(revision.version).toBe(2);
    await expect(service.reconcile(id, manifest.adminId, input)).rejects.toMatchObject({ statusCode: 409 });
    const after = await service.order(id);
    expect(after.subtotal).toBe(order.subtotal);
    expect(after.total).toBe(order.total);
    expect(after.revisions).toHaveLength(2);
    await expect(FinanceOrderReviewModel.update({ note: 'mutated' }, { where: { id: revision.id } })).rejects.toThrow(
      'append-only',
    );
  });
  it('rejects duplicate/missing order lines and false completion without costs', async () => {
    const order = await service.order(manifest.incompleteOrderIds[1]);
    await expect(
      service.reconcile(order.id, manifest.adminId, {
        expectedVersion: order.review!.version,
        items: order.items.map((i) => ({ orderItemId: i.id, unitCostVnd: null })),
        costsReviewed: true,
        note: 'Unknown',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.reconcile(order.id, manifest.adminId, {
        expectedVersion: order.review!.version,
        items: order.items.map(() => ({ orderItemId: order.items[0].id, unitCostVnd: 100 })),
        costsReviewed: false,
        note: 'Duplicate',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('protects read and write endpoints from guests and customer accounts', async () => {
    const app = await testApp('AdminFinance.Controller');
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', r));
    try {
      const address = server.address() as { port: number },
        url = `http://127.0.0.1:${address.port}/api/admin/finance`;
      for (const headers of [{}, { 'x-test-role': 'USER' }]) {
        expect((await fetch(`${url}/report`, { headers })).status).toBe(403);
        expect(
          (
            await fetch(`${url}/expenses`, {
              method: 'POST',
              headers: { ...headers, 'content-type': 'application/json' },
              body: '{}',
            })
          ).status,
        ).toBe(403);
      }
      expect(
        (await fetch(`${url}/report?from=2026-10-01&to=2026-10-27`, { headers: { 'x-test-role': 'ADMIN' } })).status,
      ).toBe(200);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
  it('matches independent SQL totals after resolving missing costs, without changing inventory', async () => {
    const stockBefore = await db.query('SELECT id,stock,sold FROM product ORDER BY id', { type: QueryTypes.SELECT });
    for (const id of manifest.incompleteOrderIds) {
      const order = await service.order(id);
      await service.reconcile(id, manifest.adminId, {
        expectedVersion: order.review!.version,
        costsReviewed: true,
        note: 'Verified invoices for acceptance test',
        items: order.items.map((item) => ({ orderItemId: item.id, unitCostVnd: 200000 })),
      });
    }
    const report = await service.report({ from: '2026-10-01', to: '2026-10-27' });
    const [expected] = await db.query<{ revenue: string; expenses: string }>(
      `SELECT
      (SELECT SUM(subtotal-discount+"shippingFee"-"shippingDiscountVnd") FROM "order" WHERE status='DELIVERED' AND "deliveredAt">='2026-10-01T00:00:00+07' AND "deliveredAt"<'2026-10-28T00:00:00+07')
      -(SELECT SUM("merchandiseVnd"+"shippingVnd") FROM order_refund WHERE "createdAt">='2026-10-01T00:00:00+07' AND "createdAt"<'2026-10-28T00:00:00+07') AS revenue,
      (SELECT SUM("amountVnd") FROM finance_expense WHERE "incurredAt">='2026-10-01T00:00:00+07' AND "incurredAt"<'2026-10-28T00:00:00+07') AS expenses`,
      { type: QueryTypes.SELECT },
    );
    expect(report.current.netRevenueVnd).toBe(Number(expected.revenue));
    expect(report.current.expenseVnd).toBe(Number(expected.expenses));
    expect(report.current.profitVnd).toBe(
      report.current.netRevenueVnd - report.current.cogsVnd! - report.current.expenseVnd,
    );
    expect(report.current.profitVnd).not.toBeNull();
    expect(await db.query('SELECT id,stock,sold FROM product ORDER BY id', { type: QueryTypes.SELECT })).toEqual(
      stockBefore,
    );
  });
});
