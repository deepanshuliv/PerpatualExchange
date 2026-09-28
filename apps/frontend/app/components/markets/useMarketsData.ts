'use client';

import { useEffect, useState } from 'react';
import { apiService } from '../../hooks/useApi';

export type MarketId = 'BTCUSD' | 'ETHUSD' | 'SOLUSD';

export const MARKET_LIST: {
  id: MarketId;
  label: string;
  name: string;
  asset: string;
  leverage: number;
  decimals: number;
}[] = [
  { id: 'BTCUSD', label: 'BTC-PERP', name: 'Bitcoin', asset: 'BTC', leverage: 75, decimals: 1 },
  { id: 'ETHUSD', label: 'ETH-PERP', name: 'Ethereum', asset: 'ETH', leverage: 50, decimals: 2 },
  { id: 'SOLUSD', label: 'SOL-PERP', name: 'Solana', asset: 'SOL', leverage: 20, decimals: 2 },
];

export interface MarketStats {
  mark: number;
  last: number;
  bestBid: number;
  bestAsk: number;
  /** Close prices of 15m candles over the past 24 hours, oldest first. */
  spark: number[];
  open24h: number;
  high24h: number;
  low24h: number;
  /** Base-asset volume over the past 24 hours. */
  volume24h: number;
}

const EMPTY: MarketStats = {
  mark: 0,
  last: 0,
  bestBid: 0,
  bestAsk: 0,
  spark: [],
  open24h: 0,
  high24h: 0,
  low24h: 0,
  volume24h: 0,
};

type Candle = { openTime: number; open: number; high: number; low: number; close: number; volume: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function loadPrices(id: MarketId) {
  const [mark, last, depth] = await Promise.all([
    apiService.getMarkPrice(id).catch(() => null),
    apiService.getTickerPrice(id).catch(() => null),
    apiService.getDepth(id).catch(() => null),
  ]);
  const bids = (depth?.data?.bids ?? []) as [number, number][];
  const asks = (depth?.data?.asks ?? []) as [number, number][];
  return {
    mark: num(mark?.price),
    last: num(last?.price),
    bestBid: bids.length ? Math.max(...bids.map((b) => num(b[0]))) : 0,
    bestAsk: asks.length ? Math.min(...asks.map((a) => num(a[0]))) : 0,
  };
}

async function loadDay(id: MarketId) {
  const json = await apiService.getCandles(id, '15m', 96).catch(() => null);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const candles = ((json?.data ?? []) as Candle[])
    .map((c) => ({ ...c, openTime: num(c.openTime) }))
    .filter((c) => c.openTime >= since)
    .sort((a, b) => a.openTime - b.openTime);
  if (candles.length === 0) return { spark: [], open24h: 0, high24h: 0, low24h: 0, volume24h: 0 };
  return {
    spark: candles.map((c) => num(c.close)),
    open24h: num(candles[0]!.open),
    high24h: Math.max(...candles.map((c) => num(c.high))),
    low24h: Math.min(...candles.map((c) => num(c.low))),
    volume24h: candles.reduce((sum, c) => sum + num(c.volume), 0),
  };
}

/** Live stats for every listed market: prices every 2s, 24h candles every 30s. */
export function useMarketsData() {
  const [data, setData] = useState<Record<MarketId, MarketStats>>({
    BTCUSD: EMPTY,
    ETHUSD: EMPTY,
    SOLUSD: EMPTY,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshPrices = async () => {
      const results = await Promise.all(MARKET_LIST.map(async (m) => [m.id, await loadPrices(m.id)] as const));
      if (cancelled) return;
      setData((prev) => {
        const next = { ...prev };
        for (const [id, p] of results) next[id] = { ...next[id], ...p };
        return next;
      });
      setLoaded(true);
    };

    const refreshDay = async () => {
      const results = await Promise.all(MARKET_LIST.map(async (m) => [m.id, await loadDay(m.id)] as const));
      if (cancelled) return;
      setData((prev) => {
        const next = { ...prev };
        for (const [id, d] of results) next[id] = { ...next[id], ...d };
        return next;
      });
    };

    void refreshPrices();
    void refreshDay();
    const priceTimer = setInterval(refreshPrices, 2000);
    const dayTimer = setInterval(refreshDay, 30000);
    return () => {
      cancelled = true;
      clearInterval(priceTimer);
      clearInterval(dayTimer);
    };
  }, []);

  return { data, loaded };
}

export type DayStats = Awaited<ReturnType<typeof loadDay>>;

/** 24h open/high/low/volume for one market from 15m candles, refreshed every 30s. */
export function useDayStats(id: MarketId) {
  const [stats, setStats] = useState<{ market: MarketId; data: DayStats } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await loadDay(id);
      if (!cancelled) setStats({ market: id, data });
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  // Never show the previous market's numbers while the new ones load.
  return stats?.market === id ? stats.data : null;
}
