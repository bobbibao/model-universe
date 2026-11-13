export type MonthlyStats = {
  month: string;
  revenue: number;
  orders: number;
  discount: number;
  newCustomers: number;
  importCost: number;
};

export type TopProduct = { productId: number; name: string; quantity: number; revenue: number };

export type TopCustomer = { userId: number; name: string; email: string; orders: number; spent: number };

export type ChartSlice = { label: string; value: number };

export type Distributions = {
  orderStatus: ChartSlice[];
  categoryShare: ChartSlice[];
  stockAvailability: { inStock: number; outOfStock: number };
  userRoles: ChartSlice[];
};
