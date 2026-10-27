import {
  pawnC50,
  simulatePawnOwed,
  pawnCashFlowEstimate,
  pawnExtensionQuote,
  PAWN_DAY_MS,
  type PawnInterestPolicy,
  type PawnCashFlow,
} from '../../src/shared/pawn-rules';
const policy: PawnInterestPolicy = {
  calculation: 'compound_0_3_v2',
  cashFlowClock: 'elapsed_24h_periods',
  legalMode: 'simulation',
  dailyRateBasisPoints: 30,
  dayCount: 'completed_days',
  rounding: 'nearest',
  graceDays: 2,
  interestStopEvent: 'verified_repayment',
};
const start = new Date('2026-10-01T00:00:00Z'),
  date = (days: number) => new Date(start.getTime() + days * PAWN_DAY_MS);
const credit = (amount: number, day: number): PawnCashFlow => ({
  kind: 'extension_credit',
  amountVnd: amount,
  principalVnd: 0,
  interestVnd: 0,
  createdAt: date(day),
});
describe('compound simulation and confirmed cash-flow periods', () => {
  it('uses exact S with half-up C50', () => {
    expect(pawnC50(500001)).toBe(250001);
    expect(() => pawnC50(NaN)).toThrow();
  });
  it('compounds and caps total interest at original principal', () => {
    expect(simulatePawnOwed(1000000, 2)).toBe(1006009);
    expect(simulatePawnOwed(1000000, 232)).toBe(2000000);
    const x = pawnCashFlowEstimate(1000000, policy, start, date(1000), []);
    expect(x.interestVnd).toBe(1000000);
    expect(x.capped).toBe(true);
  });
  it('does not increase principal or restart accrual when credit is received', () => {
    const a = pawnCashFlowEstimate(1000000, policy, start, date(20), []),
      b = pawnCashFlowEstimate(1000000, policy, start, date(20), [credit(100000, 0.5), credit(10000, 3.2)]);
    expect(b.grossRemainingVnd).toBe(a.grossRemainingVnd);
    expect(b.principalOutstandingVnd).toBe(1000000);
    expect(b.remainingVnd).toBe(1000000);
    expect(b.surplusCreditVnd).toBe(110000 - a.interestVnd);
  });
  it('splits accrual at an intraday repayment rather than applying reduced principal to the whole day', () => {
    const early = pawnCashFlowEstimate(1000000, policy, start, date(0.5), []);
    const flows: PawnCashFlow[] = [
      {
        kind: 'redemption',
        amountVnd: 500000 + early.interestOutstandingVnd,
        principalVnd: 500000,
        interestVnd: early.interestOutstandingVnd,
        createdAt: date(0.5),
      },
    ];
    const result = pawnCashFlowEstimate(1000000, policy, start, date(1), flows);
    expect(result.principalOutstandingVnd).toBe(500000);
    expect(result.interestOutstandingVnd).toBe(749);
    expect(result.interestVnd).toBeGreaterThan(2000);
    expect(result.interestVnd).toBeLessThan(3000);
  });
  it('deducts confirmed credit once and stops after redemption, still accounting for later refunds', () => {
    const flows: PawnCashFlow[] = [
      credit(10000, 0),
      {
        kind: 'redemption',
        amountVnd: 1000000,
        principalVnd: 1000000,
        interestVnd: 3000,
        creditAppliedVnd: 3000,
        createdAt: date(1),
      },
      { kind: 'credit_refund', amountVnd: 7000, principalVnd: 0, interestVnd: 0, createdAt: date(2) },
    ];
    const r = pawnCashFlowEstimate(1000000, policy, start, date(100), flows, date(1));
    expect(r.remainingVnd).toBe(0);
    expect(r.availableCreditVnd).toBe(0);
    expect(r.interestVnd).toBe(3000);
  });
  it('quotes incremental interest for repeated extensions and checks the 80% ceiling before credit', () => {
    const first = pawnExtensionQuote(1000000, 2000000, policy, start, date(10), date(20), []);
    expect(first.creditDueVnd).toBe(simulatePawnOwed(1000000, 20) - simulatePawnOwed(1000000, 10));
    expect(first.eligible).toBe(true);
    const blocked = pawnExtensionQuote(1000000, 1250000, policy, start, date(10), date(20), [credit(500000, 1)]);
    expect(blocked.eligible).toBe(false);
    expect(blocked.ceilingVnd).toBe(1000000);
  });
  it('accrues over reduced principal after a partial disposal receipt, not over original principal', () => {
    const flow: PawnCashFlow = {
      kind: 'disposal_receipt',
      amountVnd: 500000,
      principalVnd: 0,
      interestVnd: 0,
      createdAt: date(1),
    };
    const r = pawnCashFlowEstimate(1000000, policy, start, date(2), [flow]);
    expect(r.principalOutstandingVnd).toBe(500000);
    expect(r.interestOutstandingVnd).toBe(4509);
    expect(r.disposalPrincipalAppliedVnd).toBe(500000);
  });
  it('pays excess credit through a disposal surplus without creating artificial debt', () => {
    const flows: PawnCashFlow[] = [
      credit(10000, 0),
      { kind: 'disposal_receipt', amountVnd: 1000000, principalVnd: 0, interestVnd: 0, createdAt: date(1) },
      { kind: 'disposal_surplus', amountVnd: 7000, principalVnd: 0, interestVnd: 0, createdAt: date(2) },
    ];
    const r = pawnCashFlowEstimate(1000000, policy, start, date(3), flows);
    expect(r.remainingVnd).toBe(0);
    expect(r.availableCreditVnd).toBe(0);
    expect(r.disposalSurplusVnd).toBe(0);
  });
  it('rejects invalid dates and unsafe amounts', () => {
    expect(() => pawnCashFlowEstimate(1, policy, new Date('invalid'), date(1), [])).toThrow();
    expect(() => pawnCashFlowEstimate(1, policy, start, date(1), [credit(-1, 0)])).toThrow();
  });
});
