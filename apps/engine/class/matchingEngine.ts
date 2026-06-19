import Balance from "./balance";
import PostionManager from "./PositionManager";
import ORDERBOOK from "./orderBook";
import { Shared } from "shared-types";
import type { EngineSnapShotInstanceType } from "shared-types/internal-types";

export default class MatchingEngine {
  private orderBook: ORDERBOOK;
  private balance: Balance;
  private positons: PostionManager;

  constructor(position: PostionManager) {
    this.orderBook = new ORDERBOOK();
    this.balance = new Balance();
    this.positons = position;
  }

  getSnapShotOfEngine() {
    return {
      ...this.orderBook.createSnapShot(),
      ...this.positons.createPositionSnapshot(),
      balance: this.balance.createBalanceSnapShot(),
    };
  }

  loadSnapShotOfEngine(engieneSnapShotInstance: EngineSnapShotInstanceType) {
    this.balance.loadBalanceSnapshot(engieneSnapShotInstance.balance);
    this.orderBook.loadSnapShot({
      exchangeProfit: engieneSnapShotInstance.exchangeProfit,
      fills: engieneSnapShotInstance.fills,
      fundingInsurance: engieneSnapShotInstance.fundingInsurance,
      orderbook: engieneSnapShotInstance.orderbook,
      orders: engieneSnapShotInstance.orders,
    });
    this.positons.loadPositionSnapshot({
      marketIndex: engieneSnapShotInstance.marketIndex,
      positions: engieneSnapShotInstance.positions,
    });
  }
  getLastTradedPriceOFMarket(market: Shared.MARKET_AVAILABEL) {
    return this.orderBook.getLastTradedPriceOFMarket(market);
  }

  createOrder(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    type: Shared.TYPE,
    kind: Shared.KIND,
    qty: number,
    price: number,
    equity: number,
  ) {
    const userCurrentPostion = this.positons.getPosition(userId, market);
    if (!userCurrentPostion || userCurrentPostion.kind === kind) {
      const userAmount = this.balance.getBalance(userId);
      if (userAmount === null) {
        return null; // user account doesn't exist
      }

      if (userAmount < equity) {
        return null;
      }

      if (kind === "LONG") {
        this.balance.updateLockedBalance(userId, equity);
        this.balance.updateBalance(userId, -equity);
        const orderDetails = this.orderBook.createLongOrder(
          userId,
          kind,
          type,
          qty,
          price,
          equity,
          market,
        );
        if (!orderDetails) {
          // Rollback: restore balance
          this.balance.updateLockedBalance(userId, -equity);
          this.balance.updateBalance(userId, equity);
          return null;
        }
        this.positons.changePosition(
          userId,
          market,
          kind,
          orderDetails.filledQty,
          orderDetails.totalSpent,
          equity,
        );
        return orderDetails;
      } else {
        if (userAmount >= equity) {
          this.balance.updateLockedBalance(userId, equity);
          this.balance.updateBalance(userId, -equity); // deduct from available
          const orderDetails = this.orderBook.createShortOrder(
            userId,
            kind,
            type,
            qty,
            price,
            equity,
            market,
          );
          if (!orderDetails) {
            // can do Rollback: restore balance : but i have a pure inputs so pure output
            // this.balance.updateLockedBalance(userId, -equity);
            // this.balance.updateBalance(userId, equity);
            return null;
          }
          this.positons.changePosition(
            userId,
            market,
            kind,
            orderDetails.filledQty,
            orderDetails.totalSpent,
            equity,
          );
          return orderDetails;
        }
      }
    } else {
      let orderDetails;
      if (kind === "LONG") {
        orderDetails = this.orderBook.createLongOrder(
          userId,
          kind,
          type,
          qty,
          price,
          equity,
          market,
        );
      } else {
        orderDetails = this.orderBook.createShortOrder(
          userId,
          kind,
          type,
          qty,
          price,
          equity,
          market,
        );
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

        this.positons.changePosition(
          userId,
          market,
          kind,
          orderDetails.filledQty,
          entryCostBasisOfReduced,
          releasedMargin,
        );
      } else if (existingQty === orderDetails.filledQty) {
        // Full Close
        let pnl = 0;
        if (existingKind === "LONG") {
          pnl = orderDetails.totalSpent - existingCostBasis;
        } else {
          pnl = existingCostBasis - orderDetails.totalSpent;
        }

        this.balance.updateLockedBalance(userId, -existingMargin);
        this.balance.addBalance(userId, existingMargin + pnl);

        this.positons.changePosition(
          userId,
          market,
          kind,
          orderDetails.filledQty,
          existingCostBasis,
          existingMargin,
        );
      } else {
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

        this.positons.changePosition(
          userId,
          market,
          kind,
          existingQty,
          existingCostBasis,
          existingMargin,
        );
        this.positons.changePosition(
          userId,
          market,
          kind,
          flippedQty,
          flippedCostBasis,
          flippedMargin,
        );
      }
      return orderDetails;
    }
  }

  cancelOrder(userId: string, orderId: string) {
    const cancelOrder = this.orderBook.cancelOrder(userId, orderId);
    if (!cancelOrder) {
      return;
    }
    const cancelOrderReductionratio =
      cancelOrder.filledQty! / cancelOrder.totalQty!;
    const cancelOrderMarginSpent =
      cancelOrder.margin * cancelOrderReductionratio!;
    this.balance.updateBalance(userId, cancelOrderMarginSpent);
    this.balance.updateLockedBalance(userId, -cancelOrderMarginSpent);

    return cancelOrder;
  }

  getOrder(userId: string, orderId: string) {
    const userOrder = this.orderBook.getOrder(userId, orderId);
    if (!userOrder) {
      return null;
    }
    return userOrder;
  }

  getBalance(userId: string, market?: Shared.MARKET_AVAILABEL) {
    if (market) {
      const userBalance = this.positons.getPosition(userId, market);
      return userBalance;
    }
    const userBalance = this.balance.getBalance(userId);
    return userBalance;
  }

  addBalance(userId: string, amount: number) {
    const addUserBalance = this.balance.addBalance(userId, amount);
    if (!addUserBalance) {
      return null;
    }
  }

  palceMarketOrderForLiquidation(
    userId: string,
    kind: Shared.KIND,
    qty: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
    costBasis: number,
  ) {
    let userOrderInfo;
    const maxPrice = costBasis / qty;

    if (kind === "SHORT") {
      userOrderInfo = this.orderBook.createLongOrder(
        userId,
        "LONG",
        "MARKET",
        qty,
        maxPrice,
        margin,
        market,
      );
      if (userOrderInfo.filledQty < userOrderInfo.totalQty) {
        // run ADL
        const prfitDetails = this.positons.calculateAndGetHigestPnl(
          "SHORT",
          market,
        );
        const [pnl, profitableUserId] = prfitDetails.profitableUser!;

        //. update positions of profitable trader
        const remianingQty = userOrderInfo.filledQty - userOrderInfo.totalQty;
        const getProfitableUserPosition = this.positons.getPosition(
          profitableUserId,
          market,
        );
        const getAdlUserPosition = this.positons.getPosition(userId, market);
        this.positons.changePosition(
          profitableUserId,
          market,
          "SHORT",
          remianingQty,
          prfitDetails.markPrice,
          getProfitableUserPosition?.margin!,
        );
        // creaet ptofitabel user order on book1
        const profitableUserOrder = this.orderBook.createLongOrder(
          profitableUserId,
          "SHORT",
          "MARKET",
          remianingQty,
          prfitDetails.markPrice,
          getProfitableUserPosition?.margin!,
          market,
        );
        // create ADL user arket order as well and match it with remiaing
        const adlUserOrder = this.orderBook.createShortOrder(
          userId,
          "LONG",
          "MARKET",
          remianingQty,
          maxPrice,
          prfitDetails.markPrice,
          market,
        );

        // balance managing of profitable user
        const uPnlOfprofitableUser =
          profitableUserOrder.totalSpent -
          getProfitableUserPosition?.costBasis!;
        const reductionRatio =
          profitableUserOrder.filledQty / profitableUserOrder.totalQty;

        const marginToFree =
          getProfitableUserPosition?.margin! * reductionRatio;
        this.balance.updateBalance(
          profitableUserId,
          marginToFree + uPnlOfprofitableUser,
        );
        this.balance.updateLockedBalance(profitableUserId, -marginToFree);
        // TODO: delete if filled qty and position.qty
        // balance managin of other user1
        const uPnlOfAdlUser =
          getAdlUserPosition?.costBasis! - adlUserOrder.totalSpent;
        const reductionRatioAdlUser =
          adlUserOrder.filledQty - getAdlUserPosition?.qty!;
        const marginToFreeAdlUser =
          getAdlUserPosition?.margin! * reductionRatioAdlUser;

        this.balance.updateBalance(userId, marginToFreeAdlUser + uPnlOfAdlUser);
        this.balance.updateLockedBalance(userId, -marginToFreeAdlUser);
      }
      const rpnl = costBasis - userOrderInfo.totalSpent;
      const amountToReturn = margin - rpnl;
      const reductionRatio = userOrderInfo.filledQty / userOrderInfo.totalQty;
      const lockedMarginToRelease = margin * reductionRatio;
      this.balance.updateLockedBalance(userId, lockedMarginToRelease);
      this.balance.updateBalance(userId, amountToReturn);
    } else {
      userOrderInfo = this.orderBook.createLongOrder(
        userId,
        "SHORT",
        "MARKET",
        qty,
        maxPrice,
        margin,
        market,
      );
      if (userOrderInfo.filledQty < userOrderInfo.totalQty) {
        // run ADL

        const prfitDetails = this.positons.calculateAndGetHigestPnl(
          "LONG",
          market,
        );
        const [pnl, profitableUserId] = prfitDetails.profitableUser!;

        //. update positions of profitable trader
        const remianingQty = userOrderInfo.filledQty - userOrderInfo.totalQty;
        const getProfitableUserPosition = this.positons.getPosition(
          profitableUserId,
          market,
        );
        const getAdlUserPosition = this.positons.getPosition(userId, market);
        this.positons.changePosition(
          profitableUserId,
          market,
          "LONG",
          remianingQty,
          prfitDetails.markPrice,
          getProfitableUserPosition?.margin!,
        );
        // creaet ptofitabel user order on book1
        const profitableUserOrder = this.orderBook.createLongOrder(
          profitableUserId,
          "LONG",
          "MARKET",
          remianingQty,
          prfitDetails.markPrice,
          getProfitableUserPosition?.margin!,
          market,
        );
        // create ADL user arket order as well and match it with remiaing
        const adlUserOrder = this.orderBook.createShortOrder(
          userId,
          "SHORT",
          "MARKET",
          remianingQty,
          maxPrice,
          prfitDetails.markPrice,
          market,
        );

        // balance managing of profitable user
        const uPnlOfprofitableUser =
          profitableUserOrder.totalSpent -
          getProfitableUserPosition?.costBasis!;
        const reductionRatio =
          profitableUserOrder.filledQty / profitableUserOrder.totalQty;

        const marginToFree =
          getProfitableUserPosition?.margin! * reductionRatio;
        this.balance.updateBalance(
          profitableUserId,
          marginToFree + uPnlOfprofitableUser,
        );
        this.balance.updateLockedBalance(profitableUserId, -marginToFree);
        // TODO: delete if filled qty and position.qty
        // balance managin of other user1
        const uPnlOfAdlUser =
          getAdlUserPosition?.costBasis! - adlUserOrder.totalSpent;
        const reductionRatioAdlUser =
          adlUserOrder.filledQty - getAdlUserPosition?.qty!;
        const marginToFreeAdlUser =
          getAdlUserPosition?.margin! * reductionRatioAdlUser;

        this.balance.updateBalance(userId, marginToFreeAdlUser + uPnlOfAdlUser);
        this.balance.updateLockedBalance(userId, -marginToFreeAdlUser);
      }
      const rpnl = costBasis - userOrderInfo.totalSpent;
      const amountToReturn = margin - rpnl;
      const reductionRatio = userOrderInfo.filledQty / userOrderInfo.totalQty;
      const lockedMarginToRelease = margin * reductionRatio;
      this.balance.updateLockedBalance(userId, lockedMarginToRelease);
      this.balance.updateBalance(userId, amountToReturn);
    }
    return {
      ...userOrderInfo,
      userId,
      kind: kind === "SHORT" ? "LONG" : "SHORT",
    };
  }
}
