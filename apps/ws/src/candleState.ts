import {
  INTERVAL_1D_MS,
  INTERVAL_1H_MS,
  mergeTradeIntoOhlc,
  type OhlcCandle,
} from '@repo/shared-types/market-data';

type CandleInterval = '1h' | '1d';

const MAX_CANDLE_HISTORY = 200;

type MarketCandleState = {
  candle1h: OhlcCandle | null;
  candle1d: OhlcCandle | null;
  history1h: OhlcCandle[];
  history1d: OhlcCandle[];
};

const liveCandles: Record<string, MarketCandleState> = {};

function ensureMarket(market: string): MarketCandleState {
  if (!liveCandles[market]) {
    liveCandles[market] = {
      candle1h: null,
      candle1d: null,
      history1h: [],
      history1d: [],
    };
  }
  return liveCandles[market];
}

function archiveIfRolled(
  previous: OhlcCandle | null,
  next: OhlcCandle,
  history: OhlcCandle[],
): OhlcCandle[] {
  if (previous && previous.openTime !== next.openTime) {
    return [...history, previous].slice(-MAX_CANDLE_HISTORY);
  }
  return history;
}

// Candles are built exclusively from real executed trades, so the OHLC always
// reflects actual traded prices and volume.
export function applyTradeToLiveCandles(
  market: string,
  price: number,
  volume: number,
  transactionTime: number,
) {
  const state = ensureMarket(market);

  const openTime1h = Math.floor(transactionTime / INTERVAL_1H_MS) * INTERVAL_1H_MS;
  const openTime1d = Math.floor(transactionTime / INTERVAL_1D_MS) * INTERVAL_1D_MS;

  const candle1h = mergeTradeIntoOhlc(state.candle1h, price, volume, openTime1h);
  const candle1d = mergeTradeIntoOhlc(state.candle1d, price, volume, openTime1d);

  state.history1h = archiveIfRolled(state.candle1h, candle1h, state.history1h);
  state.history1d = archiveIfRolled(state.candle1d, candle1d, state.history1d);

  state.candle1h = candle1h;
  state.candle1d = candle1d;

  return { candle1h, candle1d };
}

export function getCandleSeries(market: string, interval: CandleInterval): OhlcCandle[] {
  const state = liveCandles[market];
  if (!state) return [];

  if (interval === '1h') {
    return state.candle1h ? [...state.history1h, state.candle1h] : [...state.history1h];
  }

  return state.candle1d ? [...state.history1d, state.candle1d] : [...state.history1d];
}
