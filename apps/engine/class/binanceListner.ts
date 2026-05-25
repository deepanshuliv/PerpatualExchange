import type { RedisClientType } from "redis";
import WebSocket from "ws";
export default class BinanceClassListner {
    private binanceSubscritpionRequest: {
        method: "SUBSCRIBE",
        param: string[],
        id: 1
    } = {
            method: "SUBSCRIBE",
            param: [],
            id: 1
        }
    private redisClient: RedisClientType;
    private marketToSubscribe: string[] = [
        "btcusd@indexPrice",
        "solusd@indexPrice",
        "ethusd@indexPrice",]


    async intialize(redisClient: RedisClientType) {
        await redisClient.connect();
    }

    constructor(redisClient: RedisClientType) {
        this.redisClient = redisClient;
        this.setupPriceSubscription()

    }
    async setupPriceSubscription() {
        const ws = new WebSocket("wss://fstream.binance.com/market/stream");

        this.marketToSubscribe.forEach((market) => {
            this.binanceSubscritpionRequest.param.push(market);
        })

        ws.on("open", () => {
            ws.send(JSON.stringify(this.binanceSubscritpionRequest));
        });

        ws.on("message", (data) => {
            const message = data.toString()
            const parseMesssage = JSON.parse(message);

            if (parseMesssage.id !== 1 && !parseMesssage.error) {
                return
            }
            ws.onmessage = async ({ data }) => {
                const parsedData = JSON.parse(data.toString());
                // this needs to be pushed on redis input stream
                // to keep input to engine deterministic
                await this.redisClient.xAdd(process.env.REQUEST_STREAM!, "*", {
                    data: JSON.stringify({
                        type: "markprice_updated",
                        payload: { price: parsedData.p, symbol: parsedData.i },
                    }),
                });

            }
        })
    }
}