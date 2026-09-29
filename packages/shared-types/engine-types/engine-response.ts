import z from "zod";
import {
  KIND_SCHEMA,
  MARKET_AVAILABEL_SCHEMA,
  TYPE_SCHEMA,
} from "../shared";

const BASE_RESPONSE = z.object({
  correlationId: z.string(),
});

const FILL_DETAIL_SCHEMA = z.object({
  buyerId: z.string(),
  sellerId: z.string(),
  price: z.number(),
  orderId: z.string(),
  type: TYPE_SCHEMA,
  kind: KIND_SCHEMA,
  qty: z.number(),
  status: z.string(),
  createdAt: z.date().or(z.string()),
  transactionTime: z.number(),
});

const CREATE_ORDER_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("create_order"),
  payload: z.object({
    kind: KIND_SCHEMA,
    market: MARKET_AVAILABEL_SCHEMA,
    orderId: z.string(),
    filledQty: z.number(),
    totalQty: z.number(),
    totalSpent: z.number(),
    fills: z.array(FILL_DETAIL_SCHEMA),
    userId: z.string(),
    price: z.number(),
    type: TYPE_SCHEMA,
    margin: z.number(),
    status: z.string(),
    transactionTime: z.number(),
  }),
});

const CANCEL_ORDER_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("cancel_order"),
  payload: z.object({
    orderId: z.string(),
    userId: z.string(),
    kind: KIND_SCHEMA,
    market: MARKET_AVAILABEL_SCHEMA,
    price: z.number(),
    totalQty: z.number(),
    filledQty: z.number(),
    margin: z.number(),
    transactionTime: z.number(),
  }),
});

const GET_BALANCE_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_balance"),
  payload: z.number().nullable(),
});

const ADD_BALANCE_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("add_balance"),
  payload: z.number(),
});

const ERROR_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("error"),
  payload: z.object({
    error: z.string(),
  }),
});

const LIQUIDATION_EVENT_SCHEMA = z.object({
  type: z.literal("liquidation"),
  payload: z.object({
    orderId: z.string(),
    userId: z.string(),
    kind: KIND_SCHEMA,
    market: MARKET_AVAILABEL_SCHEMA,
    filledQty: z.number(),
    totalQty: z.number(),
    totalSpent: z.number(),
    fills: z.array(FILL_DETAIL_SCHEMA),
    transactionTime: z.number(),
  }),
});

const POSITION_DETAILS_SCHEMA = z.object({
  costBasis: z.number(),
  kind: KIND_SCHEMA,
  margin: z.number(),
  market: MARKET_AVAILABEL_SCHEMA,
  qty: z.number(),
});

const GET_POSITION_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_position"),
  payload: z.union([POSITION_DETAILS_SCHEMA, z.array(POSITION_DETAILS_SCHEMA)]).nullable(),
});

const OPEN_ORDER_DETAILS_SCHEMA = z.object({
  orderId: z.string(),
  userId: z.string(),
  kind: KIND_SCHEMA,
  market: MARKET_AVAILABEL_SCHEMA,
  price: z.number(),
  totalQty: z.number(),
  filledQty: z.number(),
  margin: z.number(),
  type: TYPE_SCHEMA,
  status: z.string(),
  createdAt: z.date().or(z.string()),
  transactionTime: z.number(),
});

const GET_OPEN_ORDERS_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal('get_open_orders'),
  payload: z.array(OPEN_ORDER_DETAILS_SCHEMA),
});

const GET_FILLS_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_fills"),
  payload: z.array(FILL_DETAIL_SCHEMA),
});

const GET_DEPTH_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_depth"),
  payload: z.object({
    bids: z.array(z.tuple([z.coerce.number(), z.coerce.number()])),
    asks: z.array(z.tuple([z.coerce.number(), z.coerce.number()])),
  }),
});

const MARKPRICE_UPDATED_RESPONSE_SCHEMA = z.object({
  type: z.literal('markprice_updated'),
  payload: z.object({
    market: MARKET_AVAILABEL_SCHEMA,
    price: z.string().or(z.number()),
    transactionTime: z.number(),
  }),
});


const DEPTH_LEVEL_SCHEMA = z.tuple([z.coerce.number(), z.coerce.number()]);

const DEPTH_UPDATED_RESPONSE_SCHEMA = z.object({
  type: z.literal('depth_updated'),
  payload: z.object({
    market: MARKET_AVAILABEL_SCHEMA,
    bids: z.array(DEPTH_LEVEL_SCHEMA),
    asks: z.array(DEPTH_LEVEL_SCHEMA),
    transactionTime: z.number(),
  }),
});

const TRADE_EXECUTED_RESPONSE_SCHEMA = z.object({
  type: z.literal('trade_executed'),
  payload: z.object({
    market: MARKET_AVAILABEL_SCHEMA,
    price: z.number(),
    qty: z.number(),
    transactionTime: z.number(),
  }),
});

const LAST_TRADED_PRICE_UPDATED_RESPONSE_SCHEMA = z.object({
  type: z.literal('last_traded_price_updated'),
  payload: z.object({
    market: MARKET_AVAILABEL_SCHEMA,
    price: z.number(),
    transactionTime: z.number(),
  }),
});

const FUNDING_TIMER_RESET_SCHEMA = z.object({
  type: z.literal('funding_timer_reset'),
  payload: z.object({
    market: MARKET_AVAILABEL_SCHEMA,
    transactionTime: z.number(),
  }),
});

const BACKEND_RESPONSE_SCHEMA = z.discriminatedUnion('type', [
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  GET_BALANCE_RESPONSE_SCHEMA,
  ADD_BALANCE_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  GET_POSITION_RESPONSE_SCHEMA,
  GET_OPEN_ORDERS_RESPONSE_SCHEMA,
  GET_FILLS_RESPONSE_SCHEMA,
  GET_DEPTH_RESPONSE_SCHEMA,
]);
type BACKEND_RESPONSE = z.infer<typeof BACKEND_RESPONSE_SCHEMA>;

const WS_BROADCAST_EVENT_SCHEMA = z.discriminatedUnion('type', [
  LIQUIDATION_EVENT_SCHEMA,
  MARKPRICE_UPDATED_RESPONSE_SCHEMA,
  DEPTH_UPDATED_RESPONSE_SCHEMA,
  TRADE_EXECUTED_RESPONSE_SCHEMA,
  LAST_TRADED_PRICE_UPDATED_RESPONSE_SCHEMA,
  FUNDING_TIMER_RESET_SCHEMA,
]);

const ENGINE_STREAM_MESSAGE_SCHEMA = z.union([
  BACKEND_RESPONSE_SCHEMA,
  WS_BROADCAST_EVENT_SCHEMA,
]);
type ENGINE_STREAM_MESSAGE = z.infer<typeof ENGINE_STREAM_MESSAGE_SCHEMA>;

const DB_PERSISTENCE_EVENT_SCHEMA = z.discriminatedUnion('type', [
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
]);

export {
  BACKEND_RESPONSE_SCHEMA,
  DB_PERSISTENCE_EVENT_SCHEMA,
  WS_BROADCAST_EVENT_SCHEMA,
  type BACKEND_RESPONSE,
  type ENGINE_STREAM_MESSAGE,
};
