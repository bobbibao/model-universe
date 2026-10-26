import { evaluateVoucher, memberPrice, listPriceForMemberPrice, webListPrice } from './pricing';
import { baseDeduction, buybackMargin, DEDUCTION_PER_ISSUE_VND, tierBuyback } from './buyback-pricing';
import { pawnC50 } from './pawn-rules';

// The former catalogue formula (v5.0): B = S − tier deduction − 50,000 × issues, R = S ÷ 0.9. Superseded on 2026-10-25;
// kept only for the migration 2026-10-23-42 that applied it, never for new prices.
export function legacyCatalogFormula(referenceMemberVnd: number, ordinaryIssueCount: number) {
  if (!Number.isSafeInteger(referenceMemberVnd) || referenceMemberVnd < 1 || referenceMemberVnd > 5_000_000)
    throw new Error('Giá tham chiếu phải từ 1đ đến 5.000.000đ theo bảng thu tiêu chuẩn.');
  if (!Number.isSafeInteger(ordinaryIssueCount) || ordinaryIssueCount < 0 || ordinaryIssueCount > 100)
    throw new Error('Số lỗi thông thường phải là số nguyên từ 0 đến 100.');
  const deductionVnd = baseDeduction(referenceMemberVnd)!;
  const buybackPriceVnd = referenceMemberVnd - deductionVnd - ordinaryIssueCount * DEDUCTION_PER_ISSUE_VND;
  if (buybackPriceVnd <= 0) throw new Error('Tình trạng này cần thẩm định; giá thu theo công thức không còn dương.');
  return {
    referenceMemberVnd,
    ordinaryIssueCount,
    deductionVnd,
    buybackPriceVnd,
    listPriceVnd: listPriceForMemberPrice(referenceMemberVnd),
  };
}

// Catalogue prices (owner rule of 2026-10-26, docs/business/source/vi/three-prices-specification.md): the shop enters only
// the real selling price S; everything else follows it:
// - R = ROUND(S / 0.9), the web list price; the member code MEMBER10 takes 10% off R and gives back exactly S;
// - the shop's margin "Giá lời B" by the three rates and the buyback price S − B (buyback-pricing.ts);
// - C50 = ROUND(S × 50%), the expected pawn amount (pawn-rules.ts).
export const CATALOG_MAX_REFERENCE_VND = 1_000_000_000;
export function catalogPricing(targetPriceVnd: number) {
  if (!Number.isSafeInteger(targetPriceVnd) || targetPriceVnd < 1 || targetPriceVnd > CATALOG_MAX_REFERENCE_VND)
    throw new Error('Giá bán thực S phải là số nguyên từ 1đ đến 1.000.000.000đ.');
  return {
    referenceMemberVnd: targetPriceVnd,
    listPriceVnd: webListPrice(targetPriceVnd),
    buybackMarginVnd: buybackMargin(targetPriceVnd),
    buybackPriceVnd: tierBuyback(targetPriceVnd),
    pawnPriceVnd: pawnC50(targetPriceVnd),
  };
}

// The condition a customer's unit is priced in by the services (owner request of 2026-10-26): new from S, 2hand
// ('preowned') from S 2hand. Anything more complicated is quoted by staff from the photos.
export const REFERENCE_CONDITIONS = ['new', 'preowned'] as const;
export type ReferenceCondition = (typeof REFERENCE_CONDITIONS)[number];
export const isReferenceCondition = (value: unknown): value is ReferenceCondition =>
  REFERENCE_CONDITIONS.includes(value as ReferenceCondition);

// The S a service prices a catalogue model in a condition with: S for new, S 2hand for 2hand (null when not entered).
export const referencePrice = (
  product: { pricingReferenceMemberVnd: number | null; pricingReferencePreownedVnd?: number | null },
  condition: ReferenceCondition,
) => (condition === 'new' ? product.pricingReferenceMemberVnd : (product.pricingReferencePreownedVnd ?? null));

// Placeholder S 2hand until staff enter real ones (owner request of 2026-10-26: "mock data that makes sense"): 70% of
// S rounded down to 10,000, kept below S. Used once by migration 53, never in place of a value staff entered.
export const placeholderPreownedReference = (sellingPriceVnd: number) =>
  Math.max(10_000, Math.floor((sellingPriceVnd * 7) / 100_000) * 10_000);

export function safeSalePercent(price: number, cost: number, requested: number): boolean {
  if (!Number.isInteger(requested) || requested < 1 || requested > 25) return false;
  return evaluateVoucher({ discountPercent: requested, profitGuard: true }, [
    { productId: 1, sku: 'SALE', unitPriceVnd: price, unitCostVnd: cost, quantity: 1 },
  ]).eligible;
}

// A slower seller may receive a deeper discount, but never more than the spec's single-item profit floor permits.
export function weeklySalePercent(price: number, cost: number, ageDays: number, maximum: number): number {
  const target = Math.min(maximum, ageDays >= 120 ? 25 : ageDays >= 90 ? 20 : 15);
  for (let percent = target; percent > 10; percent--) if (safeSalePercent(price, cost, percent)) return percent;
  return 0;
}

export function vietnamWeekStart(now: Date): Date {
  const local = new Date(now.getTime() + 7 * 3600_000);
  const day = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day) - 7 * 3600_000);
}

export const memberReferenceFromList = memberPrice;
