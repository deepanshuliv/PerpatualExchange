import { test, expect, describe } from "bun:test";
import PostionManager from "./PositionManager";

describe("PostionManager", () => {
    test("constructor initializes empty state", () => {
        const pm = new PostionManager();
        // @ts-expect-error - accessing private property for test
        expect(pm.positions.size).toBe(0);
        // @ts-expect-error - accessing private property for test
        expect(pm.markteIndex.size).toBe(0);
    });

    test("getPosition returns null for non-existent user", () => {
        const pm = new PostionManager();
        expect(pm.getPosition("nonexistent", "SOLUSD")).toBeNull();
    });

    test("getPosition returns null when user has no position for market", () => {
        const pm = new PostionManager();
        // @ts-expect-error - setting up test state
        pm.positions.set("user1", [
            { market: "BTCUSD", kind: "LONG", qty: 1, costBasis: 100, margin: 50 },
        ]);
        expect(pm.getPosition("user1", "SOLUSD")).toBeNull();
    });

    test("getPosition returns position for existing user and market", () => {
        const pm = new PostionManager();
        // @ts-expect-error - setting up test state
        pm.positions.set("user1", [
            { market: "SOLUSD", kind: "LONG", qty: 10, costBasis: 150, margin: 100 },
        ]);
        const pos = pm.getPosition("user1", "SOLUSD");
        expect(pos).not.toBeNull();
        expect(pos!.market).toBe("SOLUSD");
        expect(pos!.kind).toBe("LONG");
        expect(pos!.qty).toBe(10);
        expect(pos!.costBasis).toBe(150);
        expect(pos!.margin).toBe(100);
    });

    test("changePosition creates a new position", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 10, 150, 100);
        const pos = pm.getPosition("user1", "SOLUSD");
        expect(pos).not.toBeNull();
        expect(pos!.qty).toBe(10);
        expect(pos!.costBasis).toBe(150);
        expect(pos!.margin).toBe(100);
        expect(pos!.kind).toBe("LONG");
        // @ts-expect-error - check market index
        expect(pm.markteIndex.get("SOLUSD")?.has("user1")).toBe(true);
    });

    test("changePosition increases position when same kind", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 10, 100, 50);
        pm.changePosition("user1", "SOLUSD", "LONG", 5, 75, 25);
        const pos = pm.getPosition("user1", "SOLUSD");
        expect(pos!.qty).toBe(15);
        expect(pos!.costBasis).toBe(175);
        expect(pos!.margin).toBe(75);
    });

    test("changePosition reduces position when opposite kind and existing > filled", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 10, 200, 100);
        pm.changePosition("user1", "SOLUSD", "SHORT", 3, 60, 30);
        const pos = pm.getPosition("user1", "SOLUSD");
        expect(pos!.qty).toBe(7);
        expect(pos!.margin).toBe(70);
        expect(pos!.costBasis).toBe(140);
        expect(pos!.kind).toBe("LONG");
    });

    test("changePosition closes position exactly when opposite kind and qty equal", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 10, 200, 100);
        pm.changePosition("user1", "SOLUSD", "SHORT", 10, 200, 100);
        const pos = pm.getPosition("user1", "SOLUSD");
        expect(pos).toBeNull();
        // @ts-expect-error - check market index was cleaned
        expect(pm.markteIndex.get("SOLUSD")?.has("user1")).toBe(false);
    });

    test("changePosition flips position when opposite kind and existing < filled", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 5, 100, 50);
        pm.changePosition("user1", "SOLUSD", "SHORT", 10, 200, 100);
        const pos = pm.getPosition("user1", "SOLUSD");
        expect(pos!.qty).toBe(10);
        expect(pos!.kind).toBe("SHORT");
        expect(pos!.costBasis).toBe(200);
        expect(pos!.margin).toBe(100);
    });

    test("calculateLiquidation returns null for market with no positions", () => {
        const pm = new PostionManager();
        const result = pm.calculateLiquidation("SOLUSD", 100);
        expect(result).toBeNull();
    });

    test("calculateLiquidation returns users below liquidation threshold", () => {
        const pm = new PostionManager();
        // User has a LONG position with costBasis=200, qty=1, margin=50
        // markPrice=100, so uPnl = 100*1 - 200 = -100
        // liquidation limit = 50 * 0.95 = 47.5
        // uPnl + liquidationMarginLimit = -100 + 47.5 = -52.5 <= 0 -> liquidate
        pm.changePosition("user1", "SOLUSD", "LONG", 1, 200, 50);
        const result = pm.calculateLiquidation("SOLUSD", 100);
        expect(result).not.toBeNull();
        expect(result!.length).toBe(1);
        expect(result![0].userId).toBe("user1");
        expect(result![0].kind).toBe("LONG");
    });

    test("calculateLiquidation does not return users above threshold", () => {
        const pm = new PostionManager();
        // User has a LONG position with costBasis=100, qty=1, margin=50
        // markPrice=200, so uPnl = 200*1 - 100 = 100
        // liquidation limit = 50 * 0.95 = 47.5
        // uPnl + limit = 100 + 47.5 = 147.5 > 0 -> no liquidation
        pm.changePosition("user1", "SOLUSD", "LONG", 1, 100, 50);
        const result = pm.calculateLiquidation("SOLUSD", 200);
        expect(result).toEqual([]);
    });

    test("calculateLiquidation handles multiple users independently", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 1, 200, 50); // will liquidate
        pm.changePosition("user2", "SOLUSD", "LONG", 1, 90, 50);  // safe
        const result = pm.calculateLiquidation("SOLUSD", 150);
        expect(result!.length).toBe(1);
        expect(result![0].userId).toBe("user1");
    });

    test("calculateLiquidation only considers users in the specified market", () => {
        const pm = new PostionManager();
        pm.changePosition("user1", "SOLUSD", "LONG", 1, 200, 50);
        const result = pm.calculateLiquidation("BTCUSD", 100);
        expect(result).toBeNull();
    });
});
