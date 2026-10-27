import { Op, type Transaction } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import PawnContractModel from '../database/client/models/PawnContract.Model';
import PawnEventModel from '../database/client/models/PawnEvent.Model';
import CommerceNotificationModel from '../database/client/models/CommerceNotification.Model';
import NotificationDeliveryModel from '../database/client/models/NotificationDelivery.Model';
import NotificationDispatchService from './NotificationDispatchService';
import { PAWN_DAY_MS } from '../../../shared/pawn-rules';

export default class PawnReminderService {
  static async cancel(id: number, dueAt: Date | null, transaction: Transaction) {
    if (!dueAt) return;
    const rows = await CommerceNotificationModel.findAll({
      where: {
        entityId: id,
        kind: ['pawn_due', 'pawn_overdue'],
        details: { [Op.contains]: { dueAt: dueAt.toISOString() } },
      },
      transaction,
    });
    const ids = rows.map((row) => row.id);
    if (!ids.length) return;
    await CommerceNotificationModel.update({ cancelledAt: new Date() }, { where: { id: ids }, transaction });
    await NotificationDeliveryModel.update(
      { status: 'cancelled' },
      { where: { sourceType: 'customer_notification', sourceId: ids, status: ['pending', 'failed'] }, transaction },
    );
  }
  static async schedule(row: PawnContractModel, transaction: Transaction, now = new Date()) {
    if (!row.dueAt || !row.disbursedAt || row.dueAt <= now) return;
    for (const days of [10, 5]) {
      const at = new Date(row.dueAt.getTime() - days * PAWN_DAY_MS);
      if (at < row.disbursedAt) continue;
      await new NotificationDispatchService().notifyCustomer(
        {
          userId: row.userId,
          kind: 'pawn_due',
          entityId: row.id,
          dedupeKey: `pawn:${row.id}:${row.dueAt.toISOString()}:T-${days}`,
          availableAt: at,
          details: { days, dueAt: row.dueAt.toISOString() },
          email: {
            subject: `Nhắc hạn cầm #${row.id}: T−${days}`,
            body: `Hợp đồng #${row.id} đến hạn ${row.dueAt.toISOString()}. Vui lòng liên hệ shop để đối chiếu hoặc đề nghị gia hạn. Không tự phạt hay xử lý tài sản.`,
          },
        },
        transaction,
      );
    }
  }
  async run(now = new Date()) {
    const rows = await PawnContractModel.findAll({
      where: {
        status: ['active', 'DUE_GRACE', 'OVERDUE_REVIEW'],
        dueAt: { [Op.lte]: new Date(now.getTime() + 10 * PAWN_DAY_MS) },
      },
      attributes: ['id'],
    });
    for (const candidate of rows)
      await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const row = await PawnContractModel.findByPk(candidate.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row?.dueAt || !['active', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(row.status)) return;
        const next =
          now < row.dueAt
            ? 'active'
            : now.getTime() < row.dueAt.getTime() + 2 * PAWN_DAY_MS
              ? 'DUE_GRACE'
              : 'OVERDUE_REVIEW';
        if (row.status !== next) {
          await row.update({ status: next, version: row.version + 1 }, { transaction });
          await PawnEventModel.create(
            {
              pawnContractId: row.id,
              actorUserId: null,
              action: 'deadline_state',
              details: { actor: 'system', status: next, dueAt: row.dueAt.toISOString(), asOf: now.toISOString() },
            },
            { transaction },
          );
        }
        if (next === 'active') await PawnReminderService.schedule(row, transaction, now);
        else
          await new NotificationDispatchService().notifyCustomer(
            {
              userId: row.userId,
              kind: 'pawn_overdue',
              entityId: row.id,
              dedupeKey: `pawn:${row.id}:${row.dueAt.toISOString()}:${next}`,
              details: { dueAt: row.dueAt.toISOString(), stage: next },
              email: {
                subject: `Đối chiếu hợp đồng cầm #${row.id}`,
                body: `Hợp đồng đã đến hạn, hiện ở bước ${next}. Shop sẽ đối chiếu; không tự phạt hoặc thanh lý.`,
              },
            },
            transaction,
          );
      });
  }
}
