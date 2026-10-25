import {
  b17,
  buybackRateBps,
  compareInspection,
  countIssues,
  estimateBuyback,
  resaleCandidates,
  tierBuyback,
  type BuybackIssue,
} from '../../src/shared/buyback-pricing';

// Buyback by three rates of the real selling price S: the owner's specification of 2026-10-26, §3–§5 and the QA cases
// of §24 (docs/business/source/vi/three-prices-specification.md).
const issue = (type: BuybackIssue['type'], quantity: number) => ({ type, quantity });

describe('buyback pricing B = MAX(100,000, ROUND(S × r)), r = 30% / 20% / 17%', () => {
  it.each([
    [200_000, 100_000],
    [333_333, 100_000],
    [500_000, 150_000],
    [500_001, 100_000],
    [1_000_000, 200_000],
    [1_150_000, 230_000],
    [1_150_001, 195_500],
    [2_000_000, 340_000],
    [2_750_000, 467_500],
    [5_000_000, 850_000],
    [2_500_000, 425_000],
  ])('S = %i gives B = %i', (s, expected) => {
    expect(tierBuyback(s)).toBe(expected);
    expect(estimateBuyback(s, [], { approved: true })).toMatchObject({
      estimateVnd: expected,
      manualReview: null,
      ruleVersion: 'buyback-tiers-2026-10-26',
      baseDeductionVnd: null,
      issueDeductionVnd: 0,
    });
  });

  it('keeps the owner steps at 500,001 and 1,150,001 (B drops although S rises)', () => {
    expect(buybackRateBps(500_000)).toBe(3000);
    expect(buybackRateBps(500_001)).toBe(2000);
    expect(buybackRateBps(1_150_001)).toBe(1700);
    expect(tierBuyback(500_001)).toBeLessThan(tierBuyback(500_000));
  });

  it('sends S ≤ 100,000 or B ≥ S, an issue, serious damage and a missing or unapproved S to an admin', () => {
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

  it('keeps the rule a request was quoted with (no retroactive change)', () => {
    // Quoted under B17 (2026-10-25): 17% of S.
    expect(
      estimateBuyback(2_000_000, [], { approved: true, quoted: { baseDeductionVnd: null, ruleVersion: 'buyback-17' } }),
    ).toMatchObject({
      estimateVnd: 340_000,
      ruleVersion: 'buyback-17',
    });
    expect(b17(5_000_001)).toBe(850_000);
    // Quoted under the former tier table (v5.0): S minus the quoted deduction minus 50,000 per issue.
    expect(
      estimateBuyback(1_500_000, [issue('broken_part', 1)], {
        quoted: { baseDeductionVnd: 250_000, ruleVersion: 'buyback-5.0' },
      }),
    ).toMatchObject({ estimateVnd: 1_200_000, ruleVersion: 'buyback-5.0' });
  });

  it('works a known B back to the smallest S of each rate band that gives it', () => {
    expect(resaleCandidates(150_000)).toEqual([
      { sellingPriceVnd: 499_999, baseDeductionVnd: 349_999 },
      { sellingPriceVnd: 749_998, baseDeductionVnd: 599_998 },
    ]);
    for (const candidate of resaleCandidates(340_000)) expect(tierBuyback(candidate.sellingPriceVnd)).toBe(340_000);
    expect(resaleCandidates(100_000)).toEqual([]);
  });
});
