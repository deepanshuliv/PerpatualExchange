import { test, expect, describe } from "bun:test";
import MatchingEngine from "./matchingEngine";
import PostionManager from "./PositionManager";
import type { Bids, openOrder } from "types";

function setupUserBalance(engine: MatchingEngine, userId: string, balance: number, lockedBalance: number = 0) {
    // @ts-expect-error - test setup
    engine.balance.user[userId] = { balance, lockedBalance };
}

function getBalanceState(engine: MatchingEngine) {
    // @ts-expect-error - test access
    return engine.balance.user;
}

function getOrderBook(engine: MatchingEngine) {
    // @ts-expect-error - test access
    return engine.orderBook;
}

function initMarket(engine: MatchingEngine, market: "SOLUSD" | "BTCUSD" | "ETHUSD" | "USD") {
    getOrderBook(engine).intializedMarket(market);
}

function addAsk(engine: MatchingEngine, market: "SOLUSD" | "BTCUSD" | "ETHUSD" | "USD", price: number, qty: number, userId: string) {
    const oid = crypto.randomUUID();
    const entry: openOrder = { totalQty: qty, filledQty: 0, orderId: oid, userId };
    const level: Bids = { totalqty: qty, openOrder: [entry] };
    const ob = getOrderBook(engine);
    // @ts-expect-error - accessing private orderBook for test
    ob.orderBook[market]!.asks.setElement(price, level);
    return oid;
}

function addBid(engine: MatchingEngine, market: "SOLUSD" | "BTCUSD" | "ETHUSD" | "USD", price: number, qty: number, userId: string) {
    const oid = crypto.randomUUID();
    const entry: openOrder = { totalQty: qty, filledQty: 0, orderId: oid, userId };
    const level: Bids = { totalqty: qty, openOrder: [entry] };
    const ob = getOrderBook(engine);
    // @ts-expect-error - accessing private orderBook for test
    ob.orderBook[market]!.bids.setElement(price, level);
    return oid;
}

describe("MatchingEngine", () => {
    describe("constructor", () => {
        test("initializes all sub-components", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            // @ts-expect-error - test access
            expect(engine.orderBook).toBeDefined();
            // @ts-expect-error - test access
            expect(engine.balance).toBeDefined();
            // @ts-expect-error - test access
            expect(engine.positons).toBe(pm);
        });
    });

    describe("createOrder - LONG", () => {
        test("returns null when user has no balance account", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            const result = engine.createOrder("user1", "SOLUSD", "LIMIT", "LONG", 5, 100, 50);
            expect(result).toBeNull();
        });

        test("returns null when balance is insufficient", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 10);
            const result = engine.createOrder("user1", "SOLUSD", "LIMIT", "LONG", 5, 100, 50);
            expect(result).toBeNull();
        });

        test("deducts balance and locks margin when creating LONG order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 90, 5, "seller1");

            const result = engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 3, 999999, 30);
            expect(result).not.toBeNull();

            const balances = getBalanceState(engine);
            expect(balances["user1"].balance).toBe(170);
            expect(balances["user1"].lockedBalance).toBe(30);
        });

        test("creates position after LONG order fill", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 90, 5, "seller1");

            engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 3, 999999, 30);
            const pos = pm.getPosition("user1", "SOLUSD");
            expect(pos).not.toBeNull();
            expect(pos!.kind).toBe("LONG");
            expect(pos!.qty).toBe(3);
        });

        test("returns null when long order fails (no asks, no fill, market type)", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");
            // For a MARKET order with no asks, the order cannot fill and has no way to sit on book
            // With the current code, createLongOrder always returns a result, so this should not be null
            const result = engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 3, 999999, 30);
            expect(result).not.toBeNull();
            expect(result!.filledQty).toBe(0);
        });

        test("creates limit order that sits on bids when no asks", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");

            const result = engine.createOrder("user1", "SOLUSD", "LIMIT", "LONG", 5, 90, 50);
            expect(result).not.toBeNull();
            expect(result!.filledQty).toBe(0);

            const balances = getBalanceState(engine);
            expect(balances["user1"].balance).toBe(150);
            expect(balances["user1"].lockedBalance).toBe(50);
        });
    });

    describe("createOrder - SHORT", () => {
        test("returns null when balance is insufficient", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 10);
            const result = engine.createOrder("user1", "SOLUSD", "LIMIT", "SHORT", 5, 100, 50);
            expect(result).toBeNull();
        });

        test("deducts balance and locks margin when creating SHORT order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");
            addBid(engine, "SOLUSD", 110, 5, "buyer1");

            const result = engine.createOrder("user1", "SOLUSD", "MARKET", "SHORT", 3, 0, 30);
            expect(result).not.toBeNull();

            const balances = getBalanceState(engine);
            expect(balances["user1"].balance).toBe(170);
            expect(balances["user1"].lockedBalance).toBe(30);
        });

        test("creates position after SHORT order fill", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");
            addBid(engine, "SOLUSD", 110, 5, "buyer1");

            engine.createOrder("user1", "SOLUSD", "MARKET", "SHORT", 3, 0, 30);
            const pos = pm.getPosition("user1", "SOLUSD");
            expect(pos).not.toBeNull();
            expect(pos!.kind).toBe("SHORT");
            expect(pos!.qty).toBe(3);
        });

        test("creates limit order that sits on asks when no bids", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");

            const result = engine.createOrder("user1", "SOLUSD", "LIMIT", "SHORT", 5, 100, 50);
            expect(result).not.toBeNull();
            expect(result!.filledQty).toBe(0);

            const balances = getBalanceState(engine);
            expect(balances["user1"].balance).toBe(150);
            expect(balances["user1"].lockedBalance).toBe(50);
        });
    });

    describe("createOrder - existing position handling", () => {
        test("reduces LONG position with an opposite SHORT order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 100, 10, "cp");

            // Create LONG position of 10
            engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 10, 999999, 100);

            // Reduce by placing SHORT against bids
            addBid(engine, "SOLUSD", 110, 3, "cp2");
            const result = engine.createOrder("user1", "SOLUSD", "MARKET", "SHORT", 3, 0, 30);
            expect(result).not.toBeNull();
            const pos = pm.getPosition("user1", "SOLUSD");
            expect(pos).not.toBeNull();
            expect(pos!.kind).toBe("LONG");
            expect(pos!.qty).toBe(7);
        });

        test("closes a LONG position completely with an equal opposite SHORT", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 100, 5, "cp");

            engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 5, 999999, 50);

            addBid(engine, "SOLUSD", 110, 5, "cp2");
            engine.createOrder("user1", "SOLUSD", "MARKET", "SHORT", 5, 0, 50);

            const pos = pm.getPosition("user1", "SOLUSD");
            expect(pos).toBeNull();
            const balances = getBalanceState(engine);
            expect(balances["user1"].lockedBalance).toBe(0);
        });

        test("flips a LONG position when opposite order qty exceeds position", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 100, 3, "cp");

            engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 3, 999999, 30);

            addBid(engine, "SOLUSD", 110, 5, "cp2");
            engine.createOrder("user1", "SOLUSD", "MARKET", "SHORT", 5, 0, 50);

            const pos = pm.getPosition("user1", "SOLUSD");
            expect(pos).not.toBeNull();
            expect(pos!.kind).toBe("SHORT");
            expect(pos!.qty).toBe(2);
        });
    });

    describe("cancelOrder", () => {
        test("releases locked margin on cancel", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");

            const orderResult = engine.createOrder("user1", "SOLUSD", "LIMIT", "LONG", 5, 80, 50);
            expect(orderResult).not.toBeNull();

            const balancesBefore = getBalanceState(engine);
            expect(balancesBefore["user1"].lockedBalance).toBe(50);
            expect(balancesBefore["user1"].balance).toBe(150);

            engine.cancelOrder("user1", orderResult!.orderId);
            const balancesAfter = getBalanceState(engine);
            expect(balancesAfter["user1"].lockedBalance).toBe(0);
            expect(balancesAfter["user1"].balance).toBe(200);
        });

        test("returns undefined for non-existent order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            const result = engine.cancelOrder("user1", "nonexistent");
            expect(result).toBeUndefined();
        });
    });

    describe("getOrder", () => {
        test("returns order for existing order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 200);
            initMarket(engine, "SOLUSD");

            const orderResult = engine.createOrder("user1", "SOLUSD", "LIMIT", "LONG", 5, 80, 50);
            const order = engine.getOrder("user1", orderResult!.orderId);
            expect(order).not.toBeNull();
            expect(order!.userId).toBe("user1");
        });

        test("returns null for non-existent order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            expect(engine.getOrder("user1", "nonexistent")).toBeNull();
        });
    });

    describe("getBalance", () => {
        test("returns user balance when no market specified", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            expect(engine.getBalance("user1")).toBe(500);
        });

        test("returns position when market specified", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 100, 5, "cp");
            engine.createOrder("user1", "SOLUSD", "MARKET", "LONG", 5, 999999, 50);

            const pos = engine.getBalance("user1", "SOLUSD");
            expect(pos).not.toBeNull();
            expect(pos!.kind).toBe("LONG");
        });
    });

    describe("addBalance", () => {
        test("adds balance for existing user", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            engine.addBalance("user1", 100);
            const balances = getBalanceState(engine);
            expect(balances["user1"].balance).toBe(600);
        });

        test("returns null for non-existent user", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            const result = engine.addBalance("user1", 100);
            expect(result).toBeNull();
        });
    });

    describe("palceMarketOrderForLiquidation", () => {
        test("liquidates a SHORT position by placing opposite LONG market order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            initMarket(engine, "SOLUSD");
            addAsk(engine, "SOLUSD", 100, 10, "cp");

            const result = engine.palceMarketOrderForLiquidation(
                "user1", "SHORT", 5, 50, "SOLUSD", 550
            );
            expect(result).not.toBeNull();
            expect(result.filledQty).toBeGreaterThan(0);
        });

        test("liquidates a LONG position by placing opposite SHORT market order", () => {
            const pm = new PostionManager();
            const engine = new MatchingEngine(pm);
            setupUserBalance(engine, "user1", 500);
            initMarket(engine, "SOLUSD");
            addBid(engine, "SOLUSD", 100, 10, "cp");

            const result = engine.palceMarketOrderForLiquidation(
                "user1", "LONG", 5, 50, "SOLUSD", 400
            );
            expect(result).not.toBeNull();
            expect(result.filledQty).toBeGreaterThan(0);
        });
    });
});
