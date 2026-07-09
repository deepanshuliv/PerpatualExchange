import type { OrderType } from './order';

export interface Order {
  id: string;
  userId: string;
  type: OrderType;
  totalQty: number;
  filledQty: number;
  price: number;
  status: string;
  margin: number;
  kind: "LONG" | "SHORT";
  market: string;
  transactionTime: string;
}
