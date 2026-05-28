import { test, expect, describe, mock, beforeAll } from "bun:test";

// Mock redis before importing EngineManager
const mockXAdd = mock();
const mockDuplicate = mock(() => ({
    connect: mock(),
    xAdd: mockXAdd,
}));
const mockConnect = mock();

mock.module("@repo/redis", () => ({
    redisClient: {
        duplicate: mockDuplicate,
        connect: mockConnect,
    },
}));

// Mock ws module
mock.module("ws", () => {
    return {
        default: class MockWebSocket {
            on(event: string, cb: any) {
                if (event === "open") cb();
            }
            send() {}
        },
    };
});

import EngineManager from "./EngineManager";

describe("EngineManager", () => {
    beforeAll(() => {
        process.env.REQUEST_STREAM = "request_stream";
        process.env.RESPONSE_STREAM = "response_stream";
    });

    test("constructor initializes all components", () => {
        const em = new EngineManager();
        // @ts-expect-error - test access
        expect(em.positionManager).toBeDefined();
        // @ts-expect-error - test access
        expect(em.matchingManger).toBeDefined();
        // @ts-expect-error - test access
        expect(em.redisClient).toBeDefined();
        // @ts-expect-error - test access
        expect(em.binanceListner).toBeDefined();
    });

    test("sendTobackend pushes data to response stream", async () => {
        const em = new EngineManager();
        const payload = { test: "data" };
        await em.sendTobackend(payload);
        expect(mockXAdd).toHaveBeenCalled();
    });

    test("handleRequest processes get_balance request", () => {
        const em = new EngineManager();
        const request = {
            type: "get_balance" as const,
            correlationId: "corr1",
            stream: "test",
            paylaod: { userId: "user1", market: undefined },
        };
        em.hadleRequest(request as any);
        // Should not throw, sends response via sendTobackend
    });

    test("handleRequest processes add_balance request", () => {
        const em = new EngineManager();
        const request = {
            type: "add_balance" as const,
            correlationId: "corr1",
            stream: "test",
            payload: { userId: "nonexistent", amount: 100 },
        };
        em.hadleRequest(request as any);
        // Should send error back since user doesn't exist
    });

    test("handleRequest processes cancel_order request", () => {
        const em = new EngineManager();
        const request = {
            type: "cancel_order" as const,
            correlationId: "corr1",
            stream: "test",
            payload: { userId: "user1", orderId: "nonexistent" },
        };
        em.hadleRequest(request as any);
        // Should send error back since order doesn't exist
    });

    test("handleRequest processes create_order request", () => {
        const em = new EngineManager();
        const request = {
            type: "create_order" as const,
            correlationId: "corr1",
            stream: "test",
            payload: {
                userId: "user1",
                qty: 5,
                price: 100,
                market: "SOLUSD",
                type: "LIMIT",
                kind: "LONG",
                margin: 50,
            },
        };
        em.hadleRequest(request as any);
        // Should send error back since user has no balance
    });

    test("handleRequest processes markprice_updated request", () => {
        const em = new EngineManager();
        const request = {
            type: "markprice_updated" as const,
            payload: { price: 100, market: "SOLUSD" },
        };
        em.hadleRequest(request as any);
        // Should not throw even if no positions exist
    });
});
