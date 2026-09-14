import type { Shared } from '@repo/shared-types';

export interface MarketConfig {
  market: Shared.MARKET_AVAILABEL;
  spreadPercent: number;
  baseQty: number;
  levels: number;
  qtyVariance: number;
  marginRatio: number;
  priceDecimals: number;
  qtyDecimals: number;
}

export const MM_CONFIG: {
  initialBalance: number;
  minBalanceThreshold: number;
  balanceCheckIntervalMs: number;
  requoteIntervalMs: number;
  markets: Record<string, MarketConfig>;
} = {
  initialBalance: Number(process.env.MM_INITIAL_BALANCE || 1_000_000),
  minBalanceThreshold: Number(process.env.MM_MIN_BALANCE || 100_000),
  balanceCheckIntervalMs: Number(process.env.MM_BALANCE_CHECK_INTERVAL_MS || 30_000),
  requoteIntervalMs: Number(process.env.MM_REQUOTE_INTERVAL_MS || 1_000),
  markets: {
    BTCUSD: {
      market: 'BTCUSD',
      spreadPercent: 0.0008,
      baseQty: 0.05,
      levels: 5,
      qtyVariance: 0.2,
      marginRatio: 0.1,
      priceDecimals: 2,
      qtyDecimals: 3,
    },
    ETHUSD: {
      market: 'ETHUSD',
      spreadPercent: 0.001,
      baseQty: 0.5,
      levels: 5,
      qtyVariance: 0.2,
      marginRatio: 0.1,
      priceDecimals: 2,
      qtyDecimals: 3,
    },
    SOLUSD: {
      market: 'SOLUSD',
      spreadPercent: 0.0015,
      baseQty: 5,
      levels: 5,
      qtyVariance: 0.2,
      marginRatio: 0.1,
      priceDecimals: 2,
      qtyDecimals: 2,
    },
  },
};
