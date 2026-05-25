import { redisClient, type RedisClientType } from "@repo/redis"
import BinanceClassListner from "./binanceListner"
import type { OrderBook } from "types";
import PostionManager from "./PositionManager";
import OrderBookManager from "./orderBook";

export default class EngineManager {
    private binanceListner : BinanceClassListner;
    private orderBookManager : OrderBookManager;
    private positionManager : PostionManager;
    private redisClient : RedisClientType;



    constructor(){
        this.redisClient = redisClient.duplicate();
        this.binanceListner = new BinanceClassListner(this.redisClient.duplicate());
        this.orderBookManager = new OrderBookManager();
        this.positionManager = new PostionManager();
    }

    handleCancelOrderRequest(){}
    handleCreateOrderRequest(){}
    handleAddBalanceRequest(){}
    handlegetBalanceRequest(){}
}