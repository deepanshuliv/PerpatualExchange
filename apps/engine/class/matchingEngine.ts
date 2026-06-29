import { Shared } from '@repo/shared-types';
import type {
  EngineSnapShotInstanceType,
  Fills,
  Orderdetails,
  PositionDetails,
} from '@repo/shared-types/internal-types';
import Balance from './balance';
import ORDERBOOK from './orderBook';
import PostionManager from './PositionManager';

export default class MatchingEngine {
  private orderBook: ORDERBOOK;
  private balance: Balance;
  private positons: PostionManager;

  constructor(position: PostionManager) {
    this.orderBook = new ORDERBOOK();
    this.balance = new Balance();
    this.positons = position;
  }

  createSnapShot() {
    return {
      ...this.orderBook.createSnapShot(),
      ...this.positons.createSnapShot(),
      balance: this.balance.createSnapShot(),
    };
  }

  loadSnapShot(engieneSnapShotInstance: EngineSnapShotInstanceType) {
    this.balance.loadSnapShot(engieneSnapShotInstance.balance);
    this.orderBook.loadSnapShot(engieneSnapShotInstance);
    this.positons.loadSnapShot(engieneSnapShotInstance);
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
      return this.executeOpeningOrder(userId, market, type, kind, qty, price, equity);
    }

    return this.executeClosingOrder(
      userId,
      market,
      type,
      kind,
      qty,
      price,
      equity,
      userCurrentPostion,
    );
  }

  private executeOpeningOrder(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    type: Shared.TYPE,
    kind: Shared.KIND,
    qty: number,
    price: number,
    equity: number,
  ) {
    const userAmount = this.balance.getBalance(userId);
    if (userAmount === null || userAmount < equity) {
      return null;
    }

    this.balance.updateBalance(userId, -equity);
    this.balance.updateLockedBalance(userId, equity);

    const orderDetails =
      kind === 'LONG'
        ? this.orderBook.createLongOrder(userId, kind, type, qty, price, equity, market)
        : this.orderBook.createShortOrder(userId, kind, type, qty, price, equity, market);

    if (!orderDetails) {
      this.balance.updateLockedBalance(userId, -equity);
      this.balance.updateBalance(userId, equity);
      return null;
    }

    const filledMargin = equity * (orderDetails.filledQty / qty);
    if (orderDetails.filledQty > 0) {
      this.positons.changePosition(
        userId,
        market,
        kind,
        orderDetails.filledQty,
        orderDetails.totalSpent,
        filledMargin,
      );
    }

    this.releaseUnusedOpeningMargin(
      userId,
      equity,
      filledMargin,
      type,
      orderDetails.filledQty,
      qty,
    );

    this.processMakerFills(orderDetails.fills ?? [], userId, orderDetails.orderId);
    return orderDetails;
  }

  private releaseUnusedOpeningMargin(
    userId: string,
    equity: number,
    filledMargin: number,
    type: Shared.TYPE,
    filledQty: number,
    totalQty: number,
  ) {
    const unusedMargin = equity - filledMargin;
    if (unusedMargin <= 0) return;

    if (type === 'LIMIT' && filledQty < totalQty) {
      return;
    }

    this.balance.updateLockedBalance(userId, -unusedMargin);
    this.balance.updateBalance(userId, unusedMargin);
  }

  private executeClosingOrder(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    type: Shared.TYPE,
    kind: Shared.KIND,
    qty: number,
    price: number,
    equity: number,
    userCurrentPostion: PositionDetails,
  ) {
    let orderDetails;
    if (kind === 'LONG') {
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
        // PARTIAL CLOSE — reduce position, release proportional margin + PnL
        const reductionRatio = orderDetails.filledQty / existingQty;
        const releasedMargin = existingMargin * reductionRatio;
        const entryCostBasisOfReduced = existingCostBasis * reductionRatio;

        let pnl = 0;
        if (existingKind === 'LONG') {
          pnl = orderDetails.totalSpent - entryCostBasisOfReduced;
        } else {
          pnl = entryCostBasisOfReduced - orderDetails.totalSpent;
        }

        this.balance.updateLockedBalance(userId, -releasedMargin);
        this.balance.addBalance(
          userId,
          Math.max(releasedMargin * 0.05, releasedMargin + pnl),
        );

        this.positons.changePosition(
          userId,
          market,
          kind,
          orderDetails.filledQty,
          entryCostBasisOfReduced,
          releasedMargin,
        );
      } else if (existingQty === orderDetails.filledQty) {
        // FULL CLOSE — close entire position, release all margin + PnL
        let pnl = 0;
        if (existingKind === 'LONG') {
          pnl = orderDetails.totalSpent - existingCostBasis;
        } else {
          pnl = existingCostBasis - orderDetails.totalSpent;
        }

        this.balance.updateLockedBalance(userId, -existingMargin);
        this.balance.addBalance(
          userId,
          Math.max(existingMargin * 0.05, existingMargin + pnl),
        );

        this.positons.changePosition(
          userId,
          market,
          kind,
          orderDetails.filledQty,
          existingCostBasis,
          existingMargin,
        );
      } else {
        // FLIP — close existing position and open opposite-side position
        const closeRatio = existingQty / orderDetails.filledQty;
        const closedTotalSpent = orderDetails.totalSpent * closeRatio;

        let closePnl = 0;
        if (existingKind === 'LONG') {
          closePnl = closedTotalSpent - existingCostBasis;
        } else {
          closePnl = existingCostBasis - closedTotalSpent;
        }

        this.balance.updateLockedBalance(userId, -existingMargin);
        this.balance.addBalance(
          userId,
          Math.max(existingMargin * 0.05, existingMargin + closePnl),
        );

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
      this.processMakerFills(orderDetails.fills ?? [], userId, orderDetails.orderId);
    return orderDetails;
  }

  cancelOrder(userId: string, orderId: string) {
    const cancelOrder = this.orderBook.cancelOrder(userId, orderId);
    if (!cancelOrder) {
      return;
    }
    const unfilledQty = cancelOrder.totalQty! - cancelOrder.filledQty!;
    const unfilledRatio = unfilledQty / cancelOrder.totalQty!;
    const marginToRelease = cancelOrder.margin * unfilledRatio;
    this.balance.updateBalance(userId, marginToRelease);
    this.balance.updateLockedBalance(userId, -marginToRelease);

    return cancelOrder;
  }

  getBalance(userId: string) {
    return this.balance.getBalance(userId);
  }

  getPositionForMarket(userId: string, market: Shared.MARKET_AVAILABEL) {
    return this.positons.getPosition(userId, market);
  }

  addBalance(userId: string, amount: number) {
    return this.balance.addBalance(userId, amount);
  }

  getPositions(userId: string) {
    return this.positons.getPositionsForUser(userId);
  }

  getFills(userId: string) {
    return this.orderBook.getFills(userId);
  }

  getDepth(market: Shared.MARKET_AVAILABEL) {
    return this.orderBook.getDepth(market);
  }

  placeMarketOrderForLiquidation(
    userId: string,
    kind: Shared.KIND,
    qty: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
    costBasis: number,
    markPrice: number,
  ) {
    if (qty <= 0) {
      return null;
    }

    // SHORT position → close with LONG | LONG position → close with SHORT
    const closeKind: Shared.KIND = kind === 'SHORT' ? 'LONG' : 'SHORT';

    // Phase 1 — MARKET closing order against the book
    const bookOrder =
      closeKind === 'LONG'
        ? this.orderBook.createLongOrder(
            userId,
            'LONG',
            'MARKET',
            qty,
            Number.MAX_SAFE_INTEGER,
            margin,
            market,
          )
        : this.orderBook.createShortOrder(userId, 'SHORT', 'MARKET', qty, 0, margin, market);

    if (!bookOrder) {
      return null;
    }

    this.processMakerFills(bookOrder.fills ?? [], userId, bookOrder.orderId);

    const allFills: Fills[] = [...(bookOrder.fills ?? [])];
    let closedQty = 0;

    if (bookOrder.filledQty > 0) {
      this.settleLiquidatedClose(
        userId,
        kind,
        closeKind,
        market,
        bookOrder.filledQty,
        qty,
        margin,
        costBasis,
        bookOrder.totalSpent,
      );
      closedQty += bookOrder.filledQty;
    }

    // Phase 2 — ADL remaining qty at markPrice against most profitable counterparty
    let remainingQty = qty - bookOrder.filledQty;
    let remainingMargin = margin * (remainingQty / qty);
    let remainingCostBasis = costBasis * (remainingQty / qty);

    while (remainingQty > 0) {
      const adlResult = this.runAdlAtMarkPrice(
        userId,
        kind,
        closeKind,
        remainingQty,
        remainingMargin,
        remainingCostBasis,
        market,
        markPrice,
      );
      if (!adlResult) break;

      closedQty += adlResult.adlQty;
      remainingQty -= adlResult.adlQty;
      remainingMargin -= adlResult.adlMargin;
      remainingCostBasis -= adlResult.adlCostBasis;
      allFills.push(...adlResult.fills);
    }

    // Phase 3 — if no ADL counterparty left, force-close remainder at markPrice
    if (remainingQty > 0) {
      this.settleLiquidatedCloseAtMark(
        userId,
        kind,
        closeKind,
        market,
        remainingQty,
        remainingMargin,
        remainingCostBasis,
        markPrice,
      );
      closedQty += remainingQty;
    }

    const adlAndForcedSpent = (closedQty - bookOrder.filledQty) * markPrice;

    return {
      orderId: bookOrder.orderId,
      filledQty: closedQty,
      totalQty: qty,
      totalSpent: bookOrder.totalSpent + adlAndForcedSpent,
      fills: allFills,
      price: markPrice,
      type: 'MARKET' as const,
      margin,
      status: closedQty >= qty ? ('FILLED' as const) : ('PARTIALLY_FILLED' as const),
      userId,
      kind: closeKind,
    };
  }

  private settleLiquidatedClose(
    userId: string,
    positionKind: Shared.KIND,
    closeKind: Shared.KIND,
    market: Shared.MARKET_AVAILABEL,
    closeQty: number,
    totalQty: number,
    totalMargin: number,
    totalCostBasis: number,
    totalSpent: number,
  ) {
    const ratio = closeQty / totalQty;
    const marginReleased = totalMargin * ratio;
    const closedCostBasis = totalCostBasis * ratio;

    this.positons.changePosition(
      userId,
      market,
      closeKind,
      closeQty,
      closedCostBasis,
      marginReleased,
    );

    const rpnl =
      positionKind === 'SHORT' ? closedCostBasis - totalSpent : totalSpent - closedCostBasis;

    this.balance.updateLockedBalance(userId, -marginReleased);
    this.balance.addBalance(
      userId,
      Math.max(marginReleased * 0.05, marginReleased + rpnl),
    );
  }

  private settleLiquidatedCloseAtMark(
    userId: string,
    positionKind: Shared.KIND,
    closeKind: Shared.KIND,
    market: Shared.MARKET_AVAILABEL,
    closeQty: number,
    margin: number,
    costBasis: number,
    markPrice: number,
  ) {
    const closeSpent = markPrice * closeQty;

    this.positons.changePosition(userId, market, closeKind, closeQty, costBasis, margin);

    const rpnl = positionKind === 'SHORT' ? costBasis - closeSpent : closeSpent - costBasis;

    this.balance.updateLockedBalance(userId, -margin);
    this.balance.addBalance(userId, Math.max(margin * 0.05, margin + rpnl));
    this.orderBook.setLastTradedPrice(market, markPrice);
  }

  private runAdlAtMarkPrice(
    liquidatedUserId: string,
    positionKind: Shared.KIND,
    closeKind: Shared.KIND,
    remainingQty: number,
    remainingMargin: number,
    remainingCostBasis: number,
    market: Shared.MARKET_AVAILABEL,
    markPrice: number,
  ): {
    adlQty: number;
    adlMargin: number;
    adlCostBasis: number;
    fills: Fills[];
  } | null {
    const profitDetails = this.positons.calculateAndGetHigestPnl(
      closeKind,
      market,
      markPrice,
      liquidatedUserId,
    );
    if (!profitDetails.profitableUser) return null;

    const [, adlUserId] = profitDetails.profitableUser;
    const adlPosition = this.positons.getPosition(adlUserId, market);
    if (!adlPosition || adlPosition.qty <= 0) return null;

    const adlQty = Math.min(remainingQty, adlPosition.qty);
    const adlSpent = markPrice * adlQty;
    const adlMargin = remainingMargin * (adlQty / remainingQty);
    const adlCostBasis = remainingCostBasis * (adlQty / remainingQty);
    const adlUserMarginPortion = adlPosition.margin * (adlQty / adlPosition.qty);

    // Place counterparty maker on book at markPrice, then liquidated closing order crosses it
    let adlFills: Fills[] = [];
    if (closeKind === 'LONG') {
      const makerOrder = this.orderBook.createShortOrder(
        adlUserId,
        'SHORT',
        'LIMIT',
        adlQty,
        markPrice,
        adlUserMarginPortion,
        market,
      );
      const takerOrder = this.orderBook.createLongOrder(
        liquidatedUserId,
        'LONG',
        'LIMIT',
        adlQty,
        markPrice,
        adlMargin,
        market,
      );
      adlFills = [...(makerOrder?.fills ?? []), ...(takerOrder?.fills ?? [])];
      if (takerOrder) {
        this.removeFilledOrders(adlFills, takerOrder.orderId);
      }
    } else {
      const makerOrder = this.orderBook.createLongOrder(
        adlUserId,
        'LONG',
        'LIMIT',
        adlQty,
        markPrice,
        adlUserMarginPortion,
        market,
      );
      const takerOrder = this.orderBook.createShortOrder(
        liquidatedUserId,
        'SHORT',
        'LIMIT',
        adlQty,
        markPrice,
        adlMargin,
        market,
      );
      adlFills = [...(makerOrder?.fills ?? []), ...(takerOrder?.fills ?? [])];
      if (takerOrder) {
        this.removeFilledOrders(adlFills, takerOrder.orderId);
      }
    }

    this.orderBook.setLastTradedPrice(market, markPrice);

    this.settleLiquidatedClose(
      liquidatedUserId,
      positionKind,
      closeKind,
      market,
      adlQty,
      adlQty,
      adlMargin,
      adlCostBasis,
      adlSpent,
    );

    const adlCloseKind: Shared.KIND = adlPosition.kind === 'LONG' ? 'SHORT' : 'LONG';
    this.applyCloseFill(adlUserId, market, adlPosition, adlCloseKind, adlQty, adlSpent);

    return { adlQty, adlMargin, adlCostBasis, fills: adlFills };
  }

  private processMakerFills(fills: Fills[], takerUserId: string, takerOrderId?: string) {
    const processed = new Set<string>();

    for (const fill of fills) {
      const buyerOrder = this.orderBook.getOrder(fill.buyerId, fill.orderId);
      const sellerOrder = this.orderBook.getOrder(fill.sellerId, fill.orderId);

      let makerUserId: string | null = null;
      let makerOrder: Orderdetails | null = null;

      if (buyerOrder && fill.buyerId !== takerUserId) {
        makerUserId = fill.buyerId;
        makerOrder = buyerOrder;
      } else if (sellerOrder && fill.sellerId !== takerUserId) {
        makerUserId = fill.sellerId;
        makerOrder = sellerOrder;
      }

      if (!makerUserId || !makerOrder) continue;

      const dedupeKey = `${makerUserId}-${fill.orderId}-${fill.qty}-${fill.price}`;
      if (processed.has(dedupeKey)) continue;
      processed.add(dedupeKey);

      const fillMargin = makerOrder.margin * (fill.qty / makerOrder.qty);
      const fillCostBasis = fill.price * fill.qty;
      const makerPosition = this.positons.getPosition(makerUserId, makerOrder.market);

      if (!makerPosition || makerPosition.kind === makerOrder.kind) {
        // Maker opening / adding — move filled margin from locked into position
        if (fill.qty > 0) {
          this.positons.changePosition(
            makerUserId,
            makerOrder.market,
            makerOrder.kind,
            fill.qty,
            fillCostBasis,
            fillMargin,
          );
          this.balance.updateLockedBalance(makerUserId, -fillMargin);
        }
      } else {
        // Maker closing — reduce position, release locked margin + PnL to balance
        this.applyCloseFill(
          makerUserId,
          makerOrder.market,
          makerPosition,
          makerOrder.kind,
          fill.qty,
          fillCostBasis,
        );
      }
    }

    this.removeFilledOrders(fills, takerOrderId);
  }

  private removeFilledOrders(fills: Fills[], takerOrderId?: string) {
    const orderIds = new Set<string>();
    for (const fill of fills) {
      orderIds.add(fill.orderId);
    }
    if (takerOrderId) {
      orderIds.add(takerOrderId);
    }
    for (const orderId of orderIds) {
      this.orderBook.deleteFilledOrder(orderId);
    }
  }

  private applyCloseFill(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    existingPosition: PositionDetails,
    orderKind: Shared.KIND,
    fillQty: number,
    fillSpent: number,
  ) {
    const existingQty = existingPosition.qty;
    const existingCostBasis = existingPosition.costBasis;
    const existingMargin = existingPosition.margin;
    const existingKind = existingPosition.kind;

    if (existingQty > fillQty) {
      const reductionRatio = fillQty / existingQty;
      const releasedMargin = existingMargin * reductionRatio;
      const entryCostBasisOfReduced = existingCostBasis * reductionRatio;
      const pnl =
        existingKind === 'LONG'
          ? fillSpent - entryCostBasisOfReduced
          : entryCostBasisOfReduced - fillSpent;

      this.balance.updateLockedBalance(userId, -releasedMargin);
      this.balance.addBalance(
        userId,
        Math.max(releasedMargin * 0.05, releasedMargin + pnl),
      );
      this.positons.changePosition(
        userId,
        market,
        orderKind,
        fillQty,
        entryCostBasisOfReduced,
        releasedMargin,
      );
    } else {
      const pnl =
        existingKind === 'LONG' ? fillSpent - existingCostBasis : existingCostBasis - fillSpent;

      this.balance.updateLockedBalance(userId, -existingMargin);
      this.balance.addBalance(
        userId,
        Math.max(existingMargin * 0.05, existingMargin + pnl),
      );
      this.positons.changePosition(
        userId,
        market,
        orderKind,
        existingQty,
        existingCostBasis,
        existingMargin,
      );
    }
  }
}
