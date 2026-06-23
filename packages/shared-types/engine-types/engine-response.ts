import z from "zod";
import {
  KIND_SCHEMA,
  MARKET_AVAILABEL_SCHEMA,
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

const ENGINE_RESPONSE_SCHEMA = z.discriminatedUnion("type", [
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  GET_BALANCE_RESPONSE_SCHEMA,
  ADD_BALANCE_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
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
};
