import {
  REFUND_TO_SOURCE_POLICY,
  autoApproves,
  maskAccount,
  resolveSource,
  shopDayStart,
  type PaymentSourceRow,
} from '@/shared/refund-to-source';

const row = (id: number, amountVnd: number, extra: Partial<PaymentSourceRow> = {}): PaymentSourceRow => ({
  id,
  amountVnd,
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNumber: '0071000123456',
  accountName: 'NGUYEN VAN KHACH',
  ...extra,
});

describe('refund to source', () => {
  it('refunds to the single account that paid, adding up its payments', () => {
    expect(resolveSource([row(1, 300_000), row(2, 200_000)], 500_000)).toEqual({
      ok: true,
      account: expect.objectContaining({
        bankBin: '970436',
        accountNumber: '0071000123456',
        paidVnd: 500_000,
        paymentSourceIds: [1, 2],
      }),
    });
    // Spaces payOS may keep in an account number do not make a second account.
    expect(resolveSource([row(1, 100_000), row(2, 100_000, { accountNumber: '0071 000 123 456' })], 200_000).ok).toBe(
      true,
    );
  });

  it('leaves every other case to a person', () => {
    expect(resolveSource([], 1)).toEqual({ ok: false, reason: 'no_source' });
    expect(resolveSource([row(1, 100_000, { accountNumber: null })], 100_000)).toEqual({
      ok: false,
      reason: 'missing_account',
    });
    expect(resolveSource([row(1, 100_000, { bankBin: 'VCB' })], 100_000)).toEqual({
      ok: false,
      reason: 'missing_account',
    });
    expect(resolveSource([row(1, 100_000), row(2, 100_000, { accountNumber: '0071000999999' })], 200_000)).toEqual({
      ok: false,
      reason: 'several_accounts',
    });
    // Part of the money came another way (a manual transfer): the source account cannot take the whole refund.
    expect(resolveSource([row(1, 100_000)], 150_000)).toEqual({ ok: false, reason: 'paid_less_than_refund' });
  });

  it('sends automatically only up to 2,000,000 VND per refund and 10,000,000 VND per day', () => {
    expect(REFUND_TO_SOURCE_POLICY).toMatchObject({ perRefundCapVnd: 2_000_000, dailyCapVnd: 10_000_000 });
    expect(autoApproves(2_000_000, 0)).toBe(true);
    expect(autoApproves(2_000_001, 0)).toBe(false);
    expect(autoApproves(2_000_000, 8_000_000)).toBe(true);
    expect(autoApproves(1, 10_000_000)).toBe(false);
    expect(autoApproves(0, 0)).toBe(false);
  });

  it('counts the day in Vietnam time', () => {
    // 2026-11-06 06:30 in Vietnam is 2026-11-05 23:30 UTC; the day started at 2026-11-05 17:00 UTC.
    expect(shopDayStart(new Date('2026-11-05T23:30:00Z')).toISOString()).toBe('2026-11-05T17:00:00.000Z');
    expect(shopDayStart(new Date('2026-11-05T16:59:00Z')).toISOString()).toBe('2026-11-04T17:00:00.000Z');
  });

  it('shows only the last four digits', () => {
    expect(maskAccount('0071000123456')).toBe('••••3456');
    expect(maskAccount('1234')).toBe('1234');
  });
});
