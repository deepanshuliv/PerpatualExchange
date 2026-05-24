import type {OrderedMap} from "js-sdsl"

export type MARKET = "SOL" | "BTC" | "USD";
export type Type = "LIMIT" | "MARKET";
export type Kind = "SHORT" | "LONG";
export type Status = "FILLED" | "PARTIALLY_FILLED" | "OPEN" | "CANCELLED";


export interface Bids{
totalqty : number, 
openOrder:openOrder[]
}

export interface openOrder{
    totalQty : number, 
    filledQty:number , 
    orderId :string, 
    userId : string
}


export type OrderBook = Partial<Record<MARKET ,{
    asks: OrderedMap<number , Bids >
    bids: OrderedMap<number , Bids >
}>>
