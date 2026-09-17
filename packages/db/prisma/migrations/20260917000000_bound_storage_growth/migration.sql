-- Keep high-volume raw market data from consuming the VM disk forever.
SELECT add_retention_policy('ticks', INTERVAL '30 days', if_not_exists => TRUE);

-- These indexes keep the bounded historical queries from degrading into full
-- table scans as the retained history grows.
CREATE INDEX IF NOT EXISTS "order_market_transactionTime_idx"
  ON "order" ("market", "transactionTime" DESC);

CREATE INDEX IF NOT EXISTS "fill_transactionTime_idx"
  ON "fill" ("transactionTime" DESC);
