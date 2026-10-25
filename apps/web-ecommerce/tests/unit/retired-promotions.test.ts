import { isRetiredTimedCoupon } from '../../src/shared/retired-promotions';
import { assertCouponUsable } from '../../src/core/server/services/CouponService';
import type CouponModel from '../../src/core/server/database/client/models/Coupon.Model';
describe('retired automatic timed vouchers', () => {
  test.each(['D261025-00', 'D261025-12', 'd261025-20'])(
    'rejects previously issued %s even when otherwise active',
    (code) => {
      expect(isRetiredTimedCoupon(code)).toBe(true);
      try {
        assertCouponUsable({ code, isActive: true } as CouponModel, 1000000);
        throw new Error('accepted retired coupon');
      } catch (error) {
        expect(error).toMatchObject({ statusCode: 409, code: 'PROMOTION_RETIRED' });
      }
    },
  );
  test.each(['FREESHIP30', 'FREESHIP50', 'MEMBER-MONTHLY', 'CUSTOM-12', 'D261025-21'])(
    'does not retire ordinary coupon %s',
    (code) => expect(isRetiredTimedCoupon(code)).toBe(false),
  );
});
