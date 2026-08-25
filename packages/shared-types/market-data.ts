export const INTERVAL_1M_MS = 60 * 1000;
export const INTERVAL_5M_MS = 5 * 60 * 1000;
export const INTERVAL_15M_MS = 15 * 60 * 1000;
export const INTERVAL_1H_MS = 60 * 60 * 1000;
export const INTERVAL_1D_MS = 24 * 60 * 60 * 1000;

export interface OhlcCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function createOhlcFromTrade(
  price: number,
  volume: number,
  openTime: number,
): OhlcCandle {
  return {
    openTime,
    open: price,
    high: price,
    low: price,
    close: price,
    volume,
  };
}

export function mergeTradeIntoOhlc(
  existing: OhlcCandle | null,
  price: number,
  volume: number,
  openTime: number,
): OhlcCandle {
  if (!existing || existing.openTime !== openTime) {
    return createOhlcFromTrade(price, volume, openTime);
  }

  return {
    openTime,
    open: existing.open,
    high: Math.max(existing.high, price),
    low: Math.min(existing.low, price),
    close: price,
    volume: existing.volume + volume,
  };
}
