import { QueryTypes } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import MoneyOperationsService, { type SourcePurpose } from './MoneyOperationsService';
import PayOSPayoutService, { type PayoutClient } from './PayOSPayoutService';
import Logger from '../../../shared/server/utils/logger';

// Refund to source, run by the background jobs every minute (owner decision 2026-11-06): every cancelled order and
// every cancelled or expired hold that was paid through payOS, still owes money and has no refund record yet gets one
// to the account that paid it (MoneyOperationsService.refundToSource); refunds the automatic policy approved are then
// sent through payOS payouts. Anything the policy does not cover waits in Finance for a person, as before.
const CANDIDATES = `
  SELECT 'purchase_refund' AS purpose, o.id AS "entityId" FROM "order" o
  WHERE o.status = 'CANCELLED' AND o."prepaidVnd" > 0 AND COALESCE(o."cancellationFeeVnd", 0) = 0
    AND COALESCE(o."cancelledAt", o."updatedAt") > NOW() - INTERVAL '60 days'
    AND EXISTS (SELECT 1 FROM order_payment_link l JOIN payment_source s ON s."linkId" = l.id WHERE l."orderId" = o.id)
    AND NOT EXISTS (SELECT 1 FROM money_operation m WHERE m.purpose = 'purchase_refund' AND m."entityId" = o.id)
  UNION ALL
  SELECT 'hold_refund', r.id FROM reservation r
  WHERE r.status IN ('cancelled', 'expired') AND NOT r.disputed
    AND r."updatedAt" > NOW() - INTERVAL '60 days'
    AND EXISTS (SELECT 1 FROM order_payment_link l JOIN payment_source s ON s."linkId" = l.id WHERE l."reservationId" = r.id)
    AND NOT EXISTS (SELECT 1 FROM money_operation m WHERE m.purpose = 'hold_refund' AND m."entityId" = r.id)
  ORDER BY 2 LIMIT 25`;

export default class RefundToSourceService {
  constructor(private payouts?: PayoutClient) {}

  async sweep() {
    const candidates = await DatabaseProvider.getInstance().query<{ purpose: SourcePurpose; entityId: number }>(
      CANDIDATES,
      { type: QueryTypes.SELECT },
    );
    const money = new MoneyOperationsService();
    let created = 0;
    for (const { purpose, entityId } of candidates) {
      try {
        const result = await money.refundToSource(purpose, Number(entityId));
        if (result.operation) created++;
      } catch (error) {
        // Not refundable yet (dispute, reconciliation): left for Finance; checked again on the next run.
        Logger.WARN(`Refund to source for ${purpose} #${entityId} skipped: ${(error as Error).message}`);
      }
    }
    const sent = await new PayOSPayoutService(this.payouts).submitAutoApproved();
    return { candidates: candidates.length, created, sent };
  }
}
