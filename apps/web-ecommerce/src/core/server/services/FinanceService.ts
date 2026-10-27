import { createHash } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import OrderModel from '../database/client/models/Order.Model';
import OrderItemModel from '../database/client/models/OrderItem.Model';
import {
  FinanceCostTypeModel,
  FinanceExpenseModel,
  FinanceOrderReviewModel,
  FinanceConfigAuditModel,
} from '../database/client/models/Finance.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import {
  buildFinanceReport,
  periodBounds,
  shopDay,
  FINANCE_CATEGORIES,
  COST_BASES,
  type FinanceData,
  type FinanceOrder,
  type FinanceExpense,
} from '../../../shared/finance';

const money = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000)
    throw HttpError.badRequest('Số tiền phải là VND nguyên, từ 0 đến 1.000 tỷ.');
  return value;
};
const positiveId = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw HttpError.badRequest('ID không hợp lệ.');
  return id;
};
const text = (value: unknown, max = 1000) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const orderSelect = `SELECT o.id,o."userId",o.status,o."salesChannel",o."createdAt",o."deliveredAt",o.subtotal,o.discount,o."shippingFee",o."shippingDiscountVnd",o.total,o.tax,o."recipientName",o."couponCode",o."benefitSnapshot", COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'productId',i."productId",'productName',i."productName",'quantity',i.quantity,'unitPrice',i."unitPrice",'modelSnapshot',jsonb_build_object('financeListUnitVnd',i."modelSnapshot"->'financeListUnitVnd','partnerId',i."modelSnapshot"->'partnerId')) ORDER BY i.id) FROM order_item i WHERE i."orderId"=o.id),'[]') AS items,
 (SELECT to_jsonb(r) FROM finance_order_review r WHERE r."orderId"=o.id ORDER BY r.version DESC LIMIT 1) AS review FROM "order" o`;

export default class FinanceService {
  private db = DatabaseProvider.getInstance();
  private query<T extends object>(sql: string, replacements: Record<string, unknown> = {}, transaction?: Transaction) {
    return this.db.query<T>(sql, { type: QueryTypes.SELECT, replacements, transaction });
  }
  bounds(raw: Record<string, unknown>) {
    const to = text(raw.to, 10) || shopDay(new Date());
    const from = text(raw.from, 10) || `${to.slice(0, 7)}-01`;
    try {
      return periodBounds(from, to);
    } catch {
      throw HttpError.badRequest('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
    }
  }
  async report(raw: Record<string, unknown>) {
    const range = this.bounds(raw);
    return this.db.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        const params = { start: range.start, end: range.end };
        const orders = await this.query<FinanceOrder>(
          `${orderSelect} WHERE (o."deliveredAt">= :start AND o."deliveredAt"< :end) OR (o."createdAt">= :start AND o."createdAt"< :end)`,
          params,
          transaction,
        );
        const refunds = await this.query<FinanceData['refunds'][number]>(
          `SELECT r.* FROM order_refund r JOIN "order" o ON o.id=r."orderId" WHERE o.status='DELIVERED' AND r."createdAt">= :start AND r."createdAt"< :end`,
          params,
          transaction,
        );
        const cash = await this.query<FinanceData['cash'][number]>(
          `SELECT "createdAt","amountVnd"::bigint AS "amountVnd" FROM order_receipt WHERE "createdAt">= :start AND "createdAt"< :end
          UNION ALL SELECT "createdAt",CASE WHEN kind='refund' THEN -"amountVnd" ELSE "amountVnd" END FROM order_prepayment WHERE "createdAt">= :start AND "createdAt"< :end
          UNION ALL SELECT "createdAt",-("merchandiseVnd"::bigint+"shippingVnd"+"taxVnd") FROM order_refund WHERE "createdAt">= :start AND "createdAt"< :end
          UNION ALL SELECT "createdAt",CASE WHEN kind='refund' THEN -"amountVnd" ELSE "amountVnd" END FROM reservation_payment WHERE kind IN ('receipt','refund') AND "createdAt">= :start AND "createdAt"< :end`,
          params,
          transaction,
        );
        const expenses = await this.query<FinanceExpense>(
          `SELECT * FROM finance_expense WHERE "incurredAt">= :start AND "incurredAt"< :end`,
          params,
          transaction,
        );
        const restocks = await this.query<{ createdAt: string; quantity: number; unitCostVnd: string | null }>(
          `SELECT ri."restockedAt" AS "createdAt",ri.quantity,
          (SELECT c->>'unitCostVnd' FROM jsonb_array_elements(fr.items) c WHERE (c->>'orderItemId')::int=oi.id) AS "unitCostVnd"
          FROM return_item ri JOIN order_item oi ON oi.id=ri."orderItemId"
          LEFT JOIN LATERAL (SELECT items FROM finance_order_review r WHERE r."orderId"=oi."orderId" ORDER BY version DESC LIMIT 1) fr ON true
          WHERE ri."restockedAt">= :start AND ri."restockedAt"< :end`,
          params,
          transaction,
        );
        const inventory = await this.query<{
          id: number;
          name: string;
          stock: number;
          lastReceiptAt: string | null;
          importPrice: number;
        }>(
          `SELECT p.id,p.name,p.stock,p."importPrice",
          GREATEST((SELECT MAX("createdAt") FROM catalog_intake WHERE "productId"=p.id),(SELECT MAX(s."createdAt") FROM stock_import_item i JOIN stock_import s ON s.id=i."stockImportId" WHERE i."productId"=p.id)) AS "lastReceiptAt"
          FROM product p WHERE p."isArchived"=false AND p."partnerId" IS NULL AND p.stock>0 ORDER BY p.id`,
          {},
          transaction,
        );
        const data: FinanceData = {
          orders,
          refunds,
          cash: cash.map((c) => ({ ...c, amountVnd: Number(c.amountVnd) })),
          expenses,
          restocks: restocks.map((r) => ({ ...r, unitCostVnd: r.unitCostVnd === null ? null : Number(r.unitCostVnd) })),
        };
        const report = buildFinanceReport(data, range.from, range.to);
        const today = Date.now();
        return {
          ...report,
          developmentFixtures:
            this.db.getDatabaseName().startsWith('model_universe_finance_') &&
            this.db.getDatabaseName().endsWith('_test'),
          inventory: {
            asOf: new Date().toISOString(),
            units: inventory.reduce((n, p) => n + p.stock, 0),
            referenceValueVnd: inventory.reduce((n, p) => n + p.stock * p.importPrice, 0),
            uncostedUnits: inventory.filter((p) => p.importPrice <= 0).reduce((n, p) => n + p.stock, 0),
            undatedUnits: inventory.filter((p) => !p.lastReceiptAt).reduce((n, p) => n + p.stock, 0),
            aging: inventory
              .filter((p) => p.lastReceiptAt && today - Date.parse(p.lastReceiptAt) >= 90 * 86400000)
              .sort((a, b) => Date.parse(a.lastReceiptAt!) - Date.parse(b.lastReceiptAt!))
              .slice(0, 8),
          },
        };
      },
    );
  }
  async orders(raw: Record<string, unknown>) {
    const range = this.bounds(raw);
    const page = Math.max(1, Math.min(100000, Number(raw.page) || 1));
    if (!Number.isInteger(page)) throw HttpError.badRequest('Trang không hợp lệ.');
    const query = text(raw.q, 100);
    const where = `o."createdAt">= :start AND o."createdAt"< :end AND (o."recipientName" ILIKE :q OR CAST(o.id AS text)=:id)`;
    const params = {
      start: new Date(`${range.from}T00:00:00+07:00`),
      end: range.end,
      q: `%${query}%`,
      id: query,
      limit: 30,
      offset: (page - 1) * 30,
    };
    const [rows, count] = await Promise.all([
      this.query<FinanceOrder>(
        `${orderSelect} WHERE ${where} ORDER BY o."createdAt" DESC,o.id DESC LIMIT :limit OFFSET :offset`,
        params,
      ),
      this.query<{ count: string }>(`SELECT COUNT(*) FROM "order" o WHERE ${where}`, params),
    ]);
    return { rows, count: Number(count[0].count), page };
  }
  async order(id: number) {
    const [row] = await this.query<FinanceOrder>(`${orderSelect} WHERE o.id=:id`, { id: positiveId(id) });
    if (!row) throw HttpError.notFound();
    const [expenses, revisions, shipments] = await Promise.all([
      FinanceExpenseModel.findAll({ where: { orderId: id }, order: [['id', 'ASC']] }),
      FinanceOrderReviewModel.findAll({ where: { orderId: id }, order: [['version', 'DESC']] }),
      this.query<{ trackingNumber: string; shippingFeeVnd: number; status: string }>(
        `SELECT "trackingNumber","shippingFeeVnd",status FROM order_shipment WHERE "orderId"=:id`,
        { id },
      ),
    ]);
    return { ...row, expenses, revisions, shipments };
  }
  async reconcile(id: number, actorUserId: number, raw: Record<string, unknown>) {
    return this.db.transaction(async (transaction) => {
      const order = await OrderModel.findByPk(positiveId(id), { transaction, lock: transaction.LOCK.UPDATE });
      if (!order) throw HttpError.notFound();
      const prior = await FinanceOrderReviewModel.findOne({
        where: { orderId: id },
        order: [['version', 'DESC']],
        transaction,
      });
      if (raw.expectedVersion !== (prior?.version ?? 0))
        throw HttpError.conflict('Đối soát đã thay đổi. Tải lại trước khi lưu.');
      const lines = await OrderItemModel.findAll({ where: { orderId: id }, transaction });
      if (!Array.isArray(raw.items) || raw.items.length !== lines.length)
        throw HttpError.badRequest('Cần đối soát tất cả dòng hàng.');
      const seen = new Set<number>();
      const items = raw.items.map((item: { orderItemId?: unknown; unitCostVnd?: unknown }) => {
        const lineId = positiveId(item?.orderItemId);
        if (seen.has(lineId) || !lines.some((l) => l.id === lineId))
          throw HttpError.badRequest('Dòng hàng không thuộc đơn hoặc bị trùng.');
        seen.add(lineId);
        const unitCostVnd = item.unitCostVnd === null ? null : money(item.unitCostVnd);
        if (unitCostVnd !== null && !Number.isSafeInteger(unitCostVnd * lines.find((l) => l.id === lineId)!.quantity))
          throw HttpError.badRequest('Tổng giá vốn vượt giới hạn VND an toàn.');
        return { orderItemId: lineId, unitCostVnd };
      });
      const note = text(raw.note);
      if (
        !note ||
        typeof raw.costsReviewed !== 'boolean' ||
        (raw.costsReviewed && items.some((i) => i.unitCostVnd === null))
      )
        throw HttpError.badRequest('Nhập căn cứ đối soát và giá vốn đầy đủ trước khi xác nhận.');
      return FinanceOrderReviewModel.create(
        { orderId: id, version: (prior?.version ?? 0) + 1, items, note, costsReviewed: raw.costsReviewed, actorUserId },
        { transaction },
      );
    });
  }
  types() {
    return FinanceCostTypeModel.findAll({
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });
  }
  async saveType(id: number | null, actorUserId: number, raw: Record<string, unknown>) {
    const name = text(raw.name, 100),
      unit = text(raw.unit, 30);
    if (
      !name ||
      !unit ||
      !FINANCE_CATEGORIES.includes(raw.category as never) ||
      !COST_BASES.includes(raw.basis as never) ||
      typeof raw.isActive !== 'boolean'
    )
      throw HttpError.badRequest('Tên, đơn vị, nhóm và cách ghi nhận chi phí chưa hợp lệ.');
    const unitCostVnd = money(raw.unitCostVnd);
    return this.db.transaction(async (transaction) => {
      const row = id
        ? await FinanceCostTypeModel.findByPk(positiveId(id), { transaction, lock: transaction.LOCK.UPDATE })
        : null;
      if (id && !row) throw HttpError.notFound();
      if (row && raw.expectedVersion !== row.version)
        throw HttpError.conflict('Loại chi phí đã thay đổi. Vui lòng tải lại.');
      await this.db.query('SELECT pg_advisory_xact_lock(575729,hashtext(:name))', {
        replacements: { name },
        transaction,
      });
      const values = {
        name,
        unit,
        unitCostVnd,
        category: raw.category,
        basis: raw.basis,
        isActive: raw.isActive,
        version: (row?.version ?? 0) + 1,
      };
      const duplicate = await FinanceCostTypeModel.findOne({ where: { name }, transaction });
      if (duplicate && duplicate.id !== row?.id) throw HttpError.conflict('Tên loại chi phí đã tồn tại.');
      const saved = row
        ? await row.update(values, { transaction })
        : await FinanceCostTypeModel.create(values, { transaction });
      await FinanceConfigAuditModel.create(
        { costTypeId: saved.id, snapshot: saved.get({ plain: true }), actorUserId },
        { transaction },
      );
      return saved;
    });
  }
  async expenses(raw: Record<string, unknown>) {
    const range = this.bounds(raw),
      page = Math.max(1, Math.min(100000, Number(raw.page) || 1));
    if (!Number.isInteger(page)) throw HttpError.badRequest('Trang không hợp lệ.');
    const params = { from: new Date(`${range.from}T00:00:00+07:00`), end: range.end, offset: (page - 1) * 30 };
    const [rows, count] = await Promise.all([
      this.query<FinanceExpense & { reversed: boolean }>(
        `SELECT e.*,EXISTS(SELECT 1 FROM finance_expense r WHERE r."reversesId"=e.id) AS reversed FROM finance_expense e WHERE "incurredAt">= :from AND "incurredAt"< :end ORDER BY "incurredAt" DESC,id DESC LIMIT 30 OFFSET :offset`,
        params,
      ),
      this.query<{ count: string }>(
        `SELECT count(*) FROM finance_expense WHERE "incurredAt">= :from AND "incurredAt"< :end`,
        params,
      ),
    ]);
    return { rows, count: Number(count[0].count), page };
  }
  async postExpense(actorUserId: number, raw: Record<string, unknown>, reversalId?: number) {
    const requestKey = text(raw.requestKey, 100);
    if (!/^[a-zA-Z0-9:_-]{8,100}$/.test(requestKey)) throw HttpError.badRequest('Mã ghi nhận chi phí không hợp lệ.');
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          reversalId: reversalId ?? null,
          costTypeId: raw.costTypeId,
          orderId: raw.orderId ?? null,
          quantity: raw.quantity,
          unitCostVnd: raw.unitCostVnd,
          incurredAt: raw.incurredAt,
          note: raw.note,
        }),
      )
      .digest('hex');
    return this.db.transaction(async (transaction) => {
      await this.db.query('SELECT pg_advisory_xact_lock(575727,hashtext(:key))', {
        replacements: { key: requestKey },
        transaction,
      });
      const prior = await FinanceExpenseModel.findOne({ where: { requestKey }, transaction });
      if (prior) {
        if (prior.requestDigest !== digest) throw HttpError.conflict('Mã ghi nhận đã được sử dụng cho nội dung khác.');
        return prior;
      }
      const note = text(raw.note);
      if (!note) throw HttpError.badRequest('Nhập nội dung hoặc chứng từ chi phí.');
      if (reversalId) {
        const original = await FinanceExpenseModel.findByPk(positiveId(reversalId), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!original || original.reversesId) throw HttpError.badRequest('Chỉ được đảo một bút toán chi phí gốc.');
        if (await FinanceExpenseModel.findOne({ where: { reversesId: reversalId }, transaction }))
          throw HttpError.conflict('Bút toán này đã được đảo.');
        return FinanceExpenseModel.create(
          {
            ...original.get({ plain: true }),
            id: undefined,
            createdAt: undefined,
            reversesId: original.id,
            quantity: -Number(original.quantity),
            amountVnd: -Number(original.amountVnd),
            actorUserId,
            note,
            requestKey,
            requestDigest: digest,
          },
          { transaction },
        );
      }
      const type = await FinanceCostTypeModel.findByPk(positiveId(raw.costTypeId), {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!type?.isActive) throw HttpError.badRequest('Loại chi phí không còn được sử dụng.');
      const quantity = Number(raw.quantity);
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 1000000 ||
        Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.00001 ||
        ((type.basis === 'ORDER' || type.basis === 'ACTUAL') && quantity !== 1) ||
        (type.basis === 'PARCEL' && !Number.isInteger(quantity))
      )
        throw HttpError.badRequest('Số lượng không phù hợp với cách ghi nhận của loại chi phí.');
      const unitCostVnd = money(raw.unitCostVnd === undefined ? Number(type.unitCostVnd) : raw.unitCostVnd);
      if (quantity * unitCostVnd > 1_000_000_000_000) throw HttpError.badRequest('Thành tiền vượt giới hạn VND.');
      const amountVnd = money(Math.floor((Math.round(quantity * 1000) * unitCostVnd + 500) / 1000));
      const incurredAt = text(raw.incurredAt, 10);
      try {
        periodBounds(incurredAt, incurredAt);
      } catch {
        throw HttpError.badRequest('Ngày chi phí không hợp lệ.');
      }
      const orderId = raw.orderId ? positiveId(raw.orderId) : null;
      if (type.basis === 'ORDER' && !orderId) throw HttpError.badRequest('Chi phí theo đơn phải gắn với một đơn hàng.');
      if (orderId && !(await OrderModel.findByPk(orderId, { transaction })))
        throw HttpError.notFound('Đơn hàng không tồn tại.');
      return FinanceExpenseModel.create(
        {
          costTypeId: type.id,
          orderId,
          incurredAt: new Date(`${incurredAt}T12:00:00+07:00`),
          nameSnapshot: type.name,
          categorySnapshot: type.category,
          basisSnapshot: type.basis,
          typeVersion: type.version,
          unitSnapshot: type.unit,
          quantity,
          unitCostVnd,
          amountVnd,
          note,
          actorUserId,
          requestKey,
          requestDigest: digest,
        },
        { transaction },
      );
    });
  }
}
