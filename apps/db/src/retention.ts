import { prisma } from '@repo/db';

const DEFAULT_HISTORY_RETENTION_DAYS = 90;
const DEFAULT_CANCELLED_ORDER_RETENTION_HOURS = 48;
const DELETE_BATCH_SIZE = 10_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function readPositiveInt(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : fallback;
}

function getRetentionDays() {
  return readPositiveInt('HISTORY_RETENTION_DAYS', DEFAULT_HISTORY_RETENTION_DAYS);
}

function getCancelledOrderRetentionHours() {
  return readPositiveInt('CANCELLED_ORDER_RETENTION_HOURS', DEFAULT_CANCELLED_ORDER_RETENTION_HOURS);
}

/**
 * Run a `DELETE ... LIMIT`-style statement until it removes fewer rows than a
 * full batch. Each batch is its own short statement, so a large backlog never
 * becomes one long transaction and the consumer keeps writing in between.
 */
async function deleteInBatches(deleteBatch: () => Promise<number>) {
  let total = 0;
  while (true) {
    const deleted = await deleteBatch();
    total += deleted;
    if (deleted < DELETE_BATCH_SIZE) return total;
  }
}

let running = false;

/**
 * Keep the operational database bounded. Raw ticks and candles have Timescale
 * retention policies (see the Prisma migrations); fills and orders are regular
 * Postgres tables, so they need this explicit cleanup job.
 *
 * - Cancelled orders that never filled are deleted after
 *   CANCELLED_ORDER_RETENTION_HOURS. The market maker cancels and replaces its
 *   quotes every second, so these are almost all rows in "order", and nothing
 *   reads them back. The archiver has already copied each finished day to R2.
 * - Fills, and terminal orders without fills, are deleted after
 *   HISTORY_RETENTION_DAYS.
 */
export async function cleanupHistoricalData() {
  if (running) return;
  running = true;

  const cancelledCutoff = new Date(Date.now() - getCancelledOrderRetentionHours() * HOUR_MS);
  const historyCutoff = new Date(Date.now() - getRetentionDays() * DAY_MS);

  try {
    const cancelled = await deleteInBatches(() => prisma.$executeRaw`
      DELETE FROM "order" WHERE id IN (
        SELECT o.id FROM "order" o
        WHERE o.status = 'CANCELLED'
          AND o."filledQty" = 0
          AND o."transactionTime" < ${cancelledCutoff}
          AND NOT EXISTS (SELECT 1 FROM fill f WHERE f."orderId" = o.id)
        LIMIT ${DELETE_BATCH_SIZE}
      )`);

    // Fills must be removed before their parent orders because of the FK.
    const fills = await deleteInBatches(() => prisma.$executeRaw`
      DELETE FROM fill WHERE id IN (
        SELECT id FROM fill WHERE "transactionTime" < ${historyCutoff}
        LIMIT ${DELETE_BATCH_SIZE}
      )`);

    // A long-lived order may have a recent fill. Keep it until every dependent
    // fill is gone rather than violating the foreign key.
    const orders = await deleteInBatches(() => prisma.$executeRaw`
      DELETE FROM "order" WHERE id IN (
        SELECT o.id FROM "order" o
        WHERE o.status IN ('FILLED', 'CANCELLED')
          AND o."transactionTime" < ${historyCutoff}
          AND NOT EXISTS (SELECT 1 FROM fill f WHERE f."orderId" = o.id)
        LIMIT ${DELETE_BATCH_SIZE}
      )`);

    if (cancelled > 0 || fills > 0 || orders > 0) {
      console.log(
        `[DB Retention] deleted ${cancelled} unfilled cancelled orders older than ${getCancelledOrderRetentionHours()}h, ` +
          `${fills} fills and ${orders} terminal orders older than ${getRetentionDays()} days`,
      );
    }
  } catch (err) {
    // Retention is best-effort and must never stop the consumer or the engine.
    console.log('[DB Retention] cleanup failed:', err);
  } finally {
    running = false;
  }
}
