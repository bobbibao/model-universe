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
import OrderPaymentLinkModel from '../database/client/models/OrderPaymentLink.Model';
import PaymentSourceModel from '../database/client/models/PaymentSource.Model';
import {
  REFUND_TO_SOURCE_POLICY,
  autoApproves,
  maskAccount,
  resolveSource,
  shopDayStart,
  type SourceAccount,
  type SourceResolution,
} from '../../../shared/refund-to-source';
import { transferMemo } from '../../../shared/payment';
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
// Kill switch: REFUND_TO_SOURCE_AUTO=off sends nothing automatically; every refund to source then waits for review.
export const automaticRefundsOn = () => process.env.REFUND_TO_SOURCE_AUTO?.trim().toLowerCase() !== 'off';
export const payoutConfigured = () =>
  ['CLIENT_ID', 'API_KEY', 'CHECKSUM_KEY'].every((k) => !!process.env[`PAYOS_PAYOUT_${k}`]?.trim());
// Whether a refund of this amount is sent without a reviewer when it is created now: the switch is on, the payout
// channel exists and the amount is within the per-refund limit. The daily allowance is decided when it is created.
export const sendsAutomatically = (refundVnd: number, payoutReady = payoutConfigured()) =>
  automaticRefundsOn() && payoutReady && autoApproves(refundVnd, 0);
// Keys the server derives from public ids (`refund-to-source:<purpose>:<entity>:<n>`); a client may not claim one.
const SOURCE_KEY_PREFIX = 'refund-to-source:';
// Only these are paid through payOS links, so only they have a signed paying account to refund to.
export type SourcePurpose = 'purchase_refund' | 'hold_refund';
export type SourceSkip =
  | Exclude<SourceResolution, { ok: true }>['reason']
  | 'existing_refund'
  | 'no_customer'
  | 'nothing_owed'
  | 'cancellation_fee';

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
              {
                label: 'Số tiền xử lý',
                value: `${Number(row.amountVnd).toLocaleString('vi-VN')} ₫`,
                isHighlight: true,
              },
              ...(row.details.source
                ? [
                    {
                      label: 'Hoàn về tài khoản',
                      value: `${row.details.source.bankName || 'Ngân hàng'} ${row.details.source.maskedAccount} (tài khoản đã thanh toán)`,
                    },
                  ]
                : []),
            ],
            actionButton: {
              text: 'Xem chi tiết trong tài khoản',
              url: `${shopPublicUrl()}/vi/user-profile?section=inbox`,
            },
            note: 'Chỉ trạng thái "Đã chuyển tiền hoàn thành công" mới xác nhận giao dịch đã được ngân hàng thực hiện. Nếu có thắc mắc, vui lòng liên hệ hotline 0373725104.',
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
    if (
      requestKey.length > 128 ||
      requestKey.toLowerCase().startsWith(SOURCE_KEY_PREFIX) ||
      !Number.isSafeInteger(entityId) ||
      entityId < 1
    )
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
  // The account a refund for this cancelled order or hold would go back to (refund to source), from the payOS-signed
  // payment data. Read-only; used by the refund itself, the admin preview and the cancellation alert.
  async sourceFor(purpose: SourcePurpose, entityId: number, refundVnd: number, transaction?: Transaction) {
    const links = await OrderPaymentLinkModel.findAll({
      where: purpose === 'purchase_refund' ? { orderId: entityId } : { reservationId: entityId },
      attributes: ['id'],
      transaction,
    });
    const rows = links.length
      ? await PaymentSourceModel.findAll({
          where: { linkId: links.map((link) => link.id) },
          order: [['id', 'ASC']],
          transaction,
        })
      : [];
    return resolveSource(
      rows.map((row) => ({
        id: row.id,
        amountVnd: row.amountVnd,
        bankBin: row.bankBin,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        accountName: row.accountName,
      })),
      refundVnd,
    );
  }

  // Whether this cancelled order or hold can be refunded to its source now, and with what: one rule for the refund,
  // its preview and nothing else. Throws (like `liability`) while the entity is not refundable at all.
  private async sourceEligibility(
    purpose: SourcePurpose,
    entityId: number,
    transaction: Transaction,
  ): Promise<
    | { ok: true; owner: number; balance: number; account: SourceAccount }
    | { ok: false; reason: SourceSkip; balance: number }
  > {
    const { owner, balance } = await this.liability(purpose, entityId, transaction);
    if (!owner) return { ok: false, reason: 'no_customer', balance };
    if (balance < 1) return { ok: false, reason: 'nothing_owed', balance: 0 };
    if (purpose === 'purchase_refund') {
      const order = await OrderModel.findByPk(entityId, { transaction });
      // A deduction the shop keeps is a decision for a person, never for the refund to source.
      if (!order || Number(order.cancellationFeeVnd || 0) > 0)
        return { ok: false, reason: 'cancellation_fee', balance };
    }
    const source = await this.sourceFor(purpose, entityId, balance, transaction);
    if (!source.ok) return { ok: false, reason: source.reason, balance };
    return { ok: true, owner, balance, account: source.account };
  }

  // Today's automatic refunds so far (the shop's day), which the daily limit counts.
  private async autoRefundedToday(now: Date, transaction: Transaction) {
    return Number(
      (await MoneyOperationModel.sum('amountVnd', {
        where: {
          createdAt: { [Op.gte]: shopDayStart(now) },
          status: { [Op.ne]: 'rejected' },
          'details.autoApproval.policy': REFUND_TO_SOURCE_POLICY.version,
        },
        transaction,
      })) || 0,
    );
  }

  // Creates the refund of what is still owed on a cancelled order or hold, to the single account that paid it. Within
  // the owner's limits, with the switch on and a payout channel to send it through (`payoutReady`), it is approved by
  // policy (no reviewer) and the caller sends it; otherwise it waits for review. Without `staffId` (the background
  // sweep) it never acts on an entity that already has a refund record, since a person decided that one; staff may
  // ask again after a rejected or failed refund.
  async refundToSource(
    purpose: SourcePurpose,
    entityId: number,
    options: { staffId?: number; now?: Date; payoutReady?: boolean } = {},
  ): Promise<{ operation?: MoneyOperationModel; auto: boolean; reason?: SourceSkip }> {
    const now = options.now ?? new Date();
    const payoutReady = options.payoutReady ?? payoutConfigured();
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      if (options.staffId !== undefined) await CommerceAccessService.require(options.staffId, 'finance', transaction);
      // One refund-to-source decision at a time: the daily cap is read and used under this lock.
      await DatabaseProvider.getInstance().query(`SELECT pg_advisory_xact_lock(hashtext('refund_to_source'))`, {
        transaction,
      });
      const previous = await MoneyOperationModel.findAll({ where: { purpose, entityId }, transaction });
      if (options.staffId === undefined ? previous.length : previous.some((row) => row.status !== 'rejected'))
        return { auto: false, reason: 'existing_refund' };
      const eligible = await this.sourceEligibility(purpose, entityId, transaction);
      if (!eligible.ok) return { auto: false, reason: eligible.reason };
      const { owner, balance, account: paid } = eligible;
      const autoTodayBeforeVnd = await this.autoRefundedToday(now, transaction);
      const auto = automaticRefundsOn() && payoutReady && autoApproves(balance, autoTodayBeforeVnd);
      const account = {
        bank: paid.bankBin,
        number: paid.accountNumber,
        holder: paid.accountName || 'Chủ tài khoản đã thanh toán',
      };
      const accountHash = crypto.createHash('sha256').update(JSON.stringify(account)).digest('hex');
      const reason =
        purpose === 'purchase_refund'
          ? `Hoàn về tài khoản đã thanh toán đơn ${transferMemo(entityId)} sau khi huỷ`
          : `Hoàn cọc giữ hàng #${entityId} về tài khoản đã thanh toán`;
      const at = now.toISOString();
      const operation = await MoneyOperationModel.create(
        {
          purpose,
          entityId,
          amountVnd: balance,
          requestKey: `${SOURCE_KEY_PREFIX}${purpose}:${entityId}:${previous.length + 1}`,
          requestDigest: crypto
            .createHash('sha256')
            .update(JSON.stringify({ purpose, entityId, amountVnd: balance, accountHash, reason }))
            .digest('hex'),
          // The customer the money belongs to. The staff member who started it is in the history, and may not
          // approve it (`decide`).
          requestedBy: owner,
          status: auto ? 'approved' : 'requested',
          approvedBy: null,
          details: {
            reason,
            account,
            accountHash,
            source: {
              paymentSourceIds: paid.paymentSourceIds,
              bankName: paid.bankName,
              maskedAccount: maskAccount(paid.accountNumber),
              paidVnd: paid.paidVnd,
            },
            ...(auto
              ? {
                  autoApproval: {
                    policy: REFUND_TO_SOURCE_POLICY.version,
                    perRefundCapVnd: REFUND_TO_SOURCE_POLICY.perRefundCapVnd,
                    dailyCapVnd: REFUND_TO_SOURCE_POLICY.dailyCapVnd,
                    autoTodayBeforeVnd,
                    at,
                  },
                }
              : {}),
            history: [
              { action: 'requested_to_source', at, ...(options.staffId ? { by: options.staffId } : {}) },
              ...(auto ? [{ action: 'auto_approved', at, reason: REFUND_TO_SOURCE_POLICY.version }] : []),
            ],
          },
        },
        { transaction },
      );
      await this.notify(operation, transaction);
      return { operation, auto };
    });
  }

  // An automatically approved refund the system will not send after all (the switch went off, or the amount owed
  // changed before it was submitted) goes back to review: it leaves the automatic queue, stops counting against the
  // daily limit, and a person decides it. Never touches a refund that was already submitted to payOS.
  async returnToReview(id: number, reason: string) {
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await MoneyOperationModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row || row.status !== 'approved' || row.approvedBy || !row.details.autoApproval || row.details.payout)
        return null;
      const { autoApproval: _withdrawn, ...details } = row.details;
      await row.update(
        {
          status: 'requested',
          version: row.version + 1,
          details: {
            ...details,
            history: [
              ...row.details.history,
              { action: 'returned_to_review', reason: reason.slice(0, 300), at: new Date().toISOString() },
            ],
          },
        },
        { transaction },
      );
      await new NotificationDispatchService().alertAdmins(
        {
          kind: 'refund_due',
          orderId: row.purpose === 'purchase_refund' ? row.entityId : null,
          dedupeKey: `money:${row.id}:returned-to-review:${row.version}`,
          title: 'MODEL universe – LỆNH HOÀN TỰ ĐỘNG CẦN DUYỆT TAY',
          content: `Lệnh hoàn #${row.id} (${Number(row.amountVnd).toLocaleString('vi-VN')} ₫) không được gửi tự động: ${reason.slice(0, 300)}\nVào Tài chính → Hoàn tiền để duyệt và gửi.`,
        },
        transaction,
      );
      return row;
    });
  }

  // What a refund to source would do now, for the admin panel: the account, the amount and whether it is sent
  // automatically. Finance only; changes nothing. The same eligibility rule as the refund itself.
  async sourcePreview(purpose: SourcePurpose, entityId: number, staffId: number, now = new Date()) {
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await CommerceAccessService.require(staffId, 'finance', transaction);
      const active = await MoneyOperationModel.count({
        where: { purpose, entityId, status: ['requested', 'approved', 'completed', 'reconciliation'] },
        transaction,
      });
      let eligible: Awaited<ReturnType<MoneyOperationsService['sourceEligibility']>>;
      try {
        eligible = await this.sourceEligibility(purpose, entityId, transaction);
      } catch (error) {
        return { ok: false as const, reason: (error as Error).message, amountVnd: 0 };
      }
      if (active) return { ok: false as const, reason: 'existing_refund', amountVnd: eligible.balance };
      if (!eligible.ok) return { ok: false as const, reason: eligible.reason, amountVnd: eligible.balance };
      const autoTodayVnd = await this.autoRefundedToday(now, transaction);
      return {
        ok: true as const,
        amountVnd: eligible.balance,
        bankName: eligible.account.bankName,
        maskedAccount: maskAccount(eligible.account.accountNumber),
        accountName: eligible.account.accountName,
        automatic: automaticRefundsOn() && payoutConfigured() && autoApproves(eligible.balance, autoTodayVnd),
        perRefundCapVnd: REFUND_TO_SOURCE_POLICY.perRefundCapVnd,
        dailyLeftVnd: Math.max(0, REFUND_TO_SOURCE_POLICY.dailyCapVnd - autoTodayVnd),
      };
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
      payosPayoutConfigured: payoutConfigured(),
      bankConfirmationConfigured: Number(process.env.BANK_EVENT_SIGNING_SECRET?.length || 0) >= 32,
      // Whether refunds to source within the owner's limits are sent without a reviewer (REFUND_TO_SOURCE_AUTO).
      automaticRefunds: automaticRefundsOn(),
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
      // Two people: neither the requester nor the staff member who started a refund to source may decide it.
      const startedBy = row.details.history.filter((entry) => entry.action.startsWith('requested')).map((e) => e.by);
      if (row.requestedBy === actorId || startedBy.includes(actorId))
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
            confirmedByUserId: row.approvedBy ?? row.requestedBy,
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
            actorUserId: row.approvedBy ?? row.requestedBy,
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
            actorUserId: row.approvedBy ?? row.requestedBy,
            kind: 'refund',
            amountVnd,
            externalReference: reference,
            reason: row.details.reason,
          },
          { transaction },
        );
        // The refund is the order_prepayment `refund` entry, as when staff record one; paymentStatus has no
        // REFUNDED value (enum PENDING | PAID), and writing one failed the whole confirmation after the money left.
      } else if (row.purpose === 'pawn_disposal_surplus') {
        await PawnDisposalEntryModel.create(
          {
            pawnContractId: row.entityId,
            actorUserId: row.approvedBy ?? row.requestedBy,
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
            actorUserId: row.approvedBy ?? row.requestedBy,
            action: 'surplus_provider_confirmed',
            details: { operationId: row.id, reference, amountVnd },
          },
          { transaction },
        );
      } else {
        await PawnPaymentModel.create(
          {
            pawnContractId: row.entityId,
            actorUserId: row.approvedBy ?? row.requestedBy,
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
            actorUserId: row.approvedBy ?? row.requestedBy,
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
