import Decimal from 'decimal.js';
export interface PawnInterestPolicy {
  calculation?: 'compound_0_3_v2';
  cashFlowClock?: 'elapsed_24h_periods';
  legalMode?: 'simulation' | 'approved';
  approvalType?: 'owner_operational';
  legalReference?: string;
  legalApprovedBy?: number;
  dailyRateBasisPoints: 0 | 3 | 30;
  dayCount: 'started_days' | 'completed_days';
  rounding: 'ceil' | 'floor' | 'nearest';
  graceDays: number;
  interestStopEvent: 'verified_repayment' | 'asset_handback';
}
export const PAWN_DAY_MS = 24 * 60 * 60 * 1000;
export function validatePawnPolicy(value: Record<string, unknown>): PawnInterestPolicy {
  if (
    ![0, 3, 30].includes(Number(value.dailyRateBasisPoints)) ||
    typeof value.dailyRateBasisPoints !== 'number' ||
    !['started_days', 'completed_days'].includes(String(value.dayCount)) ||
    !['ceil', 'floor', 'nearest'].includes(String(value.rounding)) ||
    !Number.isInteger(value.graceDays) ||
    Number(value.graceDays) < 0 ||
    Number(value.graceDays) > 365 ||
    !['verified_repayment', 'asset_handback'].includes(String(value.interestStopEvent))
  )
    throw new Error('Pawn interest, day counting, rounding, grace and accrual stop event require explicit approval.');
  return value as unknown as PawnInterestPolicy;
}
export function validatePawnPrincipal(appraisalVnd: number, principalVnd: number) {
  if (
    ![appraisalVnd, principalVnd].every((value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647) ||
    principalVnd * 100 < appraisalVnd * 50 ||
    principalVnd * 100 > appraisalVnd * 80
  )
    throw new Error('Principal must be a whole VND amount between 50% and 80% of the inspected appraisal.');
}
export function pawnInterest(principalVnd: number, policy: PawnInterestPolicy, disbursedAt: Date | null, asOf: Date) {
  if (!Number.isSafeInteger(principalVnd) || principalVnd < 1 || !Number.isFinite(asOf.getTime()))
    throw new Error('Invalid pawn calculation input.');
  validatePawnPolicy(policy as unknown as Record<string, unknown>);
  if (!disbursedAt) return { days: 0, interestVnd: 0, capped: false };
  if (!Number.isFinite(disbursedAt.getTime())) throw new Error('Invalid disbursement date.');
  const elapsed = Math.max(0, asOf.getTime() - disbursedAt.getTime());
  const days =
    policy.dayCount === 'started_days' ? Math.ceil(elapsed / PAWN_DAY_MS) : Math.floor(elapsed / PAWN_DAY_MS);
  if (policy.dailyRateBasisPoints === 0) return { days, interestVnd: 0, capped: false };
  if (policy.calculation === 'compound_0_3_v2') {
    const interestVnd = simulatePawnOwed(principalVnd, days) - principalVnd;
    return { days, interestVnd, capped: interestVnd >= principalVnd };
  }
  const denominator = BigInt(10000),
    numerator = BigInt(principalVnd) * BigInt(policy.dailyRateBasisPoints) * BigInt(days);
  const rounded =
    policy.rounding === 'ceil'
      ? (numerator + denominator - BigInt(1)) / denominator
      : policy.rounding === 'nearest'
        ? (numerator + denominator / BigInt(2)) / denominator
        : numerator / denominator;
  const capped = rounded >= BigInt(principalVnd);
  return { days, interestVnd: capped ? principalVnd : Number(rounded), capped };
}

// The expected pawn amount of one unit (owner rule of 2026-10-26): C50 = ROUND(S × 50%) of the approved real selling
// price S of the same SKU, half up (S 500,001 gives 250,001). B and R never enter it; no minimum.
export const pawnC50 = (sellingPriceVnd: number): number => {
  if (!Number.isSafeInteger(sellingPriceVnd) || sellingPriceVnd < 1)
    throw new RangeError('Approved S must be positive integer VND.');
  return Number((BigInt(sellingPriceVnd) + BigInt(1)) / BigInt(2));
};

// Compound interest of 0.3% a day, for display only: it is simulated (LEGAL_REVIEW_REQUIRED) and never charged until
// the pawn terms pass legal review. The amount owed after `days`, half up to whole VND.
export const PAWN_SIMULATED_DAILY_BPS = 30;
// Exact integer arithmetic: P × (10,030 / 10,000)^days, rounded half up once at the end.
export const simulatePawnOwed = (principalVnd: number, days: number): number => {
  if (!Number.isSafeInteger(principalVnd) || principalVnd < 0 || !Number.isInteger(days) || days < 0 || days > 36500)
    throw new RangeError('Invalid simulation inputs.');
  // At 0.3% daily the principal cap is reached before day 232; avoid unbounded exponentiation.
  if (days >= 232) return principalVnd * 2;
  const factor = BigInt(10_000 + PAWN_SIMULATED_DAILY_BPS),
    scale = BigInt(10_000),
    count = BigInt(Math.max(0, Math.floor(days)));
  const denominator = scale ** count;
  return Math.min(
    principalVnd * 2,
    Number((BigInt(principalVnd) * factor ** count * BigInt(2) + denominator) / (denominator * BigInt(2))),
  );
};

export interface PawnCashFlow {
  kind: string;
  amountVnd: number;
  principalVnd: number;
  interestVnd: number;
  sourceKey?: string;
  creditAppliedVnd?: number;
  createdAt: Date | string;
}
// New contracts accrue over actual elapsed 24h cash-flow periods. Credit movements do not
// restart accrual; only a confirmed repayment changes the interest/principal base.
const MoneyDecimal = Decimal.clone({ precision: 48, rounding: Decimal.ROUND_HALF_UP });
export function pawnCashFlowEstimate(
  principal: number,
  policy: PawnInterestPolicy,
  start: Date,
  at: Date,
  flows: PawnCashFlow[],
  stop?: Date,
) {
  if (
    !Number.isSafeInteger(principal) ||
    principal < 1 ||
    ![start, at, ...(stop ? [stop] : [])].every((d) => Number.isFinite(d.getTime()))
  )
    throw new RangeError('Invalid cash-flow calculation.');
  validatePawnPolicy(policy as unknown as Record<string, unknown>);
  const end = Math.max(start.getTime(), Math.min(at.getTime(), stop?.getTime() ?? at.getTime()));
  let outstanding = principal,
    interest = new MoneyDecimal(0),
    gross = new MoneyDecimal(0),
    credit = 0,
    last = start.getTime(),
    collectedVnd = 0,
    disposalPrincipal = 0,
    disposalInterest = 0,
    disposalSurplus = 0;
  const rounded = (n: Decimal) => n.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  const disposalSources = new Map<string, { principal: number; interest: number; surplus: number }>();
  const accrue = (until: number) => {
    const boundary = Math.max(last, Math.min(until, end));
    if (
      policy.dailyRateBasisPoints !== 0 &&
      boundary > last &&
      new MoneyDecimal(outstanding).plus(interest).gt(0) &&
      gross.lt(principal)
    ) {
      const days = new MoneyDecimal(boundary - last).div(PAWN_DAY_MS);
      const added = MoneyDecimal.min(
        new MoneyDecimal(principal).minus(gross),
        new MoneyDecimal(outstanding).plus(interest).times(new MoneyDecimal('1.003').pow(days).minus(1)),
      );
      gross = gross.plus(added);
      interest = interest.plus(added);
    }
    last = boundary;
  };
  const settleRounding = () => {
    const settled = new MoneyDecimal(rounded(interest));
    // Rounding is itself part of posted interest. Keep the lifetime cap on the
    // sum of posted integer VND, including earlier partial settlements.
    gross = MoneyDecimal.min(principal, MoneyDecimal.max(0, gross.plus(settled.minus(interest))));
    interest = settled;
  };
  const eligible = [...flows]
    .filter((f) => {
      const time = new Date(f.createdAt).getTime();
      if (
        !Number.isFinite(time) ||
        ![f.amountVnd, f.principalVnd, f.interestVnd, f.creditAppliedVnd || 0].every(
          (v) => Number.isSafeInteger(Number(v)) && Number(v) >= 0,
        )
      )
        throw new RangeError('Invalid ledger cash flow.');
      return time >= start.getTime() && time <= at.getTime();
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const flow of eligible) {
    if (flow.kind === 'extension_credit') credit += Number(flow.amountVnd);
    if (flow.kind === 'credit_refund') credit -= Number(flow.amountVnd);
    if (['disposal_receipt', 'disposal_reversal', 'disposal_surplus'].includes(flow.kind)) {
      accrue(new Date(flow.createdAt).getTime());
      settleRounding();
      let amount = Number(flow.amountVnd);
      const sourceKey = flow.sourceKey || 'disposal',
        source = disposalSources.get(sourceKey) || { principal: 0, interest: 0, surplus: 0 };
      disposalSources.set(sourceKey, source);
      if (flow.kind === 'disposal_surplus') {
        const cash = Math.min(Math.max(0, disposalSurplus), amount);
        disposalSurplus -= cash;
        let paidCash = cash;
        for (const contribution of disposalSources.values()) {
          const used = Math.min(contribution.surplus, paidCash);
          contribution.surplus -= used;
          paidCash -= used;
          if (!paidCash) break;
        }
        amount -= cash;
        const prepaid = Math.min(Math.max(0, credit), amount);
        credit -= prepaid;
        amount -= prepaid;
        disposalSurplus -= amount;
      } else if (flow.kind === 'disposal_reversal') {
        const fromSurplus = Math.min(Math.max(0, source.surplus), amount);
        source.surplus -= fromSurplus;
        disposalSurplus -= fromSurplus;
        amount -= fromSurplus;
        const restoredInterest = Math.min(source.interest, amount);
        source.interest -= restoredInterest;
        interest = interest.plus(restoredInterest);
        disposalInterest -= restoredInterest;
        amount -= restoredInterest;
        const restoredPrincipal = Math.min(source.principal, amount);
        source.principal -= restoredPrincipal;
        outstanding += restoredPrincipal;
        disposalPrincipal -= restoredPrincipal;
        amount -= restoredPrincipal;
        // Any refund beyond previously applied proceeds is a reconciliation deficit.
        disposalSurplus -= amount;
      } else {
        const principalApplied = Math.min(outstanding, amount);
        outstanding -= principalApplied;
        disposalPrincipal += principalApplied;
        source.principal += principalApplied;
        amount -= principalApplied;
        const useCredit = Math.min(Math.max(0, credit), interest.toNumber());
        credit -= useCredit;
        interest = interest.minus(useCredit);
        const interestApplied = Math.min(interest.toNumber(), amount);
        interest = interest.minus(interestApplied);
        disposalInterest += interestApplied + useCredit;
        source.interest += interestApplied;
        amount -= interestApplied;
        disposalSurplus += amount;
        source.surplus += amount;
      }
    }
    if (flow.kind === 'redemption') {
      accrue(new Date(flow.createdAt).getTime());
      settleRounding();
      outstanding = Math.max(0, outstanding - Number(flow.principalVnd));
      // A settlement rounds its accrued interest to integer VND; carry no fractional debt
      // after the customer has paid that entire rounded interest balance.
      interest = new MoneyDecimal(Math.max(0, rounded(interest) - Number(flow.interestVnd)));
      credit -= Number(flow.creditAppliedVnd || 0);
      collectedVnd += Number(flow.amountVnd);
    }
  }
  accrue(end);
  const interestVnd = rounded(interest),
    grossVnd = Math.min(principal, rounded(gross));
  const creditAppliedVnd = Math.min(Math.max(0, credit), interestVnd);
  return {
    disposalPrincipalAppliedVnd: disposalPrincipal,
    disposalInterestAppliedVnd: disposalInterest,
    disposalSurplusVnd: disposalSurplus,
    days: Math.floor((end - start.getTime()) / PAWN_DAY_MS),
    interestVnd: grossVnd,
    interestOutstandingVnd: interestVnd,
    principalOutstandingVnd: outstanding,
    availableCreditVnd: Math.max(0, credit),
    creditAppliedVnd,
    surplusCreditVnd: Math.max(0, credit - interestVnd),
    remainingVnd: outstanding + interestVnd - creditAppliedVnd,
    grossRemainingVnd: outstanding + interestVnd,
    capped: grossVnd >= principal,
    collectedVnd,
  };
}

export function pawnExtensionQuote(
  principal: number,
  valuation: number,
  policy: PawnInterestPolicy,
  start: Date,
  oldDue: Date,
  newDue: Date,
  flows: PawnCashFlow[],
) {
  if (!Number.isSafeInteger(valuation) || valuation < 1 || newDue <= oldDue)
    throw new RangeError('Invalid extension valuation or dates.');
  const before = pawnCashFlowEstimate(principal, policy, start, oldDue, flows);
  const after = pawnCashFlowEstimate(principal, policy, start, newDue, flows);
  const ceilingVnd = Number((BigInt(valuation) * BigInt(8)) / BigInt(10));
  return {
    creditDueVnd: Math.max(0, after.interestVnd - before.interestVnd),
    projectedInterestVnd: after.interestOutstandingVnd,
    principalOutstandingVnd: after.principalOutstandingVnd,
    projectedDebtVnd: after.grossRemainingVnd,
    ceilingVnd,
    eligible: after.grossRemainingVnd <= ceilingVnd,
  };
}

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
