-- Indexes for the fill/order retention job (apps/db/src/retention.ts). Without
-- them every cleanup pass scanned both tables and the fill foreign key check
-- for each order, which took over a minute and timed out.
CREATE INDEX IF NOT EXISTS "order_status_transactionTime_idx" ON "order"("status", "transactionTime");
CREATE INDEX IF NOT EXISTS "fill_orderId_idx" ON "fill"("orderId");
CREATE INDEX IF NOT EXISTS "fill_transactionTime_idx" ON "fill"("transactionTime");
