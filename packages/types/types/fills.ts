import type { Kind, Status, Type } from "./orderbook"

export type Fills = {
    sellerId: string ,
    buyerId : string ,
    qty : number , 
    price : number , 
    orderId : string , 
    type: Type, 
    kind : Kind , 
    status:Status,
    createdAt : Date
 }

 export type FillInfo = {
    price : number , 
    qty:number
 }