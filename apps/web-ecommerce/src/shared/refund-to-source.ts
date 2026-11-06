// Refund to source (owner decision 2026-11-06): money the shop owes back after a cancellation goes to the bank account
// that paid it, as payOS reported in its signed payment data. A refund to that account within the automatic limits is
// sent without a reviewer; above them, or without one usable source account, it waits for review as before.
// Owner limits: 2,000,000 VND per refund and 10,000,000 VND per day (Asia/Ho_Chi_Minh) of automatic refunds.

export const REFUND_TO_SOURCE_POLICY = {
  version: 'refund_to_source_v1',
  perRefundCapVnd: 2_000_000,
  dailyCapVnd: 10_000_000,
  timeZone: 'Asia/Ho_Chi_Minh',
} as const;

// One payment as payOS confirmed it: the paying account may be missing (some banks, wallets and cash deposits).
export interface PaymentSourceRow {
  id: number;
  amountVnd: number;
  bankBin: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

export interface SourceAccount {
  bankBin: string;
  bankName: string | null;
  accountNumber: string;
  accountName: string | null;
  paidVnd: number;
  paymentSourceIds: number[];
}

export type SourceResolution =
  | { ok: true; account: SourceAccount }
  | { ok: false; reason: 'no_source' | 'missing_account' | 'several_accounts' | 'paid_less_than_refund' };

const normalized = (value: string | null | undefined) => (value || '').replace(/\s+/g, '');

// The single account a refund can go back to: every payOS payment for the entity names the same Napas member bank
// (6-digit BIN) and account, and that account paid at least the refund. Anything else is a decision for a person.
export const resolveSource = (rows: readonly PaymentSourceRow[], refundVnd: number): SourceResolution => {
  if (!rows.length) return { ok: false, reason: 'no_source' };
  const accounts = new Map<string, SourceAccount>();
  for (const row of rows) {
    const bankBin = normalized(row.bankBin),
      accountNumber = normalized(row.accountNumber);
    if (!/^\d{6}$/.test(bankBin) || !/^\d{4,34}$/.test(accountNumber)) return { ok: false, reason: 'missing_account' };
    const key = `${bankBin}:${accountNumber}`;
    const account = accounts.get(key) ?? {
      bankBin,
      accountNumber,
      bankName: row.bankName,
      accountName: row.accountName,
      paidVnd: 0,
      paymentSourceIds: [],
    };
    account.paidVnd += row.amountVnd;
    account.paymentSourceIds.push(row.id);
    accounts.set(key, account);
  }
  if (accounts.size > 1) return { ok: false, reason: 'several_accounts' };
  const [account] = accounts.values();
  if (account.paidVnd < refundVnd) return { ok: false, reason: 'paid_less_than_refund' };
  return { ok: true, account };
};

// Whether a refund to the source may be sent without a reviewer, given today's automatic refunds so far.
export const autoApproves = (refundVnd: number, autoTodayVnd: number) =>
  refundVnd > 0 &&
  refundVnd <= REFUND_TO_SOURCE_POLICY.perRefundCapVnd &&
  autoTodayVnd + refundVnd <= REFUND_TO_SOURCE_POLICY.dailyCapVnd;

// Start of the current day in the shop's time zone (UTC+7, no daylight saving), as an instant.
export const shopDayStart = (now = new Date()) => {
  const offsetMs = 7 * 3_600_000;
  const local = new Date(now.getTime() + offsetMs);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs);
};

export const maskAccount = (accountNumber: string) =>
  accountNumber.length <= 4 ? accountNumber : `••••${accountNumber.slice(-4)}`;

export const SOURCE_REASON_TEXT: Record<Exclude<SourceResolution, { ok: true }>['reason'], string> = {
  no_source: 'Không có giao dịch payOS nào cho khoản này (chuyển khoản tay hoặc tiền mặt).',
  missing_account: 'payOS không trả về đủ mã ngân hàng và số tài khoản người chuyển.',
  several_accounts: 'Khoản này được trả từ nhiều tài khoản khác nhau.',
  paid_less_than_refund: 'Tài khoản nguồn đã trả ít hơn số tiền cần hoàn (có phần trả bằng cách khác).',
};
