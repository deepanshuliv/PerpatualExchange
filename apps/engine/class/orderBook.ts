import { isMainThread, markdown } from "bun";
import { OrderedMap } from "js-sdsl";
import { Base } from "js-sdsl/dist/esm/container/ContainerBase";
import { type Bids, type FillInfo, type Fills, type Kind, type MARKET, type openOrder, type Order, type OrderBook, type Orderdetails, type Status, type Type} from "types"


export default class  OrderBookManager{
    private orderBook : OrderBook;
    private fills : Fills[]
    private orders : Order

    constructor(){
        this.orderBook = {};
        this.fills = [];
        this.orders = new Map();
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
    


    createLimitLongOrder(userId:string , kind :Kind , type :Type , qty:number , price :number , margin :number , market :MARKET){
        const currentOrder = this.createUserOrder(userId , kind , type , qty , margin , price );
       
        let fillInfo : FillInfo[] = []
        
        const oppSide = this.getOppositeSide(market , kind);
        let remianingQty = qty;
        
        while(remianingQty > 0 && oppSide?.front()){
            const [bestPrice , PriceLevel] =   oppSide?.front()!;
            if(bestPrice <= price){
                if(PriceLevel.totalqty >= qty){
                    // eatas much as you can 
                    while(PriceLevel.openOrder[0] && remianingQty > 0 ){
                        let topOrder = PriceLevel.openOrder[0]!;
                        const priceLevelRemianingQty = topOrder.totalQty - topOrder.filledQty;
                        const priceLevelMaxFill = Math.min(priceLevelRemianingQty , remianingQty);
                        remianingQty-=priceLevelMaxFill;
                        topOrder.filledQty +=priceLevelMaxFill;
                        fillInfo.push({price:bestPrice , qty : priceLevelMaxFill});
                        if(remianingQty === 0 ){
                            this.addToFills(userId , topOrder.userId , priceLevelMaxFill , bestPrice , currentOrder.orderId , currentOrder.data.type, currentOrder.data.kind , "FILLED" )
                            this.changeOrderStatus(userId , currentOrder.orderId , "FILLED")
                        }else{
                            this.addToFills(userId , topOrder.userId , priceLevelMaxFill , bestPrice , currentOrder.orderId , currentOrder.data.type, currentOrder.data.kind , "PARTIALLY_FILLED" )
                            this.changeOrderStatus(userId , currentOrder.orderId , "PARTIALLY_FILLED")
                        }
                        if(topOrder.filledQty === topOrder.totalQty){
                            this.addToFills(userId , topOrder.userId , priceLevelMaxFill , bestPrice , topOrder.orderId , currentOrder.data.type, currentOrder.data.kind , "FILLED" )
                            this.changeOrderStatus(topOrder.userId , topOrder.orderId , "FILLED")
                            PriceLevel.openOrder.shift();
                        }else{
                            this.addToFills(userId , topOrder.userId , priceLevelMaxFill , bestPrice , topOrder.orderId , currentOrder.data.type, currentOrder.data.kind , "PARTIALLY_FILLED" )
                            this.changeOrderStatus(userId , topOrder.orderId , "PARTIALLY_FILLED")
                        }

                    }
                    const currentOrderFilledQty = currentOrder.data.qty - remianingQty;
                    PriceLevel.totalqty -= currentOrderFilledQty;
                }
            
            }
            if(PriceLevel.totalqty===0){
                oppSide.eraseElementByKey(bestPrice);
            }
        }
        if(remianingQty === 0){
            return {fills :fillInfo , orderId:currentOrder.orderId , filleQty:currentOrder.data.qty }
        }
        if( type === "LIMIT" ){

            // sit on same side 
            const sameSide = this.getSameSide(market , kind);;
            const sameSideOpenOrderDetail :openOrder= {
                filledQty:0,
                totalQty:remianingQty, 
                orderId:currentOrder.orderId, 
                userId:currentOrder.data.userId
            }
            const alreadyPriceOrder = sameSide?.getElementByKey(currentOrder.data.price);
            if(alreadyPriceOrder){
                alreadyPriceOrder.totalqty += remianingQty;
                alreadyPriceOrder.openOrder.push(sameSideOpenOrderDetail)
                sameSide?.setElement(currentOrder.data.price , alreadyPriceOrder);
            }
            // creaet new entry 
            const newBid : Bids = { totalqty:0 , openOrder:[sameSideOpenOrderDetail]}
            sameSide?.setElement(currentOrder.data.price , newBid)
            // if kind market return with as much filled
        }
        return {
            filledQty : remianingQty, 
            fills: fillInfo,
            orderId:currentOrder.orderId
        }
    }

    createLimitShortOrder(userId:string , kind :Kind , type :Type , qty:number , price :number , margin :number , market :MARKET){
        const currrentOrder =  this.createUserOrder(userId , kind , type , qty , margin  ,price  );
        const fillInfo : FillInfo[] = [];

        const oppSide = this.getOppositeSide(market , kind );

        let remianingQty = qty;

        while(remianingQty > 0 && oppSide?.front()){
            const [bestPrice , PriceLevel ] = oppSide.front()!;
            if(bestPrice >= price){
                if(PriceLevel.totalqty >= qty){
                    const topOrder = PriceLevel.openOrder[0];
                    while(topOrder && remianingQty>0){
                        const remainingPriceLevelQty =topOrder.totalQty - topOrder.filledQty ;
                        const maxQtyFillPriceLevel = Math.min(remainingPriceLevelQty , remianingQty);
                        remianingQty-=maxQtyFillPriceLevel;
                        topOrder.filledQty+=maxQtyFillPriceLevel;
                        fillInfo.push({
                            price:bestPrice, 
                            qty : maxQtyFillPriceLevel
                        })
                        if(topOrder.filledQty === topOrder.totalQty){
                            this.addToFills(topOrder.userId , currrentOrder.data.userId , maxQtyFillPriceLevel , bestPrice ,topOrder.orderId ,  currrentOrder.data.type , "LONG" , "FILLED" );
                            this.changeOrderStatus(topOrder.userId , topOrder.orderId , "FILLED");
                            PriceLevel.openOrder.shift()
                        }else{
                            this.addToFills(topOrder.userId , currrentOrder.data.userId , maxQtyFillPriceLevel , bestPrice ,topOrder.orderId ,  currrentOrder.data.type ,"LONG", "PARTIALLY_FILLED" );
                            this.changeOrderStatus(topOrder.userId , topOrder.orderId , "PARTIALLY_FILLED");
                        }
                        if(remianingQty === 0 ){
                            this.addToFills(topOrder.userId , currrentOrder.data.userId , currrentOrder.data.qty , currrentOrder.data.price ,currrentOrder.orderId ,  currrentOrder.data.type , "SHORT", "FILLED" );
                            this.changeOrderStatus(currrentOrder.data.userId , currrentOrder.orderId , "FILLED");
                        }else{
                            this.addToFills(topOrder.userId , currrentOrder.data.userId , currrentOrder.data.qty , currrentOrder.data.price ,currrentOrder.orderId ,  currrentOrder.data.type , "SHORT", "PARTIALLY_FILLED" );
                            this.changeOrderStatus(currrentOrder.data.userId , currrentOrder.orderId , "PARTIALLY_FILLED");
                        }

                        PriceLevel.totalqty-=maxQtyFillPriceLevel;

                    }       
              

                }
            }
            if(PriceLevel.totalqty === 0){

                oppSide.eraseElementByKey(bestPrice);
            }

        }
        if(remianingQty === 0 ){
            return {fills : fillInfo , filledQty : qty - remianingQty , orderId : currrentOrder.orderId , totalQty:currrentOrder.data.qty} 
        }
        // sit on same side 
        if(type === "LIMIT"){
            const sameSide = this.getSameSide(market , kind);
            
            const priceOrder = sameSide?.getElementByKey(price);
            const pushOpenOrderDetails : openOrder= {
                filledQty:0, 
                orderId:currrentOrder.orderId, 
                totalQty:qty - remianingQty ,
                userId:currrentOrder.data.userId
            }
            if(priceOrder){
                priceOrder.totalqty+= remianingQty;
                priceOrder.openOrder.push(pushOpenOrderDetails)
                sameSide?.setElement(currrentOrder.data.qty , priceOrder)
            }   
            // creaet a new price Order
            const newBid:Bids = {
                openOrder:[pushOpenOrderDetails],
                totalqty:qty - remianingQty
            }

            sameSide?.setElement(currrentOrder.data.price , newBid);
        }

        /// order cacncel
        return {
            filledQty: qty - remianingQty , 
            totalQty : qty, 
            orderId:currrentOrder.orderId,
            fills:fillInfo

        }
    }

    createMarketLongOrder(userId:string , kind :Kind , type :Type , qty:number ,margin :number , market :MARKET){
         const currrentOrder = this.createUserOrder(userId , kind, type , qty , margin);
         const fillInfo : FillInfo[]=[];
         let remianingQty = qty;
         const oppSide = this.getOppositeSide(market , kind);

         while(oppSide?.front() && remianingQty>0){
            const [bestPrice , priceLevel] = oppSide.front()!;
            
            const topOrder = priceLevel.openOrder[0];
            while(topOrder && remianingQty>0){
                const remainingPriceLevelQty =topOrder.totalQty - topOrder.filledQty ;
                const maxQtyFillPriceLevel = Math.min(remainingPriceLevelQty , remianingQty);
                remianingQty-=maxQtyFillPriceLevel;
                topOrder.filledQty+=maxQtyFillPriceLevel; 
                fillInfo.push({
                    price:bestPrice, 
                    qty : maxQtyFillPriceLevel
                })
                if(topOrder.filledQty === topOrder.totalQty){
                    this.addToFills(userId , topOrder.userId , maxQtyFillPriceLevel , bestPrice ,currrentOrder.orderId ,  currrentOrder.data.type , "SHORT" , "FILLED" );
                    this.changeOrderStatus(topOrder.userId , topOrder.orderId , "FILLED");
                    priceLevel.openOrder.shift()
                    
                }else{
                    this.addToFills(userId , topOrder.userId , maxQtyFillPriceLevel , bestPrice ,topOrder.orderId ,  currrentOrder.data.type ,"SHORT", "PARTIALLY_FILLED" );
                    this.changeOrderStatus(topOrder.userId , topOrder.orderId , "PARTIALLY_FILLED");
                }
                if(remianingQty === 0 ){
                    this.addToFills(userId , topOrder.userId ,currrentOrder.data.qty , bestPrice ,currrentOrder.orderId ,  currrentOrder.data.type , "LONG", "FILLED" );
                    this.changeOrderStatus(currrentOrder.data.userId , currrentOrder.orderId , "FILLED");
                }else{
                    this.addToFills(userId , topOrder.userId , currrentOrder.data.qty , bestPrice ,currrentOrder.orderId ,  currrentOrder.data.type , "LONG", "PARTIALLY_FILLED" );
                    this.changeOrderStatus(currrentOrder.data.userId , currrentOrder.orderId , "PARTIALLY_FILLED");
                }
                priceLevel.totalqty -= maxQtyFillPriceLevel;
            }
            if(priceLevel.totalqty === 0){
                oppSide.eraseElementByKey(bestPrice);
            }
            
         }

         // right now return  the order 
         // but in future , apply funding rate here

         return {
            filledQty : qty - remianingQty,
            totalQty : qty,
            fills:fillInfo,
            orderId : currrentOrder.orderId
         }
    }



    createMarketShortOrder(userId:string , kind :Kind , type :Type , qty:number ,margin :number , market :MARKET){
         const currrentOrder = this.createUserOrder(userId , kind, type , qty , margin);
         const fillInfo : FillInfo[]=[];
         let remianingQty = qty;
         const oppSide = this.getOppositeSide(market , kind);

         while(oppSide?.front() && remianingQty>0){
            const [bestPrice , priceLevel] = oppSide.front()!;
            
            const topOrder = priceLevel.openOrder[0];
            while(topOrder && remianingQty>0){
                const remainingPriceLevelQty =topOrder.totalQty - topOrder.filledQty ;
                const maxQtyFillPriceLevel = Math.min(remainingPriceLevelQty , remianingQty);
                remianingQty-=maxQtyFillPriceLevel;
                topOrder.filledQty+=maxQtyFillPriceLevel; 
                fillInfo.push({
                    price:bestPrice, 
                    qty : maxQtyFillPriceLevel
                })
                if(topOrder.filledQty === topOrder.totalQty){
                    this.addToFills(userId , topOrder.userId , maxQtyFillPriceLevel , bestPrice ,currrentOrder.orderId ,  currrentOrder.data.type , "SHORT" , "FILLED" );
                    this.changeOrderStatus(topOrder.userId , topOrder.orderId , "FILLED");
                    priceLevel.openOrder.shift()
                    
                }else{
                    this.addToFills(userId , topOrder.userId , maxQtyFillPriceLevel , bestPrice ,topOrder.orderId ,  currrentOrder.data.type ,"SHORT", "PARTIALLY_FILLED" );
                    this.changeOrderStatus(topOrder.userId , topOrder.orderId , "PARTIALLY_FILLED");
                }
                if(remianingQty === 0 ){
                    this.addToFills(userId , topOrder.userId ,currrentOrder.data.qty , bestPrice ,currrentOrder.orderId ,  currrentOrder.data.type , "LONG", "FILLED" );
                    this.changeOrderStatus(currrentOrder.data.userId , currrentOrder.orderId , "FILLED");
                }else{
                    this.addToFills(userId , topOrder.userId , currrentOrder.data.qty , bestPrice ,currrentOrder.orderId ,  currrentOrder.data.type , "LONG", "PARTIALLY_FILLED" );
                    this.changeOrderStatus(currrentOrder.data.userId , currrentOrder.orderId , "PARTIALLY_FILLED");
                }
                priceLevel.totalqty -= maxQtyFillPriceLevel;
            }
            if(priceLevel.totalqty === 0){
                oppSide.eraseElementByKey(bestPrice);
            }
            
         }

         // right now return  the order 
         // but in future , apply funding rate here

         return {
            filledQty : qty - remianingQty,
            totalQty : qty,
            fills:fillInfo,
            orderId : currrentOrder.orderId
         }
    }



    createUserOrder(userId:string , kind :Kind , type :Type , qty:number ,  margin :number ,price? :number ,){
    const orderId = crypto.randomUUID()
            const OrderToPush :Orderdetails = {
                userId,
                type,
                qty,
                price : price === undefined ? 0 : price,  
                status:"OPEN",
                margin,
                kind, 
                createdAt:new Date()
            }
            this.orders.set(orderId , OrderToPush);

            return {orderId ,data: OrderToPush}
    }

    getOppositeSide( market : MARKET , kind:Kind){
        const marketPresent  = this.orderBook[market];
        if(!marketPresent){
        return null;
        }
        const oppPos = kind === "LONG" ? "asks" : "bids";

        return marketPresent[oppPos];
    }

    getSameSide( market : MARKET , kind:Kind){
        const marketPresent  = this.orderBook[market];
        if(!marketPresent){
        return null;
        }
        const samePos = kind === "LONG" ? "bids" : "asks";

        return marketPresent[samePos];
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



    cancelOrder(userId : string , orderId:string ){
        // find and delete in open orders that order 
        // chnage the order status to cancelled in orders array

    this.getOrder(userId , orderId);    

    }

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
    }

    getOrder(userId : string , orderId:string){
        const userOrder = this.orders.get(orderId);
        if(!userOrder){
            return null
        }
        return userOrder
    };

    changeOrderStatus( userId:string , orderId :string , status : Status){
        const tempOrder=this.orders.get(orderId);
        if(tempOrder?.userId !== userId ){
            return null
        }
        tempOrder.status = status
        this.orders.set(orderId , tempOrder);
        
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