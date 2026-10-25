import type { ModelCondition } from './gunpla';

export type DirectSalePayment = 'CASH' | 'BANK_TRANSFER' | 'UNPAID';
export interface DirectSaleInput {
  requestKey: string;
  channel: 'COUNTER' | 'ASSISTED';
  fulfillment: 'HANDOVER' | 'DELIVERY';
  customerId: number | null;
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  note: string;
  items: { productId: number; quantity: number }[];
  expectedTotal: number;
  payment: DirectSalePayment;
  moneyVerified: boolean;
  externalReference: string;
}
export interface DirectSaleProduct {
  id: number;
  name: string;
  sku: string;
  imageUrl: string;
  condition: ModelCondition;
  conditionNote: string | null;
  stock: number;
  salePrice: number;
}
export interface DirectSaleCustomer {
  id: number;
  name: string;
  phone: string | null;
  email: string;
}
