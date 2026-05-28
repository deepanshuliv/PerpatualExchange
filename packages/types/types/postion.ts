import type { Kind, MARKET, Type } from "./orderbook";
import { Shared } from "shared-types"

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

export type Positions = Map<string, PositionDetails[]>;

export type MarketIndex = Map<Shared.MARKET_AVAILABEL, Set<string>>;
