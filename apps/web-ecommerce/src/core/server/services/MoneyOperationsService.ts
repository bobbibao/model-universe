import NotificationDispatchService from './NotificationDispatchService';
import { renderServiceNoticeEmail } from './mail/EmailTemplate';
import { shopPublicUrl } from './marketing/platforms';
/* eslint-disable @typescript-eslint/no-var-requires -- Resolve mutually dependent workflow services only when an operation runs. */
import OrderModel from '../database/client/models/Order.Model';
import OrderPrepaymentModel from '../database/client/models/OrderPrepayment.Model';
import PawnDisposalEntryModel from '../database/client/models/PawnDisposalEntry.Model';
import crypto from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import MoneyOperationModel from '../database/client/models/MoneyOperation.Model';
import ReservationModel from '../database/client/models/Reservation.Model';
import ReservationPaymentModel from '../database/client/models/ReservationPayment.Model';
import ReservationEventModel from '../database/client/models/ReservationEvent.Model';
import PawnContractModel from '../database/client/models/PawnContract.Model';
import PawnPaymentModel from '../database/client/models/PawnPayment.Model';
import PawnEventModel from '../database/client/models/PawnEvent.Model';
import UserModel from '../database/internal/models/User.Model';
import CommerceAccessService from './CommerceAccessService';
import MoneyReferenceService from './MoneyReferenceService';
import HttpError from '../../../shared/server/utils/HttpError';

const text = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000)
    throw HttpError.badRequest('Provide the reason and receiving bank details.');
  return value.trim();
};
const integer = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 2147483647)
    throw HttpError.badRequest('Use positive integer VND.');
  return Number(value);
};
type Purpose = 'hold_refund' | 'pawn_credit_refund' | 'purchase_refund' | 'pawn_disposal_surplus';

export default class MoneyOperationsService {
  async notify(row: MoneyOperationModel, transaction: Transaction) {
    const entity =
      row.purpose === 'purchase_refund'
        ? await OrderModel.findByPk(row.entityId, { transaction })
        : row.purpose === 'hold_refund'
          ? await ReservationModel.findByPk(row.entityId, { transaction })
          : await PawnContractModel.findByPk(row.entityId, { transaction });
    if (!entity?.userId) return;
    const status = (
      {
        requested: 'Đã nhận yêu cầu hoàn tiền',
        approved: 'Đã duyệt, chờ chuyển tiền',
        completed: 'Đã chuyển tiền hoàn thành công',
        rejected: 'Yêu cầu hoàn tiền đã bị từ chối',
        reconciliation: 'Khoản hoàn đang được đối soát',
      } as Record<string, string>
    )[row.status];
    await new NotificationDispatchService().notifyCustomer(
      {
        userId: entity.userId,
        kind: 'refund_update',
        entityId: row.id,
        dedupeKey: `money:${row.id}:${row.status}`,
        details: { status: row.status, amountVnd: Number(row.amountVnd) },
        email: {
          subject: `${status} · #${row.id}`,
          body: renderServiceNoticeEmail({
            badge: 'Hoàn tiền & Đối soát',
            title: `${status} · #${row.id}`,
            subtitle: `Cập nhật trạng thái đối soát và hoàn tiền cho yêu cầu #${row.id}.`,
            message: `Yêu cầu hoàn tiền hoặc đối soát tài chính #${row.id} của bạn hiện có trạng thái mới: <strong>${status}</strong>.`,
            details: [
              { label: 'Mã yêu cầu', value: `#${row.id}`, isHighlight: true },
              { label: 'Trạng thái', value: status },
              { label: 'Số tiền xử lý', value: `${Number(row.amountVnd).toLocaleString('vi-VN')} ₫`, isHighlight: true },
            ],
            actionButton: {
              text: 'Xem chi tiết trong tài khoản',
              url: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
            },
            note: 'Chỉ trạng thái "Đã chuyển tiền hoàn thành công" mới xác nhận giao dịch đã được ngân hàng thực hiện. Nếu có thắc mắc, vui lòng liên hệ hotline 0373498729.',
          }),
        },
      },
      transaction,
    );
  }
  private async liability(purpose: Purpose, entityId: number, transaction: Transaction) {
    if (purpose === 'purchase_refund') {
      const order = await OrderModel.findByPk(entityId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!order || order.status !== 'CANCELLED')
        throw HttpError.conflict('Approve cancellation before reconciling a purchase deposit.');
      const refunded = Number(
        (await OrderPrepaymentModel.sum('amountVnd', { where: { orderId: entityId, kind: 'refund' }, transaction })) ||
          0,
      );
      return { owner: order.userId, balance: Math.max(0, order.prepaidVnd - refunded) };
    }
    if (purpose === 'hold_refund') {
      const row = await ReservationModel.findByPk(entityId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw HttpError.notFound();
      if (row.disputed || (!['cancelled', 'expired'].includes(row.status) && !row.reconciliationRequired))
        throw HttpError.conflict('Resolve the cancellation/payment/dispute before requesting a refund.');
      const entries = await ReservationPaymentModel.findAll({ where: { reservationId: entityId }, transaction });
      const balance =
        entries.reduce(
          (sum, entry) =>
            sum +
            (['receipt', 'unallocated_receipt'].includes(entry.kind)
              ? entry.amountVnd
              : ['refund', 'reversal', 'forfeit'].includes(entry.kind)
                ? -entry.amountVnd
                : 0),
          0,
        ) - row.depositTransferredVnd;
      return { owner: row.userId, balance: Math.max(0, balance) };
    }
    const row = await PawnContractModel.findByPk(entityId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw HttpError.notFound();
    if (purpose === 'pawn_disposal_surplus') {
      if (
        row.terms?.policy.legalMode !== 'approved' ||
        !row.terms.policy.legalApprovedBy ||
        !row.terms.policy.legalReference ||
        !row.governance.titleTransfer
      )
        throw HttpError.conflict('LEGAL_REVIEW_REQUIRED: complete legal review and title transfer.');
      if (row.status !== 'disposed' || row.governance.disputed || row.disposalStatement)
        throw HttpError.conflict('Reconcile the signed disposal first.');
      const { default: PawnDisposalService } =
        require('./PawnDisposalService') as typeof import('./PawnDisposalService');
      const summary = await new PawnDisposalService().summary(row);
      if (!summary || summary.reconciliationRequired) throw HttpError.conflict('Reconcile source proceeds first.');
      return { owner: row.userId, balance: summary.surplusVnd };
    }
    if (!row.paidAt || !['repaid', 'returned'].includes(row.status) || row.governance.disputed)
      throw HttpError.conflict('Reconcile redemption before refunding excess interest credit.');
    const entries = await PawnPaymentModel.findAll({ where: { pawnContractId: entityId }, transaction });
    const balance = entries.reduce(
      (sum, entry) =>
        sum +
        (entry.kind === 'extension_credit'
          ? Number(entry.amountVnd)
          : entry.kind === 'credit_refund'
            ? -Number(entry.amountVnd)
            : -Number(entry.creditAppliedVnd || 0)),
      0,
    );
    return { owner: row.userId, balance: Math.max(0, balance) };
  }
  async request(purpose: Purpose, entityId: number, actorId: number, data: Record<string, unknown>) {
    const amountVnd = integer(data.amountVnd),
      requestKey = text(data.requestKey),
      reason = text(data.reason);
    if (requestKey.length > 128 || !Number.isSafeInteger(entityId) || entityId < 1)
      throw HttpError.badRequest('Invalid refund request key or entity.');
    const account = { bank: text(data.bankName), number: text(data.accountNumber), holder: text(data.accountHolder) };
    const accountHash = crypto.createHash('sha256').update(JSON.stringify(account)).digest('hex');
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify({ purpose, entityId, amountVnd, accountHash, reason }))
      .digest('hex');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      const replay = await MoneyOperationModel.findOne({ where: { requestKey }, transaction });
      if (replay) {
        if (replay.requestDigest !== digest || replay.requestedBy !== actorId)
          throw HttpError.conflict('Refund key already used.');
        return replay;
      }
      const { owner, balance } = await this.liability(purpose, entityId, transaction);
      if (purpose === 'pawn_disposal_surplus') {
        const entries = await PawnDisposalEntryModel.findAll({
          where: { pawnContractId: entityId },
          order: [['id', 'DESC']],
          transaction,
        });
        const accepted = entries.find((entry) => entry.statement?.payoutAccount)?.statement?.payoutAccount;
        if (
          !accepted ||
          account.bank !== accepted.bankName ||
          account.number !== accepted.accountNumber ||
          account.holder !== accepted.holderName
        )
          throw HttpError.conflict('Use the account approved in the signed customer statement.');
      }
      const actor = await UserModel.findByPk(actorId, { transaction });
      if (!actor?.isActive || (actorId !== owner && actor.role !== 'ADMIN')) throw HttpError.forbidden();
      const existing = await MoneyOperationModel.findOne({ where: { requestKey }, transaction });
      if (existing) {
        if (existing.requestDigest !== digest || existing.requestedBy !== actorId)
          throw HttpError.conflict('Refund key already used.');
        return existing;
      }
      const reserved = Number(
        (await MoneyOperationModel.sum('amountVnd', {
          where: { purpose, entityId, status: ['requested', 'approved'] },
          transaction,
        })) || 0,
      );
      if ((purpose === 'purchase_refund' && amountVnd !== balance - reserved) || amountVnd > balance - reserved)
        throw HttpError.conflict('Refund exceeds the unallocated liability after pending requests.');
      const created = await MoneyOperationModel.create(
        {
          purpose,
          entityId,
          amountVnd,
          requestKey,
          requestDigest: digest,
          requestedBy: actorId,
          details: {
            reason,
            account,
            accountHash,
            history: [{ action: 'requested', by: actorId, at: new Date().toISOString() }],
          },
        },
        { transaction },
      );
      await this.notify(created, transaction);
      return created;
    });
  }
  async validatePayout(row: MoneyOperationModel, transaction: Transaction) {
    const { balance } = await this.liability(row.purpose, row.entityId, transaction);
    const pending = Number(
      (await MoneyOperationModel.sum('amountVnd', {
        where: { purpose: row.purpose, entityId: row.entityId, status: ['approved', 'requested'] },
        transaction,
      })) || 0,
    );
    if (pending > balance) throw HttpError.conflict('Khoản phải hoàn đã thay đổi. Đối soát trước khi gửi tiền.');
  }
  async list(actorId: number) {
    await CommerceAccessService.require(actorId, 'finance');
    return {
      payosPayoutConfigured: ['CLIENT_ID', 'API_KEY', 'CHECKSUM_KEY'].every(
        (k) => !!process.env[`PAYOS_PAYOUT_${k}`]?.trim(),
      ),
      bankConfirmationConfigured: Number(process.env.BANK_EVENT_SIGNING_SECRET?.length || 0) >= 32,
      operations: await MoneyOperationModel.findAll({ order: [['id', 'DESC']], limit: 100 }),
    };
  }
  async decide(id: number, actorId: number, data: Record<string, unknown>) {
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await CommerceAccessService.require(actorId, 'finance', transaction);
      const row = await MoneyOperationModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw HttpError.notFound();
      if (row.version !== data.expectedVersion || row.status !== 'requested' || typeof data.approved !== 'boolean')
        throw HttpError.conflict('Review the latest refund request.');
      if (row.requestedBy === actorId)
        throw HttpError.forbidden('Another authorized reviewer must approve the refund.');
      const reason = text(data.reason);
      await row.update(
        {
          status: data.approved ? 'approved' : 'rejected',
          approvedBy: actorId,
          version: row.version + 1,
          details: {
            ...row.details,
            history: [
              ...row.details.history,
              { action: data.approved ? 'approved' : 'rejected', by: actorId, reason, at: new Date().toISOString() },
            ],
          },
        },
        { transaction },
      );
      await this.notify(row, transaction);
      return row;
    });
  }
  // A configured bank adapter must sign this exact envelope after the provider has confirmed the actual payout.
  // No browser flag, uploaded screenshot, approval or return URL marks a refund complete.
  async bankConfirmation(body: Record<string, unknown>, signature: string) {
    const secret = process.env.BANK_EVENT_SIGNING_SECRET;
    if (!secret || secret.length < 32)
      throw HttpError.serviceUnavailable('Bank confirmation adapter is not configured.');
    const envelope = {
      operationId: body.operationId,
      amountVnd: body.amountVnd,
      reference: body.reference,
      status: body.status,
      accountHash: body.accountHash,
      timestamp: body.timestamp,
      nonce: body.nonce,
    };
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(envelope)).digest();
    const received = /^[a-f0-9]{64}$/i.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected) ||
      !Number.isSafeInteger(body.timestamp) ||
      Math.abs(Date.now() - Number(body.timestamp) * 1000) > 300000
    )
      throw HttpError.unauthorized('Invalid bank signature or timestamp.');
    return this.recordProviderConfirmation(body, 'bank_signature');
  }
  // Internal trusted adapters only. HTTP routes must first verify their provider signature.
  async recordProviderConfirmation(body: Record<string, unknown>, verifiedBy: 'bank_signature' | 'payos_signed_api') {
    const reference = text(body.reference).toUpperCase(),
      nonce = text(body.nonce),
      amountVnd = integer(body.amountVnd);
    if (!/^[A-Z0-9:_./-]{8,128}$/.test(reference) || nonce.length > 128)
      throw HttpError.badRequest('Invalid provider reference.');
    const initial = await MoneyOperationModel.findByPk(Number(body.operationId));
    if (!initial) throw HttpError.notFound();
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await MoneyReferenceService.lock(
        reference,
        initial.purpose === 'hold_refund'
          ? 'reservation_payment'
          : initial.purpose === 'purchase_refund'
            ? 'order_prepayment'
            : initial.purpose === 'pawn_disposal_surplus'
              ? 'pawn_disposal_entry'
              : 'pawn_payment',
        transaction,
      );
      // Lock the business aggregate without re-running request eligibility: a confirmed
      // payout must remain recordable if a dispute or reversal arrived meanwhile.
      const entity =
        initial.purpose === 'hold_refund'
          ? ReservationModel
          : initial.purpose === 'purchase_refund'
            ? OrderModel
            : PawnContractModel;
      await (entity as typeof ReservationModel).findByPk(initial.entityId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const row = await MoneyOperationModel.findByPk(initial.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw HttpError.notFound();
      if (row.status === 'completed') {
        if (
          row.providerReference !== reference ||
          Number(row.amountVnd) !== amountVnd ||
          row.details.accountHash !== body.accountHash
        )
          throw HttpError.conflict('Provider transaction replay mismatch.');
        return { recorded: true, replay: true };
      }
      if (
        row.status !== 'approved' ||
        Number(row.amountVnd) !== amountVnd ||
        body.status !== 'SUCCEEDED' ||
        body.accountHash !== row.details.accountHash
      )
        throw HttpError.conflict('Provider confirmation does not match the approved payout.');
      if (
        await MoneyOperationModel.findOne({
          where: { [Op.or]: [{ providerReference: reference }, { providerEventKey: nonce }] },
          transaction,
        })
      )
        throw HttpError.conflict('Provider transaction/event already allocated.');
      if (row.purpose === 'hold_refund') {
        await ReservationPaymentModel.create(
          {
            reservationId: row.entityId,
            confirmedByUserId: row.approvedBy,
            amountVnd,
            externalReference: reference,
            kind: 'refund',
            reason: row.details.reason,
            metadata: { operationId: row.id, verifiedBy },
          },
          { transaction },
        );
        await ReservationEventModel.create(
          {
            reservationId: row.entityId,
            actorUserId: row.approvedBy,
            action: 'refund_provider_confirmed',
            reason: row.details.reason,
            details: { operationId: row.id, reference, amountVnd },
          },
          { transaction },
        );
      } else if (row.purpose === 'purchase_refund') {
        await OrderPrepaymentModel.create(
          {
            orderId: row.entityId,
            actorUserId: row.approvedBy,
            kind: 'refund',
            amountVnd,
            externalReference: reference,
            reason: row.details.reason,
          },
          { transaction },
        );
        await OrderModel.update({ paymentStatus: 'REFUNDED' }, { where: { id: row.entityId }, transaction });
      } else if (row.purpose === 'pawn_disposal_surplus') {
        await PawnDisposalEntryModel.create(
          {
            pawnContractId: row.entityId,
            actorUserId: row.approvedBy,
            kind: 'surplus',
            amountVnd,
            costsVnd: 0,
            externalReference: reference,
            reason: row.details.reason,
          },
          { transaction },
        );
        await PawnEventModel.create(
          {
            pawnContractId: row.entityId,
            actorUserId: row.approvedBy,
            action: 'surplus_provider_confirmed',
            details: { operationId: row.id, reference, amountVnd },
          },
          { transaction },
        );
      } else {
        await PawnPaymentModel.create(
          {
            pawnContractId: row.entityId,
            actorUserId: row.approvedBy,
            kind: 'credit_refund',
            amountVnd,
            principalVnd: 0,
            interestVnd: 0,
            externalReference: reference,
            reason: row.details.reason,
            metadata: { operationId: row.id, verifiedBy },
          },
          { transaction },
        );
        await PawnEventModel.create(
          {
            pawnContractId: row.entityId,
            actorUserId: row.approvedBy,
            action: 'credit_refund_confirmed',
            details: { operationId: row.id, reference, amountVnd },
          },
          { transaction },
        );
      }
      await row.update(
        {
          status: 'completed',
          providerReference: reference,
          providerEventKey: nonce,
          completedAt: new Date(),
          version: row.version + 1,
          details: {
            ...row.details,
            history: [
              ...row.details.history,
              { action: 'provider_confirmed', reference, at: new Date().toISOString() },
            ],
          },
        },
        { transaction },
      );
      await this.notify(row, transaction);
      return { recorded: true };
    });
  }
}
