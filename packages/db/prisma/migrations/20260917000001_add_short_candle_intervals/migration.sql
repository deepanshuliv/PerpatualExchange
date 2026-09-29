CREATE TABLE IF NOT EXISTS "candles_1m" (
    "openTime" TIMESTAMP(3) NOT NULL,
    "market" "Market" NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_1m_pkey" PRIMARY KEY ("openTime", "market")
);

CREATE TABLE IF NOT EXISTS "candles_5m" (
    "openTime" TIMESTAMP(3) NOT NULL,
    "market" "Market" NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_5m_pkey" PRIMARY KEY ("openTime", "market")
);

CREATE TABLE IF NOT EXISTS "candles_15m" (
    "openTime" TIMESTAMP(3) NOT NULL,
    "market" "Market" NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_15m_pkey" PRIMARY KEY ("openTime", "market")
);

CREATE INDEX IF NOT EXISTS "candles_1m_market_openTime_idx" ON "candles_1m"("market", "openTime" DESC);
CREATE INDEX IF NOT EXISTS "candles_5m_market_openTime_idx" ON "candles_5m"("market", "openTime" DESC);
CREATE INDEX IF NOT EXISTS "candles_15m_market_openTime_idx" ON "candles_15m"("market", "openTime" DESC);

SELECT create_hypertable('candles_1m', 'openTime', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
SELECT create_hypertable('candles_5m', 'openTime', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
SELECT create_hypertable('candles_15m', 'openTime', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
