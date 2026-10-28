import {
  pawnCashFlowEstimate,
  pawnExtensionQuote,
  pawnInterest,
  PAWN_DAY_MS,
  type PawnInterestPolicy,
} from '../../src/shared/pawn-rules';
const policy: PawnInterestPolicy = {
  calculation: 'compound_0_3_v2',
  cashFlowClock: 'elapsed_24h_periods',
  legalMode: 'approved',
  approvalType: 'owner_operational',
  dailyRateBasisPoints: 0,
  dayCount: 'completed_days',
  rounding: 'nearest',
  graceDays: 2,
  interestStopEvent: 'verified_repayment',
};
const start = new Date('2026-10-28T00:00:00Z');
describe('interest-free live pawn operating policy', () => {
  it('charges zero after any duration in both statement engines', () => {
    const at = new Date(start.getTime() + 1000 * PAWN_DAY_MS);
    expect(pawnInterest(1000000, policy, start, at).interestVnd).toBe(0);
    expect(pawnCashFlowEstimate(1000000, policy, start, at, []).remainingVnd).toBe(1000000);
  });
  it('uses actual principal repayments without generating phantom interest', () => {
    const at = new Date(start.getTime() + 30 * PAWN_DAY_MS);
    const result = pawnCashFlowEstimate(1000000, policy, start, at, [
      {
        kind: 'redemption',
        amountVnd: 200000,
        principalVnd: 200000,
        interestVnd: 0,
        createdAt: new Date(start.getTime() + 10 * PAWN_DAY_MS),
      },
    ]);
    expect(result.remainingVnd).toBe(800000);
    expect(result.interestVnd).toBe(0);
  });
  it('extends without demanding a nonexistent interest prepayment', () => {
    const quote = pawnExtensionQuote(
      1000000,
      2000000,
      policy,
      start,
      new Date(start.getTime() + 20 * PAWN_DAY_MS),
      new Date(start.getTime() + 40 * PAWN_DAY_MS),
      [],
    );
    expect(quote.creditDueVnd).toBe(0);
    expect(quote.projectedDebtVnd).toBe(1000000);
    expect(quote.eligible).toBe(true);
  });
});
