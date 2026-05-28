import { test, expect, describe } from "bun:test";
import OrderBookManager from "./orderBook";
import type { Bids, openOrder } from "types";

function initMarket(ob: OrderBookManager, market: "SOLUSD" | "BTCUSD" | "ETHUSD" | "USD") {
    ob.intializedMarket(market);
}

function getOrderBook(ob: OrderBookManager) {
    // @ts-expect-error - accessing private for test verification
    return ob.orderBook;
}

function getFills(ob: OrderBookManager) {
    // @ts-expect-error - accessing private for test verification
    return ob.fills;
}

function getOrders(ob: OrderBookManager) {
    // @ts-expect-error - accessing private for test verification
    return ob.orders;
}

function addAsk(ob: OrderBookManager, market: "SOLUSD" | "BTCUSD" | "ETHUSD" | "USD", price: number, qty: number, userId: string, orderId?: string) {
    const oid = orderId || crypto.randomUUID();
    const entry: openOrder = { totalQty: qty, filledQty: 0, orderId: oid, userId };
    const level: Bids = { totalqty: qty, openOrder: [entry] };
    const book = getOrderBook(ob);
    book[market]!.asks.setElement(price, level);
    return oid;
}

function addBid(ob: OrderBookManager, market: "SOLUSD" | "BTCUSD" | "ETHUSD" | "USD", price: number, qty: number, userId: string, orderId?: string) {
    const oid = orderId || crypto.randomUUID();
    const entry: openOrder = { totalQty: qty, filledQty: 0, orderId: oid, userId };
    const level: Bids = { totalqty: qty, openOrder: [entry] };
    const book = getOrderBook(ob);
    book[market]!.bids.setElement(price, level);
    return oid;
}

describe("OrderBookManager", () => {
    describe("initialization", () => {
        test("constructor initializes empty state", () => {
            const ob = new OrderBookManager();
            expect(getOrderBook(ob)).toEqual({});
            expect(getFills(ob)).toEqual([]);
            expect(getOrders(ob).size).toBe(0);
        });

        test("intializedMarket creates new market entry", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const book = getOrderBook(ob);
            expect(book["SOLUSD"]).toBeDefined();
            expect(book["SOLUSD"]!.bids).toBeDefined();
            expect(book["SOLUSD"]!.asks).toBeDefined();
        });

        test("intializedMarket does not overwrite existing market", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const book = getOrderBook(ob);
            const firstRef = book["SOLUSD"];
            ob.intializedMarket("SOLUSD");
            expect(book["SOLUSD"]).toBe(firstRef);
        });
    });

    describe("getOppositeSide", () => {
        test("returns asks for LONG", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const side = ob.getOppositeSide("SOLUSD", "LONG");
            expect(side).toBe(getOrderBook(ob)["SOLUSD"]!.asks);
        });

        test("returns bids for SHORT", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const side = ob.getOppositeSide("SOLUSD", "SHORT");
            expect(side).toBe(getOrderBook(ob)["SOLUSD"]!.bids);
        });

        test("returns null for uninitialized market", () => {
            const ob = new OrderBookManager();
            expect(ob.getOppositeSide("SOLUSD", "LONG")).toBeNull();
        });
    });

    describe("getSameSide", () => {
        test("returns bids for LONG", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const side = ob.getSameSide("SOLUSD", "LONG");
            expect(side).toBe(getOrderBook(ob)["SOLUSD"]!.bids);
        });

        test("returns asks for SHORT", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const side = ob.getSameSide("SOLUSD", "SHORT");
            expect(side).toBe(getOrderBook(ob)["SOLUSD"]!.asks);
        });

        test("returns null for uninitialized market", () => {
            const ob = new OrderBookManager();
            expect(ob.getSameSide("SOLUSD", "LONG")).toBeNull();
        });
    });

    describe("calculateTotalTrade", () => {
        test("sums up total quantity and total spent", () => {
            const ob = new OrderBookManager();
            const result = ob.calculateTotalTrade([
                { price: 100, qty: 2 },
                { price: 101, qty: 3 },
            ]);
            expect(result.totalQty).toBe(5);
            expect(result.totalSpent).toBe(2 * 100 + 3 * 101);
        });

        test("returns zeros for empty fills", () => {
            const ob = new OrderBookManager();
            const result = ob.calculateTotalTrade([]);
            expect(result.totalQty).toBe(0);
            expect(result.totalSpent).toBe(0);
        });
    });

    describe("createUserOrder", () => {
        test("creates and stores an order with LIMIT type", () => {
            const ob = new OrderBookManager();
            const result = ob.createUserOrder("user1", "LONG", "LIMIT", 10, 100, "SOLUSD", 150);
            expect(result.orderId).toBeDefined();
            expect(result.data.userId).toBe("user1");
            expect(result.data.kind).toBe("LONG");
            expect(result.data.type).toBe("LIMIT");
            expect(result.data.qty).toBe(10);
            expect(result.data.price).toBe(150);
            expect(result.data.margin).toBe(100);
            expect(result.data.market).toBe("SOLUSD");
            expect(result.data.status).toBe("OPEN");
            expect(getOrders(ob).get(result.orderId)).toBeDefined();
        });

        test("creates and stores an order with MARKET type", () => {
            const ob = new OrderBookManager();
            const result = ob.createUserOrder("user1", "SHORT", "MARKET", 5, 50, "SOLUSD");
            expect(result.data.type).toBe("MARKET");
            expect(result.data.price).toBe(0);
        });
    });

    describe("getOrder", () => {
        test("returns order details for existing order", () => {
            const ob = new OrderBookManager();
            const { orderId } = ob.createUserOrder("user1", "LONG", "LIMIT", 10, 100, "SOLUSD", 150);
            const order = ob.getOrder("user1", orderId);
            expect(order).not.toBeNull();
            expect(order!.userId).toBe("user1");
        });

        test("returns null for non-existent order", () => {
            const ob = new OrderBookManager();
            expect(ob.getOrder("user1", "nonexistent")).toBeNull();
        });
    });

    describe("changeOrderStatus", () => {
        test("changes order status when userId matches", () => {
            const ob = new OrderBookManager();
            const { orderId } = ob.createUserOrder("user1", "LONG", "LIMIT", 10, 100, "SOLUSD", 150);
            ob.changeOrderStatus("user1", orderId, "FILLED");
            const order = getOrders(ob).get(orderId);
            expect(order!.status).toBe("FILLED");
        });

        test("returns null when userId does not match", () => {
            const ob = new OrderBookManager();
            const { orderId } = ob.createUserOrder("user1", "LONG", "LIMIT", 10, 100, "SOLUSD", 150);
            const result = ob.changeOrderStatus("user2", orderId, "FILLED");
            expect(result).toBeNull();
        });
    });

    describe("addToFills", () => {
        test("adds a fill record", () => {
            const ob = new OrderBookManager();
            ob.addToFills("buyer1", "seller1", 5, 100, "order1", "LIMIT", "LONG", "FILLED");
            const fills = getFills(ob);
            expect(fills.length).toBe(1);
            expect(fills[0].buyerId).toBe("buyer1");
            expect(fills[0].sellerId).toBe("seller1");
            expect(fills[0].qty).toBe(5);
            expect(fills[0].price).toBe(100);
            expect(fills[0].orderId).toBe("order1");
            expect(fills[0].status).toBe("FILLED");
        });
    });

    describe("cancelOrder", () => {
        test("cancels an existing order stored in orders map", () => {
            const ob = new OrderBookManager();
            ob.intializedMarket("SOLUSD");
            const { orderId } = ob.createUserOrder("user1", "LONG", "LIMIT", 5, 50, "SOLUSD", 100);
            // Place the order in the order book bids so cancelOrder can find the price level
            const bidEntry: openOrder = { totalQty: 5, filledQty: 0, orderId, userId: "user1" };
            const level: Bids = { totalqty: 5, openOrder: [bidEntry] };
            getOrderBook(ob)["SOLUSD"]!.bids.setElement(100, level);

            const result = ob.cancelOrder("user1", orderId);
            expect(result).not.toBeNull();
            expect(result!.orderId).toBe(orderId);
            const order = getOrders(ob).get(orderId);
            expect(order!.status).toBe("CANCELLED");
        });

        test("returns null for non-existent order", () => {
            const ob = new OrderBookManager();
            expect(ob.cancelOrder("user1", "nonexistent")).toBeNull();
        });

        test("returns null if order not found in price level", () => {
            const ob = new OrderBookManager();
            const { orderId } = ob.createUserOrder("user1", "LONG", "LIMIT", 5, 50, "SOLUSD", 100);
            const result = ob.cancelOrder("user1", orderId);
            expect(result).toBeNull();
        });
    });

    describe("createLongOrder", () => {
        test("fully fills against existing asks (market order)", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addAsk(ob, "SOLUSD", 100, 5, "seller1");
            addAsk(ob, "SOLUSD", 101, 3, "seller2");

            const result = ob.createLongOrder("buyer1", "LONG", "MARKET", 8, 999999, 80, "SOLUSD");
            expect(result.filledQty).toBe(8);
            expect(result.totalQty).toBe(8);
            expect(result.fills.length).toBe(2);
        });

        test("partially fills, remaining sits on bids (limit order)", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addAsk(ob, "SOLUSD", 100, 3, "seller1");

            const result = ob.createLongOrder("buyer1", "LONG", "LIMIT", 5, 100, 50, "SOLUSD");
            expect(result.filledQty).toBe(3);
            expect(result.totalQty).toBe(5);

            const bids = getOrderBook(ob)["SOLUSD"]!.bids;
            const bidLevel = bids.getElementByKey(100);
            expect(bidLevel).toBeDefined();
            expect(bidLevel!.totalqty).toBe(2);
        });

        test("limit order with no match sits on bids side", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            const result = ob.createLongOrder("buyer1", "LONG", "LIMIT", 5, 100, 50, "SOLUSD");
            expect(result.filledQty).toBe(0);
            expect(result.totalQty).toBe(5);

            const bids = getOrderBook(ob)["SOLUSD"]!.bids;
            const bidLevel = bids.getElementByKey(100);
            expect(bidLevel).toBeDefined();
            expect(bidLevel!.totalqty).toBe(5);
        });

        test("multiple LONG orders at same price level accumulate on bids", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            ob.createLongOrder("buyer1", "LONG", "LIMIT", 3, 100, 30, "SOLUSD");
            ob.createLongOrder("buyer2", "LONG", "LIMIT", 2, 100, 20, "SOLUSD");

            const bids = getOrderBook(ob)["SOLUSD"]!.bids;
            const bidLevel = bids.getElementByKey(100);
            expect(bidLevel!.totalqty).toBe(5);
            expect(bidLevel!.openOrder.length).toBe(2);
        });

        test("does not match when order price below best ask", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addAsk(ob, "SOLUSD", 110, 5, "seller1");
            addAsk(ob, "SOLUSD", 120, 3, "seller2");

            const result = ob.createLongOrder("buyer1", "LONG", "LIMIT", 4, 100, 40, "SOLUSD");
            expect(result.filledQty).toBe(0);
            expect(result.totalQty).toBe(4);
        });
    });

    describe("createShortOrder", () => {
        test("fully fills against existing bids (market order)", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addBid(ob, "SOLUSD", 100, 4, "buyer1");
            addBid(ob, "SOLUSD", 99, 3, "buyer2");

            const result = ob.createShortOrder("seller1", "SHORT", "MARKET", 7, 0, 70, "SOLUSD");
            expect(result.filledQty).toBe(7);
            expect(result.totalQty).toBe(7);
        });

        test("partially fills, remaining sits on asks (limit order)", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addBid(ob, "SOLUSD", 100, 2, "buyer1");

            const result = ob.createShortOrder("seller1", "SHORT", "LIMIT", 5, 100, 50, "SOLUSD");
            expect(result.filledQty).toBe(2);
            expect(result.totalQty).toBe(5);

            const asks = getOrderBook(ob)["SOLUSD"]!.asks;
            expect(asks.size()).toBeGreaterThan(0);
        });

        test("limit order with no match sits on asks side", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            const result = ob.createShortOrder("seller1", "SHORT", "LIMIT", 5, 100, 50, "SOLUSD");
            expect(result.filledQty).toBe(0);
            expect(result.totalQty).toBe(5);
        });

        test("breaks when best bid below order price", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addBid(ob, "SOLUSD", 90, 5, "buyer1");

            const result = ob.createShortOrder("seller1", "SHORT", "LIMIT", 3, 100, 30, "SOLUSD");
            expect(result.filledQty).toBe(0);
        });
    });

    describe("createLiquidationMarketLongOrder", () => {
        test("fills against all asks without price check", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addAsk(ob, "SOLUSD", 100, 5, "seller1");
            addAsk(ob, "SOLUSD", 110, 3, "seller2");

            const result = ob.createLiquidationMarketLongOrder("liquidatedUser", 8, 80, "SOLUSD");
            expect(result.filledQty).toBe(8);
            expect(result.totalQty).toBe(8);
        });

        test("partial fill when not enough liquidity", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addAsk(ob, "SOLUSD", 100, 3, "seller1");

            const result = ob.createLiquidationMarketLongOrder("liquidatedUser", 10, 100, "SOLUSD");
            expect(result.filledQty).toBe(3);
            expect(result.totalQty).toBe(10);
        });
    });

    describe("createLiquidationMarketShortOrder", () => {
        test("fills against all bids without price check", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addBid(ob, "SOLUSD", 100, 4, "buyer1");
            addBid(ob, "SOLUSD", 95, 3, "buyer2");

            const result = ob.createLiquidationMarketShortOrder("liquidatedUser", 7, 70, "SOLUSD");
            expect(result.filledQty).toBe(7);
            expect(result.totalQty).toBe(7);
        });

        test("partial fill when not enough liquidity", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            addBid(ob, "SOLUSD", 100, 2, "buyer1");

            const result = ob.createLiquidationMarketShortOrder("liquidatedUser", 10, 100, "SOLUSD");
            expect(result.filledQty).toBe(2);
            expect(result.totalQty).toBe(10);
        });
    });

    describe("cross-market scenarios", () => {
        test("orders in different markets do not interact", () => {
            const ob = new OrderBookManager();
            initMarket(ob, "SOLUSD");
            initMarket(ob, "BTCUSD");

            ob.createLongOrder("buyer1", "LONG", "LIMIT", 5, 100, 50, "SOLUSD");
            addBid(ob, "BTCUSD", 100, 5, "buyer2");
            const result = ob.createShortOrder("seller1", "SHORT", "MARKET", 5, 0, 50, "BTCUSD");
            expect(result.filledQty).toBe(5);
        });
    });
});
