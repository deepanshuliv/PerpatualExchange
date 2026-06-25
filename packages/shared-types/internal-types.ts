import z from "zod";
import { OrderedMap } from "js-sdsl";
import {
  KIND_SCHEMA,
  MARKET_AVAILABEL_SCHEMA,
  STATUS_SCHEMA,
  TYPE_SCHEMA,
} from "./shared";
import { ADD_BALANCE_SCHEMA } from "./engine-types/engine-request";

export const ORDERMANAGERINSATNCE_SCHEMA = z.object({
  orderbook: z.string(),
  orders: z.string(),
  fills: z.string(),
  fundingInsurance: z.number(),
  exchangeProfit: z.number(),
  lastOrderId: z.number().optional().default(0),
});

export type OrderManagerSnapShotInstance = z.infer<
  typeof ORDERMANAGERINSATNCE_SCHEMA
>;
export const POSITIONSNAPSHOTINSTANCE_SCHEMA = z.object({
  positions: z.string(),
  marketIndex: z.string(),
});

export type positonSnapshotInstanceType = z.infer<
  typeof POSITIONSNAPSHOTINSTANCE_SCHEMA
>;

const ENGINESNAPSHOT_BASE = POSITIONSNAPSHOTINSTANCE_SCHEMA.extend(
  ORDERMANAGERINSATNCE_SCHEMA.shape,
);
export const ENGINESNAPSHOT_SCHEMA = ENGINESNAPSHOT_BASE.extend({
  balance: z.string(),
});
export type EngineSnapShotInstanceType = z.infer<typeof ENGINESNAPSHOT_SCHEMA>;

export const AUTHENTICATION_SCHEMA = z.object({
  username: z.string(),
  password: z.string().min(1),
});
export type AUTHENTICATION = z.infer<typeof AUTHENTICATION_SCHEMA>;

export const COLLATERAL_SCHEMA = z.object({
  balance: z.number(),
  lockedBalance: z.number(),
});
export type Collateral = z.infer<typeof COLLATERAL_SCHEMA>;

export type User = Record<string, Collateral>;

export const ORDERDETAILS_SCHEMA = z.object({
  userId: z.string(),
  kind: KIND_SCHEMA,
  type: TYPE_SCHEMA,
  qty: z.number(),
  price: z.number(),
  margin: z.number(),
  status: STATUS_SCHEMA,
  market: MARKET_AVAILABEL_SCHEMA,
  createdAt: z.date(),
});
export type Orderdetails = z.infer<typeof ORDERDETAILS_SCHEMA>;

export type Order = Map<string, Orderdetails>;

export const FILLS_SCHEMA = z.object({
  sellerId: z.string(),
  buyerId: z.string(),
  qty: z.number(),
  price: z.number(),
  orderId: z.string(),
  type: TYPE_SCHEMA,
  kind: KIND_SCHEMA,
  status: STATUS_SCHEMA,
  createdAt: z.date(),
  transactionTime: z.number(),
});
export type Fills = z.infer<typeof FILLS_SCHEMA>;

export const FILL_INFO_SCHEMA = z.object({
  price: z.number(),
  qty: z.number(),
});
export type FillInfo = z.infer<typeof FILL_INFO_SCHEMA>;

export const OPEN_ORDER_SCHEMA = z.object({
  totalQty: z.number(),
  filledQty: z.number(),
  orderId: z.string(),
  userId: z.string(),
});
export type openOrder = z.infer<typeof OPEN_ORDER_SCHEMA>;

export const BIDS_SCHEMA = z.object({
  totalqty: z.number(),
  openOrder: z.array(OPEN_ORDER_SCHEMA),
});
export type Bids = z.infer<typeof BIDS_SCHEMA>;

export type OrderBook = Partial<
  Record<
    string,
    {
      asks: OrderedMap<number, Bids>;
      bids: OrderedMap<number, Bids>;
      lastTradedPrice: number;
    }
  >
>;

export const POSITION_DETAILS_SCHEMA = z.object({
  market: MARKET_AVAILABEL_SCHEMA,
  kind: KIND_SCHEMA,
  qty: z.number(),
  costBasis: z.number(),
  margin: z.number(),
});
export type PositionDetails = z.infer<typeof POSITION_DETAILS_SCHEMA>;

export const USER_MARKET_ORDER_TYPES_SCHEMA = z.object({
  userId: z.string(),
  qty: z.number(),
  margin: z.number(),
  market: MARKET_AVAILABEL_SCHEMA,
  kind: KIND_SCHEMA,
  costBasis: z.number(),
});
export type userMarketOrderTypes = z.infer<
  typeof USER_MARKET_ORDER_TYPES_SCHEMA
>;

export type MarketMarkPrice = Map<string, number>;

export type Positions = Map<string, PositionDetails[]>;

export type MarketIndex = Map<string, Set<string>>;

export type RedisStreamResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}> | null;
