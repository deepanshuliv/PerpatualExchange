import z from 'zod';
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, TYPE_SCHEMA } from '../shared';

const BASE_ENGINE_SCHEMA = z.object({
  correlationId: z.string(),
});

const ENGINE_PAYLOAD_SCHEMA = z.object({ userId: z.string() });

const CREATE_ORDER_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('create_order'),
  payload: ENGINE_PAYLOAD_SCHEMA.extend({
    qty: z.number(),
    price: z.number(),
    market: MARKET_AVAILABEL_SCHEMA,
    type: TYPE_SCHEMA,
    kind: KIND_SCHEMA,
    margin: z.number(),
  }),
});
type CREATE_ORDER = z.infer<typeof CREATE_ORDER_SCHEMA>;

const GET_BALANCE_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('get_balance'),
  payload: ENGINE_PAYLOAD_SCHEMA.extend({
    market: MARKET_AVAILABEL_SCHEMA.optional(),
  }),
});

type GET_BALANCE = z.infer<typeof GET_BALANCE_SCHEMA>;

const CANCEL_ORDER_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('cancel_order'),
  payload: ENGINE_PAYLOAD_SCHEMA.extend({
    orderId: z.string(),
  }),
});

type CANCEL_ORDER = z.infer<typeof CANCEL_ORDER_SCHEMA>;

const ADD_BALANCE_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('add_balance'),
  payload: ENGINE_PAYLOAD_SCHEMA.extend({
    amount: z.number(),
  }),
});

type ADD_BALANCE = z.infer<typeof ADD_BALANCE_SCHEMA>;

const GET_POSITION_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('get_position'),
  payload: ENGINE_PAYLOAD_SCHEMA.extend({
    market: MARKET_AVAILABEL_SCHEMA.optional(),
  }),
});
type GET_POSITION = z.infer<typeof GET_POSITION_SCHEMA>;

const GET_FILLS_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('get_fills'),
  payload: ENGINE_PAYLOAD_SCHEMA,
});
type GET_FILLS = z.infer<typeof GET_FILLS_SCHEMA>;

const GET_DEPTH_SCHEMA = BASE_ENGINE_SCHEMA.extend({
  type: z.literal('get_depth'),
  payload: z.object({
    market: MARKET_AVAILABEL_SCHEMA,
  }),
});
type GET_DEPTH = z.infer<typeof GET_DEPTH_SCHEMA>;

// without correlationId
const GET_MARKET_PRICE_SCHEMA = z.object({
  type: z.literal('markprice_updated'),
  payload: z.object({
    price: z.number(),
    market: MARKET_AVAILABEL_SCHEMA,
  }),
});
const RUN_FUNDING_RATE_SCHEMA = z.object({
  type: z.literal('run_funding_rate'),
});

type GET_MARKET_PRICE = z.infer<typeof GET_MARKET_PRICE_SCHEMA>;

const BACKEND_ENGINE_REQUEST_SCHEMA = z.union([
  GET_BALANCE_SCHEMA,
  CREATE_ORDER_SCHEMA,
  ADD_BALANCE_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  GET_POSITION_SCHEMA,
  GET_FILLS_SCHEMA,
  GET_DEPTH_SCHEMA,
]);
type BACKEND_ENGINE_REQUEST = z.infer<typeof BACKEND_ENGINE_REQUEST_SCHEMA>;

const ENGINE_REQUEST_SCHEMA = z.union([
  GET_BALANCE_SCHEMA,
  CREATE_ORDER_SCHEMA,
  ADD_BALANCE_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  GET_POSITION_SCHEMA,
  GET_FILLS_SCHEMA,
  RUN_FUNDING_RATE_SCHEMA,
  GET_DEPTH_SCHEMA,
]);

type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;

export {
  ENGINE_REQUEST_SCHEMA,
  GET_MARKET_PRICE_SCHEMA,
  type ADD_BALANCE,
  type BACKEND_ENGINE_REQUEST,
  type CANCEL_ORDER,
  type CREATE_ORDER,
  type ENGINE_REQUEST,
  type GET_BALANCE,
  type GET_DEPTH,
  type GET_FILLS,
  type GET_MARKET_PRICE,
  type GET_POSITION,
};
