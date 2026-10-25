import { validateDirectSale } from '../../src/core/server/services/direct-sales/validation';

const sale = () => ({
  requestKey: 'fixture-sale-001',
  channel: 'COUNTER',
  fulfillment: 'HANDOVER',
  customerId: null,
  recipientName: '',
  phone: '',
  address: '',
  city: '',
  note: '',
  items: [{ productId: 2, quantity: 1 }],
  expectedTotal: 1000000,
  payment: 'CASH',
  moneyVerified: true,
  externalReference: 'cash-0000001',
});

describe('direct-sale input contract', () => {
  it('supports a walk-in guest without inventing an account or contact information', () => {
    expect(validateDirectSale(sale())).toMatchObject({
      customerId: null,
      recipientName: 'Khách lẻ',
      phone: '',
      payment: 'CASH',
      externalReference: 'CASH-0000001',
    });
  });
  it('canonicalizes line order and merges repeated SKUs for stable retry identity', () => {
    expect(
      validateDirectSale({
        ...sale(),
        items: [
          { productId: 3, quantity: 1 },
          { productId: 2, quantity: 1 },
          { productId: 3, quantity: 2 },
        ],
      }).items,
    ).toEqual([
      { productId: 2, quantity: 1 },
      { productId: 3, quantity: 3 },
    ]);
  });
  it.each([
    { items: [] },
    { items: [{ productId: 1, quantity: 0 }] },
    { items: [{ productId: 1, quantity: 1.5 }] },
    { items: [{ productId: '1', quantity: 1 }] },
    { items: [{ productId: 1, quantity: 1000 }] },
    { items: Array.from({ length: 101 }, (_, i) => ({ productId: i + 1, quantity: 1 })) },
    { customerId: -1 },
    { customerId: '1' },
    { expectedTotal: 2_147_483_648 },
    { expectedTotal: 0.5 },
    { moneyVerified: false },
    { externalReference: '' },
    { externalReference: 'qr screenshot' },
    { requestKey: '' },
    { channel: 'WEBSITE' },
    { fulfillment: 'UNKNOWN' },
    { payment: 'CARD' },
    { phone: 'invalid' },
    { note: 'a'.repeat(501) },
  ])('refuses malformed sales without coercing or truncating: %j', (extra) => {
    expect(() => validateDirectSale({ ...sale(), ...extra })).toThrow();
  });
  it('requires full recipient information for delivery, and refuses unpaid immediate handover', () => {
    expect(() => validateDirectSale({ ...sale(), fulfillment: 'DELIVERY' })).toThrow();
    expect(() =>
      validateDirectSale({ ...sale(), payment: 'UNPAID', moneyVerified: false, externalReference: '' }),
    ).toThrow();
    expect(
      validateDirectSale({
        ...sale(),
        fulfillment: 'DELIVERY',
        payment: 'UNPAID',
        moneyVerified: false,
        externalReference: '',
        recipientName: 'Collector',
        phone: '0901234567',
        address: '12 Nguyen Trai',
        city: 'HCM',
      }),
    ).toMatchObject({ payment: 'UNPAID' });
  });
  it('refuses phantom receipts on unpaid orders and duplicate quantities above the line limit', () => {
    expect(() => validateDirectSale({ ...sale(), fulfillment: 'DELIVERY', payment: 'UNPAID' })).toThrow();
    expect(() =>
      validateDirectSale({
        ...sale(),
        items: [
          { productId: 1, quantity: 999 },
          { productId: 1, quantity: 1 },
        ],
      }),
    ).toThrow();
  });
});
