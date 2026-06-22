import type { Shared } from "@repo/shared-types"

export interface Collateral{
    balance : number ,
    lockedBalance : number 
}
export interface Orderdetails{
    userId : string , 
    kind:Shared.KIND , 
    type : Shared.TYPE  , 
    qty:number , 
    price : number  ,
    margin : number , 
    status:Shared.STATUS,
    market:Shared.MARKET_AVAILABEL,
    createdAt : Date
}
export type Order= Map<string , Orderdetails>
export type User = Record<string, Collateral>