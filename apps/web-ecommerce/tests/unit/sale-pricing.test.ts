import {
  catalogPricing,
  legacyCatalogFormula,
  safeSalePercent,
  weeklySalePercent,
  vietnamWeekStart,
} from '../../src/shared/sale-pricing';
import { memberPrice } from '../../src/shared/pricing';
import { couponDiscount } from '../../src/core/server/services/CouponService';
import { applyDiscount } from '../../src/core/server/services/ProductDiscountService';

describe('shop sale and catalog pricing', () => {
  // The former formula (R ≈ S ÷ 0.9), kept only for the catalogue migration that applied it.
  it('calculates the legacy B and R from the spec example, with ordinary issue deductions', () => {
    const result = legacyCatalogFormula(1_100_000, 2);
    expect(result.buybackPriceVnd).toBe(750_000); // 1,100,000 − 250,000 − 2 × 50,000
    expect(result.listPriceVnd).toBe(1_222_222);
    expect(memberPrice(result.listPriceVnd)).toBe(1_100_000);
  });
  it.each([500_000, 500_001, 1_000_000, 1_000_001, 1_500_000, 2_000_000, 3_000_000, 5_000_000])(
    'round-trips the member price at %i',
    (s) => {
      expect(memberPrice(legacyCatalogFormula(s, 0).listPriceVnd)).toBe(s);
    },
  );
  it('does not invent formulas for appraisal-only goods or non-positive offers', () => {
    expect(() => legacyCatalogFormula(5_000_001, 0)).toThrow();
    expect(() => legacyCatalogFormula(100_000, 1)).toThrow();
    expect(() => legacyCatalogFormula(900_000, -1)).toThrow();
  });
  // Owner rule of 2026-10-25: S is the target price, B17 = ROUND(0.17 × S) at every price, and no R is derived from S.
  // Owner rule of 2026-10-26: S is entered; R = ROUND(S / 0.9), B by three rates and C50 = 50% of S follow it.
  it('derives the web price, the buyback price and the pawn amount from S', () => {
    expect(catalogPricing(1_100_000)).toEqual({
      referenceMemberVnd: 1_100_000,
      listPriceVnd: 1_222_222,
      buybackPriceVnd: 220_000,
      pawnPriceVnd: 550_000,
    });
    expect(catalogPricing(2_500_000)).toEqual({
      referenceMemberVnd: 2_500_000,
      listPriceVnd: 2_777_778,
      buybackPriceVnd: 425_000,
      pawnPriceVnd: 1_250_000,
    });
    expect(catalogPricing(500_001).pawnPriceVnd).toBe(250_001);
    // MEMBER10 takes R back to exactly S.
    for (const s of [1, 99, 500_001, 1_150_001, 2_700_000, 40_000_000])
      expect(memberPrice(catalogPricing(s).listPriceVnd)).toBe(s);
    expect(() => catalogPricing(1_000_000_001)).toThrow();
    expect(() => catalogPricing(0)).toThrow();
    expect(() => catalogPricing(1.5)).toThrow();
  });
  it('selects deeper weekly discounts only when the original profit floor allows them', () => {
    expect(weeklySalePercent(1_000_000, 100_000, 60, 25)).toBe(15);
    expect(weeklySalePercent(1_000_000, 100_000, 90, 25)).toBe(20);
    expect(weeklySalePercent(1_000_000, 100_000, 120, 25)).toBe(25);
    expect(weeklySalePercent(1_000_000, 850_000, 120, 25)).toBe(11);
    expect(weeklySalePercent(1_000_000, 0, 120, 25)).toBe(0);
    expect(safeSalePercent(1_000_000, 950_000, 10)).toBe(false);
  });
  it('uses the spec half-up discount rounding, including half-VND boundaries', () => {
    expect(applyDiscount(105, 10)).toBe(94);
    expect(applyDiscount(105, 10)).toBe(memberPrice(105));
  });
  it('finds the Monday boundary in Vietnam rather than UTC', () => {
    expect(vietnamWeekStart(new Date('2026-10-18T18:00:00Z')).toISOString()).toBe('2026-10-18T17:00:00.000Z');
    expect(vietnamWeekStart(new Date('2026-10-18T16:59:00Z')).toISOString()).toBe('2026-10-11T17:00:00.000Z');
  });
  it('allows one member voucher on a sale only if the combined original profit floor holds', () => {
    const member = { source: 'member', kind: 'member', discountPercent: 10, profitGuard: true } as const;
    const line = {
      productId: 1,
      sku: 'KIT',
      listPrice: 1_000_000,
      salePrice: 850_000,
      quantity: 1,
      costVnd: 100_000,
      managedSale: true,
    };
    expect(couponDiscount(member, [line])).toBe(85_000);
    expect(() => couponDiscount(member, [{ ...line, salePrice: 750_000 }])).toThrow();
    expect(() => couponDiscount({ source: 'admin', discountPercent: 25 }, [line])).toThrow();
  });
});
