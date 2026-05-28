import { test, expect, describe } from "bun:test";
import Admin from "./admin";
import OrderBookManager from "./orderBook";

describe("Admin", () => {
    test("constructor stores OrderBookManager instance", () => {
        const ob = new OrderBookManager();
        const admin = new Admin(ob);
        // @ts-expect-error - accessing private property for test
        expect(admin.engine).toBe(ob);
    });

    test("createAdminMarket calls intializedMarket on the engine", () => {
        const ob = new OrderBookManager();
        const admin = new Admin(ob);
        admin.createAdminMarket("SOLUSD");
        // @ts-expect-error - accessing private property for verification
        expect(ob.orderBook["SOLUSD"]).toBeDefined();
        // @ts-expect-error - accessing private property for verification
        expect(ob.orderBook["SOLUSD"]?.bids).toBeDefined();
        // @ts-expect-error - accessing private property for verification
        expect(ob.orderBook["SOLUSD"]?.asks).toBeDefined();
    });

    test("createAdminMarket can create multiple markets", () => {
        const ob = new OrderBookManager();
        const admin = new Admin(ob);
        admin.createAdminMarket("SOLUSD");
        admin.createAdminMarket("BTCUSD");
        // @ts-expect-error - accessing private property for verification
        expect(ob.orderBook["SOLUSD"]).toBeDefined();
        // @ts-expect-error - accessing private property for verification
        expect(ob.orderBook["BTCUSD"]).toBeDefined();
    });
});
