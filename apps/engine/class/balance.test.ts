import { test, expect, describe } from "bun:test";
import Balance from "./balance";

describe("Balance", () => {
    test("constructor initializes empty user record", () => {
        const balance = new Balance();
        // @ts-expect-error - accessing private property for test
        expect(balance.user).toEqual({});
    });

    test("getBalance returns null for non-existent user", () => {
        const balance = new Balance();
        expect(balance.getBalance("nonexistent")).toBeNull();
    });

    test("getBalance returns balance for existing user", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 500, lockedBalance: 100 } };
        expect(balance.getBalance("user1")).toBe(500);
    });

    test("updateBalance modifies balance for existing user", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 500, lockedBalance: 100 } };
        balance.updateBalance("user1", -50);
        // @ts-expect-error - accessing private property for verification
        expect(balance.user.user1.balance).toBe(450);
    });

    test("updateBalance returns null for non-existent user", () => {
        const balance = new Balance();
        expect(balance.updateBalance("nonexistent", 100)).toBeNull();
    });

    test("addBalance adds to existing user balance", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 500, lockedBalance: 0 } };
        balance.addBalance("user1", 200);
        // @ts-expect-error - accessing private property for verification
        expect(balance.user.user1.balance).toBe(700);
    });

    test("addBalance returns null for non-existent user", () => {
        const balance = new Balance();
        expect(balance.addBalance("nonexistent", 100)).toBeNull();
    });

    test("updateLockedBalance modifies locked balance", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 1000, lockedBalance: 100 } };
        balance.updateLockedBalance("user1", 50);
        // @ts-expect-error - accessing private property for verification
        expect(balance.user.user1.lockedBalance).toBe(150);
    });

    test("updateLockedBalance can decrease locked balance", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 1000, lockedBalance: 200 } };
        balance.updateLockedBalance("user1", -100);
        // @ts-expect-error - accessing private property for verification
        expect(balance.user.user1.lockedBalance).toBe(100);
    });

    test("updateLockedBalance returns null for non-existent user", () => {
        const balance = new Balance();
        expect(balance.updateLockedBalance("nonexistent", 50)).toBeNull();
    });

    test("addLockedBalance adds to locked balance", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 1000, lockedBalance: 50 } };
        balance.addLockedBalance("user1", 100);
        // @ts-expect-error - accessing private property for verification
        expect(balance.user.user1.lockedBalance).toBe(150);
    });

    test("addLockedBalance returns null for non-existent user", () => {
        const balance = new Balance();
        expect(balance.addLockedBalance("nonexistent", 50)).toBeNull();
    });

    test("getLockedBalance returns locked balance", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 1000, lockedBalance: 75 } };
        expect(balance.getLockedBalance("user1")).toBe(75);
    });

    test("getLockedBalance returns null for non-existent user", () => {
        const balance = new Balance();
        expect(balance.getLockedBalance("nonexistent")).toBeNull();
    });

    test("updateBalance with negative amount deducts correctly", () => {
        const balance = new Balance();
        // @ts-expect-error - setting up test state
        balance.user = { user1: { balance: 300, lockedBalance: 0 } };
        balance.updateBalance("user1", -299);
        // @ts-expect-error - accessing private property for verification
        expect(balance.user.user1.balance).toBe(1);
    });
});
