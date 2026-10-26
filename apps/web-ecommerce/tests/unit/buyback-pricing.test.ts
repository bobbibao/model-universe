import {
  b17,
  buybackMargin,
  buybackRateBps,
  compareInspection,
  countIssues,
  estimateBuyback,
  resaleCandidates,
  tierBuyback,
  type BuybackIssue,
} from '../../src/shared/buyback-pricing';

// Buyback by the shop's margin of the real selling price S (owner rule of 2026-10-26: the workbook's "Giá lời B" and
// H = S − B; docs/business/source/vi/three-prices-specification.md).
const issue = (type: BuybackIssue['type'], quantity: number) => ({ type, quantity });

describe('buyback price = S − margin, margin B = MAX(100,000, ROUND(S × r)), r = 30% / 20% / 17%', () => {
  it.each([
    [200_000, 100_000, 100_000],
    [333_333, 100_000, 233_333],
    [500_000, 150_000, 350_000],
    [500_001, 100_000, 400_001],
    [1_000_000, 200_000, 800_000],
    [1_150_000, 230_000, 920_000],
    [1_150_001, 195_500, 954_501],
    [2_000_000, 340_000, 1_660_000],
    [2_500_000, 425_000, 2_075_000],
    [2_750_000, 467_500, 2_282_500],
    [3_300_000, 561_000, 2_739_000],
    [5_000_000, 850_000, 4_150_000],
  ])('S = %i: margin %i, buyback price %i (the workbook columns J and H)', (s, margin, price) => {
    expect(buybackMargin(s)).toBe(margin);
    expect(tierBuyback(s)).toBe(price);
    expect(estimateBuyback(s, [], { approved: true })).toMatchObject({
      estimateVnd: price,
      manualReview: null,
      ruleVersion: 'buyback-margin-2026-10-26',
      baseDeductionVnd: null,
      issueDeductionVnd: 0,
    });
  });

  it('keeps the owner steps at 500,001 and 1,150,001 (the margin drops, the price jumps)', () => {
    expect(buybackRateBps(500_000)).toBe(3000);
    expect(buybackRateBps(500_001)).toBe(2000);
    expect(buybackRateBps(1_150_001)).toBe(1700);
    expect(buybackMargin(500_001)).toBeLessThan(buybackMargin(500_000));
  });

  it('sends S ≤ 100,000, an issue, serious damage and a missing or unapproved S to an admin', () => {
    expect(estimateBuyback(90_000, [], { approved: true }).manualReview).toBe('price_too_low');
    expect(estimateBuyback(100_000, [], { approved: true }).manualReview).toBe('price_too_low');
    expect(estimateBuyback(2_000_000, [issue('missing_box', 1)], { approved: true })).toMatchObject({
      estimateVnd: null,
      manualReview: 'issues_declared',
    });
    expect(estimateBuyback(2_000_000, [], { approved: true, seriousDamage: true }).manualReview).toBe('serious_damage');
    expect(estimateBuyback(2_000_000, []).manualReview).toBe('reference_not_approved');
    expect(estimateBuyback(null, [], { approved: true }).manualReview).toBe('no_reference_price');
  });

  it('counts issues for the inspection record only', () => {
    expect(countIssues([issue('missing_box', 1), issue('missing_box', 1), issue('poor_assembly', 3)])).toBe(2);
    const declared = [issue('missing_box', 1), issue('broken_part', 2)];
    expect(compareInspection(declared, [...declared, issue('missing_accessory', 1)])).toMatchObject({
      newIssueCount: 1,
      resolvedIssueCount: 0,
    });
  });

  it('keeps the rule a request was quoted with, and quotes the misread margin rule again', () => {
    expect(
      estimateBuyback(2_000_000, [], { approved: true, quoted: { baseDeductionVnd: null, ruleVersion: 'buyback-17' } }),
    ).toMatchObject({ estimateVnd: 340_000, ruleVersion: 'buyback-17' });
    expect(b17(5_000_001)).toBe(850_000);
    expect(
      estimateBuyback(1_500_000, [issue('broken_part', 1)], {
        quoted: { baseDeductionVnd: 250_000, ruleVersion: 'buyback-5.0' },
      }),
    ).toMatchObject({ estimateVnd: 1_200_000, ruleVersion: 'buyback-5.0' });
    expect(
      estimateBuyback(2_500_000, [], {
        approved: true,
        quoted: { baseDeductionVnd: null, ruleVersion: 'buyback-tiers-2026-10-26' },
      }),
    ).toMatchObject({ estimateVnd: 2_075_000, ruleVersion: 'buyback-margin-2026-10-26' });
  });

  it('works a known buyback price back to the smallest S of each rate band that gives it', () => {
    const candidates = resaleCandidates(2_075_000);
    expect(candidates[0]).toEqual({ sellingPriceVnd: 2_500_000, baseDeductionVnd: 425_000 });
    for (const candidate of [...candidates, ...resaleCandidates(350_000)])
      expect(tierBuyback(candidate.sellingPriceVnd)).toBe(candidate.sellingPriceVnd - candidate.baseDeductionVnd);
    expect(resaleCandidates(0)).toEqual([]);
  });
});
