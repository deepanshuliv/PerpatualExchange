import type { MARKET } from "types";
import OrderBookManager from "./orderBook";
import ORDERBOOK from "./orderBook";

export default class Admin{
    private engine : OrderBookManager;

    constructor(OrderMangerInsatnce:OrderBookManager){
        this.engine = OrderMangerInsatnce;
    }

    createAdminMarket(market:MARKET){
        this.engine.intializedMarket(market)
    }


}

