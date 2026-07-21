import { Shared } from '@repo/shared-types';
import type {
  Bids,
  FillInfo,
  Fills,
  openOrder,
  Order,
  OrderBook,
  Orderdetails,
  OrderManagerSnapShotInstance,
} from '@repo/shared-types/internal-types';
import { OrderedMap } from 'js-sdsl';

export default class OrderBookManager {
  private orderBook: OrderBook;
  private fills: Fills[];
  private orders: Order;
  private exchangeProfit: number;
  private fundingInsurance: number;
  private lastOrderId: number;

  constructor() {
    this.orderBook = {};
    this.fills = [];
    this.orders = new Map();
    this.exchangeProfit = 0;
    this.fundingInsurance = 0;
    this.lastOrderId = 0;
  }

  createSnapShot() {
    const serializableBook: Record<string, any> = {};
    for (const [market, book] of Object.entries(this.orderBook)) {
      if (!book) continue;
      serializableBook[market] = {
        asks: Array.from(book.asks ?? []),
        bids: Array.from(book.bids ?? []),
        lastTradedPrice: book.lastTradedPrice ?? 0,
      };
    }
    return {
      orderbook: JSON.stringify(serializableBook),
      fills: JSON.stringify(
        this.fills.map((f) => ({
          ...f,
          createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
        })),
      ),
      orders: JSON.stringify(
        Array.from(this.orders.entries()).map(([id, ord]) => [
          id,
          {
            ...ord,
            createdAt: ord.createdAt instanceof Date ? ord.createdAt.toISOString() : ord.createdAt,
          },
        ]),
      ),
      fundingInsurance: this.fundingInsurance,
      exchangeProfit: this.exchangeProfit,
      lastOrderId: this.lastOrderId,
    };
  }

  loadSnapShot(orderManagerSnapShotInstance: OrderManagerSnapShotInstance) {
    if (!orderManagerSnapShotInstance) return;

    const parsedBook = JSON.parse(orderManagerSnapShotInstance.orderbook || '{}');
    this.orderBook = {};
    for (const [market, bookData] of Object.entries(parsedBook) as [
      Shared.MARKET_AVAILABEL,
      any,
    ][]) {
      this.orderBook[market] = {
        asks: new OrderedMap(bookData.asks || [], (a: number, b: number) => a - b),
        bids: new OrderedMap(bookData.bids || [], (a: number, b: number) => b - a),
        lastTradedPrice: bookData.lastTradedPrice || 0,
      };
    }

    this.fills = (JSON.parse(orderManagerSnapShotInstance.fills || '[]') as any[]).map((f) => ({
      ...f,
      createdAt: f?.createdAt ? new Date(f.createdAt) : new Date(),
    }));
    this.orders = new Map(
      (JSON.parse(orderManagerSnapShotInstance.orders || '[]') as any[]).map(([id, ord]) => [
        id,
        {
          ...ord,
          createdAt: ord?.createdAt ? new Date(ord.createdAt) : new Date(),
        },
      ]),
    );

    this.fundingInsurance = orderManagerSnapShotInstance.fundingInsurance ?? 0;
    this.exchangeProfit = orderManagerSnapShotInstance.exchangeProfit ?? 0;
    this.lastOrderId = orderManagerSnapShotInstance.lastOrderId ?? 0;
  }

  getOpenOrdersForUser(userId: string, market?: Shared.MARKET_AVAILABEL) {
    const out: Array<{
      orderId: string;
      userId: string;
      kind: Shared.KIND;
      market: Shared.MARKET_AVAILABEL;
      price: number;
      totalQty: number;
      filledQty: number;
      margin: number;
      type: Shared.TYPE;
      status: Shared.STATUS;
      createdAt: Date;
    }> = [];

    const collect = (mkt: Shared.MARKET_AVAILABEL, side: 'bids' | 'asks') => {
      const book = this.orderBook[mkt];
      if (!book) return;
      const levels = book[side];
      if (!levels) return;

      for (const [price, level] of levels) {
        for (const ord of level.openOrder) {
          if (ord.userId !== userId) continue;
          const details = this.orders.get(ord.orderId);
          if (!details) continue;
          if (details.status !== 'OPEN' && details.status !== 'PARTIALLY_FILLED') continue;
          out.push({
            orderId: ord.orderId,
            userId,
            kind: details.kind,
            market: mkt,
            price,
            totalQty: ord.totalQty,
            filledQty: ord.filledQty,
            margin: details.margin,
            type: details.type,
            status: details.status,
            createdAt: details.createdAt,
          });
        }
      }
    };

    const markets = market ? [market] : (Object.keys(this.orderBook) as Shared.MARKET_AVAILABEL[]);
    for (const mkt of markets) {
      collect(mkt, 'bids');
      collect(mkt, 'asks');
    }

    return out;
  }

  getLastTradedPriceOFMarket(market: Shared.MARKET_AVAILABEL) {
    return this.orderBook[market]?.lastTradedPrice;
  }

  setLastTradedPrice(market: Shared.MARKET_AVAILABEL, price: number) {
    this.intializedMarket(market);
    this.orderBook[market]!.lastTradedPrice = price;
  }

  calculateTotalTrade(fills: FillInfo[]): {
    totalSpent: number;
    totalQty: number;
  } {
    const total = fills.reduce(
      (acc: any, curr: any) => {
        acc.totalQty += curr.qty;
        acc.totalPrice += curr.qty * curr.price;
        return acc;
      },
      { totalQty: 0, totalPrice: 0 },
    );
    return { totalSpent: total.totalPrice, totalQty: total.totalQty };
  }

  createLongOrder(
    userId: string,
    kind: Shared.KIND,
    type: Shared.TYPE,
    qty: number,
    price: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
  ) {
    const currentOrder = this.createUserOrder(userId, kind, type, qty, margin, market, price);

    let fillInfo: FillInfo[] = [];
    const generatedFills: Fills[] = [];

    const oppSide = this.getOppositeSide(market, kind);
    let remianingQty = qty;

    while (remianingQty > 0 && oppSide?.front()) {
      const [bestPrice, PriceLevel] = oppSide?.front()!;

      if (bestPrice > price) {
        break;
      }

      if (bestPrice <= price) {
        while (PriceLevel.openOrder.length > 0 && remianingQty > 0) {
          let topOrder = PriceLevel.openOrder[0]!;
          const priceLevelRemianingQty = topOrder.totalQty - topOrder.filledQty;
          if (priceLevelRemianingQty <= 0) {
            PriceLevel.openOrder.shift();
            continue;
          }
          const priceLevelMaxFill = Math.min(priceLevelRemianingQty, remianingQty);
          remianingQty -= priceLevelMaxFill;
          topOrder.filledQty += priceLevelMaxFill;

          this.orderBook[market]!.lastTradedPrice = bestPrice;

          fillInfo.push({ price: bestPrice, qty: priceLevelMaxFill });

          if (remianingQty === 0) {
            const f = this.addToFills(
              topOrder.userId,
              userId,
              priceLevelMaxFill,
              bestPrice,
              currentOrder.orderId,
              currentOrder.data.type,
              currentOrder.data.kind,
              'FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(userId, currentOrder.orderId, 'FILLED');
          } else {
            const f = this.addToFills(
              topOrder.userId,
              userId,
              priceLevelMaxFill,
              bestPrice,
              currentOrder.orderId,
              currentOrder.data.type,
              currentOrder.data.kind,
              'PARTIALLY_FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(userId, currentOrder.orderId, 'PARTIALLY_FILLED');
          }

          if (topOrder.filledQty === topOrder.totalQty) {
            const f = this.addToFills(
              topOrder.userId,
              userId,
              priceLevelMaxFill,
              bestPrice,
              topOrder.orderId,
              currentOrder.data.type,
              currentOrder.data.kind,
              'FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(topOrder.userId, topOrder.orderId, 'FILLED');
            PriceLevel.openOrder.shift();
          } else {
            const f = this.addToFills(
              topOrder.userId,
              userId,
              priceLevelMaxFill,
              bestPrice,
              topOrder.orderId,
              currentOrder.data.type,
              currentOrder.data.kind,
              'PARTIALLY_FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(topOrder.userId, topOrder.orderId, 'PARTIALLY_FILLED');
          }
          PriceLevel.totalqty -= priceLevelMaxFill;
        }
        if (PriceLevel.totalqty <= 0 || PriceLevel.openOrder.length === 0) {
          oppSide.eraseElementByKey(bestPrice);
        }
      } else {
        break;
      }
    }

    if (remianingQty === 0) {
      const { totalQty, totalSpent } = this.calculateTotalTrade(fillInfo);
      return {
        orderId: currentOrder.orderId,
        filledQty: totalQty,
        totalQty: qty,
        totalSpent,
        fills: generatedFills,
        price: currentOrder.data.price,
        type: currentOrder.data.type,
        margin: currentOrder.data.margin,
        status: currentOrder.data.status,
      };
    }

    if (type === 'LIMIT') {
      const sameSide = this.getSameSide(market, kind);
      const sameSideOpenOrderDetail: openOrder = {
        filledQty: 0,
        totalQty: remianingQty,
        orderId: currentOrder.orderId,
        userId: currentOrder.data.userId,
      };
      const alreadyPriceOrder = sameSide?.getElementByKey(currentOrder.data.price);
      if (alreadyPriceOrder) {
        alreadyPriceOrder.totalqty += remianingQty;
        alreadyPriceOrder.openOrder.push(sameSideOpenOrderDetail);
        sameSide?.setElement(currentOrder.data.price, alreadyPriceOrder);
      } else {
        const newBid: Bids = {
          totalqty: remianingQty,
          openOrder: [sameSideOpenOrderDetail],
        };
        sameSide?.setElement(currentOrder.data.price, newBid);
      }
    }
    const { totalQty, totalSpent } = this.calculateTotalTrade(fillInfo);
    return {
      filledQty: totalQty,
      orderId: currentOrder.orderId,
      totalQty: currentOrder.data.qty,
      totalSpent,
      fills: generatedFills,
      price: currentOrder.data.price,
      type: currentOrder.data.type,
      margin: currentOrder.data.margin,
      status: currentOrder.data.status,
    };
  }

  createShortOrder(
    userId: string,
    kind: Shared.KIND,
    type: Shared.TYPE,
    qty: number,
    price: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
  ) {
    const currrentOrder = this.createUserOrder(userId, kind, type, qty, margin, market, price);
    const fillInfo: FillInfo[] = [];
    const generatedFills: Fills[] = [];

    const oppSide = this.getOppositeSide(market, kind);

    let remianingQty = qty;
    while (remianingQty > 0 && oppSide?.front()) {
      const [bestPrice, PriceLevel] = oppSide.front()!;

      if (bestPrice < price) {
        break;
      }
      if (bestPrice >= price) {
        while (PriceLevel.openOrder.length > 0 && remianingQty > 0) {
          const topOrder = PriceLevel.openOrder[0]!;
          const remainingPriceLevelQty = topOrder.totalQty - topOrder.filledQty;
          if (remainingPriceLevelQty <= 0) {
            PriceLevel.openOrder.shift();
            continue;
          }
          const maxQtyFillPriceLevel = Math.min(remainingPriceLevelQty, remianingQty);
          remianingQty -= maxQtyFillPriceLevel;
          topOrder.filledQty += maxQtyFillPriceLevel;
          this.orderBook[market]!.lastTradedPrice = bestPrice;
          fillInfo.push({
            price: bestPrice,
            qty: maxQtyFillPriceLevel,
          });
          if (topOrder.filledQty === topOrder.totalQty) {
            const f = this.addToFills(
              topOrder.userId,
              currrentOrder.data.userId,
              maxQtyFillPriceLevel,
              bestPrice,
              topOrder.orderId,
              currrentOrder.data.type,
              'LONG',
              'FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(topOrder.userId, topOrder.orderId, 'FILLED');
            PriceLevel.openOrder.shift();
          } else {
            const f = this.addToFills(
              topOrder.userId,
              currrentOrder.data.userId,
              maxQtyFillPriceLevel,
              bestPrice,
              topOrder.orderId,
              currrentOrder.data.type,
              'LONG',
              'PARTIALLY_FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(topOrder.userId, topOrder.orderId, 'PARTIALLY_FILLED');
          }
          if (remianingQty === 0) {
            const f = this.addToFills(
              topOrder.userId,
              currrentOrder.data.userId,
              maxQtyFillPriceLevel,
              bestPrice,
              currrentOrder.orderId,
              currrentOrder.data.type,
              'SHORT',
              'FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(currrentOrder.data.userId, currrentOrder.orderId, 'FILLED');
          } else {
            const f = this.addToFills(
              topOrder.userId,
              currrentOrder.data.userId,
              maxQtyFillPriceLevel,
              bestPrice,
              currrentOrder.orderId,
              currrentOrder.data.type,
              'SHORT',
              'PARTIALLY_FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(
              currrentOrder.data.userId,
              currrentOrder.orderId,
              'PARTIALLY_FILLED',
            );
          }

          PriceLevel.totalqty -= maxQtyFillPriceLevel;
        }
      } else {
        break;
      }

      if (PriceLevel.totalqty <= 0 || PriceLevel.openOrder.length === 0) {
        oppSide.eraseElementByKey(bestPrice);
      }
    }

    if (remianingQty === 0) {
      const { totalQty, totalSpent } = this.calculateTotalTrade(fillInfo);
      return {
        filledQty: totalQty,
        orderId: currrentOrder.orderId,
        totalQty: currrentOrder.data.qty,
        totalSpent,
        fills: generatedFills,
        price: currrentOrder.data.price,
        type: currrentOrder.data.type,
        margin: currrentOrder.data.margin,
        status: currrentOrder.data.status,
      };
    }

    if (type === 'LIMIT') {
      const sameSide = this.getSameSide(market, kind);

      const priceOrder = sameSide?.getElementByKey(price);
      const pushOpenOrderDetails: openOrder = {
        filledQty: 0,
        orderId: currrentOrder.orderId,
        totalQty: remianingQty,
        userId: currrentOrder.data.userId,
      };
      if (priceOrder) {
        priceOrder.totalqty += remianingQty;
        priceOrder.openOrder.push(pushOpenOrderDetails);
        sameSide?.setElement(currrentOrder.data.price, priceOrder);
      } else {
        const newBid: Bids = {
          openOrder: [pushOpenOrderDetails],
          totalqty: remianingQty,
        };
        sameSide?.setElement(currrentOrder.data.price, newBid);
      }
    }
    const { totalQty, totalSpent } = this.calculateTotalTrade(fillInfo);
    return {
      filledQty: totalQty,
      orderId: currrentOrder.orderId,
      totalQty: currrentOrder.data.qty,
      totalSpent,
      fills: generatedFills,
      price: currrentOrder.data.price,
      type: currrentOrder.data.type,
      margin: currrentOrder.data.margin,
      status: currrentOrder.data.status,
    };
  }

  createUserOrder(
    userId: string,
    kind: Shared.KIND,
    type: Shared.TYPE,
    qty: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
    price?: number,
  ) {
    this.intializedMarket(market);
    this.lastOrderId++;
    const orderId = String(this.lastOrderId);
    const OrderToPush: Orderdetails = {
      userId,
      type,
      qty,
      price: price === undefined ? 0 : price,
      status: 'OPEN',
      margin,
      kind,
      market,
      createdAt: new Date(),
    };
    this.orders.set(orderId, OrderToPush);

    return { orderId, data: OrderToPush };
  }

  getOppositeSide(market: Shared.MARKET_AVAILABEL, kind: Shared.KIND) {
    const marketPresent = this.orderBook[market];
    if (!marketPresent) {
      return null;
    }
    const oppPos = kind === 'LONG' ? 'asks' : 'bids';

    return marketPresent[oppPos];
  }

  getSameSide(market: Shared.MARKET_AVAILABEL, kind: Shared.KIND) {
    const marketPresent = this.orderBook[market];
    if (!marketPresent) {
      return null;
    }
    const samePos = kind === 'LONG' ? 'bids' : 'asks';

    return marketPresent[samePos];
  }

  intializedMarket(market: Shared.MARKET_AVAILABEL) {
    if (!this.orderBook[market]) {
      this.orderBook[market] = {
        asks: new OrderedMap([], (a: number, b: number) => a - b),
        bids: new OrderedMap([], (a: number, b: number) => b - a),
        lastTradedPrice: 0,
      };
    }
    return this.orderBook[market];
  }

  cancelOrder(userId: string, orderId: string) {
    const userOrderDetails = this.getOrder(userId, orderId);
    if (!userOrderDetails) {
      return null;
    }
    this.changeOrderStatus(userId, orderId, 'CANCELLED');

    const kind = userOrderDetails.kind;
    const market = userOrderDetails.market;
    const price = userOrderDetails.price;

    const side = this.getSameSide(market, kind);
    const priceLevel = side?.getElementByKey(price);
    if (!priceLevel) {
      return null;
    }
    const deleteIngOrder = priceLevel.openOrder.find((order) => order.orderId === orderId);
    if (!deleteIngOrder) {
      return null;
    }

    const unfilledQty = deleteIngOrder.totalQty - deleteIngOrder.filledQty;
    priceLevel.totalqty -= unfilledQty;
    priceLevel.openOrder = priceLevel.openOrder.filter((order) => order.orderId !== orderId);

    if (priceLevel.totalqty <= 0) {
      side?.eraseElementByKey(price);
    }

    return {
      ...deleteIngOrder,
      kind: userOrderDetails.kind,
      margin: userOrderDetails.margin,
      market: userOrderDetails.market,
      price: userOrderDetails.price,
    };
  }

  addToFills(
    buyerId: string,
    sellerId: string,
    qty: number,
    price: number,
    orderId: string,
    type: Shared.TYPE,
    kind: Shared.KIND,
    status: Shared.STATUS,
  ) {
    const fillDetail: Fills = {
      buyerId,
      sellerId,
      price,
      orderId,
      type,
      kind,
      qty,
      status,
      createdAt: new Date(),
      transactionTime: Date.now(),
    };
    this.fills.push(fillDetail);
    return fillDetail;
  }

  getOrder(userId: string, orderId: string) {
    if (!this.orders || typeof this.orders.get !== 'function') {
      this.orders = new Map();
      return null;
    }
    const userOrder = this.orders.get(orderId);
    if (!userOrder) {
      return null;
    }
    return userOrder;
  }

  changeOrderStatus(userId: string, orderId: string, status: Shared.STATUS) {
    if (!this.orders) {
      this.orders = new Map();
      return null;
    }

    const tempOrder = this.orders.get(orderId);
    if (tempOrder?.userId !== userId) {
      return null;
    }
    tempOrder.status = status;
    this.orders.set(orderId, tempOrder);
    return tempOrder;
  }

  deleteFilledOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'FILLED') {
      return null;
    }
    this.orders.delete(orderId);
    return order;
  }

  getFills(userId: string) {
    return this.fills.filter((fill) => fill.buyerId === userId || fill.sellerId === userId);
  }

  getDepth(market: Shared.MARKET_AVAILABEL) {
    const marketBook = this.orderBook[market];
    if (!marketBook) {
      return {
        bids: [],
        asks: [],
      };
    }

    const bids: [number, number][] = [];
    const asks: [number, number][] = [];

    for (const [price, bid] of marketBook.bids) {
      bids.push([price, bid.totalqty]);
    }

    for (const [price, ask] of marketBook.asks) {
      asks.push([price, ask.totalqty]);
    }

    bids.sort((a, b) => b[0] - a[0]);
    asks.sort((a, b) => a[0] - b[0]);

    return {
      bids,
      asks,
    };
  }
}
