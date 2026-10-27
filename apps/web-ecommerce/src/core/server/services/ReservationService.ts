import NotificationDispatchService from './NotificationDispatchService';
import MoneyOperationsService from './MoneyOperationsService';
import { effectiveItemType } from '../../../shared/condition-tree';
import { Op, Transaction, UniqueConstraintError, col, fn, where } from 'sequelize';
import ReservationModel from '../database/client/models/Reservation.Model';
import ReservationPaymentModel from '../database/client/models/ReservationPayment.Model';
import ReservationEventModel from '../database/client/models/ReservationEvent.Model';
import CouponModel from '../database/client/models/Coupon.Model';
import OrderPaymentLinkModel from '../database/client/models/OrderPaymentLink.Model';
import PromotionService from './PromotionService';
import CommerceAccessService from './CommerceAccessService';
import MoneyOperationModel from '../database/client/models/MoneyOperation.Model';
import ProductModel, { isSellable } from '../database/client/models/Product.Model';
import OrderModel from '../database/client/models/Order.Model';
import OrderItemModel from '../database/client/models/OrderItem.Model';
import UserModel from '../database/internal/models/User.Model';
import DatabaseProvider from '../database/Database.Provider';
import CartService from './CartService';
import OrderService from './OrderService';
import CommercePolicyService from './CommercePolicyService';
import EvidenceService from './EvidenceService';
import MoneyReferenceService from './MoneyReferenceService';
import CommerceNotificationModel from '../database/client/models/CommerceNotification.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import {
  reservationDeadline,
  reservationDays,
  minimumHoldVnd,
  HOLD_RULE_VERSION,
  HOLD_TERMS,
} from '../../../shared/reservation';

const integer = (value: unknown, label: string, minimum = 1): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum)
    throw HttpError.badRequest(`Invalid ${label}.`);
  return value;
};
const reference = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_./-]{8,128}$/.test(value))
    throw HttpError.badRequest('An 8–128 character transaction reference is required.');
  return value.trim().toUpperCase();
};
const reason = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000)
    throw HttpError.badRequest('A recorded reason is required.');
  return value.trim();
};
const expired = (row: ReservationModel, now = new Date()): boolean =>
  row.paidVnd < row.totalVnd &&
  !!row.expiresAt &&
  now >= row.expiresAt &&
  ['holding', 'delivery_requested', 'expired', 'cancel_requested'].includes(row.status);

export default class ReservationService {
  private policies = new CommercePolicyService();
  private orders = new OrderService();

  private async admin(actorUserId: number, transaction: Transaction) {
    const actor = await UserModel.findByPk(actorUserId, { transaction });
    if (!actor?.isActive || actor.role !== 'ADMIN') throw HttpError.forbidden();
  }
  private async locked(id: number, transaction: Transaction, userId?: number) {
    integer(id, 'reservation');
    const row = await ReservationModel.findOne({
      where: { id, ...(userId !== undefined ? { userId } : {}) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw HttpError.notFound('Reservation not found.');
    return row;
  }
  private audit(
    row: ReservationModel,
    actorUserId: number,
    action: string,
    note: string,
    transaction: Transaction,
    details: Record<string, unknown> = {},
  ) {
    return ReservationEventModel.create(
      { reservationId: row.id, actorUserId, action, reason: note, details },
      { transaction },
    );
  }
  private view(row: ReservationModel) {
    const view = row.get({ plain: true });
    if (view.benefitSnapshot) delete view.benefitSnapshot.internal;
    return {
      ...view,
      paymentPurpose: 'HOLD_DEPOSIT',
      paymentState:
        row.paidVnd === row.totalVnd ? 'PAID_IN_FULL' : row.inventoryAllocated ? 'HOLD_ACTIVE' : 'NOT_ACTIVATED',
      status: expired(row) ? 'expired' : row.status,
      remainingVnd: row.totalVnd - row.paidVnd,
      minimumInitialVnd: minimumHoldVnd(row.totalVnd),
    };
  }
  async list(userId?: number) {
    const rows = await ReservationModel.findAll({
      where: userId === undefined ? {} : { userId },
      order: [['id', 'DESC']],
      limit: 100,
    });
    return rows.map((row) => this.view(row));
  }
  async detail(id: number, userId?: number) {
    integer(id, 'reservation');
    const row = await ReservationModel.findOne({ where: { id, ...(userId !== undefined ? { userId } : {}) } });
    if (!row) throw HttpError.notFound('Reservation not found.');
    const [payments, events] = await Promise.all([
      ReservationPaymentModel.findAll({ where: { reservationId: id }, order: [['id', 'ASC']] }),
      ReservationEventModel.findAll({ where: { reservationId: id }, order: [['id', 'ASC']] }),
    ]);
    const evidence = await new EvidenceService().list(row.userId, 'reservation_payment', id);
    const refundedVnd = payments
      .filter((payment) => payment.kind === 'refund')
      .reduce((sum, payment) => sum + payment.amountVnd, 0);
    const unallocatedVnd = payments
      .filter((payment) => payment.kind === 'unallocated_receipt')
      .reduce((sum, payment) => sum + payment.amountVnd, 0);
    const operations = await MoneyOperationModel.findAll({
      where: { purpose: 'hold_refund', entityId: id },
      order: [['id', 'DESC']],
    });
    const forfeitedVnd = payments
      .filter((payment) => payment.kind === 'forfeit')
      .reduce((sum, payment) => sum + payment.amountVnd, 0);
    return {
      ...this.view(row),
      payments,
      events,
      evidence,
      operations,
      unallocatedVnd,
      refundedVnd,
      forfeitedVnd,
      unresolvedDepositVnd: ['cancelled', 'expired'].includes(row.status)
        ? Math.max(0, row.paidVnd + unallocatedVnd - row.depositTransferredVnd - refundedVnd - forfeitedVnd)
        : unallocatedVnd,
    };
  }
  async attachEvidence(id: number, userId: number, ids: unknown) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, transaction, userId);
      if (['cancelled', 'completed'].includes(row.status))
        throw HttpError.conflict('This reservation no longer accepts payment evidence.');
      const evidence = await new EvidenceService().bind(ids, userId, 'reservation_payment', id, transaction);
      await this.audit(
        row,
        userId,
        'evidence_submitted',
        'Payment evidence submitted for staff verification; no funds confirmed.',
        transaction,
        { evidence },
      );
    });
    return this.detail(id, userId);
  }
  async notifications(userId: number) {
    return CommerceNotificationModel.findAll({
      where: { userId, kind: 'reservation_deadline' },
      order: [['id', 'DESC']],
      limit: 50,
    });
  }
  async quote(userId: number, data: Record<string, unknown>) {
    const quote = await new CartService().quote(
      [{ productId: integer(data.productId, 'product'), quantity: integer(data.quantity, 'quantity') }],
      { userId, couponCode: data.couponCode, shippingFeeVnd: 0 },
    );
    if (quote.lines.some((line) => line.status !== 'OK')) throw HttpError.conflict('Mẫu không còn đủ tồn khả dụng.');
    if (!Number.isSafeInteger(quote.total) || quote.total < 1 || quote.total > 2147483647)
      throw HttpError.badRequest('Invalid net merchandise amount.');
    const product = await ProductModel.findByPk(Number(data.productId));
    const eligible = !!product?.ownershipVerifiedAt && !product.partnerId && isSellable(product);
    return {
      eligible,
      blockedReason: eligible
        ? null
        : 'Shop chưa mở giữ hàng cho SKU này. Cần hoàn tất xác minh quyền sở hữu trước khi nhận cọc.',
      totalVnd: quote.total,
      merchandiseVnd: quote.subtotal,
      discountVnd: quote.discount,
      minimumInitialVnd: minimumHoldVnd(quote.total),
      ruleVersion: HOLD_RULE_VERSION,
      terms: HOLD_TERMS,
      days: [10, 15, 25, 30, 45],
    };
  }
  private async releaseCoupon(row: ReservationModel, transaction: Transaction) {
    if (!row.couponReserved || !row.couponId) return;
    const coupon = await CouponModel.findByPk(row.couponId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!coupon) throw HttpError.conflict('Coupon escrow needs reconciliation.');
    await coupon.update(
      {
        usageCount: coupon.source === 'loyalty' ? coupon.usageCount : Math.max(0, coupon.usageCount - 1),
        reservedHoldId: coupon.reservedHoldId === row.id ? null : coupon.reservedHoldId,
        budgetUsedVnd: Math.max(0, Number(coupon.budgetUsedVnd || 0) - row.couponBudgetVnd),
      },
      { transaction },
    );
    await row.update({ couponReserved: false }, { transaction });
  }
  async create(userId: number, data: Record<string, unknown>) {
    const productId = integer(data.productId, 'product'),
      quantity = integer(data.quantity, 'quantity');
    if (quantity > 100) throw HttpError.badRequest('Reservation quantity is too large.');
    const key = reference(data.requestKey);
    const couponCode = typeof data.couponCode === 'string' ? data.couponCode.trim().toUpperCase() : '';
    const policy = await this.policies.approved('reservation');
    if (policy.settings.ruleVersion !== HOLD_RULE_VERSION)
      throw HttpError.conflict('Duyệt chính sách giữ hàng mới trước khi nhận yêu cầu.');
    if (data.termsAccepted !== true || data.termsVersion !== HOLD_RULE_VERSION)
      throw HttpError.badRequest('Chấp thuận đúng điều khoản giữ hàng đang hiển thị.');
    const assertReplay = (row: ReservationModel) => {
      if (
        row.productId !== productId ||
        row.quantity !== quantity ||
        (row.benefitSnapshot?.voucher?.couponCode || '') !== couponCode
      )
        throw HttpError.conflict('The request reference belongs to a different reservation.');
      return this.view(row);
    };
    try {
      return await DatabaseProvider.getInstance().transaction(async (transaction) => {
        await DatabaseProvider.getInstance().query('SELECT pg_advisory_xact_lock(836221, hashtext(:key))', {
          replacements: { key: `${userId}:${key}` },
          transaction,
        });
        const existing = await ReservationModel.findOne({ where: { userId, requestKey: key }, transaction });
        if (existing) return assertReplay(existing);
        const { lines, products } = await new CartService().resolveLines([{ productId, quantity }], {
          transaction,
          lock: true,
        });
        const line = lines[0],
          product = products.get(productId) as ProductModel;
        if (line?.status !== 'OK' || !product || product.partnerId || !product.ownershipVerifiedAt)
          throw HttpError.conflict('Chỉ giữ hàng sẵn bán đã được xác minh quyền sở hữu.');
        if (couponCode)
          await CouponModel.findOne({ where: { code: couponCode }, transaction, lock: transaction.LOCK.UPDATE });
        const benefits = await new PromotionService().resolve({
          userId,
          lines,
          products,
          couponCode,
          shippingFeeVnd: 0,
          strict: true,
          transaction,
        });
        const totalVnd = line.lineTotal - benefits.benefits.discountVnd;
        if (!Number.isSafeInteger(totalVnd) || totalVnd < 1 || totalVnd > 2147483647)
          throw HttpError.badRequest('Unsupported net merchandise amount.');
        if (data.expectedTotal !== totalVnd)
          throw HttpError.conflict('The price changed. Review the latest quote.', 'PRICE_CHANGED');
        const coupon = benefits.voucher;
        const row = await ReservationModel.create(
          {
            userId,
            productId,
            quantity,
            productName: product.name,
            imageUrl: product.imageUrl,
            unitPriceVnd: line.product!.salePrice,
            originalMerchandiseVnd: line.lineTotal,
            discountVnd: benefits.benefits.discountVnd,
            totalVnd,
            requestKey: key,
            policyVersion: policy.version,
            ruleVersion: HOLD_RULE_VERSION,
            acceptedTerms: { version: HOLD_RULE_VERSION, text: HOLD_TERMS, acceptedAt: new Date().toISOString() },
            benefitSnapshot: benefits.snapshot,
            couponId: coupon?.id || null,
            couponBudgetVnd: benefits.benefits.voucherDiscountVnd,
            couponReserved: !!coupon,
            modelSnapshot: {
              partnerId: null,
              financeListUnitVnd: product.price,
              sku: product.sku,
              scale: product.scale,
              modelCode: product.modelCode,
              condition: product.condition,
              modelFamilyId: product.modelFamilyId,
              itemTypeKey: effectiveItemType(product),
              conditionNodeIds: product.conditionNodeIds,
              conditionLabels: line.product?.conditionLabels ?? [],
            },
          },
          { transaction },
        );
        if (coupon) {
          if (coupon.source === 'loyalty') await coupon.update({ reservedHoldId: row.id }, { transaction });
          else await coupon.increment('usageCount', { transaction });
          if (coupon.budgetVnd != null)
            await coupon.increment('budgetUsedVnd', { by: row.couponBudgetVnd, transaction });
        }
        await this.audit(
          row,
          userId,
          'requested',
          'Accepted hold terms and net merchandise quote; no stock held before verified payment.',
          transaction,
          { terms: row.acceptedTerms, totalVnd, discountVnd: row.discountVnd },
        );
        return this.view(row);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const replay = await ReservationModel.findOne({ where: { userId, requestKey: key } });
        if (replay) return assertReplay(replay);
      }
      throw error;
    }
  }
  async confirmPayment(id: number, actorUserId: number, data: Record<string, unknown>) {
    await CommerceAccessService.require(actorUserId, 'finance');
    if (
      data.moneyVerified !== true ||
      typeof data.bankEvidenceReference !== 'string' ||
      data.bankEvidenceReference.trim().length < 8
    )
      throw HttpError.badRequest('Đối chiếu giao dịch thực tế với ngân hàng và ghi tham chiếu bằng chứng.');
    return this.recordReceipt(id, actorUserId, data, false);
  }
  // Only called by the signature-verified gateway with a persisted matching payment link, never by a browser return URL.
  async confirmProviderPayment(id: number, data: { amountVnd: number; externalReference: string; linkId: number }) {
    const link = await OrderPaymentLinkModel.findOne({ where: { id: data.linkId, reservationId: id } });
    if (!link) throw HttpError.notFound();
    const row = await ReservationModel.findByPk(id);
    if (!row) throw HttpError.notFound();
    return this.recordReceipt(
      id,
      row.userId,
      { ...data, reason: 'Verified payOS webhook', mismatch: link.amountVnd !== data.amountVnd },
      true,
    );
  }
  private async recordReceipt(id: number, actorUserId: number, data: Record<string, unknown>, provider: boolean) {
    const amountVnd = integer(data.amountVnd, 'confirmed payment'),
      externalReference = reference(data.externalReference),
      note = reason(data.reason);
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      if (!provider) await CommerceAccessService.require(actorUserId, 'finance', transaction);
      await MoneyReferenceService.lock(externalReference, 'reservation_payment', transaction);
      const row = await this.locked(id, transaction);
      const replay = await ReservationPaymentModel.findOne({
        where: where(fn('UPPER', col('externalReference')), externalReference),
        transaction,
      });
      if (replay) {
        if (
          replay.reservationId !== id ||
          replay.amountVnd !== amountVnd ||
          !['receipt', 'unallocated_receipt'].includes(replay.kind)
        )
          throw HttpError.conflict('Payment reference already used.');
        return;
      }
      const paidVnd = row.paidVnd + amountVnd;
      let invalid =
        row.ruleVersion !== HOLD_RULE_VERSION ||
        row.disputed ||
        row.paymentReversed ||
        row.reconciliationRequired ||
        data.mismatch === true ||
        !['awaiting_payment', 'holding', 'delivery_requested'].includes(row.status) ||
        expired(row) ||
        paidVnd > row.totalVnd;
      let allocate = false;
      if (!invalid && !row.inventoryAllocated && paidVnd >= minimumHoldVnd(row.totalVnd)) {
        const product = await ProductModel.findByPk(row.productId, { transaction, lock: transaction.LOCK.UPDATE });
        if (
          !product ||
          product.partnerId ||
          !isSellable(product) ||
          !product.ownershipVerifiedAt ||
          product.stock < row.quantity
        )
          invalid = true;
        else {
          await product.update({ stock: product.stock - row.quantity }, { transaction });
          allocate = true;
        }
      }
      await ReservationPaymentModel.create(
        {
          reservationId: id,
          confirmedByUserId: actorUserId,
          amountVnd,
          externalReference,
          reason: note,
          kind: invalid ? 'unallocated_receipt' : 'receipt',
          metadata: {
            verifiedBy: provider ? 'payos_signature' : 'finance_bank_review',
            bankEvidenceReference: data.bankEvidenceReference,
            linkId: data.linkId,
          },
        },
        { transaction },
      );
      if (invalid) {
        await row.update({ reconciliationRequired: true }, { transaction });
        await new NotificationDispatchService().alertAdmins(
          {
            kind: 'payment_problem',
            orderId: null,
            dedupeKey: `hold:${id}:unallocated:${externalReference}`,
            title: `Cọc giữ hàng #${id} cần đối soát`,
            content: `${amountVnd} VND đã nhận nhưng chưa phân bổ. Không tự kích hoạt giữ hàng.`,
          },
          transaction,
        );
        await this.audit(
          row,
          actorUserId,
          'unallocated_payment',
          'Money recorded for reconciliation; hold and inventory were not activated.',
          transaction,
          { amountVnd, externalReference },
        );
      } else {
        const now = new Date(),
          startedAt = row.startedAt || (allocate ? now : null);
        const holding = row.inventoryAllocated || allocate;
        const expiresAt =
          paidVnd === row.totalVnd
            ? null
            : holding && startedAt
              ? reservationDeadline(startedAt, row.totalVnd, paidVnd, row.extensionDays)
              : null;
        await row.update(
          {
            paidVnd,
            startedAt,
            expiresAt,
            inventoryAllocated: holding,
            status:
              paidVnd === row.totalVnd
                ? 'PAID_IN_FULL'
                : row.status === 'delivery_requested'
                  ? 'delivery_requested'
                  : holding
                    ? 'holding'
                    : 'awaiting_payment',
          },
          { transaction },
        );
        await this.audit(row, actorUserId, 'payment_confirmed', note, transaction, {
          amountVnd,
          externalReference,
          activatedAt: startedAt,
          expiresAt,
          days: reservationDays(row.totalVnd, paidVnd),
        });
      }
      if (provider)
        await OrderPaymentLinkModel.update(
          { status: invalid ? 'RECONCILIATION' : 'PAID', reference: externalReference, paidAt: new Date() },
          { where: { id: data.linkId, reservationId: id }, transaction },
        );
    });
    return this.detail(id);
  }
  async requestDelivery(id: number, userId: number, data: Record<string, unknown>) {
    const deliveryMethod = data.deliveryMethod;
    if (!['delivery', 'pickup'].includes(String(deliveryMethod)))
      throw HttpError.badRequest('Choose delivery or pickup.');
    // Pickup still records verified recipient contact; store address is not invented as a shipping destination.
    const shipping = this.orders.validateShipping((data.shipping as Record<string, unknown>) || {});
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, transaction, userId);
      if (row.disputed || row.paymentReversed || row.reconciliationRequired || !row.inventoryAllocated)
        throw HttpError.conflict('Resolve the payment, stock or ownership review first.');
      if (!['holding', 'fully_paid', 'PAID_IN_FULL', 'delivery_requested'].includes(row.status) || expired(row))
        throw HttpError.conflict('Delivery can only be requested during an active hold or after full payment.');
      await row.update({ status: 'delivery_requested', shipping, deliveryMethod }, { transaction });
      await this.audit(
        row,
        userId,
        'delivery_requested',
        'Customer requested fulfillment; COD is limited to the unpaid balance.',
        transaction,
        { deliveryMethod, remainingVnd: row.totalVnd - row.paidVnd },
      );
    });
    return this.detail(id, userId);
  }
  async cancelDeliveryRequest(id: number, userId: number) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, transaction, userId);
      if (row.disputed || row.paymentReversed || row.reconciliationRequired)
        throw HttpError.conflict('Resolve the payment or ownership dispute first.');
      if (row.status !== 'delivery_requested')
        throw HttpError.conflict('No unconfirmed delivery request can be cancelled.');
      const status = row.paidVnd === row.totalVnd ? 'PAID_IN_FULL' : expired(row) ? 'expired' : 'holding';
      await row.update({ status, shipping: null, deliveryMethod: null }, { transaction });
      await this.audit(
        row,
        userId,
        'delivery_request_cancelled',
        'Customer cancelled the unconfirmed fulfillment request.',
        transaction,
      );
    });
    return this.detail(id, userId);
  }
  async confirmDelivery(id: number, actorUserId: number) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const row = await this.locked(id, transaction);
      if (row.orderId) return;
      if (row.disputed || row.paymentReversed || row.reconciliationRequired)
        throw HttpError.conflict('Resolve the dispute or payment reconciliation first.');
      if (row.status !== 'delivery_requested' || expired(row) || !row.inventoryAllocated || !row.shipping)
        throw HttpError.conflict('The delivery request is not eligible for confirmation.');
      const product = await ProductModel.findByPk(row.productId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!product) throw HttpError.notFound('Reserved model not found.');
      const shipping = this.orders.validateShipping(row.shipping);
      const order = await OrderModel.create(
        {
          ...shipping,
          userId: row.userId,
          status: 'PROCESSING',
          paymentMethod: 'COD',
          paymentPlan: row.paidVnd === row.totalVnd ? 'full' : 'deposit',
          upfrontDueVnd: row.paidVnd,
          paymentDueAt: null,
          paymentStatus: row.paidVnd === row.totalVnd ? 'PAID' : 'PENDING',
          requiresCollectionConfirmation: true,
          subtotal: row.originalMerchandiseVnd || row.totalVnd,
          discount: row.discountVnd,
          couponCode: row.benefitSnapshot?.voucher?.couponCode || null,
          benefitSnapshot: row.benefitSnapshot,
          total: row.totalVnd,
          prepaidVnd: row.paidVnd,
          paymentSource: row.paidVnd === row.totalVnd ? 'BANK_TRANSFER' : 'TRANSFER_PLUS_COD',
          note: `${shipping.note || ''}\nReservation #${id}; ${row.deliveryMethod}; COD balance ${row.totalVnd - row.paidVnd} VND.`.trim(),
        },
        { transaction },
      );
      await OrderItemModel.create(
        {
          orderId: order.id,
          productId: row.productId,
          productName: row.productName,
          imageUrl: row.imageUrl,
          quantity: row.quantity,
          unitPrice: row.unitPriceVnd,
          modelSnapshot: row.modelSnapshot,
        },
        { transaction },
      );
      await product.increment('sold', { by: row.quantity, transaction });
      if (row.depositTransferredAt) throw HttpError.conflict('Deposit already transferred to an order.');
      if (row.couponReserved && row.couponId) {
        const coupon = await CouponModel.findByPk(row.couponId, { transaction, lock: transaction.LOCK.UPDATE });
        if (coupon && coupon.reservedHoldId === row.id)
          await coupon.update({ reservedHoldId: null, reservedOrderId: order.id }, { transaction });
      }
      await row.update(
        {
          status: 'fulfilling',
          orderId: order.id,
          depositTransferredAt: new Date(),
          depositTransferredVnd: row.paidVnd,
          couponReserved: false,
        },
        { transaction },
      );
      await this.audit(
        row,
        actorUserId,
        'fulfillment_confirmed',
        'Shop confirmed fulfillment and stopped expiry; stock allocation transferred to order.',
        transaction,
        { orderId: order.id, codDueVnd: row.totalVnd - row.paidVnd },
      );
    });
    return this.detail(id);
  }
  async extend(id: number, actorUserId: number, data: Record<string, unknown>) {
    const days = integer(data.days, 'extension days');
    if (days > 365) throw HttpError.badRequest('Extension exceeds one year.');
    const note = reason(data.reason);
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const row = await this.locked(id, transaction);
      if (
        row.ruleVersion !== HOLD_RULE_VERSION ||
        expired(row) ||
        !row.inventoryAllocated ||
        !row.startedAt ||
        !['holding', 'delivery_requested'].includes(row.status) ||
        row.paidVnd === row.totalVnd
      )
        throw HttpError.conflict('Only unpaid allocated holds can be extended.');
      const extensionDays = row.extensionDays + days;
      const expiresAt = reservationDeadline(row.startedAt, row.totalVnd, row.paidVnd, extensionDays);
      await row.update(
        {
          extensionDays,
          expiresAt,
          status:
            expiresAt < new Date() ? 'expired' : row.status === 'delivery_requested' ? 'delivery_requested' : 'holding',
        },
        { transaction },
      );
      await this.audit(row, actorUserId, 'extended', note, transaction, { days, expiresAt });
    });
    return this.detail(id);
  }
  async cancel(id: number, actorUserId: number, data: Record<string, unknown>, customer = false) {
    const note = reason(data.reason);
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      if (!customer) await this.admin(actorUserId, transaction);
      const row = await this.locked(id, transaction, customer ? actorUserId : undefined);
      if (row.status === 'cancelled') return;
      if (['fulfilling', 'completed'].includes(row.status) || row.orderId)
        throw HttpError.conflict('Manage the linked order before cancelling its reservation.');
      if (customer && row.paidVnd > 0) {
        await row.update({ status: 'cancel_requested' }, { transaction });
        await this.audit(row, actorUserId, 'cancel_requested', note, transaction, {
          depositVnd: row.paidVnd,
          reviewRequired: true,
        });
        return;
      }

      if (row.inventoryAllocated) {
        const product = await ProductModel.findByPk(row.productId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!product) throw HttpError.notFound('Reserved model not found.');
        await product.increment('stock', { by: row.quantity, transaction });
      }
      await this.releaseCoupon(row, transaction);
      await row.update({ status: 'cancelled', inventoryAllocated: false }, { transaction });
      await this.audit(row, actorUserId, 'cancelled', note, transaction, {
        depositVnd: row.paidVnd,
        depositDisposition: 'pending_staff_reconciliation',
      });
    });
    return this.detail(id, customer ? actorUserId : undefined);
  }
  async raiseDispute(id: number, userId: number, data: Record<string, unknown>) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, transaction, userId);
      await row.update({ disputed: true }, { transaction });
      await this.audit(row, userId, 'customer_dispute', reason(data.reason), transaction);
    });
    return this.detail(id, userId);
  }
  async confirmRefund(id: number, actorUserId: number, data: Record<string, unknown>) {
    await new MoneyOperationsService().request('hold_refund', id, actorUserId, data);
    return this.detail(id);
  }
  async confirmForfeit(_id: number, _actorUserId: number, _data: Record<string, unknown>) {
    throw HttpError.conflict('Không tự tịch thu cọc. Dùng hồ sơ tranh chấp và quyết định có căn cứ được duyệt.');
  }
  async review(id: number, actorUserId: number, data: Record<string, unknown>) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      await CommerceAccessService.require(
        actorUserId,
        data.action === 'resolve_dispute' ? 'compliance' : 'finance',
        transaction,
      );
      if (data.action === 'reverse_payment')
        await MoneyReferenceService.lock(reference(data.externalReference), 'reservation_payment', transaction);
      const row = await this.locked(id, transaction);
      const note = reason(data.reason);
      if (data.action === 'dispute') await row.update({ disputed: true }, { transaction });
      else if (data.action === 'resolve_dispute') {
        if (typeof data.legalReference !== 'string' || data.legalReference.length < 8)
          throw HttpError.badRequest('Record the dispute decision reference.');
        await row.update({ disputed: false }, { transaction });
      } else if (data.action === 'reverse_payment') {
        const amountVnd = integer(data.amountVnd, 'verified reversal');
        if (amountVnd > row.paidVnd || data.moneyVerified !== true)
          throw HttpError.badRequest('Verify the actual reversed payment.');
        const externalReference = reference(data.externalReference);
        const replay = await ReservationPaymentModel.findOne({ where: { externalReference }, transaction });
        if (replay) {
          if (replay.reservationId !== id || replay.kind !== 'reversal' || replay.amountVnd !== amountVnd)
            throw HttpError.conflict('Reference reused.');
          return;
        }
        await ReservationPaymentModel.create(
          {
            reservationId: id,
            confirmedByUserId: actorUserId,
            amountVnd,
            externalReference,
            kind: 'reversal',
            reason: note,
          },
          { transaction },
        );
        if (row.inventoryAllocated && !row.orderId) {
          const product = await ProductModel.findByPk(row.productId, { transaction, lock: transaction.LOCK.UPDATE });
          if (!product) throw HttpError.notFound();
          await product.increment('stock', { by: row.quantity, transaction });
        }
        await row.update(
          {
            paidVnd: row.paidVnd - amountVnd,
            paymentReversed: true,
            disputed: true,
            reconciliationRequired: true,
            ...(!row.orderId ? { inventoryAllocated: false, status: 'cancelled' } : {}),
          },
          { transaction },
        );
      } else throw HttpError.badRequest('Choose dispute, resolve_dispute or reverse_payment.');
      await this.audit(row, actorUserId, String(data.action), note, transaction, {
        legalReference: data.legalReference,
      });
    });
    return this.detail(id);
  }
  async expireHolds(now = new Date()) {
    const candidates = await ReservationModel.findAll({
      where: {
        orderId: null,
        inventoryAllocated: true,
        status: ['holding', 'delivery_requested', 'cancel_requested', 'expired'],
        expiresAt: { [Op.lte]: now },
      },
      attributes: ['id'],
    });
    for (const candidate of candidates)
      await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const row = await this.locked(candidate.id, transaction);
        if (
          !row.inventoryAllocated ||
          row.orderId ||
          !row.expiresAt ||
          row.expiresAt > now ||
          row.paidVnd >= row.totalVnd
        )
          return;
        const product = await ProductModel.findByPk(row.productId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!product) throw HttpError.notFound('Expired allocation needs stock reconciliation.');
        await product.increment('stock', { by: row.quantity, transaction });
        await this.releaseCoupon(row, transaction);
        await row.update({ status: 'expired', inventoryAllocated: false }, { transaction });
        await OrderPaymentLinkModel.update(
          { status: 'EXPIRED' },
          { where: { reservationId: row.id, status: ['PENDING', 'PROCESSING'] }, transaction },
        );
        await this.audit(
          row,
          row.userId,
          'hold_expired',
          'Elapsed hold released atomically; deposit remains a liability for review.',
          transaction,
          { actor: 'system', expiredAt: now.toISOString(), depositVnd: row.paidVnd },
        );
      });
  }
  async expiryQueue() {
    const rows = await ReservationModel.findAll({
      where: { status: { [Op.in]: ['holding', 'delivery_requested', 'expired'] }, expiresAt: { [Op.lt]: new Date() } },
      order: [['expiresAt', 'ASC']],
      limit: 100,
    });
    return rows.filter((row) => expired(row)).map((row) => this.view(row));
  }
}
