import { QueryTypes } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import MoneyOperationsService, { payoutConfigured, type SourcePurpose } from './MoneyOperationsService';
import PayOSPayoutService, { type PayoutClient } from './PayOSPayoutService';
import Logger from '../../../shared/server/utils/logger';

// Refund to source, run by the background jobs every minute (owner decision 2026-11-06): every cancelled order and
// every cancelled or expired hold that was paid through payOS, still owes money and has no refund record yet gets one
// to the account that paid it (MoneyOperationsService.refundToSource); refunds the automatic policy approved are then
// sent through payOS payouts. Anything the policy does not cover waits in Finance for a person, as before.
//
// The query keeps what the refund would refuse anyway out of the batch (no customer, already refunded by hand, a
// paying account payOS did not report, several paying accounts), so those cannot fill it. The refund itself remains
// the authority: an entity it still skips or cannot process is left alone for RETRY_AFTER_MS before it is read again.
const USABLE_SOURCE = (link: string) => `(
    SELECT COUNT(DISTINCT (regexp_replace(s."bankBin", '\\s', '', 'g'), regexp_replace(s."accountNumber", '\\s', '', 'g'))) = 1
       AND bool_and(regexp_replace(s."bankBin", '\\s', '', 'g') ~ '^\\d{6}$'
                AND regexp_replace(s."accountNumber", '\\s', '', 'g') ~ '^\\d{4,34}$')
    FROM order_payment_link l JOIN payment_source s ON s."linkId" = l.id WHERE ${link})`;
const CANDIDATES = `
  SELECT 'purchase_refund' AS purpose, o.id AS "entityId" FROM "order" o
  WHERE o.status = 'CANCELLED' AND o."userId" IS NOT NULL AND COALESCE(o."cancellationFeeVnd", 0) = 0
    AND o."prepaidVnd" > COALESCE(
      (SELECT SUM(p."amountVnd") FROM order_prepayment p WHERE p."orderId" = o.id AND p.kind = 'refund'), 0)
    AND COALESCE(o."cancelledAt", o."updatedAt") > NOW() - INTERVAL '60 days'
    AND ${USABLE_SOURCE('l."orderId" = o.id')}
    AND NOT EXISTS (SELECT 1 FROM money_operation m WHERE m.purpose = 'purchase_refund' AND m."entityId" = o.id)
  UNION ALL
  SELECT 'hold_refund', r.id FROM reservation r
  WHERE r.status IN ('cancelled', 'expired') AND NOT r.disputed AND r."userId" IS NOT NULL
    AND r."updatedAt" > NOW() - INTERVAL '60 days'
    AND ${USABLE_SOURCE('l."reservationId" = r.id')}
    AND NOT EXISTS (SELECT 1 FROM money_operation m WHERE m.purpose = 'hold_refund' AND m."entityId" = r.id)
  ORDER BY 2 LIMIT 200`;
const BATCH = 25;
const RETRY_AFTER_MS = 60 * 60_000;

export default class RefundToSourceService {
  // Entities the refund skipped or could not process, and when to look at them again (per process).
  private static readonly retryAt = new Map<string, number>();

  constructor(private payouts?: PayoutClient) {}

  async sweep(now = Date.now()) {
    const found = await DatabaseProvider.getInstance().query<{ purpose: SourcePurpose; entityId: number }>(CANDIDATES, {
      type: QueryTypes.SELECT,
    });
    const { retryAt } = RefundToSourceService;
    for (const [key, at] of retryAt) if (at <= now) retryAt.delete(key);
    const candidates = found.filter((row) => !retryAt.has(`${row.purpose}:${row.entityId}`)).slice(0, BATCH);
    const money = new MoneyOperationsService();
    const payoutReady = !!this.payouts || payoutConfigured();
    let created = 0;
    for (const { purpose, entityId } of candidates) {
      try {
        const result = await money.refundToSource(purpose, Number(entityId), { payoutReady });
        if (result.operation) created++;
        else retryAt.set(`${purpose}:${entityId}`, now + RETRY_AFTER_MS);
      } catch (error) {
        // Not refundable yet (dispute, reconciliation): left for Finance and looked at again later.
        retryAt.set(`${purpose}:${entityId}`, now + RETRY_AFTER_MS);
        Logger.WARN(`Refund to source for ${purpose} #${entityId} skipped: ${(error as Error).message}`);
      }
    }
    const sent = await new PayOSPayoutService(this.payouts).submitAutoApproved();
    return { candidates: candidates.length, created, sent };
  }

  // Tests start from an empty memory of skipped entities.
  static forgetSkipped() {
    RefundToSourceService.retryAt.clear();
  }
}
