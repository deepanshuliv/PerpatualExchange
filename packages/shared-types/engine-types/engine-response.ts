import z from "zod"
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA, TYPE_SCHEMA } from "../shared"

const BASE_RESPONSE = z.object({
    stream: z.string(),
    correlationId: z.string(),
})
const CREATE_ORDER_SCHEMA = BASE_RESPONSE.extend({
    qty: z.number(),
    filledQty: z.number(),
    fills: z.array(z.object({ price: z.number(), qty: z.number() })),
    orderId: z.string()
})

type CREATE_ORDER = z.infer<typeof CREATE_ORDER_SCHEMA>


const ADD_BALANCE_SCHEMA = CREATE_ORDER_SCHEMA.extend({
    amount: z.number(),
    msg: z.string()
})

export {
    type CREATE_ORDER,
    CREATE_ORDER_SCHEMA
}