import AdminAlertModel from '../database/client/models/AdminAlert.Model';
import { Op, QueryTypes } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import CommerceNotificationModel from '../database/client/models/CommerceNotification.Model';
import NotificationDeliveryModel from '../database/client/models/NotificationDelivery.Model';
import PawnContractModel from '../database/client/models/PawnContract.Model';
import ReservationModel from '../database/client/models/Reservation.Model';
import UserModel from '../database/internal/models/User.Model';
import NotificationDispatchService from './NotificationDispatchService';
import { shopPublicUrl } from './marketing/platforms';
import { renderPawnNoticeEmail, renderReservationNoticeEmail, renderServiceNoticeEmail } from './mail/EmailTemplate';

const titles: Record<string, string> = {
  reservation_deadline: 'Sắp đến hạn nhận mô hình đang giữ',
  pawn_due: 'Nhắc hạn hợp đồng cầm cố',
  restock: 'Mô hình bạn theo dõi đã có hàng',
  voucher_expiry: 'Mã ưu đãi sắp hết hạn',
  reservation_update: 'Đơn giữ hàng có cập nhật',
  pawn_update: 'Hồ sơ cầm cố có cập nhật',
};
export const commerceEmail = (kind: string, entityId: number) => {
  const subject = titles[kind] || 'Tài khoản của bạn có cập nhật mới';
  let body = '';
  if (kind.startsWith('pawn')) {
    body = renderPawnNoticeEmail({
      contractId: entityId,
      title: subject,
      message: 'Hồ sơ cầm cố của bạn vừa có cập nhật mới từ Model Universe. Bạn vui lòng đăng nhập vào tài khoản để xem chi tiết thông tin và thực hiện các bước tiếp theo.',
      actionUrl: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
    });
  } else if (kind.startsWith('reservation')) {
    body = renderReservationNoticeEmail({
      reservationId: entityId,
      title: subject,
      message: 'Đơn giữ hàng của bạn vừa có cập nhật mới từ Model Universe. Vui lòng kiểm tra thông tin và thời hạn hoàn tất.',
      actionUrl: `${shopPublicUrl()}/vi/reservations`,
    });
  } else {
    body = renderServiceNoticeEmail({
      badge: 'Thông báo',
      title: subject,
      message: `Model Universe có thông báo mới liên quan đến hồ sơ #${entityId} của bạn.`,
      details: [{ label: 'Mã hồ sơ', value: `#${entityId}`, isHighlight: true }],
      actionButton: {
        text: 'Xem chi tiết trong hộp thư',
        url: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
      },
    });
  }
  return { subject, body };
};

// Durable bridge for committed domain events and inbox-only notices. No email sends inside a business transaction.
export default class CommerceEmailService {
  async run() {
    const since = new Date(process.env.SMTP_ENABLED_AT || Date.now());
    if (!process.env.SMTP_HOST || !Number.isFinite(since.getTime())) return;
    const db = DatabaseProvider.getInstance();
    for (const family of ['reservation', 'pawn'] as const) {
      const table = family === 'pawn' ? 'pawn_event' : 'reservation_event';
      const key = family === 'pawn' ? 'pawnContractId' : 'reservationId';
      // Exclude already queued events in SQL so a large history cannot starve new events.
      const rows = await db.query<{ id: number; entityId: number }>(
        `SELECT e.id,e."${key}" AS "entityId" FROM ${table} e WHERE e."createdAt">=:since
         AND NOT EXISTS (SELECT 1 FROM commerce_notification n WHERE n."dedupeKey"=:prefix || e.id::text)
         ORDER BY e.id LIMIT 100`,
        { replacements: { since, prefix: `email-event:${family}:` }, type: QueryTypes.SELECT },
      );
      for (const event of rows) {
        await db.transaction(async (transaction) => {
          const row =
            family === 'pawn'
              ? await PawnContractModel.findByPk(event.entityId, { transaction })
              : await ReservationModel.findByPk(event.entityId, { transaction });
          if (!row?.userId) return;
          await new NotificationDispatchService().notifyCustomer(
            {
              userId: row.userId,
              kind: `${family}_update`,
              entityId: row.id,
              dedupeKey: `email-event:${family}:${event.id}`,
              details: { eventId: event.id },
              email: commerceEmail(`${family}_update`, row.id),
            },
            transaction,
          );
        });
      }
    }
    const notices = await db.query<{ id: number }>(
      `SELECT n.id FROM commerce_notification n WHERE n."createdAt">=:since AND n."cancelledAt" IS NULL
       AND NOT EXISTS (SELECT 1 FROM notification_delivery d WHERE d.channel='email' AND d."sourceType"='customer_notification' AND d."sourceId"=n.id)
       ORDER BY n.id LIMIT 100`,
      { replacements: { since }, type: QueryTypes.SELECT },
    );
    for (const notice of notices) {
      await db.transaction(async (transaction) => {
        const row = await CommerceNotificationModel.findByPk(notice.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row || row.cancelledAt) return;
        const user = await UserModel.findByPk(row.userId, { attributes: ['email', 'isActive'], transaction });
        if (!user?.isActive || !user.email) return;
        if (
          await NotificationDeliveryModel.findOne({
            where: { channel: 'email', sourceType: 'customer_notification', sourceId: row.id },
            transaction,
          })
        )
          return;
        const message = commerceEmail(row.kind, row.entityId);
        await NotificationDeliveryModel.create(
          {
            channel: 'email',
            sourceType: 'customer_notification',
            sourceId: row.id,
            recipient: user.email,
            subject: message.subject,
            body: message.body,
            scheduledAt: row.availableAt,
          },
          { transaction },
        );
      });
    }
    const admins = await UserModel.findAll({ where: { role: 'ADMIN', isActive: true }, attributes: ['email'] });
    const alerts = await db.query<{ id: number }>(
      `SELECT a.id FROM admin_alert a WHERE a."createdAt">=:since AND NOT EXISTS
       (SELECT 1 FROM notification_delivery d WHERE d.channel='email' AND d."sourceType"='admin_alert' AND d."sourceId"=a.id)
       ORDER BY a.id LIMIT 100`,
      { replacements: { since }, type: QueryTypes.SELECT },
    );
    for (const alert of alerts) {
      await db.transaction(async (transaction) => {
        const row = await AdminAlertModel.findByPk(alert.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row) return;
        for (const admin of admins) {
          const where = {
            channel: 'email' as const,
            sourceType: 'admin_alert' as const,
            sourceId: row.id,
            recipient: admin.email,
          };
          await NotificationDeliveryModel.findOrCreate({
            where,
            defaults: {
              ...where,
              subject: row.title,
              body: renderServiceNoticeEmail({
                badge: 'Cảnh báo Quản trị',
                title: row.title,
                message: row.content,
                actionButton: {
                  text: 'Mở trang quản trị Model Universe',
                  url: `${shopPublicUrl()}/vi/admin`,
                },
              }),
              scheduledAt: new Date(),
            },
            transaction,
          });
        }
      });
    }
    // Historical development messages that failed before SMTP activation must not suddenly email old demo orders.
    await NotificationDeliveryModel.update(
      { status: 'cancelled', lastError: 'Historical message retired when live SMTP was activated; no email sent.' },
      {
        where: {
          channel: 'email',
          status: { [Op.in]: ['pending', 'failed'] },
          createdAt: { [Op.lt]: since },
          scheduledAt: { [Op.lte]: since },
          lastError: { [Op.like]: '%SMTP is not configured%' },
        },
      },
    );
  }
}
