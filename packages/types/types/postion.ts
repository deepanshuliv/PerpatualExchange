import type { Kind, MARKET, Type } from "./orderbook";

    
export interface PositionDetails {
    market:MARKET,
    kind:Kind,
    qty:number , 
    costBasis : number , // directly store qty * buy/sell_price
    margin:number ,
}

export interface userMarketOrderTypes{
    qty:number,
    margin : number ,
    market:MARKET , 
    kind:Kind , 

}

export type Positions = Map<string , PositionDetails[]>;
 
export type MarketIndex = Map<MARKET , Set<string>>;
