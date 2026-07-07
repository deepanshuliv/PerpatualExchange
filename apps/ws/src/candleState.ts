import {
  INTERVAL_1D_MS,
  INTERVAL_1H_MS,
  mergeTradeIntoOhlc,
  type OhlcCandle,
} from '@repo/shared-types/market-data';

// keeps the current 1h and 1d candle per market in memory
const liveCandles: Record<string, { candle1h: OhlcCandle | null; candle1d: OhlcCandle | null }> =
  {};

export function applyTradeToLiveCandles(
  market: string,
  price: number,
  volume: number,
  transactionTime: number,
) {
  if (!liveCandles[market]) {
    liveCandles[market] = { candle1h: null, candle1d: null };
  }

  const openTime1h = Math.floor(transactionTime / INTERVAL_1H_MS) * INTERVAL_1H_MS;
  const openTime1d = Math.floor(transactionTime / INTERVAL_1D_MS) * INTERVAL_1D_MS;

  const candle1h = mergeTradeIntoOhlc(
    liveCandles[market].candle1h,
    price,
    volume,
    openTime1h,
  );
  const candle1d = mergeTradeIntoOhlc(
    liveCandles[market].candle1d,
    price,
    volume,
    openTime1d,
  );

  liveCandles[market].candle1h = candle1h;
  liveCandles[market].candle1d = candle1d;

  return { candle1h, candle1d };
}
