export type CustomerOverview = { total: number; new30Days: number; purchased: number; repeat: number };
export type OrderOverview = {
  processing: number;
  shipping: number;
  receivableVnd: number;
  unpaidOrders: number;
  cancellationRequests: number;
};
