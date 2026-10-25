// The checks before a bought-back model is listed (owner specification of 2026-10-25, section III §12,
// docs/business/source/vi/buyback-17-percent-specification.md). Every check must hold, else the review fails
// (QC_FAILED). A passed review lets staff take the unit into stock as a DRAFT listing; a second, final check publishes it.
// Changing the listing's photos, price, SKU or condition after the review voids it (§13).
export const LISTING_QC_CHECKS = [
  'QC01',
  'QC02',
  'QC03',
  'QC04',
  'QC05',
  'QC06',
  'QC07',
  'QC08',
  'QC09',
  'QC10',
  'QC11',
  'QC12',
  'QC13',
  'QC14',
  'QC15',
  'QC16',
] as const;
export type ListingQcCheck = (typeof LISTING_QC_CHECKS)[number];
export type ListingQcChecks = Record<ListingQcCheck, boolean>;

// The checks the server verifies from the request and the listing itself; what the reviewer ticks for them is ignored.
// QC01 physical receipt, QC02 inspection recording, QC06 accepted final quote, QC07 verified settlement, QC08 one unit
// not taken in before, QC10 approved target price S, QC16 the reviewer and time (recorded with the review).
export const SYSTEM_QC_CHECKS: readonly ListingQcCheck[] = ['QC01', 'QC02', 'QC06', 'QC07', 'QC08', 'QC10', 'QC16'];

export const isListingQcCheck = (value: unknown): value is ListingQcCheck =>
  typeof value === 'string' && (LISTING_QC_CHECKS as readonly string[]).includes(value);

// The checks that do not hold (empty: the review passes).
export const failedQcChecks = (checks: Partial<ListingQcChecks>): ListingQcCheck[] =>
  LISTING_QC_CHECKS.filter((check) => checks[check] !== true);
