import {
  buildFinanceReport,
  financePeriod,
  periodBounds,
  type FinanceData,
  type FinanceOrder,
} from '../../src/shared/finance';
const order = (overrides: Partial<FinanceOrder> = {}): FinanceOrder => ({
  id: 1,
  userId: 1,
  status: 'DELIVERED',
  salesChannel: 'WEBSITE',
  createdAt: '2026-10-10T03:00:00Z',
  deliveredAt: '2026-10-12T03:00:00Z',
  subtotal: 1000000,
  discount: 100000,
  shippingFee: 30000,
  shippingDiscountVnd: 10000,
  total: 920000,
  recipientName: 'QA',
  couponCode: 'MEMBER10',
  benefitSnapshot: { scope: 'shop_owned', voucher: { couponCode: 'MEMBER10', discountVnd: 100000 } },
  items: [
    {
      id: 11,
      productId: 101,
      productName: 'MG QA',
      quantity: 2,
      unitPrice: 500000,
      modelSnapshot: { financeListUnitVnd: 600000 },
    },
  ],
  review: { version: 1, items: [{ orderItemId: 11, unitCostVnd: 200000 }], costsReviewed: true, note: 'Invoice' },
  ...overrides,
});
const data = (overrides: Partial<FinanceData> = {}): FinanceData => ({
  orders: [order()],
  refunds: [],
  restocks: [],
  cash: [{ createdAt: '2026-10-10T03:00:00Z', amountVnd: 920000 }],
  expenses: [
    {
      id: 1,
      orderId: 1,
      amountVnd: 20000,
      incurredAt: '2026-10-11T03:00:00Z',
      nameSnapshot: 'Packing',
      categorySnapshot: 'PACKAGING',
      quantity: 2,
      unitCostVnd: 10000,
      basisSnapshot: 'QUANTITY',
      note: 'Invoice',
      reversesId: null,
      createdAt: '2026-10-11T03:00:00Z',
    },
    {
      id: 2,
      orderId: 1,
      amountVnd: 35000,
      incurredAt: '2026-10-11T03:00:00Z',
      nameSnapshot: 'Carrier',
      categorySnapshot: 'SHIPPING',
      quantity: 1,
      unitCostVnd: 35000,
      basisSnapshot: 'ACTUAL',
      note: 'Invoice',
      reversesId: null,
      createdAt: '2026-10-11T03:00:00Z',
    },
  ],
  ...overrides,
});
const calculate = (source = data()) => financePeriod(source, '2026-10-01', '2026-10-31');
describe('management finance in integer VND', () => {
  it('does not silently date a delivered order by its creation timestamp', () => {
    const source = data();
    source.orders.push(order({ id: 2, deliveredAt: null }));
    expect(calculate(source)).toMatchObject({
      netRevenueVnd: 920000,
      profitVnd: null,
      quality: { missingDeliveryDates: 1 },
    });
  });
  it('fails explicitly instead of returning imprecise VND totals beyond safe integers', () => {
    const row = order();
    row.review!.items[0].unitCostVnd = Number.MAX_SAFE_INTEGER;
    expect(() => calculate(data({ orders: [row] }))).toThrow('FINANCE_AMOUNT_OVERFLOW');
  });
  it('separates merchandise, customer shipping, COGS, actual carrier and packing costs', () => {
    expect(calculate()).toMatchObject({
      grossMerchandiseVnd: 1200000,
      soldMerchandiseVnd: 1000000,
      markdownVnd: 200000,
      netRevenueVnd: 920000,
      cogsVnd: 400000,
      expenseVnd: 55000,
      profitVnd: 465000,
      aovVnd: 900000,
    });
  });
  it('does not deduct product markdowns, vouchers or shipping support twice', () => {
    const result = calculate();
    expect(result.promotions.totalVnd).toBe(310000);
    expect(result.profitVnd).toBe(465000);
    expect(result.promotions.memberVnd).toBe(100000);
  });
  it('does not recognize cash deposits or processing orders as delivered revenue', () => {
    expect(calculate(data({ orders: [order({ status: 'PROCESSING', deliveredAt: null })] }))).toMatchObject({
      netRevenueVnd: 0,
      orders: 0,
      verifiedCashNetVnd: 920000,
      profitVnd: -55000,
    });
  });
  it('excludes cancelled sales while retaining their actual recorded expenses and cash ledger', () => {
    expect(calculate(data({ orders: [order({ status: 'CANCELLED', deliveredAt: null })] }))).toMatchObject({
      netRevenueVnd: 0,
      expenseVnd: 55000,
      profitVnd: -55000,
      cancelledOrders: 1,
    });
  });
  it('reduces revenue on verified refunds, reversing COGS only after actual restocking', () => {
    const source = data({
      refunds: [
        { orderId: 1, createdAt: '2026-10-20T03:00:00Z', merchandiseVnd: 100000, shippingVnd: 5000, taxVnd: 1000 },
      ],
    });
    expect(calculate(source)).toMatchObject({ netRevenueVnd: 815000, cogsVnd: 400000, profitVnd: 360000 });
    source.restocks.push({ createdAt: '2026-10-21T03:00:00Z', quantity: 1, unitCostVnd: 200000 });
    expect(calculate(source)).toMatchObject({ cogsVnd: 200000, profitVnd: 560000 });
  });
  it('includes a refund in this period even when the original sale was in a prior period', () => {
    const result = calculate(
      data({
        refunds: [
          { orderId: 99, createdAt: '2026-10-20T03:00:00Z', merchandiseVnd: 200000, shippingVnd: 0, taxVnd: 0 },
        ],
      }),
    );
    expect(result.netRevenueVnd).toBe(720000);
    expect(result.refundedOrders).toBe(1);
  });
  it('leaves profit unavailable if a single unit lacks verified acquisition cost', () => {
    expect(calculate(data({ orders: [order({ review: null })] }))).toMatchObject({
      profitVnd: null,
      cogsVnd: null,
      quality: { missingCostUnits: 2, unreviewedOrders: 1 },
    });
  });
  it('requires review even when costs have been entered', () => {
    const row = order();
    row.review!.costsReviewed = false;
    expect(calculate(data({ orders: [row] })).profitVnd).toBeNull();
  });
  it('never replaces missing historical list snapshots with current catalog prices', () => {
    const row = order();
    row.items[0].modelSnapshot = null;
    expect(calculate(data({ orders: [row] }))).toMatchObject({
      grossMerchandiseVnd: null,
      markdownVnd: null,
      netRevenueVnd: 920000,
      promotions: { totalVnd: null },
    });
  });
  it('keeps zero acquisition cost distinct from an unknown cost', () => {
    const row = order();
    row.review!.items[0].unitCostVnd = 0;
    expect(calculate(data({ orders: [row] })).cogsVnd).toBe(0);
  });
  it('does not fabricate partner profit without settlement costs', () => {
    const row = order();
    row.items[0].modelSnapshot!.partnerId = 10;
    expect(calculate(data({ orders: [row] })).profitVnd).toBeNull();
  });
  it('offsets reversed expenses in their original period without mutating the original entry', () => {
    const source = data();
    source.expenses.push({
      ...source.expenses[0],
      id: 3,
      amountVnd: -20000,
      quantity: -2,
      reversesId: 1,
      createdAt: '2026-11-10T03:00:00Z',
    });
    expect(calculate(source).expenseVnd).toBe(35000);
    expect(source.expenses[0].amountVnd).toBe(20000);
  });
  it('uses the shop timezone at midnight boundaries', () => {
    const result = calculate(
      data({
        cash: [
          { createdAt: '2026-09-30T16:59:59Z', amountVnd: 10 },
          { createdAt: '2026-09-30T17:00:00Z', amountVnd: 20 },
          { createdAt: '2026-10-31T17:00:00Z', amountVnd: 40 },
        ],
      }),
    );
    expect(result.verifiedCashNetVnd).toBe(20);
  });
  it('rejects invalid dates and unbounded report intervals', () => {
    for (const dates of [
      ['2026-02-30', '2026-03-03'],
      ['2026-10-01', '2026-09-30'],
      ['2024-01-01', '2026-01-01'],
    ])
      expect(() => periodBounds(dates[0], dates[1])).toThrow('INVALID_DATE_RANGE');
  });
  it('uses an equal-length preceding comparison period and fills empty series dates', () => {
    const result = buildFinanceReport(data(), '2026-10-01', '2026-10-03');
    expect(result).toMatchObject({ previousFrom: '2026-09-28', previousTo: '2026-09-30' });
    expect(result.series).toHaveLength(3);
    expect(result.series.every((r) => r.netRevenueVnd === 0)).toBe(true);
  });
  it('refuses profit if order lines do not reconcile with merchandise subtotal', () => {
    expect(calculate(data({ orders: [order({ subtotal: 999999 })] })).profitVnd).toBeNull();
  });
});
