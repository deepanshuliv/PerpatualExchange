import type { OrderedMap } from "js-sdsl"
import type { Shared } from "@repo/shared-types"



export interface Bids {
    totalqty: number,
    openOrder: openOrder[]
}

export interface openOrder {
    totalQty: number,
    filledQty: number,
    orderId: string,
    userId: string
}


export type OrderBook = Partial<Record<Shared.MARKET_AVAILABEL, {
    asks: OrderedMap<number, Bids>
    bids: OrderedMap<number, Bids>,
    lastTradedPrice:number
}>>
