import type { Shared } from "shared-types";
import OrderBookManager from "./orderBook";

export default class Admin {
  private engine: OrderBookManager;

  constructor(OrderMangerInsatnce: OrderBookManager) {
    this.engine = OrderMangerInsatnce;
  }

  createAdminMarket(market: Shared.MARKET_AVAILABEL) {
    this.engine.intializedMarket(market);
  }
}
