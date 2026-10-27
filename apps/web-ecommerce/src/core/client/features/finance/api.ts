'use client';
import Api from '@/core/client/api/Api';
import type {
  CostBasis,
  FinanceCategory,
  FinanceExpense,
  FinanceOrder,
  FinanceReport,
  FinanceReview,
} from '@/shared/finance';
export interface CostType {
  id: number;
  name: string;
  unit: string;
  category: FinanceCategory;
  basis: CostBasis;
  unitCostVnd: number;
  isActive: boolean;
  version: number;
}
export interface OrderDetail extends FinanceOrder {
  expenses: FinanceExpense[];
  revisions: FinanceReview[];
  shipments: { trackingNumber: string; shippingFeeVnd: number; status: string }[];
}
export interface Report extends FinanceReport {
  developmentFixtures?: boolean;
  inventory: {
    units: number;
    referenceValueVnd: number;
    uncostedUnits: number;
    undatedUnits: number;
    asOf: string;
    aging: { id: number; name: string; stock: number; lastReceiptAt: string }[];
  };
}
export interface Page<T> {
  rows: T[];
  count: number;
  page: number;
}
const root = '/admin/finance';
export const financeApi = {
  report: async (params: object) => (await Api.get<Report>(`${root}/report`, { params })).data,
  orders: async (params: object) => (await Api.get<Page<FinanceOrder>>(`${root}/orders`, { params })).data,
  order: async (id: number) => (await Api.get<OrderDetail>(`${root}/orders/${id}`)).data,
  types: async () => (await Api.get<CostType[]>(`${root}/cost-types`)).data,
  saveType: async (id: number | undefined, data: object) =>
    id ? Api.put(`${root}/cost-types/${id}`, data) : Api.post(`${root}/cost-types`, data),
  expenses: async (params: object) =>
    (await Api.get<Page<FinanceExpense & { reversed: boolean }>>(`${root}/expenses`, { params })).data,
  expense: async (data: object) => Api.post(`${root}/expenses`, data),
  reverse: async (id: number, data: object) => Api.post(`${root}/expenses/${id}/reverse`, data),
  reconcile: async (id: number, data: object) => Api.post(`${root}/orders/${id}/reconcile`, data),
};
export const amount = (value: number | string | null | undefined, en = false) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat(en ? 'en-GB' : 'vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(Number(value));
export const categoryLabels: Record<FinanceCategory, string> = {
  PACKAGING: 'Vật tư đóng gói',
  SHIPPING: 'Vận chuyển',
  LABOUR: 'Nhân công',
  OPERATING: 'Vận hành',
  OTHER: 'Chi phí khác',
};
export const basisLabels: Record<CostBasis, string> = {
  ORDER: 'Theo đơn',
  PARCEL: 'Theo kiện',
  QUANTITY: 'Theo lượng vật tư',
  ACTUAL: 'Chi phí thực tế',
};
