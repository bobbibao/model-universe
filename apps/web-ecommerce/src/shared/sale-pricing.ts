import { evaluateVoucher, memberPrice, listPriceForMemberPrice } from './pricing';
import { b17, baseDeduction, DEDUCTION_PER_ISSUE_VND } from './buyback-pricing';

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

// Catalogue prices (owner rule of 2026-10-25, docs/business/source/vi/buyback-17-percent-specification.md): S is the
// shop's target selling price, approved by an admin; its buy-back reference is B17 = 17% of S. The public list price R
// is only ever a real published price approved with its proof (PricingApprovalService), never derived as S ÷ 0.9;
// until R is approved the shop sells at S.
export const CATALOG_MAX_REFERENCE_VND = 1_000_000_000;
export function catalogPricing(targetPriceVnd: number) {
  if (!Number.isSafeInteger(targetPriceVnd) || targetPriceVnd < 1 || targetPriceVnd > CATALOG_MAX_REFERENCE_VND)
    throw new Error('Giá bán mục tiêu S phải là số nguyên từ 1đ đến 1.000.000.000đ.');
  return { referenceMemberVnd: targetPriceVnd, buybackPriceVnd: b17(targetPriceVnd) };
}

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
