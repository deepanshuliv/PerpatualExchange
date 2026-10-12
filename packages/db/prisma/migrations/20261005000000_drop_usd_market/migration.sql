-- USD was never tradable: it had no leverage cap and no Binance mark price, and
-- the API rejected orders for it. Drop it from the enum.
--
-- Refuse to run if any row still uses it, instead of silently rewriting history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "order" WHERE "market" = 'USD')
    OR EXISTS (SELECT 1 FROM "ticks" WHERE "market" = 'USD')
    OR EXISTS (SELECT 1 FROM "candles_1m" WHERE "market" = 'USD')
    OR EXISTS (SELECT 1 FROM "candles_5m" WHERE "market" = 'USD')
    OR EXISTS (SELECT 1 FROM "candles_15m" WHERE "market" = 'USD')
    OR EXISTS (SELECT 1 FROM "candles_1h" WHERE "market" = 'USD')
    OR EXISTS (SELECT 1 FROM "candles_1d" WHERE "market" = 'USD')
  THEN
    RAISE EXCEPTION 'Rows with market = USD exist; remove or migrate them before dropping the USD market';
  END IF;
END $$;

-- Postgres cannot remove a value from an enum, so recreate the type.
ALTER TYPE "Market" RENAME TO "Market_old";
CREATE TYPE "Market" AS ENUM ('BTCUSD', 'ETHUSD', 'SOLUSD');

ALTER TABLE "order"       ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");
ALTER TABLE "ticks"       ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");
ALTER TABLE "candles_1m"  ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");
ALTER TABLE "candles_5m"  ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");
ALTER TABLE "candles_15m" ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");
ALTER TABLE "candles_1h"  ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");
ALTER TABLE "candles_1d"  ALTER COLUMN "market" TYPE "Market" USING ("market"::text::"Market");

DROP TYPE "Market_old";
