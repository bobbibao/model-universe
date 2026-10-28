import { PayOS } from '@payos/node';
import type { Payout, PayoutRequest } from '@payos/node/lib/resources/v1/payouts/payouts';
import crypto from 'node:crypto';
import DatabaseProvider from '../database/Database.Provider';
import MoneyOperationModel from '../database/client/models/MoneyOperation.Model';
import CommerceAccessService from './CommerceAccessService';
import MoneyOperationsService from './MoneyOperationsService';
import HttpError from '../../../shared/server/utils/HttpError';

export interface PayoutClient {
  payouts: {
    create(data: PayoutRequest, key: string): Promise<Payout>;
    get(id: string): Promise<Payout>;
    list(filter: { referenceId: string; limit: number }): Promise<{ data: Payout[] }>;
  };
}
export const payoutConfigured = () =>
  ['CLIENT_ID', 'API_KEY', 'CHECKSUM_KEY'].every((k) => !!process.env[`PAYOS_PAYOUT_${k}`]?.trim());
export const requirePayoutSignature = async (response: Response) => {
  if (response.ok) {
    const body = await response.clone().json();
    if (body.code === '00' && !response.headers.get('x-signature'))
      throw new Error('payOS payout response is missing its signature.');
  }
  return response;
};
const client = (): PayoutClient => {
  if (!payoutConfigured())
    throw HttpError.serviceUnavailable(
      'Chưa có bộ khóa payOS Chi hộ. Cấu hình PAYOS_PAYOUT_CLIENT_ID/API_KEY/CHECKSUM_KEY.',
    );
  return new PayOS({
    clientId: process.env.PAYOS_PAYOUT_CLIENT_ID!.trim(),
    apiKey: process.env.PAYOS_PAYOUT_API_KEY!.trim(),
    checksumKey: process.env.PAYOS_PAYOUT_CHECKSUM_KEY!.trim(),
    baseURL: 'https://api-merchant.payos.vn',
    fetch: async (input, init) => requirePayoutSignature(await fetch(input, init)),
    timeout: 20000,
    maxRetries: 0,
  });
};

export const payoutPayload = (
  row: Pick<MoneyOperationModel, 'id' | 'amountVnd' | 'requestDigest' | 'details'>,
): PayoutRequest => {
  const account = row.details.account;
  if (!/^\d{6}$/.test(account.bank) || !/^\d{4,34}$/.test(account.number))
    throw HttpError.badRequest(
      'Hoàn qua payOS cần mã BIN ngân hàng 6 số và số tài khoản hợp lệ. Hồ sơ cũ cần đối soát qua ngân hàng.',
    );
  return {
    referenceId: `MU-RF-${row.id}-${row.requestDigest.slice(0, 16)}`,
    amount: Number(row.amountVnd),
    description: `MU hoan tien ${row.id}`,
    toBin: account.bank,
    toAccountNumber: account.number,
  };
};

// A signed provider response must describe exactly one transfer to the independently approved recipient.
export const verifiedPayout = (payout: Payout, expected: PayoutRequest) => {
  if (payout.referenceId !== expected.referenceId || payout.transactions.length !== 1)
    throw HttpError.conflict('payOS trả về lệnh chi không khớp hồ sơ. Cần đối soát.');
  const tx = payout.transactions[0];
  if (
    tx.referenceId !== expected.referenceId ||
    tx.amount !== expected.amount ||
    tx.toBin !== expected.toBin ||
    tx.toAccountNumber !== expected.toAccountNumber
  )
    throw HttpError.conflict('Số tiền hoặc tài khoản trong kết quả payOS không khớp. Cần đối soát.');
  return tx;
};

export default class PayOSPayoutService {
  constructor(private injected?: PayoutClient) {}

  async reconcilePending() {
    if (!this.injected && !payoutConfigured()) return 0;
    const rows = await MoneyOperationModel.findAll({
      where: { status: 'approved' },
      order: [['updatedAt', 'ASC']],
      limit: 100,
    });
    let checked = 0;
    for (const row of rows) {
      if (!row.details.payout || !row.approvedBy) continue;
      try {
        await this.execute(row.id, row.approvedBy, row.version, false);
        checked++;
      } catch {
        /* Unknown/failed responses stay outstanding for Finance; never send again here. */
      }
    }
    return checked;
  }

  async execute(id: number, actorId: number, expectedVersion: unknown, send = true) {
    const sdk = this.injected || client();
    const approved = await DatabaseProvider.getInstance().transaction(async (transaction) => {
      await CommerceAccessService.require(actorId, 'finance', transaction);
      const row = await MoneyOperationModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw HttpError.notFound();
      if (row.status === 'completed') return row;
      if (row.status !== 'approved' || row.version !== expectedVersion || !row.approvedBy)
        throw HttpError.conflict('Xem lại yêu cầu đã được duyệt trước khi chuyển tiền.');
      const payload = payoutPayload(row);
      if (!row.details.payout?.providerId && send) await new MoneyOperationsService().validatePayout(row, transaction);
      if (row.details.payout?.providerId || !send) return row;
      await row.update(
        {
          version: row.version + 1,
          details: {
            ...row.details,
            payout: { ...row.details.payout, referenceId: payload.referenceId, state: 'SUBMITTING' },
            history: [
              ...row.details.history,
              { action: 'payos_submission_requested', by: actorId, at: new Date().toISOString() },
            ],
          },
        },
        { transaction },
      );
      return row;
    });
    if (approved.status === 'completed') return approved;
    const payload = payoutPayload(approved);
    let result: Payout;
    try {
      if (approved.details.payout?.providerId) result = await sdk.payouts.get(approved.details.payout.providerId);
      else if (!send) {
        const found = (await sdk.payouts.list({ referenceId: payload.referenceId, limit: 2 })).data;
        if (found.length !== 1)
          throw HttpError.conflict('Chưa tìm thấy một lệnh chi duy nhất. Kiểm tra payOS trước khi thử chuyển lại.');
        result = await sdk.payouts.get(found[0].id);
      } else {
        // The stable key and immutable payload survive process crashes, timeouts and concurrent retries.
        const found = (await sdk.payouts.list({ referenceId: payload.referenceId, limit: 2 })).data;
        if (found.length > 1) throw HttpError.conflict('Có nhiều lệnh chi cùng tham chiếu. Cần đối soát.');
        const payout = found[0] || (await sdk.payouts.create(payload, payload.referenceId));
        result = await sdk.payouts.get(payout.id);
      }
      const tx = verifiedPayout(result, payload);
      await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const row = await MoneyOperationModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row || row.status === 'completed') return;
        if (row.status !== 'approved') throw HttpError.conflict('Trạng thái hoàn tiền đã thay đổi.');
        await row.update(
          {
            version: row.version + 1,
            status: ['FAILED', 'CANCELLED'].includes(tx.state) ? 'rejected' : row.status,
            details: {
              ...row.details,
              payout: {
                providerId: result.id,
                referenceId: payload.referenceId,
                transactionId: tx.id,
                state: tx.state,
                checkedAt: new Date().toISOString(),
              },
              history: [
                ...row.details.history,
                { action: `payos_${tx.state.toLowerCase()}`, by: actorId, at: new Date().toISOString() },
              ],
            },
          },
          { transaction },
        );
      });
      if (['FAILED', 'CANCELLED'].includes(tx.state)) {
        await DatabaseProvider.getInstance().transaction(async (transaction) => {
          const failed = await MoneyOperationModel.findByPk(id, { transaction });
          if (failed) await new MoneyOperationsService().notify(failed, transaction);
        });
      }
      if (tx.state === 'SUCCEEDED') {
        const row = await MoneyOperationModel.findByPk(id);
        if (!row) throw HttpError.notFound();
        await new MoneyOperationsService().recordProviderConfirmation(
          {
            operationId: id,
            amountVnd: tx.amount,
            reference: `PAYOS:${tx.id}`.toUpperCase(),
            status: 'SUCCEEDED',
            accountHash: row.details.accountHash,
            nonce: crypto.createHash('sha256').update(`payos:${result.id}:${tx.id}`).digest('hex'),
          },
          'payos_signed_api',
        );
      }
      return MoneyOperationModel.findByPk(id);
    } catch (error) {
      // A timeout is unknown, never a failed/refunded payment. Keep the same operation and idempotency key.
      if (error instanceof HttpError) throw error;
      throw HttpError.serviceUnavailable(
        'payOS chưa xác nhận kết quả. Không tạo yêu cầu hoàn khác; bấm “Kiểm tra payOS” để đối soát lệnh hiện tại.',
      );
    }
  }
}
