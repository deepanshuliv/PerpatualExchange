import z from 'zod';
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, TYPE_SCHEMA } from '../shared';

const BASE_BACKEND_REQUEST = z.object({
    correlationId: z.string(),
});

const CREATE_ORDER_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('create_order'),
    data: z.object({
        qty: z.union([z.string(), z.number()]).transform(String),
        price: z.union([z.number(), z.string()]).transform(Number),
        market: MARKET_AVAILABEL_SCHEMA,
        type: TYPE_SCHEMA,
        kind: KIND_SCHEMA,
        margin: z.union([z.string(), z.number()]).transform(String),
    }),
});

type CREATE_ORDER = z.infer<typeof CREATE_ORDER_SCHEMA>;

const CANCEL_ORDER_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('cancel_order'),
    data: z.object({
        orderId: z.string(),
    }),
});
type CANCEL_ORDER = z.infer<typeof CANCEL_ORDER_SCHEMA>;

const GET_BALANCE_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('get_balance'),
    data: z.object({
        market: MARKET_AVAILABEL_SCHEMA.optional(),
    }),
});

type GET_BALANCE = z.infer<typeof GET_BALANCE_SCHEMA>;

const ADD_BALANCE_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('add_balance'),
    data: z.object({
        amount: z.number(),
    }),
});

type ADD_BALANCE = z.infer<typeof ADD_BALANCE_SCHEMA>;

const GET_DEPTH_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('get_depth_update'),
    data: z.object({
        market: MARKET_AVAILABEL_SCHEMA,
    }),
});

type GET_DEPTH = z.infer<typeof GET_DEPTH_SCHEMA>;

const GET_POSITION_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('get_position'),
    data: z.object({
        market: MARKET_AVAILABEL_SCHEMA.optional(),
    }),
});

type GET_POSITION = z.infer<typeof GET_POSITION_SCHEMA>;

const DB_REQUEST_SCHEMA = z.object({
    orderId: z.string(),
});

const BACKEND_REQUEST_TYPE = z.union([
    GET_BALANCE_SCHEMA,
    GET_DEPTH_SCHEMA,
    GET_POSITION_SCHEMA,
    CREATE_ORDER_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA,
]);

const BACKEND_REQUEST_SCHEMA = z.union([BACKEND_REQUEST_TYPE, DB_REQUEST_SCHEMA]);

type BACKEND_REQUEST = z.infer<typeof BACKEND_REQUEST_SCHEMA>;

export {
    ADD_BALANCE_SCHEMA,
    BACKEND_REQUEST_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    CREATE_ORDER_SCHEMA,
    DB_REQUEST_SCHEMA,
    GET_BALANCE_SCHEMA,
    GET_DEPTH_SCHEMA,
    GET_POSITION_SCHEMA,
    type ADD_BALANCE,
    type BACKEND_REQUEST,
    type CANCEL_ORDER,
    type CREATE_ORDER,
    type GET_BALANCE,
    type GET_DEPTH,
    type GET_POSITION,
};
