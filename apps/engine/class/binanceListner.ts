import type { RedisClientType } from "redis";
import WebSocket from "ws";
import { connectRedisClient } from "@repo/redis";

const STREAM_URL =
    process.env.BINANCE_STREAM_URL ||
    "wss://stream.binancefuture.com/stream?streams=btcusdt@markPrice@1s/solusdt@markPrice@1s/ethusdt@markPrice@1s";

export default class BinanceClassListner {
    private redisClient: RedisClientType;

    constructor(redisClient: RedisClientType) {
        this.redisClient = redisClient;
    }

    async intialize(): Promise<void> {
        await connectRedisClient(this.redisClient, 'BinancePriceListener');
        return new Promise<void>((resolve, reject) => {
            this.setupPriceSubscription(resolve, reject);
        });
    }

    setupPriceSubscription(resolve?: () => void, reject?: (err: Error) => void) {
        const ws = new WebSocket(STREAM_URL);

        ws.on("open", () => {
            console.log("binance ws connected (stream.binancefuture.com)");
            if (resolve) {
                resolve();
            }
        });

        ws.on("error", (err) => {
            console.error("binance ws error:", err.message);
            if (reject) {
                reject(err);
            }
        });

        ws.on("close", (code) => {
            console.warn("binance ws closed, reconnecting in 3s...", code);
            setTimeout(() => this.setupPriceSubscription(), 3000);
        });

        ws.on("message", async (raw) => {
            // combined stream wraps payload in { stream, data }
            try {
                const parsed = JSON.parse(raw.toString());
                const data = parsed.data || {};
                if (!data.s || !data.p) return;
                
                const rawSymbol = String(data.s).toUpperCase();
                let market = "";
                if (rawSymbol === "BTCUSDT") market = "BTCUSD";
                else if (rawSymbol === "ETHUSDT") market = "ETHUSD";
                else if (rawSymbol === "SOLUSDT") market = "SOLUSD";
                else market = rawSymbol;

                await this.redisClient.xAdd("to-engine", "*", {
                    data: JSON.stringify({
                        type: "markprice_updated",
                        payload: { price: Number(data.p), market },
                    }),
                });
            } catch (err) {
                console.error("Failed to parse or process Binance message:", err);
            }
        });
    }
}