'use client';

import { useEffect, useState } from 'react';
import { apiService } from '../../hooks/useApi';

export type LandingMarket = 'BTCUSD' | 'ETHUSD' | 'SOLUSD';

const MARKETS: LandingMarket[] = ['BTCUSD', 'ETHUSD', 'SOLUSD'];

/** Polls the public mark-price endpoint for every market. Missing values stay 0. */
export function useMarketPrices(intervalMs = 3000) {
  const [prices, setPrices] = useState<Record<LandingMarket, number>>({
    BTCUSD: 0,
    ETHUSD: 0,
    SOLUSD: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const results = await Promise.all(
        MARKETS.map(async (m) => {
          try {
            const json = await apiService.getMarkPrice(m);
            const value = Number(json?.price ?? json?.data);
            return [m, Number.isFinite(value) ? value : 0] as const;
          } catch {
            return [m, 0] as const;
          }
        }),
      );
      if (cancelled) return;
      setPrices((prev) => {
        const next = { ...prev };
        for (const [m, v] of results) if (v > 0) next[m] = v;
        return next;
      });
    };

    void load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return prices;
}
