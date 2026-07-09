import type { RedisClientType } from '@repo/redis';
import {
  INTERVAL_1D_MS,
  INTERVAL_1H_MS,
  mergeTradeIntoOhlc,
  type OhlcCandle,
} from '@repo/shared-types/market-data';

type DepthLevel = [number, number];
type CandleInterval = '1h' | '1d';

const MAX_CANDLE_HISTORY = 200;

type MarketCandleState = {
  candle1h: OhlcCandle | null;
  candle1d: OhlcCandle | null;
  history1h: OhlcCandle[];
  history1d: OhlcCandle[];
};

const liveCandles: Record<string, MarketCandleState> = {};
const lastDepthByMarket: Record<string, { bids: unknown; asks: unknown }> = {};
const lastMarkPriceByMarket: Record<string, number> = {};

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

export function midPriceFromDepth(bids: unknown, asks: unknown): number | null {
  const sortedBids = Array.isArray(bids)
    ? [...(bids as DepthLevel[])].sort((a, b) => Number(b[0]) - Number(a[0]))
    : [];
  const sortedAsks = Array.isArray(asks)
    ? [...(asks as DepthLevel[])].sort((a, b) => Number(a[0]) - Number(b[0]))
    : [];

  const bestBid = sortedBids.length > 0 ? Number(sortedBids[sortedBids.length - 1]![0]) : null;
  const bestAsk = sortedAsks.length > 0 ? Number(sortedAsks[0]![0]) : null;

  if (bestBid && bestAsk && bestBid > 0 && bestAsk > 0) {
    return (bestBid + bestAsk) / 2;
  }
  if (bestBid && bestBid > 0) return bestBid;
  if (bestAsk && bestAsk > 0) return bestAsk;
  return null;
}

export function rememberDepth(market: string, bids: unknown, asks: unknown) {
  lastDepthByMarket[market] = { bids, asks };
}

export function getLastDepth(market: string) {
  return lastDepthByMarket[market] ?? null;
}

export function rememberMarkPrice(market: string, price: number) {
  if (Number.isFinite(price) && price > 0) {
    lastMarkPriceByMarket[market] = price;
  }
}

export function getLastMarkPrice(market: string) {
  return lastMarkPriceByMarket[market] ?? null;
}

export async function seedMarketCacheFromStream(redis: RedisClientType) {
  const streamKey = process.env.BACKEND_STREAM || 'to-backend';

  try {
    const messages = await redis.xRevRange(streamKey, '+', '-', { COUNT: 300 });
    const seededDepth = new Set<string>();
    const seededMark = new Set<string>();

    for (const msg of messages) {
      try {
        const parsed = JSON.parse(msg.message.data ?? '{}');
        const market = parsed.payload?.market;
        if (!market) continue;

        if (parsed.type === 'depth_updated' && !seededDepth.has(market)) {
          rememberDepth(market, parsed.payload.bids, parsed.payload.asks);
          seededDepth.add(market);
        }

        if (parsed.type === 'markprice_updated' && !seededMark.has(market)) {
          rememberMarkPrice(market, Number(parsed.payload.price));
          seededMark.add(market);
        }
      } catch {
        // skip malformed entries
      }
    }
  } catch (err) {
    console.log('[WS] Failed to seed market cache from stream:', err);
  }
}

export function sampleOrderbookMids() {
  const updates: Array<{ market: string; price: number; transactionTime: number }> = [];
  const transactionTime = Date.now();

  for (const [market, depth] of Object.entries(lastDepthByMarket)) {
    const midPrice = midPriceFromDepth(depth.bids, depth.asks);
    if (midPrice) {
      updates.push({ market, price: midPrice, transactionTime });
    }
  }

  return updates;
}

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
