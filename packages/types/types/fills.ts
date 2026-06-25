import type { Shared } from "@repo/shared-types";

export type Fills = {
    sellerId: string ,
    buyerId : string ,
    qty : number , 
    price : number , 
    orderId : string , 
    type: Shared.TYPE, 
    kind : Shared.KIND , 
    status: Shared.STATUS,
    createdAt : Date
 }

 export type FillInfo = {
    price : number , 
    qty:number
 }

export interface Fill {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  qty: number;
  type: string;
  kind: string;
  status: string;
  transactionTime: string;
}