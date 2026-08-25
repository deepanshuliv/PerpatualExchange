import {
  INTERVAL_1M_MS,
  INTERVAL_5M_MS,
  INTERVAL_15M_MS,
  INTERVAL_1D_MS,
  INTERVAL_1H_MS,
  mergeTradeIntoOhlc,
  type OhlcCandle,
} from '@repo/shared-types/market-data';

type Market = 'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'USD';

export interface TradeTickInput {
  market: Market;
  price: number;
  volume: number;
  time: Date;
}

type CandleModel = {
  findUnique: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type MarketDataTx = {
  tick: { createMany: (args: unknown) => Promise<unknown> };
  candle1m: CandleModel;
  candle5m: CandleModel;
  candle15m: CandleModel;
  candle1h: CandleModel;
  candle1d: CandleModel;
};

async function upsertCandle(
  model: CandleModel,
  market: Market,
  price: number,
  volume: number,
  openTimeMs: number,
) {
  const openTime = new Date(openTimeMs);

  const existing = (await model.findUnique({
    where: { openTime_market: { openTime, market } },
  })) as {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    openTime: Date;
  } | null;

  const current: OhlcCandle | null = existing
    ? {
        openTime: existing.openTime.getTime(),
        open: existing.open,
        high: existing.high,
        low: existing.low,
        close: existing.close,
        volume: existing.volume,
      }
    : null;

  const merged = mergeTradeIntoOhlc(current, price, volume, openTimeMs);

  if (!existing) {
    await model.create({
      data: {
        market,
        openTime,
        open: merged.open,
        high: merged.high,
        low: merged.low,
        close: merged.close,
        volume: merged.volume,
      },
    });
    return;
  }

  await model.update({
    where: { openTime_market: { openTime, market } },
    data: {
      high: merged.high,
      low: merged.low,
      close: merged.close,
      volume: merged.volume,
    },
  });
}

export async function persistTicksAndCandles(tx: MarketDataTx, trades: TradeTickInput[]) {
  if (trades.length === 0) return;

  await tx.tick.createMany({
    data: trades.map((trade) => ({
      market: trade.market,
      price: trade.price,
      volume: trade.volume,
      time: trade.time,
    })),
  });

  for (const trade of trades) {
    const openTime1m = Math.floor(trade.time.getTime() / INTERVAL_1M_MS) * INTERVAL_1M_MS;
    const openTime5m = Math.floor(trade.time.getTime() / INTERVAL_5M_MS) * INTERVAL_5M_MS;
    const openTime15m = Math.floor(trade.time.getTime() / INTERVAL_15M_MS) * INTERVAL_15M_MS;
    const openTime1h = Math.floor(trade.time.getTime() / INTERVAL_1H_MS) * INTERVAL_1H_MS;
    const openTime1d = Math.floor(trade.time.getTime() / INTERVAL_1D_MS) * INTERVAL_1D_MS;

    await upsertCandle(tx.candle1m, trade.market, trade.price, trade.volume, openTime1m);
    await upsertCandle(tx.candle5m, trade.market, trade.price, trade.volume, openTime5m);
    await upsertCandle(tx.candle15m, trade.market, trade.price, trade.volume, openTime15m);
    await upsertCandle(tx.candle1h, trade.market, trade.price, trade.volume, openTime1h);
    await upsertCandle(tx.candle1d, trade.market, trade.price, trade.volume, openTime1d);
  }
}
