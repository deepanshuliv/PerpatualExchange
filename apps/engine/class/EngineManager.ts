import { redisClient, type RedisClientType } from "@repo/redis"
import BinanceClassListner from "./binanceListner"
import PostionManager from "./PositionManager";
import MatchingEngine from "./matchingEngine";
import { EngineRequest } from "shared-types";
import { Shared } from "shared-types";
import { allMarketsList } from "../../../packages/shared-types/shared";

type RedisStreamResponse = Array<{
    name: string;
    messages: Array<{
        id: string;
        message: Record<string, string>;
    }>;
}> | null;

export default class EngineManager {
    private binanceListner: BinanceClassListner;
    private redisClient: RedisClientType;
    private positionManager: PostionManager;
    private matchingManger: MatchingEngine;




    constructor() {
        this.redisClient = redisClient.duplicate();
        this.binanceListner = new BinanceClassListner(redisClient.duplicate());
        this.positionManager = new PostionManager();
        this.matchingManger = new MatchingEngine(this.positionManager)
    }
    // might be stream name as well if i am taking the response stream for each backend . and a common reposne stream for db and ws.
    // right now  one response  and one request stream. 
    async sendTobackend(payload: any, correlationId?: string,) {
        // TODO- create a object with correlationId and push to response stream.
        console.log("sending message to {to-backend} ");

        const publisher = await this.redisClient.connect()
        await publisher.xAdd("to-backend", "*", { data: JSON.stringify(payload) });

    }

    hadleRequest(request: EngineRequest.ENGINE_REQUEST) {
        if (request.type === "get_balance") {
            const { market, userId } = request.paylaod;
            let userBalance;
            if (market) {
                userBalance = this.matchingManger.getBalance(userId, market);
                if (!userBalance) {
                    const payload = {
                        error: "USER_BALANCE_NOT_PRESENT"
                    }
                    userBalance = payload
                }
            }

            userBalance = this.matchingManger.getBalance(userId, market);

            this.sendTobackend(userBalance, request.correlationId)
        }
        else if (request.type === "create_order") {
            let createOrder;

            const { userId, qty, market, margin, type, kind, price } = request.payload;
            createOrder = this.matchingManger.createOrder(userId, market, type, kind, qty, price, margin);
            if (!createOrder) {
                const payload = {
                    error: "ERROR_IN_CREATING_ORDER"
                }
                createOrder = payload
            }

            this.sendTobackend(createOrder, request.correlationId);
        }

        else if (request.type === "add_balance") {
            let user;
            const { userId, amount } = request.payload;
            user = this.matchingManger.addBalance(userId, amount);
            if (!user) {
                const paylaod = {
                    error: "FAILED_TO_ADD_BALANCE"
                }
                user = paylaod
            }

            this.sendTobackend(user, request.correlationId);
        }
        else if (request.type === "cancel_order") {
            let user;
            const { userId, orderId } = request.payload;
            user = this.matchingManger.cancelOrder(userId, orderId);
            if (!user) {
                const payload = {
                    error: "NOT_ABLE_TO_CANCEL"
                }
                user = payload
            }
            this.sendTobackend(user, request.correlationId);
        }
        else if (request.type === "markprice_updated") {
            console.log("liquidation satrted")
            const { price, market } = request.payload;
            this.positionManager.updateMarkpriceMap(market, price);
            const userToLiquidate = this.positionManager.calculateLiquidation(market, price);
            userToLiquidate?.forEach((user) => {
                const { qty, margin, userId, kind, market, costBasis } = user;
                const marketOrder = this.matchingManger.palceMarketOrderForLiquidation(userId, kind, qty, margin, market, costBasis );
                this.sendTobackend(marketOrder)
            })
        }
        else if (request.type === "run_funding_rate") {
            setInterval(async () => {
                const publisher = await redisClient.connect();
                publisher.xAdd("to-engine", "*", { data: JSON.stringify({ type: "run_funding_rate" }) })

            }, 8 * 60 * 60 * 1000) // 8hrs timer
            allMarketsList.forEach((market) => {
                const markPrice = this.positionManager.getMarkpriceOfMarket(market) || 0;
                const lastTradedPrice = this.matchingManger.getLastTradedPriceOFMarket(market) || 0;
                this.positionManager.claculateFundingRate(markPrice, lastTradedPrice, market);
            })

        }
    }

    async start() {
        await this.binanceListner.intialize();
        const subscriber = await this.redisClient.connect();

        while (1) {
            const response = await subscriber.xRead([{ key: "to-engine", id: "$" }], { BLOCK: 0, COUNT: 100 })
            if (!response) {
                continue
            }
            for (const stream of response) {
                for (const msg of stream.messages) {
                    const parsedMessage = JSON.parse(msg.message.data!) || {};
                    const { success, data } = EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsedMessage)
                    if (!success) continue;
                    console.log("message come and handling to engine");

                    this.hadleRequest(data)
                }
            }
        }
    }
}