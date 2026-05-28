import z from "zod";

const REQUEST_TYPE_SCHEMA = z.union([
    z.literal("create_order"),
    z.literal("cancel_order"),
    z.literal("add_balance"),
    z.literal("get_balance"),
    z.literal("get_order"),
])

type REQUEST_TYPE = z.infer<typeof REQUEST_TYPE_SCHEMA>

const MARKET_AVAILABEL_SCHEMA = z.union([
    z.literal("BTCUSD"),
    z.literal("USD"),
    z.literal("SOLUSD"),
    z.literal("ETHUSD"),
])

const KIND_SCHEMA = z.union([z.literal("LONG"), z.literal("SHORT")]);
const TYPE_SCHEMA = z.union([z.literal("LIMIT"), z.literal("MARKET")]);
const STATUS_SCHEMA = z.union([z.literal("PARTIALLY_FILLED"), z.literal("FILLED"), z.literal("OPEN"), z.literal("CANCELLED")])

type KIND = z.infer<typeof KIND_SCHEMA>
type TYPE = z.infer<typeof TYPE_SCHEMA>
type STATUS = z.infer<typeof STATUS_SCHEMA>
type MARKET_AVAILABEL= z.infer<typeof MARKET_AVAILABEL_SCHEMA>


export {
    REQUEST_TYPE_SCHEMA,
    MARKET_AVAILABEL_SCHEMA,
    type MARKET_AVAILABEL,
    KIND_SCHEMA,
    TYPE_SCHEMA,
    type REQUEST_TYPE,
    type KIND,
    type TYPE,
    type STATUS
}