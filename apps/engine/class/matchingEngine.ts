import Balance from "./balance";
import PostionManager from "./PositionManager";
import ORDERBOOK from "./orderBook";
import { Shared } from "shared-types";

export default class MatchingEngine {
    private orderBook: ORDERBOOK;
    private balance: Balance;
    private positons: PostionManager;

    constructor(position: PostionManager) {
        this.orderBook = new ORDERBOOK();
        this.balance = new Balance();
        this.positons = position;

    }
    getLastTradedPriceOFMarket(market: Shared.MARKET_AVAILABEL) {
        return this.orderBook.getLastTradedPriceOFMarket(market)
    }

    createOrder(userId: string, market: Shared.MARKET_AVAILABEL, type: Shared.TYPE, kind: Shared.KIND, qty: number, price: number, equity: number) {

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

    cancelOrder(userId: string, orderId: string) {
        const cancelOrder = this.orderBook.cancelOrder(userId, orderId);
        if (!cancelOrder) {
            return
        }
        const cancelOrderReductionratio = cancelOrder.filledQty! / cancelOrder.totalQty!;
        const cancelOrderMarginSpent = cancelOrder.margin * cancelOrderReductionratio!;
        this.balance.updateBalance(userId, cancelOrderMarginSpent);
        this.balance.updateLockedBalance(userId, -cancelOrderMarginSpent);

        return cancelOrder;

    }

    getOrder(userId: string, orderId: string) {
        const userOrder = this.orderBook.getOrder(userId, orderId);
        if (!userOrder) {
            return null;
        }
        return userOrder
    }

    getBalance(userId: string, market?: Shared.MARKET_AVAILABEL) {
        if (market) {
            const userBalance = this.positons.getPosition(userId, market);
            return userBalance
        }
        const userBalance = this.balance.getBalance(userId);
        return userBalance;
    }

    addBalance(userId: string, amount: number) {
        const addUserBalance = this.balance.addBalance(userId, amount);
        if (!addUserBalance) {
            return null
        }

    }

    palceMarketOrderForLiquidation(userId: string, kind: Shared.KIND, qty: number, margin: number, market: Shared.MARKET_AVAILABEL, costBasis: number) {
        let userOrderInfo;
        // opposite order placed in order to close postion
        if (kind === "SHORT") {
            userOrderInfo = this.orderBook.createLiquidationMarketLongOrder(userId, qty, margin, market);
            // do the calculation in balances as revert back loss or profit and release the remianing margin
            const rpnl = costBasis - userOrderInfo.totalSpent;
            const amountToReturn = margin - rpnl;
            // if amountToReturn -ve than max 0 can be posssibel than rest of it decrese from exchange insurance funds
            // can be negative suppose if other person can buy at worst price
            const reductionRatio = userOrderInfo.filledQty / userOrderInfo.totalQty;
            const lockedMarginToRelease = margin * reductionRatio;
            // update margin
            this.balance.updateLockedBalance(userId, lockedMarginToRelease);
            // return the amountToreturn after adding profit and substracting loss
            this.balance.updateBalance(userId, amountToReturn)

        } else {
            userOrderInfo = this.orderBook.createLiquidationMarketShortOrder(userId, qty, margin, market)
            // do the calculation in balances as revert back loss or profit and release the remianing margin 
            const rpnl = costBasis - userOrderInfo.totalSpent;
            // if amountToReturn -ve than max 0 can be posssibel than rest of it decrese from exchange insurance funds
            // amountReturn negative suppose if other person can buy at worst price
            // TO DO : decrese from exhange profit balnces -> insurance funds
            const amountToReturn = margin - rpnl;
            const reductionRatio = userOrderInfo.filledQty / userOrderInfo.totalQty;
            const lockedMarginToRelease = margin * reductionRatio;
            // update margin
            this.balance.updateLockedBalance(userId, lockedMarginToRelease);
            // return the amountToreturn after adding profit and substracting loss
            this.balance.updateBalance(userId, amountToReturn)
        }
        return { ...userOrderInfo, userId, kind: kind === "SHORT" ? "LONG" : "SHORT" }
    }
}