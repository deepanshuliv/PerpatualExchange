import z from 'zod';
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, ORDER_TYPE_SCHEMA } from '../shared';

const decimalString = z.union([z.string(), z.number()]).transform(String);

const BASE_BACKEND_REQUEST = z.object({
    correlationId: z.string(),
});

const CREATE_ORDER_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('create_order'),
    data: z.object({
        qty: decimalString,
        price: decimalString,
        market: MARKET_AVAILABEL_SCHEMA,
        type: ORDER_TYPE_SCHEMA,
        kind: KIND_SCHEMA,
        margin: decimalString,
    }),
});

const CANCEL_ORDER_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('cancel_order'),
    data: z.object({
        orderId: z.string(),
    }),
});

const ADD_BALANCE_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal('add_balance'),
    data: z.object({
        amount: z.number(),
    }),
});

export {
    ADD_BALANCE_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    CREATE_ORDER_SCHEMA,
};
