import z, { boolean } from "zod";
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, TYPE_SCHEMA } from "../shared";


const BASE_ENGINE_SCHEMA = z.object({
    stream: z.string(),
    correlationId: z.string()
})

const ENGINE_PAYLOAD_SCHEMA = z.object({ userId: z.string() })

const CREATE_ORDER_SCHEMA = BASE_ENGINE_SCHEMA.extend({
    type: z.literal("create_order"),
    payload: ENGINE_PAYLOAD_SCHEMA.extend({
        qty: z.string(),
        price: z.number(),
        market: MARKET_AVAILABEL_SCHEMA,
        type: TYPE_SCHEMA,
        kind: KIND_SCHEMA,
        margin: z.number()
    })
})
type CREATE_ORDER = z.infer<typeof CREATE_ORDER_SCHEMA>;

const GET_BALANCE_SCHEMA = BASE_ENGINE_SCHEMA.extend({
    type: z.literal("get_balance"),
    paylaod: ENGINE_PAYLOAD_SCHEMA.extend({
        market: MARKET_AVAILABEL_SCHEMA.optional()
    })
})

type GET_BALANCE = z.infer<typeof GET_BALANCE_SCHEMA>

const CANCEL_ORDER_SCHEMA = BASE_ENGINE_SCHEMA.extend({
    type: z.literal("cancel_order"),
    payload: ENGINE_PAYLOAD_SCHEMA.extend({
        orderId: z.string()
    })
})

type CANCEL_ORDER = z.infer<typeof CANCEL_ORDER_SCHEMA>

// currently only for usd
const ADD_BALANCE_SCHEMA = BASE_ENGINE_SCHEMA.extend({
    type: z.literal("add_balance"),
    payload: ENGINE_PAYLOAD_SCHEMA.extend({
        amount: z.number(),
    })
})

type ADD_BALANCE = z.infer<typeof ADD_BALANCE_SCHEMA>;

const GET_MARKET_PRICE_SCHEMA = z.object({
    type: z.literal("markprice_updated"),
    payload: z.object({
        price: z.number(),
        market: MARKET_AVAILABEL_SCHEMA
    })
})

type GET_MARKET_PRICE = z.infer<typeof GET_MARKET_PRICE_SCHEMA>


// it is a DB request
const GET_ORDER_SCHEMA = z.object({
    orderId: z.string()
})

const DB_REQUEST_SCHEMA = z.union([GET_ORDER_SCHEMA])

const ENGINE_REQUEST_SCHEMA = z.union([
    GET_BALANCE_SCHEMA,
    CREATE_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    GET_MARKET_PRICE_SCHEMA

])

type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;

type DB_REQUEST = z.infer<typeof DB_REQUEST_SCHEMA>;

const isEngineRequest = (request: unknown): request is ENGINE_REQUEST => {
    return ENGINE_REQUEST_SCHEMA.safeParse(request).success
}

const isDbRequest = (request: unknown): request is DB_REQUEST => {
    return DB_REQUEST_SCHEMA.safeParse(request).success
}


export {
    GET_BALANCE_SCHEMA,
    type GET_BALANCE,
    GET_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA,
    type ADD_BALANCE,
    CREATE_ORDER_SCHEMA,
    type CREATE_ORDER,
    CANCEL_ORDER_SCHEMA,
    type CANCEL_ORDER,
    type GET_MARKET_PRICE,
    GET_MARKET_PRICE_SCHEMA,
    ENGINE_REQUEST_SCHEMA,
    isDbRequest,
    isEngineRequest,
    type DB_REQUEST,
    type ENGINE_REQUEST
}