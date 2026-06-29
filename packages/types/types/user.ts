export interface Order {
  id: string;
  userId: string;
  type: string;
  totalQty: number;
  filledQty: number;
  price: number;
  status: string;
  margin: number;
  kind: "LONG" | "SHORT";
  market: string;
  transactionTime: string;
}
