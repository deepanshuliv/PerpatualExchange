import z from "zod";

/** Every market here must have a MAX_LEVERAGE entry and a Binance mark-price symbol. */
const MARKET_AVAILABEL_SCHEMA = z.union([
    z.literal("BTCUSD"),
    z.literal("SOLUSD"),
    z.literal("ETHUSD"),
])

const KIND_SCHEMA = z.union([z.literal("LONG"), z.literal("SHORT")]);
const ORDER_TYPE_SCHEMA = z.union([z.literal("LIMIT"), z.literal("MARKET")]);
const TYPE_SCHEMA = z.union([
    z.literal("LIMIT"),
    z.literal("MARKET"),
    z.literal("LIQUIDATION"),
]);
const STATUS_SCHEMA = z.union([z.literal("PARTIALLY_FILLED"), z.literal("FILLED"), z.literal("OPEN"), z.literal("CANCELLED")])

type KIND = z.infer<typeof KIND_SCHEMA>
type TYPE = z.infer<typeof TYPE_SCHEMA>
type STATUS = z.infer<typeof STATUS_SCHEMA>
type MARKET_AVAILABEL = z.infer<typeof MARKET_AVAILABEL_SCHEMA>
const allMarketsList = MARKET_AVAILABEL_SCHEMA.options.map((o) => o.value)

/** Highest leverage allowed per perpetual market (margin >= notional / MAX_LEVERAGE). */
const MAX_LEVERAGE: Record<MARKET_AVAILABEL, number> = {
    BTCUSD: 75,
    ETHUSD: 50,
    SOLUSD: 20,
}

/** Funding settles every 8 hours, on the 00:00, 08:00 and 16:00 UTC boundaries. */
const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;

/** The next funding boundary strictly after `now` (epoch ms). */
function nextFundingTime(now = Date.now()) {
    return Math.floor(now / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS + FUNDING_INTERVAL_MS;
}

export {
    MARKET_AVAILABEL_SCHEMA,
    type MARKET_AVAILABEL,
    KIND_SCHEMA,
    ORDER_TYPE_SCHEMA,
    TYPE_SCHEMA,
    type KIND,
    type TYPE,
    type STATUS,
    allMarketsList,
    MAX_LEVERAGE,
    STATUS_SCHEMA,
    FUNDING_INTERVAL_MS,
    nextFundingTime,
}
