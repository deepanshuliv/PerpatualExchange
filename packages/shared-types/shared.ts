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



export {
    type REQUEST_TYPE,
    REQUEST_TYPE_SCHEMA,
    MARKET_AVAILABEL_SCHEMA,
    KIND_SCHEMA,
    TYPE_SCHEMA
}