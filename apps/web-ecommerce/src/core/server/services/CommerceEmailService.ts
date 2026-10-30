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
import {
  renderPawnNoticeEmail,
  renderReservationNoticeEmail,
  renderServiceNoticeEmail,
  renderLoyaltyRewardEmail,
  renderAdminAlertEmail,
  renderVoucherNoticeEmail,
  renderRestockAlertEmail,
  type ServiceDetailRow,
} from './mail/EmailTemplate';

const titles: Record<string, string> = {
  reservation_deadline: 'Sắp đến hạn nhận mô hình đang giữ',
  pawn_due: 'Nhắc hạn hợp đồng cầm cố',
  restock: 'Mô hình bạn theo dõi đã có hàng',
  voucher_expiry: 'Mã ưu đãi sắp hết hạn',
  voucher_expiring: 'Mã ưu đãi sắp hết hạn',
  reservation_update: 'Đơn giữ hàng có cập nhật',
  pawn_update: 'Hồ sơ cầm cố có cập nhật',
  loyalty_earned: 'Điểm thưởng thành viên vừa được cộng',
  review_reward: 'Thưởng điểm đánh giá sản phẩm',
  profile_completed: 'Thưởng hoàn thiện hồ sơ',
};

export const commerceEmail = (
  kind: string,
  entityId: number,
  details?: Record<string, unknown>,
  user?: { firstName?: string; lastName?: string; email?: string } | null,
) => {
  const customerName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() : 'Quý khách';

  // 1. Pawn contracts
  if (kind.startsWith('pawn')) {
    if (kind === 'pawn_due') {
      const days = details?.days ? `${details.days} ngày` : 'sắp đến hạn';
      const dueAtStr = details?.dueAt ? new Date(String(details.dueAt)).toLocaleDateString('vi-VN') : 'kỳ hạn quy định';
      const subject = `Nhắc hạn hợp đồng cầm cố #${entityId}`;
      const body = renderPawnNoticeEmail({
        contractId: entityId,
        title: subject,
        subtitle: `Hợp đồng cầm cố #${entityId} sắp đến hạn đối chiếu (${days}).`,
        details: [
          { label: 'Mã hợp đồng', value: `#${entityId}`, isHighlight: true },
          { label: 'Thời hạn còn lại', value: days, isHighlight: true },
          { label: 'Ngày đến hạn', value: dueAtStr },
        ],
        message: 'Hợp đồng cầm cố mô hình của bạn sắp đến ngày đáo hạn. Bạn vui lòng liên hệ showroom hoặc đăng nhập tài khoản để làm thủ tục chuộc tài sản hoặc đề xuất gia hạn.',
        actionUrl: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
        note: 'Chính sách Model Universe cam kết bảo lưu và niêm phong tài sản an toàn, không tự ý thanh lý hoặc xử phạt tài sản khi chưa đối chiếu.',
      });
      return { subject, body };
    }
    if (kind === 'pawn_overdue') {
      const stage = details?.stage === 'DUE_GRACE' ? 'Thời gian ân hạn (DUE_GRACE)' : 'Đối soát quá hạn (OVERDUE_REVIEW)';
      const subject = `Thông báo đối chiếu hợp đồng cầm cố #${entityId}`;
      const body = renderPawnNoticeEmail({
        contractId: entityId,
        title: subject,
        subtitle: `Hợp đồng cầm cố #${entityId} chuyển sang giai đoạn đối chiếu.`,
        statusText: stage,
        details: [
          { label: 'Mã hợp đồng', value: `#${entityId}`, isHighlight: true },
          { label: 'Giai đoạn xử lý', value: stage, isHighlight: true },
        ],
        message: 'Hợp đồng cầm cố của bạn đã đến hạn thanh toán và đang ở bước đối soát hỗ trợ. Đội ngũ quản lý hợp đồng của Model Universe sẽ phối hợp giải quyết cùng bạn. Shop cam kết tuyệt đối không tự động thanh lý tài sản.',
        actionUrl: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
      });
      return { subject, body };
    }
    const subject = `Hồ sơ cầm cố #${entityId} có cập nhật`;
    const body = renderPawnNoticeEmail({
      contractId: entityId,
      title: subject,
      message: 'Hồ sơ cầm cố của bạn vừa có cập nhật mới từ Model Universe. Bạn vui lòng đăng nhập vào tài khoản để xem chi tiết thông tin và thực hiện các bước tiếp theo.',
      details: [
        { label: 'Mã hợp đồng', value: `#${entityId}`, isHighlight: true },
        ...(details?.status ? [{ label: 'Trạng thái', value: String(details.status) }] : []),
        ...(details?.stage ? [{ label: 'Tiến trình', value: String(details.stage) }] : []),
      ],
      actionUrl: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
      note: 'Hồ sơ cầm cố tuân thủ chính sách bảo mật tài sản tuyệt đối theo quy chuẩn Model Universe. Cần hỗ trợ khẩn cấp, vui lòng liên hệ hotline 0373498729.',
    });
    return { subject, body };
  }

  // 2. Reservations / Order holds
  if (kind.startsWith('reservation')) {
    if (kind === 'reservation_deadline') {
      const hours = details?.hours ? `${details.hours} giờ` : 'sắp hết hạn';
      const subject = `Sắp đến hạn nhận mô hình đang giữ #${entityId}`;
      const body = renderReservationNoticeEmail({
        reservationId: entityId,
        title: subject,
        subtitle: `Thời gian bảo lưu mô hình #${entityId} còn lại ${hours}.`,
        details: [
          { label: 'Mã đơn giữ hàng', value: `#${entityId}`, isHighlight: true },
          { label: 'Thời gian còn lại', value: hours, isHighlight: true },
        ],
        message: 'Suất giữ hàng mô hình của bạn sắp kết thúc thời hạn bảo lưu cọc. Vui lòng hoàn tất thanh toán phần còn lại để showroom tiến hành bàn giao hoặc giao hàng cho bạn.',
        actionUrl: `${shopPublicUrl()}/vi/reservations`,
      });
      return { subject, body };
    }
    const subject = `Đơn giữ hàng #${entityId} có cập nhật`;
    const body = renderReservationNoticeEmail({
      reservationId: entityId,
      title: subject,
      message: 'Đơn giữ hàng của bạn vừa có cập nhật mới từ Model Universe. Vui lòng kiểm tra thông tin và thời hạn hoàn tất.',
      details: [
        { label: 'Mã đơn giữ hàng', value: `#${entityId}`, isHighlight: true },
        ...(details?.status ? [{ label: 'Trạng thái', value: String(details.status) }] : []),
      ],
      actionUrl: `${shopPublicUrl()}/vi/reservations`,
    });
    return { subject, body };
  }

  // 3. Loyalty points & rewards
  if (kind === 'loyalty_earned' || kind === 'loyalty_points') {
    const points = Number(details?.points) || 0;
    const reason = String(details?.reason || `Tích luỹ điểm từ giao dịch đơn hàng #${entityId}`);
    const subject = `Bạn vừa nhận được +${points.toLocaleString('vi-VN')} điểm tích luỹ Model Universe!`;
    const body = renderLoyaltyRewardEmail({
      customerName,
      points,
      reason,
      orderId: entityId,
      actionUrl: `${shopPublicUrl()}/vi/user-profile?section=loyalty`,
    });
    return { subject, body };
  }

  if (kind === 'review_reward') {
    const points = Number(details?.points) || 50;
    const subject = `Thưởng +${points} điểm đánh giá sản phẩm thành công!`;
    const body = renderLoyaltyRewardEmail({
      customerName,
      points,
      reason: 'Đánh giá sản phẩm Gunpla/Mecha thực tế kèm ảnh/video được duyệt',
      actionUrl: `${shopPublicUrl()}/vi/user-profile?section=loyalty`,
    });
    return { subject, body };
  }

  if (kind === 'profile_completed') {
    const points = Number(details?.points) || 20;
    const subject = `Thưởng +${points} điểm hoàn thiện hồ sơ thành viên!`;
    const body = renderLoyaltyRewardEmail({
      customerName,
      points,
      reason: 'Hoàn thiện hồ sơ cá nhân và người sưu tầm tại Model Universe',
      actionUrl: `${shopPublicUrl()}/vi/user-profile?section=profile`,
    });
    return { subject, body };
  }

  // 4. Voucher expiry
  if (kind === 'voucher_expiry' || kind === 'voucher_expiring') {
    const code = String(details?.code || `#${entityId}`);
    const desc = String(details?.description || 'Ưu đãi dành riêng cho thành viên');
    const expireAt = details?.expiresAt ? new Date(String(details.expiresAt)).toLocaleString('vi-VN') : 'Sắp đến hạn';
    const subject = `Mã ưu đãi ${code} của bạn sắp hết hạn!`;
    const body = renderVoucherNoticeEmail({
      customerName,
      code,
      description: desc,
      expireAt,
      actionUrl: `${shopPublicUrl()}/vi/shop`,
    });
    return { subject, body };
  }

  // 5. Restock alert
  if (kind === 'restock') {
    const productName = String(details?.productName || `Mô hình #${entityId}`);
    const stock = Number(details?.observedStock) || 1;
    const subject = `Sản phẩm "${productName}" đã có hàng trở lại tại Model Universe!`;
    const body = renderRestockAlertEmail({
      productName,
      stock,
      productUrl: `${shopPublicUrl()}/vi/shop`,
    });
    return { subject, body };
  }

  // 6. Generic service notice with clean detail rows
  const subject = titles[kind] || 'Tài khoản của bạn có cập nhật mới';
  const detailRows: ServiceDetailRow[] = [
    { label: 'Mã hồ sơ', value: `#${entityId}`, isHighlight: true },
  ];
  if (details) {
    for (const [k, v] of Object.entries(details)) {
      if (k !== 'eventId' && typeof v !== 'object' && v !== null && v !== undefined && String(v).length < 100) {
        detailRows.push({
          label: k.replace(/([A-Z])/g, ' $1').trim(),
          value: String(v),
        });
      }
    }
  }

  const body = renderServiceNoticeEmail({
    badge: 'Thông báo',
    title: subject,
    subtitle: `Cập nhật thông tin giao dịch liên quan đến hồ sơ #${entityId}.`,
    message: `Model Universe có thông báo mới liên quan đến hồ sơ #${entityId} của bạn. Vui lòng kiểm tra chi tiết bên dưới:`,
    details: detailRows,
    actionButton: {
      text: 'Xem chi tiết trong hộp thư',
      url: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
    },
    note: 'Email này được gửi tự động từ hệ thống Model Universe. Không chia sẻ mật khẩu hoặc mã OTP cho bất kỳ ai.',
  });
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
        const user = await UserModel.findByPk(row.userId, { attributes: ['email', 'isActive', 'firstName', 'lastName'], transaction });
        if (!user?.isActive || !user.email) return;
        if (
          await NotificationDeliveryModel.findOne({
            where: { channel: 'email', sourceType: 'customer_notification', sourceId: row.id },
            transaction,
          })
        )
          return;
        const message = commerceEmail(row.kind, row.entityId, row.details, user);
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
              body: renderAdminAlertEmail({
                title: row.title,
                content: row.content,
                actionUrl: `${shopPublicUrl()}/vi/admin`,
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
