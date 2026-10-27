import { cancellationFeeVnd, isCustomerSideCancellation } from '../../src/shared/cancellation';

describe('cancellation keeps funds as a liability pending reviewed refund', () => {
  const order = { total: 2_030_000, subtotal: 2_000_000, discount: 0, shippingFee: 30_000 };

  it('never automatically forfeits a paid deposit', () => {
    expect(cancellationFeeVnd({ ...order, paymentPlan: 'deposit', upfrontDueVnd: 200_000, prepaidVnd: 200_000 })).toBe(
      0,
    );
    expect(cancellationFeeVnd({ ...order, paymentPlan: 'deposit', upfrontDueVnd: 200_000, prepaidVnd: 0 })).toBe(0);
    expect(cancellationFeeVnd({ ...order, paymentPlan: 'deposit', upfrontDueVnd: 200_001, prepaidVnd: 200_001 })).toBe(
      0,
    );
  });

  it('never penalizes a full payment automatically', () => {
    expect(
      cancellationFeeVnd({ ...order, paymentPlan: 'full', upfrontDueVnd: order.total, prepaidVnd: order.total }),
    ).toBe(0);
  });

  it('applies only when the customer gave the order up', () => {
    expect(isCustomerSideCancellation({ cancelledBy: 'customer' })).toBe(true);
    expect(isCustomerSideCancellation({ cancelledBy: 'staff', cancelReason: 'customer_request' })).toBe(true);
    expect(isCustomerSideCancellation({ cancelledBy: 'staff', cancelReason: 'customer_unreachable' })).toBe(true);
    expect(isCustomerSideCancellation({ cancelledBy: 'system', cancelReason: 'customer_request' })).toBe(true);
    expect(isCustomerSideCancellation({ cancelledBy: 'staff', cancelReason: 'out_of_stock' })).toBe(false);
    expect(isCustomerSideCancellation({ cancelledBy: 'system', cancelReason: 'payment_timeout' })).toBe(false);
  });
});
