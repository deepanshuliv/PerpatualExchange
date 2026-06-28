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
    return {
      orderbook: JSON.stringify(this.orderBook),
      fills: JSON.stringify(this.fills),
      orders: JSON.stringify(Array.from(this.orders.entries())),
      fundingInsurance: this.fundingInsurance,
      exchangeProfit: this.exchangeProfit,
      lastOrderId: this.lastOrderId,
    };
  }

  loadSnapShot(orderManagerSnapShotInstance: OrderManagerSnapShotInstance) {
    if (!orderManagerSnapShotInstance) return;

    const parsedBook = JSON.parse(orderManagerSnapShotInstance.orderbook || '{}');
    this.orderBook = {};
    for (const [market, bookData] of Object.entries(parsedBook) as [Shared.MARKET_AVAILABEL, any][]) {
      this.orderBook[market] = {
        asks: new OrderedMap(bookData.asks || [], (a: number, b: number) => a - b),
        bids: new OrderedMap(bookData.bids || [], (a: number, b: number) => b - a),
        lastTradedPrice: bookData.lastTradedPrice || 0,
      };
    }

    this.fills = JSON.parse(orderManagerSnapShotInstance.fills || '[]');
    this.orders = new Map(JSON.parse(orderManagerSnapShotInstance.orders || '[]'));

    this.fundingInsurance = orderManagerSnapShotInstance.fundingInsurance ?? 0;
    this.exchangeProfit = orderManagerSnapShotInstance.exchangeProfit ?? 0;
    this.lastOrderId = orderManagerSnapShotInstance.lastOrderId ?? 0;
  }

  getFundingInsurance() {
    return this.fundingInsurance;
  }
  getExchangeProfit() {
    return this.exchangeProfit;
  }
  updateExchangeProfit(signedAmount: number) {
    this.exchangeProfit += signedAmount;
  }

  updateFundingInsurance(signedAmount: number) {
    this.fundingInsurance += signedAmount;
  }

  getLastTradedPriceOFMarket(market: Shared.MARKET_AVAILABEL) {
    return this.orderBook[market]?.lastTradedPrice;
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

      if (bestPrice <= price) {
        // eatas much as you can
        while (PriceLevel.openOrder.length > 0 && remianingQty > 0) {
          let topOrder = PriceLevel.openOrder[0]!;
          const priceLevelRemianingQty = topOrder.totalQty - topOrder.filledQty;
          const priceLevelMaxFill = Math.min(priceLevelRemianingQty, remianingQty);
          remianingQty -= priceLevelMaxFill;
          topOrder.filledQty += priceLevelMaxFill;

          this.orderBook[market]!.lastTradedPrice = bestPrice;
          // deduct the fees

          fillInfo.push({ price: bestPrice, qty: priceLevelMaxFill });
          if (remianingQty === 0) {
            const f = this.addToFills(
              userId,
              topOrder.userId,
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
              userId,
              topOrder.userId,
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
              userId,
              topOrder.userId,
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
              userId,
              topOrder.userId,
              priceLevelMaxFill,
              bestPrice,
              topOrder.orderId,
              currentOrder.data.type,
              currentOrder.data.kind,
              'PARTIALLY_FILLED',
            );
            generatedFills.push(f);
            this.changeOrderStatus(userId, topOrder.orderId, 'PARTIALLY_FILLED');
          }
          PriceLevel.totalqty -= priceLevelMaxFill;
        }
        if (PriceLevel.totalqty === 0) {
          oppSide.eraseElementByKey(bestPrice);
        }
      }
    }

    // any type complete
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
      // sit on same side
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
        // create new entry only when price level doesn't already exist
        const newBid: Bids = {
          totalqty: remianingQty,
          openOrder: [sameSideOpenOrderDetail],
        };
        sameSide?.setElement(currentOrder.data.price, newBid);
      }
      // if kind market return with as much filled
    }
    // return with partial filled qty happen in type case
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
    // eat as much as we can
    while (remianingQty > 0 && oppSide?.front()) {
      const [bestPrice, PriceLevel] = oppSide.front()!;

      if (bestPrice < price) {
        break;
      }

      if (bestPrice >= price) {
        while (PriceLevel.openOrder.length > 0 && remianingQty > 0) {
          const topOrder = PriceLevel.openOrder[0]!;
          const remainingPriceLevelQty = topOrder.totalQty - topOrder.filledQty;
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
              currrentOrder.data.qty,
              currrentOrder.data.price,
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
              currrentOrder.data.qty,
              currrentOrder.data.price,
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
      }

      if (PriceLevel.totalqty === 0) {
        oppSide.eraseElementByKey(bestPrice);
      }
    }

    // if complete filled any type
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

    // sit on same side
    if (type === 'LIMIT') {
      const sameSide = this.getSameSide(market, kind);

      const priceOrder = sameSide?.getElementByKey(price);
      const pushOpenOrderDetails: openOrder = {
        filledQty: 0,
        orderId: currrentOrder.orderId,
        totalQty: qty - remianingQty,
        userId: currrentOrder.data.userId,
      };
      if (priceOrder) {
        priceOrder.totalqty += remianingQty;
        priceOrder.openOrder.push(pushOpenOrderDetails);
        sameSide?.setElement(currrentOrder.data.price, priceOrder);
      } else {
        // create a new price Order only when price level doesn't already exist
        const newBid: Bids = {
          openOrder: [pushOpenOrderDetails],
          totalqty: remianingQty,
        };
        sameSide?.setElement(currrentOrder.data.price, newBid);
      }
    }
    // if market return with partial
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
  /*
    this startegy biggest issue it can force user to buy or sell at worst price if oposite oly worst price is avilabel.

        createLiquidationMarketLongOrder(userId: string, qty: number, margin: number, market: Shared.MARKET_AVAILABEL) {
            const kind = "LONG"
            const currrentOrder = this.createUserOrder(userId, kind, "MARKET", qty, margin, market);
            const fillInfo: FillInfo[] = [];
            let remianingQty = qty;
            const oppSide = this.getOppositeSide(market, kind);
    
            while (oppSide?.front() && remianingQty > 0) {
                const [bestPrice, priceLevel] = oppSide.front()!;
    
                while (priceLevel.openOrder.length > 0 && remianingQty > 0) {
                    const topOrder = priceLevel.openOrder[0]!;
                    const remainingPriceLevelQty = topOrder.totalQty - topOrder.filledQty;
                    const maxQtyFillPriceLevel = Math.min(remainingPriceLevelQty, remianingQty);
                    remianingQty -= maxQtyFillPriceLevel;
                    topOrder.filledQty += maxQtyFillPriceLevel;
                    fillInfo.push({
                        price: bestPrice,
                        qty: maxQtyFillPriceLevel
                    })
                    if (topOrder.filledQty === topOrder.totalQty) {
                        this.addToFills(userId, topOrder.userId, maxQtyFillPriceLevel, bestPrice, currrentOrder.orderId, currrentOrder.data.type, "SHORT", "FILLED");
                        this.changeOrderStatus(topOrder.userId, topOrder.orderId, "FILLED");
                        priceLevel.openOrder.shift()
    
                    } else {
                        this.addToFills(userId, topOrder.userId, maxQtyFillPriceLevel, bestPrice, topOrder.orderId, currrentOrder.data.type, "SHORT", "PARTIALLY_FILLED");
                        this.changeOrderStatus(topOrder.userId, topOrder.orderId, "PARTIALLY_FILLED");
                    }
                    if (remianingQty === 0) {
                        this.addToFills(userId, topOrder.userId, currrentOrder.data.qty, bestPrice, currrentOrder.orderId, currrentOrder.data.type, "LONG", "FILLED");
                        this.changeOrderStatus(currrentOrder.data.userId, currrentOrder.orderId, "FILLED");
                    } else {
                        this.addToFills(userId, topOrder.userId, currrentOrder.data.qty, bestPrice, currrentOrder.orderId, currrentOrder.data.type, "LONG", "PARTIALLY_FILLED");
                        this.changeOrderStatus(currrentOrder.data.userId, currrentOrder.orderId, "PARTIALLY_FILLED");
                    }
                    priceLevel.totalqty -= maxQtyFillPriceLevel;
                }
                if (priceLevel.totalqty === 0) {
                    oppSide.eraseElementByKey(bestPrice);
                }
    
            }
    
            // right now return  the order 
            // but in future , apply funding rate here
            const { totalQty, totalSpent } = this.calculateTotalTrade(fillInfo);
            return {
                filledQty: totalQty,
                totalQty: qty,
                totalSpent,
                orderId: currrentOrder.orderId,
                fills: fillInfo
            }
        }
    
        createLiquidationMarketShortOrder(userId: string, qty: number, margin: number, market: Shared.MARKET_AVAILABEL) {
            const kind = "SHORT"
    
            const currrentOrder = this.createUserOrder(userId, kind, "MARKET", qty, margin, market);
            const fillInfo: FillInfo[] = [];
            let remianingQty = qty;
            const oppSide = this.getOppositeSide(market, kind);
    
            while (oppSide?.front() && remianingQty > 0) {
                const [bestPrice, priceLevel] = oppSide.front()!;
    
                while (priceLevel.openOrder.length > 0 && remianingQty > 0) {
                    const topOrder = priceLevel.openOrder[0]!;
                    const remainingPriceLevelQty = topOrder.totalQty - topOrder.filledQty;
                    const maxQtyFillPriceLevel = Math.min(remainingPriceLevelQty, remianingQty);
                    remianingQty -= maxQtyFillPriceLevel;
                    topOrder.filledQty += maxQtyFillPriceLevel;
                    fillInfo.push({
                        price: bestPrice,
                        qty: maxQtyFillPriceLevel
                    })
                    if (topOrder.filledQty === topOrder.totalQty) {
                        this.addToFills(userId, topOrder.userId, maxQtyFillPriceLevel, bestPrice, currrentOrder.orderId, currrentOrder.data.type, "SHORT", "FILLED");
                        this.changeOrderStatus(topOrder.userId, topOrder.orderId, "FILLED");
                        priceLevel.openOrder.shift()
    
                    } else {
                        this.addToFills(userId, topOrder.userId, maxQtyFillPriceLevel, bestPrice, topOrder.orderId, currrentOrder.data.type, "SHORT", "PARTIALLY_FILLED");
                        this.changeOrderStatus(topOrder.userId, topOrder.orderId, "PARTIALLY_FILLED");
                    }
                    if (remianingQty === 0) {
                        this.addToFills(userId, topOrder.userId, currrentOrder.data.qty, bestPrice, currrentOrder.orderId, currrentOrder.data.type, "LONG", "FILLED");
                        this.changeOrderStatus(currrentOrder.data.userId, currrentOrder.orderId, "FILLED");
                    } else {
                        this.addToFills(userId, topOrder.userId, currrentOrder.data.qty, bestPrice, currrentOrder.orderId, currrentOrder.data.type, "LONG", "PARTIALLY_FILLED");
                        this.changeOrderStatus(currrentOrder.data.userId, currrentOrder.orderId, "PARTIALLY_FILLED");
                    }
                    priceLevel.totalqty -= maxQtyFillPriceLevel;
                }
                if (priceLevel.totalqty === 0) {
                    oppSide.eraseElementByKey(bestPrice);
                }
    
            }
    
            // right now return  the order 
            // but in future , apply funding rate here
            const { totalQty, totalSpent } = this.calculateTotalTrade(fillInfo);
            return {
                filledQty: totalQty,
                totalQty: qty,
                totalSpent,
                fills: fillInfo,
                orderId: currrentOrder.orderId
            }
        }
    */
  createUserOrder(
    userId: string,
    kind: Shared.KIND,
    type: Shared.TYPE,
    qty: number,
    margin: number,
    market: Shared.MARKET_AVAILABEL,
    price?: number,
  ) {
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
    const marketCreate = this.orderBook[market];
    if (!marketCreate) {
      this.orderBook[market] = {
        asks: new OrderedMap([], (a: number, b: number) => a - b),
        bids: new OrderedMap([], (a: number, b: number) => b - a),
        lastTradedPrice: 0,
      };
    }
    return marketCreate;
  }

  cancelOrder(userId: string, orderId: string) {
    // find and delete in open orders that order
    // chnage the order status to cancelled in orders array

    const userOrderDetails = this.getOrder(userId, orderId);
    if (!userOrderDetails) {
      return null;
    }
    // changed order status
    this.changeOrderStatus(userId, orderId, 'CANCELLED');

    const kind = userOrderDetails.kind;
    const market = userOrderDetails.market;
    const price = userOrderDetails.price;

    const side = this.getSameSide(market, kind);
    const priceLevel = side?.getElementByKey(price);
    if (!priceLevel) {
      return null;
    }
    //TODO:- check can be a better way to delete a order from orderBook
    const deleteIngOrder = priceLevel.openOrder.find((order) => {
      return order.userId === userId;
    });
    priceLevel.openOrder = priceLevel.openOrder.filter((order) => {
      return order.orderId !== orderId;
    });

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
    // orderId is for one either seller or buyer
    // status is either "FILLED" and "PARTIALLY_FLLED"
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
    if (!this.orders || typeof this.orders.get !== 'function') {
      this.orders = new Map();
      return null;
    }
    const tempOrder = this.orders.get(orderId);
    if (tempOrder?.userId !== userId) {
      return null;
    }
    tempOrder.status = status;
    this.orders.set(orderId, tempOrder);
  }

  pushOrder(userId: string, orderId: string) {
    // orders whose status is "FILLED"
    // pushed to queue
    // delete from here
  }

  pushFills() {
    // push on the response queue
    // delete entry from fills table
  }
  getFills(userId: string) {
    return this.fills.filter((fill) => fill.buyerId === userId || fill.sellerId === userId);
  }

  getOpenOrders(userId: string, market?: Shared.MARKET_AVAILABEL) {
    const openOrders: any[] = [];
    this.orders.forEach((order, orderId) => {
      if (
        order.userId === userId &&
        order.status === 'OPEN' &&
        (!market || order.market === market)
      ) {
        openOrders.push({ ...order, orderId });
      }
    });
    return openOrders;
  }

  getClosedOrders(userId: string, market?: Shared.MARKET_AVAILABEL) {
    const closedOrders: any[] = [];
    this.orders.forEach((order, orderId) => {
      if (
        order.userId === userId &&
        order.status !== 'OPEN' &&
        (!market || order.market === market)
      ) {
        closedOrders.push({ ...order, orderId });
      }
    });
    return closedOrders;
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

    return {
      bids,
      asks,
    };
  }
}
