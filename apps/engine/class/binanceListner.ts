import type { RedisClientType } from "redis";
import WebSocket from "ws";

// stream.binancefuture.com works from all regions (fstream.binance.com is geo-blocked)
const STREAM_URL =
    "wss://stream.binancefuture.com/stream?streams=btcusdt@markPrice@1s/solusdt@markPrice@1s/ethusdt@markPrice@1s";

export default class BinanceClassListner {
    private redisClient: RedisClientType;

    constructor(redisClient: RedisClientType) {
        this.redisClient = redisClient;
    }

    async intialize() {
        await this.redisClient.connect();
        this.setupPriceSubscription();
    }

    setupPriceSubscription() {
        const ws = new WebSocket(STREAM_URL);

        ws.on("open", () => {
            console.log("binance ws connected (stream.binancefuture.com)");
        });

        ws.on("error", (err) => {
            console.error("binance ws error:", err.message);
        });

        ws.on("close", (code) => {
            console.warn("binance ws closed, reconnecting in 3s...", code);
            setTimeout(() => this.setupPriceSubscription(), 3000);
        });

        ws.on("message", async (raw) => {
            // combined stream wraps payload in { stream, data }
            const { data } = JSON.parse(raw.toString());
            // data.s = symbol, data.p = mark price
            console.log("price update from binance", data.p, data.s);
            await this.redisClient.xAdd("to-engine", "*", {
                data: JSON.stringify({
                    type: "markprice_updated",
                    payload: { price: data.p, market: data.s },
                }),
            });
        });
    }
}