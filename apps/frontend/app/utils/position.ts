/** Unrealized PnL using mark price — matches engine PositionManager logic. */
export function calculateUnrealizedPnl(
  qty: number,
  entryPrice: number,
  markPrice: number,
): number {
  if (!markPrice || !qty || !entryPrice) return 0;
  const sign = qty > 0 ? 1 : -1;
  return sign * Math.abs(qty) * (markPrice - entryPrice);
}
