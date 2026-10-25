import { estimatePawn, pawnC50, simulatePawnOwed } from '../../src/shared/pawn-rules';

// Pawn quotes of the owner's rule of 2026-10-26 (three-prices specification §16 and the sheet "Kiểm thử giá cầm 50%").
describe('pawn quote C50 = ROUND(S × 50%)', () => {
  it.each([
    [100_000, 50_000],
    [200_000, 100_000],
    [500_000, 250_000],
    [500_001, 250_001],
    [1_150_000, 575_000],
  ])('S = %i gives C50 = %i, without the 100,000 buyback minimum or steps', (s, c50) => {
    expect(pawnC50(s)).toBe(c50);
    expect(estimatePawn(s, { approved: true })).toMatchObject({
      amountVnd: c50,
      manualReview: null,
      legalReviewRequired: true,
    });
  });

  it('quotes nothing without an approved S, for S = 0 or for a declared issue', () => {
    expect(estimatePawn(0, { approved: true })).toMatchObject({ amountVnd: null, manualReview: 'no_reference_price' });
    expect(estimatePawn(null)).toMatchObject({ amountVnd: null, manualReview: 'no_reference_price' });
    expect(estimatePawn(1_000_000)).toMatchObject({ amountVnd: null, manualReview: 'reference_not_approved' });
    expect(estimatePawn(1_000_000, { approved: true, issuesDeclared: true }).manualReview).toBe('issues_declared');
  });

  it('simulates 0.3% a day compound interest in whole VND', () => {
    expect(simulatePawnOwed(1_000_000, 0)).toBe(1_000_000);
    expect(simulatePawnOwed(1_000_000, 1)).toBe(1_003_000);
    expect(simulatePawnOwed(1_000_000, 2)).toBe(1_006_009);
    expect(simulatePawnOwed(1_250_000, 30)).toBe(Math.round(1_250_000 * 1.003 ** 30));
  });
});
