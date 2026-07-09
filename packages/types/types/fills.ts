import type { OrderType } from './order';

export interface Fill {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  qty: number;
  type: OrderType;
  kind: 'LONG' | 'SHORT';
  status: string;
  transactionTime: string;
}
