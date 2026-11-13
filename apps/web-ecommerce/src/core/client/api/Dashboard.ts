'use client';

import Api from './Api';
import { DASHBOARD_API } from './endpoint';
import type {
  Distributions,
  MonthlyStats,
  TopCustomer,
  TopProduct,
} from '@/shared/types/dashboard';

const get = async <T>(url: string, params?: object): Promise<T | undefined> => {
  try {
    const response = await Api.get(url, { params });
    return response.data;
  } catch (error) {
    return undefined;
  }
};

export default class DashboardApi {
  static getMonthly(months: number) {
    return get<MonthlyStats[]>(DASHBOARD_API.GET_MONTHLY, { months });
  }

  static getTopProducts(limit: number) {
    return get<TopProduct[]>(DASHBOARD_API.GET_TOP_PRODUCTS, { limit });
  }

  static getTopCustomers(limit: number) {
    return get<TopCustomer[]>(DASHBOARD_API.GET_TOP_CUSTOMERS, { limit });
  }

  static getDistributions() {
    return get<Distributions>(DASHBOARD_API.GET_DISTRIBUTIONS);
  }
}
