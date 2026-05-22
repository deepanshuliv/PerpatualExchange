import { markdown } from "bun";
import { OrderedMap } from "js-sdsl";
import { type Fills, type Kind, type MARKET, type Order, type OrderBook, type Status, type Type} from "types"


export default class  OrderBookManager{
    private orderBook : OrderBook;
    private fills : Fills[]
    private orders : Order[]

    constructor(){
        this.orderBook = {};
        this.fills = [];
        this.orders = []
    }
    
/*

export type MARKET = "SOL" | "BTC" | "USD";
export type Type = "LIMIT" | "MARKET";
export type Kind = "SHORT" | "LONG";


export interface Bids{
totalqty : number, 
openOrder:openOrder[]
}

export interface openOrder{
    totalQty : string, 
    filledQty:string , 
    orderId :string, 
    userId : string
}

export interface PRICE_LEVEL{
    bids:Bids, 
    asks: Bids , 
}

export type OrderBook = Partial<Record<MARKET , OrderedMap<number , PRICE_LEVEL >>>

export interface Collateral{
    balance : number ,
    lockedBalance : number 
}
export interface Order{
    userId : string , 
    kind:Kind , 
    type : Type  , 
    qty:number , 
    price : number  ,
    margin : number , 
    ordeId : string , 
    createdAt : Date
}


export type Fills = {
    sellerId: string ,
    buyerId : string ,
    qty : number , 
    price : number , 
    orderId : string , 
    type: Type, 
    kind : Kind , 
    createdAt : Date
 }

*/
    createUserOrder(userId:string , kind :Kind , type :Type , qty:number , price :number , margin :number ){
        const OrderToPush :Order = {
            userId,
            type,
            qty,
            price,  
            ordeId:crypto.randomUUID(),
            status:"OPEN",
            margin,
            kind, 
            createdAt:new Date()
        }
        this.orders.push(OrderToPush)
        return OrderToPush
    }

    getOppositeSide( market : MARKET , kind:Kind){
        const marketPresent  = this.orderBook[market];
        if(!marketPresent){
            return {ok:false , msg:"MARKET_IS_NOT_AVAILABEL"}
        }
        return marketPresent
    }

    intializedMarket(market:MARKET ){
        const marketCreate = this.orderBook[market];
        if(!marketCreate){
            this.orderBook[market] = {
                asks: new OrderedMap([] , (a:number,b:number)=>(a-b)) ,
                bids:new OrderedMap([] , (a:number ,b:number)=>(b - a ))
            }
        }
        return marketCreate
    }

 

    createLimitLongOrder(userId:string , kind :Kind , type :Type , qty:number , price :number , margin :number ){

    }

    createLimitShortOrder(){}

    createMarketLongOrder(){}

    createMarketOrder(){}
    
    addToFills(buyerId : string , sellerId : string ,qty:number , price:number , orderId:string , type:Type , kind:Kind  ,status:Status){
        // orderId is for one either seller or buyer 
        // status is either "FILLED" and "PARTIALLY_FLLED"
        const fillDetail:Fills = {
            buyerId , 
            sellerId , 
            price, 
            orderId, 
            type, 
            kind, 
            qty , 
            status, 
            createdAt:new Date()
        }
        this.fills.push(fillDetail);
        return {ok:true , msg:"FILLS_CREATED_SUCCESFULLY"}
    }

    getOrder(userId : string , orderId:string){
        const userOrder = this.orders.find((order)=>{
            return order.orderId === orderId && userId === order.userId;
        })
        if(!userOrder){
            return {ok:false , msg:"USER_ORDER_NOT_AVAILABEL"}
        }
        return userOrder
    };

    changeOrderStatus( userId:string , orderId :string , status : Status){
        const userOrder =this.orders.find((order)=> (order.orderId === orderId && userId === userId));
        if(!userOrder){
            return {ok:false , msg:"USER_ORDER_NOT_AVAILABEL"}
        }

        userOrder.status = status
        return {ok:true , msg:"STATUS_CHNAGED_SUCCESSFULLY_OF_ORDER"}
    }

    pushOrder(userId:string , orderId:string){
        // orders whose status is "FILLED" 
        // pushed to queue 
        // delete from here
    }

    pushFills(){
        // push on the response queue 
        // delete entry from fills table 
    }
    // can become trades
    getFills( ){

    }

}