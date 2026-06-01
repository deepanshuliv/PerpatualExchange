import { redisClient, type RedisClientType } from "@repo/redis"
import BinanceClassListner from "./binanceListner"
import PostionManager from "./PositionManager";
import MatchingEngine from "./matchingEngine";
import { EngineRequest, EngineResponse, Shared } from "shared-types";
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
    // Wraps the result into the canonical ENGINE_RESPONSE shape and pushes to
    // the to-backend stream.  The correlationId is what the backend uses to
    // match this response to the promise that is waiting for it.
    async sendTobackend(response: EngineResponse.ENGINE_RESPONSE) {
        const publisher = await this.redisClient.connect()
        await publisher.xAdd("to-backend", "*", { data: JSON.stringify(response) });
    }

    hadleRequest(request: EngineRequest.ENGINE_REQUEST) {

        if (request.type === "get_balance") {
            const { correlationId } = request;
            const { market, userId } = request.paylaod;
            const balance = this.matchingManger.getBalance(userId, market);
            const numericBalance = typeof balance === "number" ? balance : null;
            this.sendTobackend({
                correlationId,
                type: "get_balance",
                payload: numericBalance,
            });
        }
        else if (request.type === "create_order") {
            const { correlationId } = request;
            const { userId, qty, market, margin, type, kind, price } = request.payload;
            const createOrder = this.matchingManger.createOrder(userId, market, type, kind, qty, price, margin);
            if (!createOrder) {
                this.sendTobackend({ correlationId, type: "error", payload: { error: "ERROR_IN_CREATING_ORDER" } });
                return;
            }
            this.sendTobackend({
                correlationId,
                type: "create_order",
                payload: createOrder,
            });
        }
        else if (request.type === "add_balance") {
            const { correlationId } = request;
            const { userId, amount } = request.payload;
            this.matchingManger.addBalance(userId, amount);
            this.sendTobackend({ correlationId, type: "add_balance", payload: null });
        }
        else if (request.type === "cancel_order") {
            const { correlationId } = request;
            const { userId, orderId } = request.payload;
            const cancelled = this.matchingManger.cancelOrder(userId, orderId);
            if (!cancelled) {
                this.sendTobackend({ correlationId, type: "error", payload: { error: "NOT_ABLE_TO_CANCEL" } });
                return;
            }
            this.sendTobackend({
                correlationId,
                type: "cancel_order",
                payload: {
                    orderId: cancelled.orderId!,
                    userId: cancelled.userId!,
                    kind: cancelled.kind,
                    market: cancelled.market,
                    price: cancelled.price,
                    totalQty: cancelled.totalQty!,
                    filledQty: cancelled.filledQty!,
                    margin: cancelled.margin,
                },
            });
        }
        else if (request.type === "markprice_updated") {
            console.log("liquidation started")
            const { price, market } = request.payload;
            this.positionManager.updateMarkpriceMap(market, price);
            const userToLiquidate = this.positionManager.calculateLiquidation(market, price);
            userToLiquidate?.forEach((user) => {
                const { qty, margin, userId, kind, market, costBasis } = user;
                const liquidationOrder = this.matchingManger.palceMarketOrderForLiquidation(userId, kind, qty, margin, market, costBasis);
                if (!liquidationOrder) return;
                // Push to to-backend so DB poller and WS can react
                this.sendTobackend({
                    type: "liquidation",
                    payload: {
                        orderId: liquidationOrder.orderId,
                        userId,
                        kind: liquidationOrder.kind as any,
                        market,
                        filledQty: liquidationOrder.filledQty,
                        totalQty: liquidationOrder.totalQty,
                        totalSpent: liquidationOrder.totalSpent,
                        fills: liquidationOrder.fills,
                    },
                });
            })
        }
        else if (request.type === "run_funding_rate") {
            setInterval(async () => {
                const publisher = await redisClient.connect();
                publisher.xAdd("to-engine", "*", { data: JSON.stringify({ type: "run_funding_rate" }) })
            }, 8 * 60 * 60 * 1000) // 8hr timer
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