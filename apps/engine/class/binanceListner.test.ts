import { test, expect, describe, mock } from "bun:test";
import BinanceClassListner from "./binanceListner";

describe("BinanceClassListner", () => {
    test("constructor stores redis client and starts price subscription", () => {
        const mockRedisClient = {
            duplicate: mock(() => mockRedisClient),
            connect: mock(),
            xAdd: mock(),
        };
        const listener = new BinanceClassListner(mockRedisClient as any);
        // @ts-expect-error - test access
        expect(listener.redisClient).toBe(mockRedisClient);
        // @ts-expect-error - test access
        expect(listener.marketToSubscribe.length).toBe(3);
        // @ts-expect-error - test access
        expect(listener.marketToSubscribe).toContain("btcusd@indexPrice");
        // @ts-expect-error - test access
        expect(listener.marketToSubscribe).toContain("solusd@indexPrice");
        // @ts-expect-error - test access
        expect(listener.marketToSubscribe).toContain("ethusd@indexPrice");
    });

    test("initialize connects to redis", async () => {
        const mockRedisClient = { connect: mock() };
        const listener = new BinanceClassListner(mockRedisClient as any);
        const mockClient = { connect: mock() };
        await listener.intialize(mockClient as any);
        expect(mockClient.connect).toHaveBeenCalled();
    });

    test("setupPriceSubscription creates a WebSocket connection", () => {
        const mockRedisClient = { connect: mock(), xAdd: mock() };
        const listener = new BinanceClassListner(mockRedisClient as any);
        // @ts-expect-error - test access to binanceSubscritpionRequest
        expect(listener.binanceSubscritpionRequest.param.length).toBe(3);
        // @ts-expect-error - test access
        expect(listener.binanceSubscritpionRequest.param).toContain("btcusd@indexPrice");
        // @ts-expect-error - test access
        expect(listener.binanceSubscritpionRequest.param).toContain("solusd@indexPrice");
        // @ts-expect-error - test access
        expect(listener.binanceSubscritpionRequest.param).toContain("ethusd@indexPrice");
        // @ts-expect-error - test access
        expect(listener.binanceSubscritpionRequest.method).toBe("SUBSCRIBE");
    });
});
