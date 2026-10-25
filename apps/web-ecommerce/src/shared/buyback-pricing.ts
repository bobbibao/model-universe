// Buyback pricing (owner rule of 2026-10-26, docs/business/source/vi/three-prices-specification.md): the expected buyback
// price B of one unit follows the shop's real selling price S of the same SKU and version by three rates,
// B = MAX(100,000, ROUND(S × r)) with r = 30% for S ≤ 500,000, 20% for 500,000 < S ≤ 1,150,000 and 17% above. The steps
// at 500,001 and 1,150,001 (B drops although S rises) are the owner's choice, not smoothed. B is offered only for a
// matched SKU with an approved S, an item declared new without any issue, S above 100,000 and B below S; anything else
// goes to an admin, who prices it (no deduction per issue). Shared by the server (it recomputes every amount) and the
// client (it shows the estimate). Whole VND integers only.
//
// Requests quoted earlier keep the rule they were quoted with: B17 (17% of S, 2026-10-25) or the tier table of the
// unified rules v5.0.

export const BUYBACK_RULE_VERSION = 'buyback-tiers-2026-10-26';
export const BUYBACK_TIERS_BPS: readonly { maxTargetVnd: number; bps: number }[] = [
  { maxTargetVnd: 500_000, bps: 3000 },
  { maxTargetVnd: 1_150_000, bps: 2000 },
  { maxTargetVnd: Number.MAX_SAFE_INTEGER, bps: 1700 },
];
export const MIN_BUYBACK_VND = 100_000;
// The rule of 2026-10-25: 17% of S. Only for requests quoted under it.
export const B17_RULE_VERSION = 'buyback-17';
export const BUYBACK_RATE_PERCENT = 17;
// The former rule (v5.0): S minus a tier deduction minus 50,000 VND per issue. Only for requests quoted under it.
export const LEGACY_BUYBACK_RULE_VERSION = 'buyback-5.0';
export const DEDUCTION_PER_ISSUE_VND = 50_000;

// The rate of S paid for a unit, in basis points (3000 = 30%).
export const buybackRateBps = (targetPriceVnd: number): number =>
  BUYBACK_TIERS_BPS.find((tier) => targetPriceVnd <= tier.maxTargetVnd)!.bps;

// B = MAX(100,000, ROUND(S × r)), half up on integers: S 500,000 gives 150,000; S 500,001 gives 100,000.
export const tierBuyback = (targetPriceVnd: number): number =>
  Math.max(MIN_BUYBACK_VND, Math.floor((targetPriceVnd * buybackRateBps(targetPriceVnd) * 2 + 10_000) / 20_000));

// B17 = ROUND(0.17 × S): the rule of 2026-10-25, for requests quoted under it.
export const b17 = (targetPriceVnd: number): number =>
  Math.floor((targetPriceVnd * BUYBACK_RATE_PERCENT * 2 + 100) / 200);

// The former tier table (inclusive upper bounds), kept for requests quoted under it and for history only.
export const BUYBACK_TIERS: readonly { maxReferenceVnd: number; baseDeductionVnd: number }[] = [
  { maxReferenceVnd: 500_000, baseDeductionVnd: 100_000 },
  { maxReferenceVnd: 1_000_000, baseDeductionVnd: 200_000 },
  { maxReferenceVnd: 1_500_000, baseDeductionVnd: 250_000 },
  { maxReferenceVnd: 2_000_000, baseDeductionVnd: 350_000 },
  { maxReferenceVnd: 3_000_000, baseDeductionVnd: 450_000 },
  { maxReferenceVnd: 5_000_000, baseDeductionVnd: 500_000 },
];

// Every ordinary issue costs the same 50,000 VND per counting unit; the unit only says what one issue is.
export const BUYBACK_ISSUE_TYPES = [
  'missing_box', // the whole box is absent: always one issue
  'damaged_box', // one damaged-box condition
  'broken_part', // per broken part
  'cracked_part', // per cracked part
  'missing_accessory', // per missing accessory
  'poor_assembly', // the whole model counts once
  'glue_mark', // per separate glued spot
  'loose_joint', // per loose or broken joint
  'scratch_area', // per independent scratched area
  'missing_decal', // per missing decal item on the checklist
  'missing_detail', // per missing small detail
  'other', // per separate described issue
] as const;
export type BuybackIssueType = (typeof BUYBACK_ISSUE_TYPES)[number];

// Conditions that are one issue for the whole model, however they are counted.
export const SINGLE_UNIT_ISSUES: readonly BuybackIssueType[] = ['missing_box', 'damaged_box', 'poor_assembly'];
export const MAX_ISSUE_QUANTITY = 50;

export interface BuybackIssue {
  type: BuybackIssueType;
  quantity: number;
  description: string;
}

export type ManualReviewReason =
  | 'no_reference_price'
  | 'reference_not_approved'
  | 'price_too_low'
  | 'issues_declared'
  | 'above_tier_table'
  | 'zero_estimate'
  | 'serious_damage';

export interface BuybackEstimate {
  ruleVersion: string;
  referencePriceVnd: number | null;
  baseDeductionVnd: number | null;
  issueCount: number;
  deductionPerIssueVnd: number;
  issueDeductionVnd: number;
  // null when the shop must price the model manually (manualReview says why).
  estimateVnd: number | null;
  manualReview: ManualReviewReason | null;
}

export const isBuybackIssueType = (value: unknown): value is BuybackIssueType =>
  typeof value === 'string' && (BUYBACK_ISSUE_TYPES as readonly string[]).includes(value);

// The tier's base deduction for a reference price, or null above the table (manual pricing).
export const baseDeduction = (referencePriceVnd: number): number | null =>
  BUYBACK_TIERS.find((tier) => referencePriceVnd <= tier.maxReferenceVnd)?.baseDeductionVnd ?? null;

// Issues of the same type are merged; single-unit conditions never count more than once (a duplicate report of the
// same condition is not charged twice).
export const countIssues = (issues: readonly Pick<BuybackIssue, 'type' | 'quantity'>[]): number => {
  const byType = new Map<BuybackIssueType, number>();
  for (const issue of issues) byType.set(issue.type, (byType.get(issue.type) || 0) + issue.quantity);
  let count = 0;
  for (const [type, quantity] of byType) count += SINGLE_UNIT_ISSUES.includes(type) ? Math.min(1, quantity) : quantity;
  return count;
};

// `referencePriceVnd` is S and `approved` whether an admin approved it. `quoted` is the estimate a request was first
// quoted with: a request quoted under an earlier rule keeps it, so a rule change never alters agreed terms.
export const estimateBuyback = (
  referencePriceVnd: number | null,
  issues: readonly Pick<BuybackIssue, 'type' | 'quantity'>[],
  options: {
    seriousDamage?: boolean;
    approved?: boolean;
    quoted?: Pick<BuybackEstimate, 'baseDeductionVnd' | 'ruleVersion'> | null;
  } = {},
): BuybackEstimate => {
  if (options.quoted?.ruleVersion === B17_RULE_VERSION) return estimateB17(referencePriceVnd, issues, options);
  if (options.quoted?.ruleVersion && options.quoted.ruleVersion !== BUYBACK_RULE_VERSION)
    return estimateLegacyBuyback(referencePriceVnd, issues, options);
  const issueCount = countIssues(issues);
  const common = {
    ruleVersion: BUYBACK_RULE_VERSION,
    referencePriceVnd: referencePriceVnd && referencePriceVnd > 0 ? referencePriceVnd : null,
    baseDeductionVnd: null,
    issueCount,
    deductionPerIssueVnd: 0,
    issueDeductionVnd: 0,
  };
  if (!common.referencePriceVnd) return { ...common, estimateVnd: null, manualReview: 'no_reference_price' };
  if (!options.approved) return { ...common, estimateVnd: null, manualReview: 'reference_not_approved' };
  if (options.seriousDamage) return { ...common, estimateVnd: null, manualReview: 'serious_damage' };
  if (issueCount > 0) return { ...common, estimateVnd: null, manualReview: 'issues_declared' };
  const estimateVnd = tierBuyback(common.referencePriceVnd);
  // S ≤ 100,000 or B ≥ S: the minimum price would pay as much as the shop sells for.
  if (common.referencePriceVnd <= MIN_BUYBACK_VND || estimateVnd >= common.referencePriceVnd)
    return { ...common, estimateVnd: null, manualReview: 'price_too_low' };
  return { ...common, estimateVnd, manualReview: null };
};

// The rule of 2026-10-25 for a request quoted under it: 17% of an approved S, an issue goes to an admin.
const estimateB17 = (
  referencePriceVnd: number | null,
  issues: readonly Pick<BuybackIssue, 'type' | 'quantity'>[],
  options: { seriousDamage?: boolean; approved?: boolean },
): BuybackEstimate => {
  const issueCount = countIssues(issues);
  const common = {
    ruleVersion: B17_RULE_VERSION,
    referencePriceVnd: referencePriceVnd && referencePriceVnd > 0 ? referencePriceVnd : null,
    baseDeductionVnd: null,
    issueCount,
    deductionPerIssueVnd: 0,
    issueDeductionVnd: 0,
  };
  if (!common.referencePriceVnd) return { ...common, estimateVnd: null, manualReview: 'no_reference_price' };
  if (!options.approved) return { ...common, estimateVnd: null, manualReview: 'reference_not_approved' };
  if (options.seriousDamage) return { ...common, estimateVnd: null, manualReview: 'serious_damage' };
  if (issueCount > 0) return { ...common, estimateVnd: null, manualReview: 'issues_declared' };
  return { ...common, estimateVnd: b17(common.referencePriceVnd), manualReview: null };
};

// A former tier rule (v5.0 or earlier) for a request quoted under it: S minus its quoted tier deduction minus 50,000 VND per issue.
const estimateLegacyBuyback = (
  referencePriceVnd: number | null,
  issues: readonly Pick<BuybackIssue, 'type' | 'quantity'>[],
  options: { seriousDamage?: boolean; quoted?: Pick<BuybackEstimate, 'baseDeductionVnd' | 'ruleVersion'> | null } = {},
): BuybackEstimate => {
  const issueCount = countIssues(issues);
  const issueDeductionVnd = issueCount * DEDUCTION_PER_ISSUE_VND;
  const quoted = options.quoted?.baseDeductionVnd != null ? options.quoted : null;
  const base =
    referencePriceVnd && referencePriceVnd > 0
      ? quoted
        ? quoted.baseDeductionVnd
        : baseDeduction(referencePriceVnd)
      : null;
  const common = {
    ruleVersion: quoted?.ruleVersion ?? LEGACY_BUYBACK_RULE_VERSION,
    referencePriceVnd: referencePriceVnd && referencePriceVnd > 0 ? referencePriceVnd : null,
    baseDeductionVnd: base,
    issueCount,
    deductionPerIssueVnd: DEDUCTION_PER_ISSUE_VND,
    issueDeductionVnd,
  };
  if (!common.referencePriceVnd) return { ...common, estimateVnd: null, manualReview: 'no_reference_price' };
  if (base === null) return { ...common, estimateVnd: null, manualReview: 'above_tier_table' };
  const estimateVnd = Math.max(0, common.referencePriceVnd - base - issueDeductionVnd);
  if (options.seriousDamage) return { ...common, estimateVnd, manualReview: 'serious_damage' };
  if (estimateVnd === 0) return { ...common, estimateVnd: null, manualReview: 'zero_estimate' };
  return { ...common, estimateVnd, manualReview: null };
};

export interface InspectionComparison {
  declaredIssueCount: number;
  inspectedIssueCount: number;
  // Issues found that were not declared, and declared issues that do not exist (per type, never negative).
  newIssueCount: number;
  resolvedIssueCount: number;
  initialDeductionVnd: number;
  finalDeductionVnd: number;
  // Positive: the final price is lower than the estimate; negative: higher (declared issues that did not exist).
  deductionDifferenceVnd: number;
}

// Compares the customer's declaration with the inspection both ways, so a declared issue that is not there lowers the
// deduction instead of only ever adding to it.
export const compareInspection = (
  declared: readonly Pick<BuybackIssue, 'type' | 'quantity'>[],
  inspected: readonly Pick<BuybackIssue, 'type' | 'quantity'>[],
  // The quoted rule's deduction per issue: 0 under B17 (issues are priced by an admin), 50,000 VND under the former rule.
  deductionPerIssueVnd = DEDUCTION_PER_ISSUE_VND,
): InspectionComparison => {
  const perType = (issues: readonly Pick<BuybackIssue, 'type' | 'quantity'>[]) => {
    const map = new Map<BuybackIssueType, number>();
    for (const type of BUYBACK_ISSUE_TYPES) map.set(type, countIssues(issues.filter((issue) => issue.type === type)));
    return map;
  };
  const before = perType(declared),
    after = perType(inspected);
  let newIssueCount = 0,
    resolvedIssueCount = 0;
  for (const type of BUYBACK_ISSUE_TYPES) {
    const delta = (after.get(type) || 0) - (before.get(type) || 0);
    if (delta > 0) newIssueCount += delta;
    else resolvedIssueCount -= delta;
  }
  const declaredIssueCount = countIssues(declared),
    inspectedIssueCount = countIssues(inspected);
  return {
    declaredIssueCount,
    inspectedIssueCount,
    newIssueCount,
    resolvedIssueCount,
    initialDeductionVnd: declaredIssueCount * deductionPerIssueVnd,
    finalDeductionVnd: inspectedIssueCount * deductionPerIssueVnd,
    deductionDifferenceVnd: (inspectedIssueCount - declaredIssueCount) * deductionPerIssueVnd,
  };
};

// A trade (§9): the customer hands in a model and takes a shop item. D = the item's price − the approved buy-back total;
// D > 0 the customer pays the difference, D < 0 the shop pays it back once an admin approves that, D is unknown
// (INCOMPLETE) while the buy-back price is not final. The trade credit is not a voucher and earns no points.
export const tradeDifference = (itemPriceVnd: number, buybackVnd: number | null) =>
  buybackVnd === null
    ? { differenceVnd: null, status: 'incomplete' as const }
    : { differenceVnd: itemPriceVnd - buybackVnd, status: 'ready' as const };

// The selling prices S whose buyback price is a known B: in each rate band, the smallest S of that band with
// tierBuyback(S) = B (B above the 100,000 minimum only), lowest first. A proposal for staff: S is still approved on its
// own merits (cost, market, margin).
export const resaleCandidates = (buybackVnd: number): { sellingPriceVnd: number; baseDeductionVnd: number }[] => {
  if (!Number.isSafeInteger(buybackVnd) || buybackVnd <= MIN_BUYBACK_VND) return [];
  const candidates: { sellingPriceVnd: number; baseDeductionVnd: number }[] = [];
  let lower = 0;
  for (const tier of BUYBACK_TIERS_BPS) {
    // ROUND(S × r) ≥ B exactly when S × r ≥ B − 0.5.
    const selling = Math.max(lower + 1, Math.ceil(((buybackVnd * 2 - 1) * 10_000) / (tier.bps * 2)));
    if (selling <= tier.maxTargetVnd && tierBuyback(selling) === buybackVnd)
      candidates.push({ sellingPriceVnd: selling, baseDeductionVnd: selling - buybackVnd });
    lower = tier.maxTargetVnd;
  }
  return candidates;
};
