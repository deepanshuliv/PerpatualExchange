export interface Position {
  userId: string;
  market: string;
  qty: number;
  entryPrice: number;
  margin: number;
  pnl?: number;
}
