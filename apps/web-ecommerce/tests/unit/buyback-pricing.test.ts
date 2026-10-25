import {
  b17,
  compareInspection,
  countIssues,
  estimateBuyback,
  resaleCandidates,
  type BuybackIssue,
} from '../../src/shared/buyback-pricing';

// Buy-back at 17% of the approved target price S: the owner's specification of 2026-10-25, section V (§18) and the
// examples of §5 (docs/business/source/vi/buyback-17-percent-specification.md).
const issue = (type: BuybackIssue['type'], quantity: number) => ({ type, quantity });

describe('buyback pricing B17 = ROUND(0.17 × S)', () => {
  it.each([
    [1_000_000, 170_000],
    [2_000_000, 340_000],
    [2_250_000, 382_500],
    [5_000_000, 850_000],
    [5_000_001, 850_000],
    [10_000_000, 1_700_000],
    [20_000_000, 3_400_000],
  ])('S = %i gives B17 = %i, without steps at 5, 10 or 20 million', (s, expected) => {
    expect(b17(s)).toBe(expected);
    expect(estimateBuyback(s, [], { approved: true })).toMatchObject({
      estimateVnd: expected,
      manualReview: null,
      ruleVersion: 'buyback-17',
      baseDeductionVnd: null,
      issueDeductionVnd: 0,
    });
  });

  it('rounds half up on whole VND (0.5 goes up)', () => {
    expect(b17(50)).toBe(9); // 8.5
    expect(b17(1)).toBe(0); // 0.17
    expect(b17(3)).toBe(1); // 0.51
  });

  it('never deducts per issue: an issue, serious damage, or a missing or unapproved S goes to an admin', () => {
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

  it('a request quoted under a former tier rule keeps its terms (no retroactive change)', () => {
    const quoted = { baseDeductionVnd: 250_000, ruleVersion: 'buyback-5.0' };
    expect(estimateBuyback(1_500_000, [issue('broken_part', 1)], { quoted })).toMatchObject({
      estimateVnd: 1_200_000,
      ruleVersion: 'buyback-5.0',
    });
    expect(estimateBuyback(1_500_000, [], { quoted: { baseDeductionVnd: 200_000, ruleVersion: 'buyback-2.0' } })).toMatchObject(
      { estimateVnd: 1_300_000, ruleVersion: 'buyback-2.0' },
    );
  });

  it('works a known B17 back to the smallest S that gives it', () => {
    expect(resaleCandidates(340_000)).toEqual([{ sellingPriceVnd: 1_999_998, baseDeductionVnd: 1_659_998 }]);
    expect(b17(1_999_998)).toBe(340_000);
    expect(b17(1_999_997)).toBe(339_999);
  });
});
