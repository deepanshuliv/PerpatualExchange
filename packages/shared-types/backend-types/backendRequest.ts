import z, { ZodUnion } from "zod";
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, TYPE_SCHEMA } from "../shared";

const BASE_BACKEND_REQUEST = z.object({
    correlationId: z.string()
})


const CREATE_ORDER_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal("create_order"),
    data: z.object({
        qty: z.string(),
        price: z.number(),
        market: MARKET_AVAILABEL_SCHEMA,
        type: TYPE_SCHEMA,
        kind: KIND_SCHEMA
    })
})

const CANCEL_ORDER_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal("cancel_order"),
    data: z.object({
        orderId: z.string()
    })
})

const GET_BALANCE_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: z.literal("get_balance"),
    data: z.object({
        market: MARKET_AVAILABEL_SCHEMA.optional()
    })
})

const ADD_BALANCE_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: "add_balance",
    data: z.object({
        // for adding usd only
        amount: z.number()
    })
})

const GET_DEPTH_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: "get_depth_update",
    data: z.object({
        market: MARKET_AVAILABEL_SCHEMA
    })
})

const GET_POSITION_SCHEMA = BASE_BACKEND_REQUEST.extend({
    type: "get_position",
    data: z.object({
        market: MARKET_AVAILABEL_SCHEMA.optional()
    })
})

const DB_REQUEST_data = z.object({
    orderId: z.string()
})

const ENGINE_REQUEST_data = z.union([
    GET_BALANCE_SCHEMA,
    GET_DEPTH_SCHEMA,
    GET_POSITION_SCHEMA,
    CREATE_ORDER_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA
])



const BACKEND_REQUEST_SCHEMA = z.union([ENGINE_REQUEST_data, DB_REQUEST_data])

export {
    GET_BALANCE_SCHEMA,
    GET_DEPTH_SCHEMA,
    GET_POSITION_SCHEMA,
    CREATE_ORDER_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA,
    ENGINE_REQUEST_data,
    BACKEND_REQUEST_SCHEMA
}