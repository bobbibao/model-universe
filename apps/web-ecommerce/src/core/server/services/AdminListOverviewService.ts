import { QueryTypes } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import type { CustomerOverview, OrderOverview } from '../../../shared/admin-list-overview';

export const deliveredCustomerOrders = `(SELECT COUNT(*) FROM "order" customer_order WHERE customer_order."userId" = "UserModel".id AND customer_order.status = 'DELIVERED')`;

// Values are confirmed receipts, not an estimate based on delivery status. PAID includes retained settled orders.
export const orderOutstandingSql = (alias: 'o' | 'OrderModel') =>
  `CASE WHEN "${alias}"."paymentStatus" = 'PAID' OR "${alias}".status = 'CANCELLED' THEN 0 ELSE GREATEST("${alias}".total::bigint - "${alias}"."prepaidVnd"::bigint - COALESCE((SELECT r."amountVnd"::bigint FROM order_receipt r WHERE r."orderId" = "${alias}".id), 0), 0) END`;

export default class AdminListOverviewService {
  async customers(): Promise<CustomerOverview> {
    const [row] = await DatabaseProvider.getInstance().query<Record<string, string>>(
      `
      WITH purchases AS (SELECT "userId", COUNT(*) AS count FROM "order" WHERE status = 'DELIVERED' AND "userId" IS NOT NULL GROUP BY "userId")
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE u."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS "new30Days",
        COUNT(*) FILTER (WHERE COALESCE(p.count, 0) >= 1) AS purchased,
        COUNT(*) FILTER (WHERE COALESCE(p.count, 0) >= 2) AS repeat
      FROM "user" u LEFT JOIN purchases p ON p."userId" = u.id WHERE u.role = 'USER'`,
      { type: QueryTypes.SELECT },
    );
    return {
      total: Number(row.total),
      new30Days: Number(row.new30Days),
      purchased: Number(row.purchased),
      repeat: Number(row.repeat),
    };
  }

  async orders(): Promise<OrderOverview> {
    const [row] = await DatabaseProvider.getInstance().query<Record<string, string>>(
      `
      WITH orders AS (SELECT o.*, ${orderOutstandingSql('o')} AS remaining FROM "order" o)
      SELECT COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing,
        COUNT(*) FILTER (WHERE status = 'SHIPPED') AS shipping,
        COALESCE(SUM(remaining), 0) AS "receivableVnd",
        COUNT(*) FILTER (WHERE remaining > 0) AS "unpaidOrders",
        COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND "cancelRequest"->>'status' = 'PENDING') AS "cancellationRequests"
      FROM orders`,
      { type: QueryTypes.SELECT },
    );
    return {
      processing: Number(row.processing),
      shipping: Number(row.shipping),
      receivableVnd: Number(row.receivableVnd),
      unpaidOrders: Number(row.unpaidOrders),
      cancellationRequests: Number(row.cancellationRequests),
    };
  }
}
