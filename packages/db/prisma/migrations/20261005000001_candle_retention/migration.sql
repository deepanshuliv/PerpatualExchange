-- Bound candle storage. Each window comfortably covers the API's maximum of
-- 1000 candles per request (1m: ~17 hours, 5m: ~3.5 days, 15m: ~10 days,
-- 1h: ~42 days). Daily candles stay forever: about 1,100 rows a year for
-- three markets.
SELECT add_retention_policy('candles_1m', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('candles_5m', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('candles_15m', INTERVAL '180 days', if_not_exists => TRUE);
SELECT add_retention_policy('candles_1h', INTERVAL '730 days', if_not_exists => TRUE);
