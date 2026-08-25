import {
  INTERVAL_1M_MS,
  INTERVAL_5M_MS,
  INTERVAL_15M_MS,
  INTERVAL_1D_MS,
  INTERVAL_1H_MS,
  mergeTradeIntoOhlc,
  type OhlcCandle,
} from '@repo/shared-types/market-data';

type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d';

const MAX_CANDLE_HISTORY = 200;

type MarketCandleState = {
  candle1m: OhlcCandle | null;
  candle5m: OhlcCandle | null;
  candle15m: OhlcCandle | null;
  candle1h: OhlcCandle | null;
  candle1d: OhlcCandle | null;
  history1m: OhlcCandle[];
  history5m: OhlcCandle[];
  history15m: OhlcCandle[];
  history1h: OhlcCandle[];
  history1d: OhlcCandle[];
};

const liveCandles: Record<string, MarketCandleState> = {};

function ensureMarket(market: string): MarketCandleState {
  if (!liveCandles[market]) {
    liveCandles[market] = {
      candle1m: null,
      candle5m: null,
      candle15m: null,
      candle1h: null,
      candle1d: null,
      history1m: [],
      history5m: [],
      history15m: [],
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

  const openTime1m = Math.floor(transactionTime / INTERVAL_1M_MS) * INTERVAL_1M_MS;
  const openTime5m = Math.floor(transactionTime / INTERVAL_5M_MS) * INTERVAL_5M_MS;
  const openTime15m = Math.floor(transactionTime / INTERVAL_15M_MS) * INTERVAL_15M_MS;
  const openTime1h = Math.floor(transactionTime / INTERVAL_1H_MS) * INTERVAL_1H_MS;
  const openTime1d = Math.floor(transactionTime / INTERVAL_1D_MS) * INTERVAL_1D_MS;

  const candle1m = mergeTradeIntoOhlc(state.candle1m, price, volume, openTime1m);
  const candle5m = mergeTradeIntoOhlc(state.candle5m, price, volume, openTime5m);
  const candle15m = mergeTradeIntoOhlc(state.candle15m, price, volume, openTime15m);
  const candle1h = mergeTradeIntoOhlc(state.candle1h, price, volume, openTime1h);
  const candle1d = mergeTradeIntoOhlc(state.candle1d, price, volume, openTime1d);

  state.history1m = archiveIfRolled(state.candle1m, candle1m, state.history1m);
  state.history5m = archiveIfRolled(state.candle5m, candle5m, state.history5m);
  state.history15m = archiveIfRolled(state.candle15m, candle15m, state.history15m);
  state.history1h = archiveIfRolled(state.candle1h, candle1h, state.history1h);
  state.history1d = archiveIfRolled(state.candle1d, candle1d, state.history1d);

  state.candle1m = candle1m;
  state.candle5m = candle5m;
  state.candle15m = candle15m;
  state.candle1h = candle1h;
  state.candle1d = candle1d;

  return { candle1m, candle5m, candle15m, candle1h, candle1d };
}

export function getCandleSeries(market: string, interval: CandleInterval): OhlcCandle[] {
  const state = liveCandles[market];
  if (!state) return [];

  if (interval === '1m') {
    return state.candle1m ? [...state.history1m, state.candle1m] : [...state.history1m];
  }
  if (interval === '5m') {
    return state.candle5m ? [...state.history5m, state.candle5m] : [...state.history5m];
  }
  if (interval === '15m') {
    return state.candle15m ? [...state.history15m, state.candle15m] : [...state.history15m];
  }
  if (interval === '1h') {
    return state.candle1h ? [...state.history1h, state.candle1h] : [...state.history1h];
  }

  return state.candle1d ? [...state.history1d, state.candle1d] : [...state.history1d];
}
