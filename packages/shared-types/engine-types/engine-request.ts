import z from "zod";
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, TYPE_SCHEMA } from "../shared";


const BASE_ENGINE_SCHEMA = z.object({
    stream: z.string(),
    requestId: z.string()
})

const ENGINE_PAYLOAD_SCHEMA = z.object({ userId: z.string() })

const CREATE_ORDER_SCHEMA = BASE_ENGINE_SCHEMA.extend({
    payload: ENGINE_PAYLOAD_SCHEMA.extend({
        qty: z.string(),
        price: z.number(),
        market: MARKET_AVAILABEL_SCHEMA,
        type: TYPE_SCHEMA,
        kind: KIND_SCHEMA
    })
})

const GET_BALANCE_SCHEMA = BASE_ENGINE_SCHEMA.extend({
    paylaod: ENGINE_PAYLOAD_SCHEMA.extend({
        market: MARKET_AVAILABEL_SCHEMA.optional()
    })
})

const CANCEL_ORDER_SCHEMA = z.object({
    payload: ENGINE_PAYLOAD_SCHEMA.extend({
        orderId: z.string()
    })
})


// currently only for usd
const ADD_BALANCE_SCHEMA = ENGINE_PAYLOAD_SCHEMA.extend({
    payload: ENGINE_PAYLOAD_SCHEMA.extend({
        amount: z.number(),
    })
})

const GET_ORDER_SCHEMA = z.object({
    orderId: z.string()
})

const DB_REQUEST_SCHEMA = z.union([GET_ORDER_SCHEMA])
const ENGINE_REQUEST_SCHEMA = z.union([
    GET_BALANCE_SCHEMA,
    CREATE_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA,
    CANCEL_ORDER_SCHEMA

])


type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;
type DB_REQUEST = z.infer<typeof DB_REQUEST_SCHEMA>


const isEngineRequest = (request: unknown): request is ENGINE_REQUEST => {
    return ENGINE_REQUEST_SCHEMA.safeParse(request).success
}

const isDbRequest = (request: unknown): request is DB_REQUEST => {
    return DB_REQUEST_SCHEMA.safeParse(request).success
}


export {
    GET_BALANCE_SCHEMA,
    GET_ORDER_SCHEMA,
    ADD_BALANCE_SCHEMA,
    CREATE_ORDER_SCHEMA,
    CANCEL_ORDER_SCHEMA,
    isDbRequest,
    isEngineRequest,
    type DB_REQUEST,
    type ENGINE_REQUEST
}