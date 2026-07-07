CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE "ticks" (
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL,
    "market" "Market" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ticks_pkey" PRIMARY KEY ("time", "id")
);

CREATE TABLE "candles_1h" (
    "openTime" TIMESTAMP(3) NOT NULL,
    "market" "Market" NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_1h_pkey" PRIMARY KEY ("openTime", "market")
);

CREATE TABLE "candles_1d" (
    "openTime" TIMESTAMP(3) NOT NULL,
    "market" "Market" NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_1d_pkey" PRIMARY KEY ("openTime", "market")
);

CREATE INDEX "ticks_market_time_idx" ON "ticks"("market", "time" DESC);
CREATE INDEX "candles_1h_market_openTime_idx" ON "candles_1h"("market", "openTime" DESC);
CREATE INDEX "candles_1d_market_openTime_idx" ON "candles_1d"("market", "openTime" DESC);

SELECT create_hypertable('ticks', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
SELECT create_hypertable('candles_1h', 'openTime', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
SELECT create_hypertable('candles_1d', 'openTime', chunk_time_interval => INTERVAL '30 days', if_not_exists => TRUE);
