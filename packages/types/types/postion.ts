import { Shared } from "@repo/shared-types"
import type { MARKET_AVAILABEL } from "../../shared-types/shared";

export interface PositionDetails {
    market: Shared.MARKET_AVAILABEL,
    kind: Shared.KIND,
    qty: number,
    costBasis: number, // directly store qty * buy/sell_price
    margin: number,
}

export interface userMarketOrderTypes {
    userId: string,
    qty: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
    kind: Shared.KIND,
    costBasis: number
}

export type MarketMarkPrice = Map<Shared.MARKET_AVAILABEL , number>

export type Positions = Map<string, PositionDetails[]>;

export type MarketIndex = Map<Shared.MARKET_AVAILABEL, Set<string>>;

export interface Position {
  userId: string;
  market: string;
  qty: number;
  entryPrice: number;
  margin: number;
  pnl?: number;
}
