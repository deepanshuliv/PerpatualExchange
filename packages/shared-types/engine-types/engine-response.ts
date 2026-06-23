import z from "zod";
import {
  KIND_SCHEMA,
  MARKET_AVAILABEL_SCHEMA,
  TYPE_SCHEMA,
} from "../shared";

const BASE_RESPONSE = z.object({
  correlationId: z.string(),
});

const FILL_INFO_SCHEMA = z.object({
  price: z.number(),
  qty: z.number(),
});
type FILL_INFO = z.infer<typeof FILL_INFO_SCHEMA>;

const CREATE_ORDER_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("create_order"),
  payload: z.object({
    kind: KIND_SCHEMA,
    market: MARKET_AVAILABEL_SCHEMA,
    orderId: z.string(),
    filledQty: z.number(),
    totalQty: z.number(),
    totalSpent: z.number(),
    fills: z.array(FILL_INFO_SCHEMA),
  }),
});
type CREATE_ORDER_RESPONSE = z.infer<typeof CREATE_ORDER_RESPONSE_SCHEMA>;

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
  }),
});
type CANCEL_ORDER_RESPONSE = z.infer<typeof CANCEL_ORDER_RESPONSE_SCHEMA>;

const GET_BALANCE_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_balance"),
  payload: z.number().nullable(),
});
type GET_BALANCE_RESPONSE = z.infer<typeof GET_BALANCE_RESPONSE_SCHEMA>;

const ADD_BALANCE_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("add_balance"),
  payload: z.null(),
});
type ADD_BALANCE_RESPONSE = z.infer<typeof ADD_BALANCE_RESPONSE_SCHEMA>;

const ERROR_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("error"),
  payload: z.object({
    error: z.string(),
  }),
});
type ERROR_RESPONSE = z.infer<typeof ERROR_RESPONSE_SCHEMA>;

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
    fills: z.array(FILL_INFO_SCHEMA),
  }),
});
type LIQUIDATION_EVENT = z.infer<typeof LIQUIDATION_EVENT_SCHEMA>;

const POSITION_DETAILS_SCHEMA = z.object({
  costBasis: z.number(),
  kind: KIND_SCHEMA,
  margin: z.number(),
  market: MARKET_AVAILABEL_SCHEMA,
  qty: z.number(),
});
type POSITION_DETAILS = z.infer<typeof POSITION_DETAILS_SCHEMA>;

const GET_POSITION_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_position"),
  payload: z.union([POSITION_DETAILS_SCHEMA, z.array(POSITION_DETAILS_SCHEMA)]).nullable(),
});
type GET_POSITION_RESPONSE = z.infer<typeof GET_POSITION_RESPONSE_SCHEMA>;

const ORDER_DETAILS_SCHEMA = z.object({
  userId: z.string(),
  type: TYPE_SCHEMA,
  qty: z.number(),
  price: z.number(),
  status: z.string(),
  margin: z.number(),
  kind: KIND_SCHEMA,
  market: MARKET_AVAILABEL_SCHEMA,
  createdAt: z.date().or(z.string()),
  orderId: z.string().optional()
});
type ORDER_DETAILS = z.infer<typeof ORDER_DETAILS_SCHEMA>;

const GET_OPEN_ORDERS_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_open_orders"),
  payload: z.array(ORDER_DETAILS_SCHEMA),
});
type GET_OPEN_ORDERS_RESPONSE = z.infer<typeof GET_OPEN_ORDERS_RESPONSE_SCHEMA>;

const GET_CLOSED_ORDERS_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_closed_orders"),
  payload: z.array(ORDER_DETAILS_SCHEMA),
});
type GET_CLOSED_ORDERS_RESPONSE = z.infer<typeof GET_CLOSED_ORDERS_RESPONSE_SCHEMA>;

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
});
type FILL_DETAIL = z.infer<typeof FILL_DETAIL_SCHEMA>;

const GET_FILLS_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
  type: z.literal("get_fills"),
  payload: z.array(FILL_DETAIL_SCHEMA),
});
type GET_FILLS_RESPONSE = z.infer<typeof GET_FILLS_RESPONSE_SCHEMA>;

const ENGINE_RESPONSE_SCHEMA = z.discriminatedUnion("type", [
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  GET_BALANCE_RESPONSE_SCHEMA,
  ADD_BALANCE_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
  GET_POSITION_RESPONSE_SCHEMA,
  GET_OPEN_ORDERS_RESPONSE_SCHEMA,
  GET_CLOSED_ORDERS_RESPONSE_SCHEMA,
  GET_FILLS_RESPONSE_SCHEMA,
]);

type ENGINE_RESPONSE = z.infer<typeof ENGINE_RESPONSE_SCHEMA>;

export {
  ENGINE_RESPONSE_SCHEMA,
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  type ENGINE_RESPONSE,
  type CREATE_ORDER_RESPONSE,
  type CANCEL_ORDER_RESPONSE,
  type GET_BALANCE_RESPONSE,
  type ADD_BALANCE_RESPONSE,
  type ERROR_RESPONSE,
  LIQUIDATION_EVENT_SCHEMA,
  type LIQUIDATION_EVENT,
  type FILL_INFO,
  POSITION_DETAILS_SCHEMA,
  type POSITION_DETAILS,
  GET_POSITION_RESPONSE_SCHEMA,
  type GET_POSITION_RESPONSE,
  ORDER_DETAILS_SCHEMA,
  type ORDER_DETAILS,
  GET_OPEN_ORDERS_RESPONSE_SCHEMA,
  type GET_OPEN_ORDERS_RESPONSE,
  GET_CLOSED_ORDERS_RESPONSE_SCHEMA,
  type GET_CLOSED_ORDERS_RESPONSE,
  FILL_DETAIL_SCHEMA,
  type FILL_DETAIL,
  GET_FILLS_RESPONSE_SCHEMA,
  type GET_FILLS_RESPONSE,
};
