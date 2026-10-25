export interface PawnInterestPolicy {
  dailyRateBasisPoints: 3 | 30;
  dayCount: 'started_days' | 'completed_days';
  rounding: 'ceil' | 'floor' | 'nearest';
  graceDays: number;
  interestStopEvent: 'verified_repayment' | 'asset_handback';
}
export const PAWN_DAY_MS = 24 * 60 * 60 * 1000;
export function validatePawnPolicy(value: Record<string, unknown>): PawnInterestPolicy {
  if (![3, 30].includes(Number(value.dailyRateBasisPoints)) || typeof value.dailyRateBasisPoints !== 'number' || !['started_days', 'completed_days'].includes(String(value.dayCount)) || !['ceil', 'floor', 'nearest'].includes(String(value.rounding)) || !Number.isInteger(value.graceDays) || Number(value.graceDays) < 0 || Number(value.graceDays) > 365 || !['verified_repayment', 'asset_handback'].includes(String(value.interestStopEvent))) throw new Error('Pawn interest, day counting, rounding, grace and accrual stop event require explicit approval.');
  return value as unknown as PawnInterestPolicy;
}
export function validatePawnPrincipal(appraisalVnd: number, principalVnd: number) {
  if (![appraisalVnd, principalVnd].every(value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647) || principalVnd * 100 < appraisalVnd * 50 || principalVnd * 100 > appraisalVnd * 80) throw new Error('Principal must be a whole VND amount between 50% and 80% of the inspected appraisal.');
}
export function pawnInterest(principalVnd: number, policy: PawnInterestPolicy, disbursedAt: Date | null, asOf: Date) {
  if (!Number.isSafeInteger(principalVnd) || principalVnd < 1 || !Number.isFinite(asOf.getTime())) throw new Error('Invalid pawn calculation input.');
  validatePawnPolicy(policy as unknown as Record<string, unknown>);
  if (!disbursedAt) return { days: 0, interestVnd: 0, capped: false };
  if (!Number.isFinite(disbursedAt.getTime())) throw new Error('Invalid disbursement date.');
  const elapsed = Math.max(0, asOf.getTime() - disbursedAt.getTime());
  const days = policy.dayCount === 'started_days' ? Math.ceil(elapsed / PAWN_DAY_MS) : Math.floor(elapsed / PAWN_DAY_MS);
  const denominator = BigInt(10000), numerator = BigInt(principalVnd) * BigInt(policy.dailyRateBasisPoints) * BigInt(days);
  const rounded = policy.rounding === 'ceil' ? (numerator + denominator - BigInt(1)) / denominator : policy.rounding === 'nearest' ? (numerator + denominator / BigInt(2)) / denominator : numerator / denominator;
  const capped = rounded >= BigInt(principalVnd);
  return { days, interestVnd: capped ? principalVnd : Number(rounded), capped };
}

// The expected pawn amount of one unit (owner rule of 2026-10-26): C50 = ROUND(S × 50%) of the approved real selling
// price S of the same SKU, half up (S 500,001 gives 250,001). B and R never enter it; no minimum.
export const pawnC50 = (sellingPriceVnd: number): number => Math.floor((sellingPriceVnd + 1) / 2);

// Compound interest of 0.3% a day, for display only: it is simulated (LEGAL_REVIEW_REQUIRED) and never charged until
// the pawn terms pass legal review. The amount owed after `days`, half up to whole VND.
export const PAWN_SIMULATED_DAILY_BPS = 30;
// Exact integer arithmetic: P × (10,030 / 10,000)^days, rounded half up once at the end.
export const simulatePawnOwed = (principalVnd: number, days: number): number => {
  const factor = BigInt(10_000 + PAWN_SIMULATED_DAILY_BPS),
    scale = BigInt(10_000),
    count = BigInt(Math.max(0, Math.floor(days)));
  const denominator = scale ** count;
  return Number((BigInt(principalVnd) * factor ** count * BigInt(2) + denominator) / (denominator * BigInt(2)));
};

// The web pawn quote of one unit (owner rule of 2026-10-26, three-prices specification §16): C50 for a catalogue model
// the shop sells new, with an approved S; anything else (no catalogue model, a used or faulty unit, S missing or not
// approved) goes to an admin. It is a quote for the shop to confirm, not a disbursement: interest stays simulated until
// legal review.
export const PAWN_RULE_VERSION = 'pawn-c50-2026-10-26';
export type PawnManualReview = 'no_reference_price' | 'reference_not_approved' | 'issues_declared';
export interface PawnEstimate {
  ruleVersion: string;
  referencePriceVnd: number | null;
  amountVnd: number | null;
  manualReview: PawnManualReview | null;
  legalReviewRequired: true;
}
export const estimatePawn = (
  referencePriceVnd: number | null,
  options: { approved?: boolean; issuesDeclared?: boolean } = {},
): PawnEstimate => {
  const common = {
    ruleVersion: PAWN_RULE_VERSION,
    referencePriceVnd: referencePriceVnd && referencePriceVnd > 0 ? referencePriceVnd : null,
    legalReviewRequired: true as const,
  };
  if (!common.referencePriceVnd) return { ...common, amountVnd: null, manualReview: 'no_reference_price' };
  if (!options.approved) return { ...common, amountVnd: null, manualReview: 'reference_not_approved' };
  if (options.issuesDeclared) return { ...common, amountVnd: null, manualReview: 'issues_declared' };
  return { ...common, amountVnd: pawnC50(common.referencePriceVnd), manualReview: null };
};
