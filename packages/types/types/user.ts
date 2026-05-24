import type { Kind, MARKET, Status, Type } from "./orderbook"

export interface Collateral{
    balance : number ,
    lockedBalance : number 
}
export interface Orderdetails{
    userId : string , 
    kind:Kind , 
    type : Type  , 
    qty:number , 
    price : number  ,
    margin : number , 
    status:Status,
    market:MARKET,
    createdAt : Date
}
export type Order= Map<string , Orderdetails>
export type User = Record<string, Collateral>