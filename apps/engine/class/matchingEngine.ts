import type { Kind, MARKET, MarketIndex, Type } from "types";
import Balance from "./balance";
import PostionManager from "./liquidation";
import ORDERBOOK from "./orderBook";
import { REDISEARCH_LANGUAGE } from "redis";

export default class MatchingEngine {
    private orderBook: ORDERBOOK;
    private balance: Balance;
    private positons: PostionManager;

    constructor() {
        this.orderBook = new ORDERBOOK();
        this.balance = new Balance();
        this.positons = new PostionManager()
    }

    createOrder(userId: string, market: MARKET, type: Type, kind: Kind, qty: number, price: number, equity: number) {

        const userCurrentPostion = this.positons.getPosition(userId, market)
        if (!userCurrentPostion || userCurrentPostion.kind === kind) {
            const userAmount = this.balance.getBalance(userId);
            if (userAmount === null) {
                return null // user account doesn't exist
            }
            if (userAmount < equity) {
                return null
            }

            if (kind === "LONG") {
                this.balance.updateLockedBalance(userId, equity);
                this.balance.updateBalance(userId, -equity); 
                const orderDetails = this.orderBook.createLongOrder(userId, kind, type, qty, price, equity, market);
                if (!orderDetails) {
                    // Rollback: restore balance
                    this.balance.updateLockedBalance(userId, -equity);
                    this.balance.updateBalance(userId, equity);
                    return null;
                }
                this.positons.changePosition(userId, market, kind, orderDetails.filledQty, orderDetails.totalSpent, equity);
                return orderDetails;
            } else {
                if (userAmount >= equity) {
                    this.balance.updateLockedBalance(userId, equity);
                    this.balance.updateBalance(userId, -equity); // deduct from available
                    const orderDetails = this.orderBook.createShortOrder(userId, kind, type, qty, price, equity, market);
                    if (!orderDetails) {
                        // can do Rollback: restore balance : but i have a pure inputs so pure output
                        // this.balance.updateLockedBalance(userId, -equity);
                        // this.balance.updateBalance(userId, equity);
                        return null;
                    }
                    this.positons.changePosition(userId, market, kind, orderDetails.filledQty, orderDetails.totalSpent, equity);
                    return orderDetails;
                }
            }
        } else {
            let orderDetails;
            if (kind === "LONG") {
                orderDetails = this.orderBook.createLongOrder(userId, kind, type, qty, price, equity, market);
            } else {
                orderDetails = this.orderBook.createShortOrder(userId, kind, type, qty, price, equity, market);
            }

            if (!orderDetails || orderDetails.filledQty === 0) {
                return null;
            }

            const existingQty = userCurrentPostion.qty;
            const existingCostBasis = userCurrentPostion.costBasis;
            const existingMargin = userCurrentPostion.margin;
            const existingKind = userCurrentPostion.kind;

            if (existingQty > orderDetails.filledQty) {
                const reductionRatio = orderDetails.filledQty / existingQty;
                const releasedMargin = existingMargin * reductionRatio;
                const entryCostBasisOfReduced = existingCostBasis * reductionRatio;

                let pnl = 0;
                if (existingKind === "LONG") {
                    pnl = orderDetails.totalSpent - entryCostBasisOfReduced;
                } else {
                    pnl = entryCostBasisOfReduced - orderDetails.totalSpent;
                }

                this.balance.updateLockedBalance(userId, -releasedMargin);
                this.balance.addBalance(userId, releasedMargin + pnl);

                this.positons.changePosition(userId, market, kind, orderDetails.filledQty, entryCostBasisOfReduced, releasedMargin);
            }
            else if (existingQty === orderDetails.filledQty) {
                // Full Close
                let pnl = 0;
                if (existingKind === "LONG") {
                    pnl = orderDetails.totalSpent - existingCostBasis;
                } else {
                    pnl = existingCostBasis - orderDetails.totalSpent;
                }

                this.balance.updateLockedBalance(userId, -existingMargin);
                this.balance.addBalance(userId, existingMargin + pnl);

                this.positons.changePosition(userId, market, kind, orderDetails.filledQty, existingCostBasis, existingMargin);
            }
            else {
                const closeRatio = existingQty / orderDetails.filledQty;
                const closedTotalSpent = orderDetails.totalSpent * closeRatio;

                let closePnl = 0;
                if (existingKind === "LONG") {
                    closePnl = closedTotalSpent - existingCostBasis;
                } else {
                    closePnl = existingCostBasis - closedTotalSpent;
                }

                this.balance.updateLockedBalance(userId, -existingMargin);
                this.balance.addBalance(userId, existingMargin + closePnl);

                const flippedQty = orderDetails.filledQty - existingQty;
                const flippedCostBasis = orderDetails.totalSpent - closedTotalSpent;
                const flippedMarginRatio = flippedQty / orderDetails.filledQty;
                const flippedMargin = equity * flippedMarginRatio;

                this.balance.updateLockedBalance(userId, flippedMargin);
                this.balance.updateBalance(userId, -flippedMargin); 

                this.positons.changePosition(userId, market, kind, existingQty, existingCostBasis, existingMargin);
                this.positons.changePosition(userId, market, kind, flippedQty, flippedCostBasis, flippedMargin);
            }
            return orderDetails;
        }
    }
    cancelOrder() { }
    getOrder() { }
    getBalance() { }
    getOpenPositions() { }
    getClosePositions() { }

}