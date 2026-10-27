// Management reporting in integer VND. Revenue follows delivery; cash follows verified ledger events.
export const FINANCE_CATEGORIES = ['PACKAGING', 'SHIPPING', 'LABOUR', 'OPERATING', 'OTHER'] as const;
export const COST_BASES = ['ORDER', 'PARCEL', 'QUANTITY', 'ACTUAL'] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
export type CostBasis = (typeof COST_BASES)[number];
export interface FinanceLine {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  modelSnapshot?: { financeListUnitVnd?: number; partnerId?: number | null } | null;
}
export interface FinanceReview {
  version: number;
  items: { orderItemId: number; unitCostVnd: number | null }[];
  costsReviewed: boolean;
  note: string;
}
export interface FinanceOrder {
  id: number;
  userId: number | null;
  status: string;
  salesChannel: string;
  createdAt: string;
  deliveredAt: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  shippingDiscountVnd: number;
  total: number;
  tax?: number;
  recipientName: string;
  couponCode: string | null;
  benefitSnapshot: {
    scope?: string;
    voucher?: { couponCode?: string; discountVnd?: number };
    rank?: { discountVnd?: number };
  } | null;
  items: FinanceLine[];
  review: FinanceReview | null;
}
export interface FinanceExpense {
  id: number;
  orderId: number | null;
  amountVnd: number;
  incurredAt: string;
  nameSnapshot: string;
  categorySnapshot: FinanceCategory;
  quantity: number;
  unitCostVnd: number;
  basisSnapshot: CostBasis;
  unitSnapshot?: string;
  note: string;
  reversesId: number | null;
  createdAt: string;
}
export interface FinanceData {
  orders: FinanceOrder[];
  refunds: { orderId: number; createdAt: string; merchandiseVnd: number; shippingVnd: number; taxVnd: number }[];
  cash: { createdAt: string; amountVnd: number }[];
  restocks: { createdAt: string; quantity: number; unitCostVnd: number | null }[];
  expenses: FinanceExpense[];
}
const shopDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const shopDay = (value: string | Date) => shopDayFormatter.format(new Date(value));
const sum = <T>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
const between = (value: string | null, from: string, to: string) =>
  !!value && shopDay(value) >= from && shopDay(value) <= to;
export function periodBounds(from: string, to: string) {
  if (
    ![from, to].every(
      (day) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        !Number.isNaN(Date.parse(day)) &&
        new Date(day).toISOString().slice(0, 10) === day,
    )
  )
    throw new Error('INVALID_DATE_RANGE');
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days < 1 || days > 366) throw new Error('INVALID_DATE_RANGE');
  const previousTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  const previousFrom = new Date(Date.parse(from) - days * 86400000).toISOString().slice(0, 10);
  return {
    from,
    to,
    days,
    previousFrom,
    previousTo,
    start: new Date(`${previousFrom}T00:00:00+07:00`),
    end: new Date(Date.parse(`${to}T00:00:00+07:00`) + 86400000),
  };
}
export function financePeriod(data: FinanceData, from: string, to: string) {
  const delivered = data.orders.filter((o) => o.status === 'DELIVERED' && between(o.deliveredAt, from, to));
  const refunds = data.refunds.filter((r) => between(r.createdAt, from, to));
  const restocks = data.restocks.filter((r) => between(r.createdAt, from, to));
  const expenses = data.expenses.filter((e) => between(e.incurredAt, from, to));
  let cogsVnd = 0,
    missingCostUnits = 0,
    missingListUnits = 0,
    markdownVnd = 0,
    unreviewedOrders = 0,
    partnerUnits = 0,
    mismatchOrders = 0;
  const top = new Map<number, { productId: number; name: string; quantity: number; merchandiseVnd: number }>();
  for (const order of delivered) {
    if (!order.review?.costsReviewed) unreviewedOrders++;
    if (
      sum(order.items, (line) => line.quantity * line.unitPrice) !== order.subtotal ||
      order.discount > order.subtotal ||
      order.shippingDiscountVnd > order.shippingFee ||
      order.total !== order.subtotal - order.discount + order.shippingFee - order.shippingDiscountVnd + (order.tax ?? 0)
    )
      mismatchOrders++;
    for (const line of order.items) {
      const cost = order.review?.items.find((i) => i.orderItemId === line.id)?.unitCostVnd;
      if (cost === null || cost === undefined) missingCostUnits += line.quantity;
      else cogsVnd += cost * line.quantity;
      const list = line.modelSnapshot?.financeListUnitVnd;
      if (typeof list !== 'number' || list < line.unitPrice) missingListUnits += line.quantity;
      else markdownVnd += (list - line.unitPrice) * line.quantity;
      if (line.modelSnapshot?.partnerId) partnerUnits += line.quantity;
      const row = top.get(line.productId) ?? {
        productId: line.productId,
        name: line.productName,
        quantity: 0,
        merchandiseVnd: 0,
      };
      row.quantity += line.quantity;
      row.merchandiseVnd += line.quantity * line.unitPrice;
      top.set(row.productId, row);
    }
  }
  let missingRestockUnits = 0;
  for (const returned of restocks) {
    if (returned.unitCostVnd === null) missingRestockUnits += returned.quantity;
    else cogsVnd -= returned.unitCostVnd * returned.quantity;
  }
  const soldMerchandiseVnd = sum(delivered, (o) => o.subtotal);
  const orderDiscountVnd = sum(delivered, (o) => o.discount);
  const merchandiseRefundVnd = sum(refunds, (r) => r.merchandiseVnd);
  const shippingSupportVnd = sum(delivered, (o) => o.shippingDiscountVnd);
  const netShippingVnd =
    sum(delivered, (o) => o.shippingFee - o.shippingDiscountVnd) - sum(refunds, (r) => r.shippingVnd);
  const netMerchandiseVnd = soldMerchandiseVnd - orderDiscountVnd - merchandiseRefundVnd;
  const netRevenueVnd = netMerchandiseVnd + netShippingVnd;
  const expenseVnd = sum(expenses, (e) => Number(e.amountVnd));
  const missingDeliveryDates = data.orders.filter(
    (o) => o.status === 'DELIVERED' && !o.deliveredAt && between(o.createdAt, from, to),
  ).length;
  if (![cogsVnd, netRevenueVnd, expenseVnd].every(Number.isSafeInteger)) throw new Error('FINANCE_AMOUNT_OVERFLOW');
  const complete =
    missingDeliveryDates === 0 &&
    missingCostUnits === 0 &&
    missingRestockUnits === 0 &&
    unreviewedOrders === 0 &&
    partnerUnits === 0 &&
    mismatchOrders === 0 &&
    (delivered.length > 0 || restocks.length > 0 || refunds.length > 0 || expenses.length > 0);
  const profitVnd = complete ? netRevenueVnd - cogsVnd - expenseVnd : null;
  const voucherVnd = sum(delivered, (o) => Math.min(o.discount, Number(o.benefitSnapshot?.voucher?.discountVnd ?? 0)));
  const rankVnd = sum(delivered, (o) =>
    Math.min(
      Math.max(0, o.discount - Number(o.benefitSnapshot?.voucher?.discountVnd ?? 0)),
      Number(o.benefitSnapshot?.rank?.discountVnd ?? 0),
    ),
  );
  const memberVnd = sum(delivered, (o) =>
    o.benefitSnapshot?.voucher?.couponCode === 'MEMBER10'
      ? Math.min(o.discount, Number(o.benefitSnapshot.voucher.discountVnd ?? 0))
      : 0,
  );
  return {
    orders: delivered.length,
    soldUnits: sum(delivered, (o) => sum(o.items, (i) => i.quantity)),
    soldMerchandiseVnd,
    grossMerchandiseVnd: missingListUnits ? null : soldMerchandiseVnd + markdownVnd,
    markdownVnd: missingListUnits ? null : markdownVnd,
    orderDiscountVnd,
    merchandiseRefundVnd,
    shippingSupportVnd,
    netShippingVnd,
    netMerchandiseVnd,
    netRevenueVnd,
    verifiedCashNetVnd: sum(
      data.cash.filter((c) => between(c.createdAt, from, to)),
      (c) => Number(c.amountVnd),
    ),
    cogsVnd: missingCostUnits || missingRestockUnits ? null : cogsVnd,
    knownCogsVnd: cogsVnd,
    expenseVnd,
    profitVnd,
    marginPercent: profitVnd !== null && netRevenueVnd > 0 ? (profitVnd / netRevenueVnd) * 100 : null,
    aovVnd: delivered.length ? Math.round((soldMerchandiseVnd - orderDiscountVnd) / delivered.length) : null,
    cancelledOrders: data.orders.filter((o) => o.status === 'CANCELLED' && between(o.createdAt, from, to)).length,
    refundedOrders: new Set(refunds.map((r) => r.orderId)).size,
    quality: {
      missingCostUnits,
      missingRestockUnits,
      missingListUnits,
      unreviewedOrders,
      partnerUnits,
      mismatchOrders,
      missingDeliveryDates,
    },
    promotions: {
      memberVnd,
      voucherVnd: voucherVnd - memberVnd,
      rankVnd,
      unclassifiedVnd: orderDiscountVnd - voucherVnd - rankVnd,
      shippingSupportVnd,
      totalVnd: missingListUnits ? null : markdownVnd + orderDiscountVnd + shippingSupportVnd,
      confirmedShopFundedVnd: sum(
        delivered.filter((o) => o.benefitSnapshot?.scope === 'shop_owned'),
        (o) => o.discount + o.shippingDiscountVnd,
      ),
    },
    expenseGroups: FINANCE_CATEGORIES.map((category) => ({
      category,
      amountVnd: sum(
        expenses.filter((e) => e.categorySnapshot === category),
        (e) => Number(e.amountVnd),
      ),
    })),
    topProductsByRevenue: [...top.values()]
      .sort((a, b) => b.merchandiseVnd - a.merchandiseVnd || b.quantity - a.quantity)
      .slice(0, 8),
    topProducts: [...top.values()]
      .sort((a, b) => b.quantity - a.quantity || b.merchandiseVnd - a.merchandiseVnd)
      .slice(0, 8),
  };
}
export function buildFinanceReport(data: FinanceData, from: string, to: string) {
  const bounds = periodBounds(from, to);
  const series = [];
  let cursor = from;
  while (cursor <= to) {
    const end =
      bounds.days > 62
        ? new Date(Date.UTC(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7)), 0)).toISOString().slice(0, 10)
        : cursor;
    const last = end < to ? end : to;
    const value = financePeriod(data, cursor, last);
    series.push({
      date: cursor,
      netRevenueVnd: value.netRevenueVnd,
      profitVnd: value.profitVnd,
      expenseVnd: value.expenseVnd,
      verifiedCashNetVnd: value.verifiedCashNetVnd,
    });
    cursor = new Date(Date.parse(last) + 86400000).toISOString().slice(0, 10);
  }
  return {
    from,
    to,
    timeZone: 'Asia/Ho_Chi_Minh',
    granularity: bounds.days > 62 ? ('month' as const) : ('day' as const),
    previousFrom: bounds.previousFrom,
    previousTo: bounds.previousTo,
    current: financePeriod(data, from, to),
    previous: financePeriod(data, bounds.previousFrom, bounds.previousTo),
    series,
    generatedAt: new Date().toISOString(),
  };
}
export type FinanceReport = ReturnType<typeof buildFinanceReport>;
