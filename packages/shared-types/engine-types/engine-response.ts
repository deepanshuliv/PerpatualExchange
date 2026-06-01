import z from "zod"
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, STATUS_SCHEMA, TYPE_SCHEMA } from "../shared"

// ─── base — every response carries correlationId so the backend
//     can look up which waiting promise to resolve ──────────────────────────
const BASE_RESPONSE = z.object({
    correlationId: z.string(),
})

// ─── fill info (embedded inside create_order response) ────────────────────
const FILL_INFO_SCHEMA = z.object({
    price: z.number(),
    qty: z.number(),
})
type FILL_INFO = z.infer<typeof FILL_INFO_SCHEMA>

// ─── per-action response variants ────────────────────────────────────────────

const CREATE_ORDER_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
    type: z.literal("create_order"),
    payload: z.object({
        orderId: z.string(),
        filledQty: z.number(),
        totalQty: z.number(),
        totalSpent: z.number(),
        fills: z.array(FILL_INFO_SCHEMA),
    }),
})
type CREATE_ORDER_RESPONSE = z.infer<typeof CREATE_ORDER_RESPONSE_SCHEMA>

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
})
type CANCEL_ORDER_RESPONSE = z.infer<typeof CANCEL_ORDER_RESPONSE_SCHEMA>

// get_balance returns a plain number (USD balance) or null if user not found
const GET_BALANCE_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
    type: z.literal("get_balance"),
    payload: z.number().nullable(),
})
type GET_BALANCE_RESPONSE = z.infer<typeof GET_BALANCE_RESPONSE_SCHEMA>

// add_balance has no meaningful data to return — just acknowledge success
const ADD_BALANCE_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
    type: z.literal("add_balance"),
    payload: z.null(),
})
type ADD_BALANCE_RESPONSE = z.infer<typeof ADD_BALANCE_RESPONSE_SCHEMA>

// any error from the engine
const ERROR_RESPONSE_SCHEMA = BASE_RESPONSE.extend({
    type: z.literal("error"),
    payload: z.object({
        error: z.string(),
    }),
})
type ERROR_RESPONSE = z.infer<typeof ERROR_RESPONSE_SCHEMA>

// Liquidation is an engine-initiated EVENT — not a response to any backend
// request — so it has NO correlationId.  DB poller and WS read this to
// persist the forced close and notify the user.
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
})
type LIQUIDATION_EVENT = z.infer<typeof LIQUIDATION_EVENT_SCHEMA>

// ─── union — what the engine actually pushes onto to-backend stream ───────────
const ENGINE_RESPONSE_SCHEMA = z.discriminatedUnion("type", [
    CREATE_ORDER_RESPONSE_SCHEMA,
    CANCEL_ORDER_RESPONSE_SCHEMA,
    GET_BALANCE_RESPONSE_SCHEMA,
    ADD_BALANCE_RESPONSE_SCHEMA,
    ERROR_RESPONSE_SCHEMA,
    LIQUIDATION_EVENT_SCHEMA,
])


type ENGINE_RESPONSE = z.infer<typeof ENGINE_RESPONSE_SCHEMA>

export {
    ENGINE_RESPONSE_SCHEMA,
    type ENGINE_RESPONSE,
    type CREATE_ORDER_RESPONSE,
    type CANCEL_ORDER_RESPONSE,
    type GET_BALANCE_RESPONSE,
    type ADD_BALANCE_RESPONSE,
    type ERROR_RESPONSE,
    LIQUIDATION_EVENT_SCHEMA,
    type LIQUIDATION_EVENT,
    type FILL_INFO,
}