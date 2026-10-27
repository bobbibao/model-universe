import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { QueryTypes } from 'sequelize';
import DatabaseProvider from '../../Database.Provider';
import UserModel from '../../internal/models/User.Model';
import ProductModel from '../models/Product.Model';
import CategoryModel from '../models/Category.Model';
import OrderModel from '../models/Order.Model';
import OrderItemModel from '../models/OrderItem.Model';
import OrderReceiptModel from '../models/OrderReceipt.Model';
import OrderPrepaymentModel from '../models/OrderPrepayment.Model';
import OrderRefundModel from '../models/OrderRefund.Model';
import CatalogIntakeModel from '../models/CatalogIntake.Model';
import ReturnRequestModel from '../models/ReturnRequest.Model';
import ReturnItemModel from '../models/ReturnItem.Model';
import {
  FinanceCostTypeModel,
  FinanceExpenseModel,
  FinanceOrderReviewModel,
  FinanceConfigAuditModel,
} from '../models/Finance.Model';

export interface FinanceFixtureManifest {
  key: string;
  baseDay: string;
  adminId: number;
  orderIds: number[];
  productIds: number[];
  incompleteOrderIds: number[];
  crossPeriodRefundOrderId: number;
  counts: { customers: number; products: number; orders: number; expenses: number; refunds: number };
}
// The isolated fixture stays strict; current-database seeding requires the separate explicit authorization entry.
export async function seedFinanceFixture(baseDay = '2026-10-27'): Promise<FinanceFixtureManifest> {
  return seedFinanceRows(baseDay, false);
}
export async function seedFinanceDevelopment(
  expectedDatabase: string,
  baseDay = '2026-10-27',
): Promise<FinanceFixtureManifest> {
  if (
    DatabaseProvider.getInstance().getDatabaseName() !== expectedDatabase ||
    process.env.FINANCE_ALLOW_CURRENT_DEVELOPMENT !== 'true'
  )
    throw new Error('Explicit development database authorization is required.');
  return seedFinanceRows(baseDay, true);
}
async function seedFinanceRows(baseDay: string, currentDevelopment: boolean): Promise<FinanceFixtureManifest> {
  const db = DatabaseProvider.getInstance();
  if (!currentDevelopment && !db.getDatabaseName().endsWith('_test'))
    throw new Error('Finance fixtures require an explicit disposable *_test database.');
  const key = currentDevelopment ? 'finance-development-main-v1' : 'finance-linked-fixture-v1';
  const prefix = currentDevelopment ? 'DEV-FIN' : 'FIN-QA';
  const label = currentDevelopment ? '[DEV]' : 'QA ·';
  const at = (days: number) =>
    new Date(`${new Date(Date.parse(baseDay) - days * 86400000).toISOString().slice(0, 10)}T10:00:00+07:00`);
  await db.query('CREATE TABLE IF NOT EXISTS finance_fixture_manifest (key text PRIMARY KEY, manifest jsonb NOT NULL)');
  return db.transaction(async (transaction) => {
    await db.query('SELECT pg_advisory_xact_lock(575728,1)', { transaction });
    const [prior] = await db.query<{ manifest: FinanceFixtureManifest }>(
      'SELECT manifest FROM finance_fixture_manifest WHERE key=:key',
      { replacements: { key }, type: QueryTypes.SELECT, transaction },
    );
    if (prior) return prior.manifest;
    if (!currentDevelopment) {
      const [foreign] = await db.query<{ count: string }>(
        `SELECT COUNT(*) FROM product WHERE sku NOT LIKE 'FIN-QA-%'`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (Number(foreign.count) || (await OrderModel.count({ transaction })))
        throw new Error('Refusing to mix finance fixtures with an existing shop catalog or orders.');
    }
    const passwordHash = await hash(currentDevelopment ? randomUUID() : 'Finance-Check-2026!', 10);
    const admin = currentDevelopment
      ? await UserModel.findOne({ where: { role: 'ADMIN', isActive: true }, order: [['id', 'ASC']], transaction })
      : await UserModel.create(
          {
            email: 'finance.admin@model-universe.test',
            passwordHash,
            firstName: 'Finance',
            lastName: 'QA',
            role: 'ADMIN',
          },
          { transaction },
        );
    if (!admin)
      throw new Error(
        'An existing active admin is required. No admin credentials are created for the current database.',
      );
    const customers = [];
    for (let i = 0; i < 8; i++)
      customers.push(
        await UserModel.create(
          {
            email: `${currentDevelopment ? 'development.finance' : 'finance.customer'}.${i}@model-universe.test`,
            passwordHash,
            firstName: `${label} Khách ${i + 1}`,
            lastName: currentDevelopment ? 'Development' : 'QA',
            role: 'USER',
            isActive: !currentDevelopment,
            createdAt: at(180 - i * 10),
          },
          { transaction },
        ),
      );
    const category = await CategoryModel.create(
      { name: `${label} Lịch sử bán hàng phát triển`, slug: currentDevelopment ? 'development-finance' : 'finance-qa' },
      { transaction },
    );
    const brands = ['BANDAI', 'MOTOR NUCLEAR', 'MOSHOW', 'SNAA', 'IN ERA+', 'HEMOXIAN'];
    const models = ['MG RX-78-2 Ver.3.0', 'Ngao Bính', 'Hou Yi', 'Blade King', 'Ruling', 'Thor'];
    const products: ProductModel[] = [];
    for (let i = 0; i < 12; i++) {
      const price = 350000 + i * 125000,
        cost = 180000 + i * 70000;
      const product = await ProductModel.create(
        {
          name: `${label} ${models[i % 6]} · ${i < 6 ? '2hand thiếu hộp' : currentDevelopment ? '2hand đã lắp' : 'New'}`,
          sku: `${prefix}-${i + 1}`,
          brandName: brands[i % 6],
          categoryId: category.id,
          price,
          importPrice: cost,
          stock: currentDevelopment ? 50 + i * 3 : 50,
          listingStatus: currentDevelopment ? 'hidden' : 'published',
          sold: 0,
          condition: currentDevelopment || i < 6 ? 'preowned' : 'new',
          itemTypeKey: currentDevelopment || i < 6 ? 'preowned' : 'new',
          imageUrl: '/placeholder.svg',
          modelCode: `${prefix}-${i + 1}`,
          scale: '1/100',
          createdAt: at(180),
        },
        { transaction },
      );
      products.push(product);
      await CatalogIntakeModel.create(
        {
          productId: product.id,
          sourceType: currentDevelopment ? 'development_finance' : 'finance_fixture',
          sourceId: `${prefix}-INTAKE-${i}-A`,
          quantity: currentDevelopment ? 30 + i * 3 : 30,
          unitCostVnd: cost,
          actorUserId: admin.id,
          snapshot: { fixture: key, lot: 'A' },
          createdAt: at(180),
        },
        { transaction },
      );
      await CatalogIntakeModel.create(
        {
          productId: product.id,
          sourceType: currentDevelopment ? 'development_finance' : 'finance_fixture',
          sourceId: `${prefix}-INTAKE-${i}-B`,
          quantity: 20,
          unitCostVnd: cost + 5000,
          actorUserId: admin.id,
          snapshot: { fixture: key, lot: 'B' },
          createdAt: at(20),
        },
        { transaction },
      );
    }
    const types: FinanceCostTypeModel[] = [];
    for (const values of [
      { name: label + ' Thùng carton', unit: 'kiện', category: 'PACKAGING', basis: 'PARCEL', unitCostVnd: 12000 },
      { name: label + ' Chống sốc', unit: 'mét', category: 'PACKAGING', basis: 'QUANTITY', unitCostVnd: 4000 },
      { name: label + ' Nhân công đóng gói', unit: 'đơn', category: 'LABOUR', basis: 'ORDER', unitCostVnd: 8000 },
      { name: label + ' Cước thực tế', unit: 'lần', category: 'SHIPPING', basis: 'ACTUAL', unitCostVnd: 35000 },
      { name: label + ' Di chuyển hàng', unit: 'chuyến', category: 'OPERATING', basis: 'ACTUAL', unitCostVnd: 90000 },
      {
        name: label + ' Băng keo cũ (ngừng)',
        unit: 'cuộn',
        category: 'PACKAGING',
        basis: 'QUANTITY',
        unitCostVnd: 15000,
        isActive: false,
      },
    ])
      types.push(await FinanceCostTypeModel.create(values, { transaction }));
    if (currentDevelopment)
      for (const values of [
        { name: '[DEV] Băng keo đóng gói', unit: 'mét', category: 'PACKAGING', basis: 'QUANTITY', unitCostVnd: 800 },
        { name: '[DEV] Túi khí chống sốc', unit: 'túi', category: 'PACKAGING', basis: 'QUANTITY', unitCostVnd: 1500 },
        { name: '[DEV] Túi / bao bì', unit: 'cái', category: 'PACKAGING', basis: 'QUANTITY', unitCostVnd: 2000 },
        {
          name: '[DEV] Thuê kho / mặt bằng',
          unit: 'tháng',
          category: 'OPERATING',
          basis: 'ACTUAL',
          unitCostVnd: 750000,
        },
        { name: '[DEV] Điện / Internet', unit: 'tháng', category: 'OPERATING', basis: 'ACTUAL', unitCostVnd: 350000 },
      ])
        types.push(await FinanceCostTypeModel.create(values, { transaction }));
    for (const type of types)
      await FinanceConfigAuditModel.create(
        { costTypeId: type.id, actorUserId: admin.id, snapshot: { ...type.get({ plain: true }), source: key } },
        { transaction },
      );
    let expenseCount = 0;
    const expense = async (
      typeIndex: number,
      orderId: number | null,
      quantity: number,
      days: number,
      unitCost?: number,
    ) => {
      const type = types[typeIndex],
        cost = unitCost ?? Number(type.unitCostVnd);
      expenseCount++;
      return FinanceExpenseModel.create(
        {
          costTypeId: type.id,
          orderId,
          requestKey: `${prefix}-EXP-${expenseCount}`,
          requestDigest: `fixture-${expenseCount}`,
          incurredAt: at(days),
          nameSnapshot: type.name,
          categorySnapshot: type.category,
          basisSnapshot: type.basis,
          typeVersion: type.version,
          unitSnapshot: type.unit,
          quantity,
          unitCostVnd: cost,
          amountVnd: Math.round(quantity * cost),
          note: `${label} Dữ liệu phát triển · Chứng từ ${expenseCount}`,
          actorUserId: admin.id,
          createdAt: at(days),
        },
        { transaction },
      );
    };
    const orderIds: number[] = [],
      incompleteOrderIds: number[] = [];
    let oldRefundOrder: OrderModel | undefined;
    for (let i = 0; i < 54; i++) {
      const days = i < 18 ? i + 1 : i < 36 ? 30 + (i - 18) * 2 : 70 + (i - 36) * 5;
      const status = i % 13 === 0 ? 'CANCELLED' : i % 17 === 0 ? 'PROCESSING' : i % 19 === 0 ? 'SHIPPED' : 'DELIVERED';
      const selected = [products[i % 12], products[(i + 3) % 12]],
        quantity = i % 3 === 0 ? 2 : 1;
      const markdown = i % 4 === 0 ? 20000 : 0;
      const subtotal = selected.reduce((s, p) => s + (p.price - markdown) * quantity, 0);
      const member = i % 4 === 1,
        voucher = i % 4 === 2,
        rank = voucher && i % 2 === 0 ? 10000 : 0;
      const discount = member ? Math.round(subtotal * 0.1) : voucher ? 50000 + rank : 0;
      const shippingFee = i % 3 === 0 ? 0 : 35000,
        shippingDiscountVnd = i % 5 === 0 ? Math.min(shippingFee, 30000) : 0;
      const total = subtotal - discount + shippingFee - shippingDiscountVnd;
      const order = await OrderModel.create(
        {
          userId: customers[i % customers.length].id,
          createdByUserId: currentDevelopment ? admin.id : null,
          note: currentDevelopment ? '[DEV] Đơn mẫu phát triển, không giao hàng hoặc thanh toán thật.' : null,
          salesChannel: ['WEBSITE', 'COUNTER', 'ASSISTED'][i % 3],
          status,
          paymentMethod: 'COD',
          paymentStatus: status === 'DELIVERED' ? 'PAID' : 'PENDING',
          requiresCollectionConfirmation: true,
          subtotal,
          discount,
          shippingFee,
          shippingDiscountVnd,
          total,
          prepaidVnd: 0,
          recipientName: `${label} Khách ${(i % 8) + 1}`,
          phone: '0900000000',
          address: 'Dữ liệu kiểm thử - không giao hàng',
          city: 'QA',
          checkoutKey: `${prefix}-ORDER-${i}`,
          couponCode: member ? 'MEMBER10' : voucher ? 'QA50K' : null,
          benefitSnapshot: {
            scope: 'shop_owned',
            voucher:
              member || voucher ? { couponCode: member ? 'MEMBER10' : 'QA50K', discountVnd: discount - rank } : null,
            rank: rank ? { discountVnd: rank } : null,
          },
          createdAt: at(days + 2),
          updatedAt: at(days),
          deliveredAt: status === 'DELIVERED' ? at(days) : null,
        },
        { transaction },
      );
      orderIds.push(order.id);
      const lines = [];
      for (const product of selected) {
        const item = await OrderItemModel.create(
          {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            imageUrl: product.imageUrl,
            quantity,
            unitPrice: product.price - markdown,
            modelSnapshot: { financeListUnitVnd: product.price, partnerId: null, fixture: key },
            createdAt: at(days + 2),
          },
          { transaction },
        );
        lines.push(item);
        if (status !== 'CANCELLED') {
          product.stock -= quantity;
          product.sold += quantity;
          await product.save({ transaction });
        }
      }
      if (status === 'DELIVERED') {
        await OrderReceiptModel.create(
          {
            orderId: order.id,
            confirmedByUserId: admin.id,
            amountVnd: total,
            externalReference: `${prefix}-RECEIPT-${i}`,
            reason: `${label} Biên nhận mẫu phát triển`,
            createdAt: at(Math.max(0, days - 1)),
          },
          { transaction },
        );
        const incomplete = !currentDevelopment && (i === 2 || i === 6);
        if (incomplete) incompleteOrderIds.push(order.id);
        await FinanceOrderReviewModel.create(
          {
            orderId: order.id,
            version: 1,
            costsReviewed: !incomplete,
            items: lines.map((line, index) => ({
              orderItemId: line.id,
              unitCostVnd: incomplete && index === 0 ? null : selected[index].importPrice,
            })),
            note: incomplete ? 'QA · chờ hóa đơn mua hàng' : `${label} Giá vốn mẫu theo lô A và chi phí phát triển`,
            actorUserId: admin.id,
            createdAt: at(days),
          },
          { transaction },
        );
        await expense(0, order.id, 1, days);
        await expense(1, order.id, 1.5, days);
        await expense(2, order.id, 1, days);
        if (shippingFee > 0) await expense(3, order.id, 1, days, 32000 + (i % 4) * 2000);
        if (currentDevelopment) {
          await expense(6, order.id, 2.5, days);
          await expense(7, order.id, 2, days);
          await expense(8, order.id, 1, days);
        }
        if (i === 40) oldRefundOrder = order;
        if (i === 7 || i === 25 || i === 40) {
          const refundDays = i === 40 ? 3 : Math.max(1, days - 3),
            item = lines[0];
          const refundAmount = Math.floor(item.unitPrice * 0.6);
          await OrderRefundModel.create(
            {
              orderId: order.id,
              actorUserId: admin.id,
              externalReference: `${prefix}-REFUND-${i}`,
              merchandiseVnd: refundAmount,
              shippingVnd: 0,
              taxVnd: 0,
              reason: `${label} Bút toán hoàn tiền mẫu`,
              lineRefunds: [{ orderItemId: item.id, merchandiseVnd: refundAmount }],
              createdAt: at(refundDays),
            },
            { transaction },
          );
          const returned = await ReturnRequestModel.create(
            {
              orderId: order.id,
              userId: order.userId,
              status: 'RECEIVED',
              receivedAt: at(refundDays + 1),
              createdAt: at(refundDays + 2),
            },
            { transaction },
          );
          await ReturnItemModel.create(
            {
              returnRequestId: returned.id,
              orderItemId: item.id,
              quantity: 1,
              reason: 'shipping_damage',
              condition: 'open_box',
              refundAmount,
              restockedAt: i === 25 ? null : at(refundDays),
            },
            { transaction },
          );
          if (i !== 25) {
            selected[0].stock++;
            await selected[0].save({ transaction });
          }
        }
      } else if (status === 'CANCELLED') {
        for (const kind of ['receipt', 'refund'])
          await OrderPrepaymentModel.create(
            {
              orderId: order.id,
              actorUserId: admin.id,
              kind,
              amountVnd: 100000,
              externalReference: `${prefix}-CANCEL-${i}-${kind}`,
              reason: `${label} Cọc và hoàn cọc mẫu`,
              createdAt: at(days),
            },
            { transaction },
          );
        await expense(3, order.id, 1, days, 12000);
      }
    }
    for (const days of [4, 35, 65, 95, 125]) await expense(4, null, 1, days);
    if (currentDevelopment)
      for (const days of [4, 35, 65, 95, 125]) {
        await expense(9, null, 1, days);
        await expense(10, null, 1, days);
      }
    const original = await expense(0, null, 2, 8);
    await FinanceExpenseModel.create(
      {
        ...original.get({ plain: true }),
        id: undefined,
        createdAt: at(7),
        reversesId: original.id,
        requestKey: `${prefix}-REVERSAL`,
        requestDigest: 'fixture-reversal',
        quantity: -2,
        amountVnd: -Number(original.amountVnd),
        note: `${label} Đảo chứng từ nhập nhầm`,
      },
      { transaction },
    );
    expenseCount++;
    const manifest: FinanceFixtureManifest = {
      key,
      baseDay,
      adminId: admin.id,
      productIds: products.map((p) => p.id),
      orderIds,
      incompleteOrderIds,
      crossPeriodRefundOrderId: oldRefundOrder!.id,
      counts: { customers: 8, products: 12, orders: 54, expenses: expenseCount, refunds: 3 },
    };
    await db.query('INSERT INTO finance_fixture_manifest(key,manifest) VALUES(:key,CAST(:manifest AS jsonb))', {
      replacements: { key, manifest: JSON.stringify(manifest) },
      transaction,
    });
    return manifest;
  });
}
