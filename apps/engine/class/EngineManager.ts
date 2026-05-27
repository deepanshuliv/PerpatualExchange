import { redisClient, type RedisClientType } from "@repo/redis"
import BinanceClassListner from "./binanceListner"
import PostionManager from "./PositionManager";
import MatchingEngine from "./matchingEngine";
import { EngineRequest } from "shared-types";


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
        this.redisClient.connect()
        this.binanceListner = new BinanceClassListner(this.redisClient.duplicate());
        this.positionManager = new PostionManager();
        this.matchingManger = new MatchingEngine(this.positionManager)
    }
    // might be stream name as well if i am taking the response stream for each backend . and a common reposne stream for db and ws.
    // right now  one response  and one request stream. 
    async sendTobackend(payload: any, correlationId: string,) {
        await redisClient.xAdd(process.env.RESPONSE_STREAM!, "*", { data: JSON.stringify(payload) })
    }

    hadleRequest(request: EngineRequest.ENGINE_REQUEST) {
        if (request.type === "get_balance") {

        }
        else if (request.type === "create_order") {

        }
        else if (request.type === "add_balance") {

        }
        else if (request.type === "cancel_order") {

        }
        else if (request.type === "markprice_updated") {

        }
    }

    async start() {
        while (1) {
            const response = await redisClient.xRead([{ key: process.env.REQUEST_STREAM!, id: "$" }], { BLOCK: 0, COUNT: 100 }) as RedisStreamResponse
            if (!response || !Array.isArray(response)) {
                continue
            }

            for (const stream of response) {
                for (const msg of stream.messages) {
                    const parsedMessage = JSON.parse(msg.message.data!);
                    if (!parsedMessage) {
                        continue
                    }
                    const { success, data } = EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsedMessage)
                    if (!success) continue;

                    this.hadleRequest(data)
                }
            }
        }
    }

}