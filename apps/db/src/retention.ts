import { prisma } from '@repo/db';

const DEFAULT_HISTORY_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function getRetentionDays() {
  const configured = Number(process.env.HISTORY_RETENTION_DAYS);
  return Number.isFinite(configured) && configured >= 1
    ? Math.floor(configured)
    : DEFAULT_HISTORY_RETENTION_DAYS;
}

/**
 * Keep the operational database bounded. Raw ticks have a Timescale retention
 * policy (see the Prisma migration); fills and terminal orders are regular
 * Postgres tables, so they need an explicit cleanup job.
 */
export async function cleanupHistoricalData() {
  const cutoff = new Date(Date.now() - getRetentionDays() * DAY_MS);

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      // Fills must be removed before their parent orders because of the FK.
      const fills = await tx.fill.deleteMany({
        where: { transactionTime: { lt: cutoff } },
      });

      const orders = await tx.order.deleteMany({
        where: {
          transactionTime: { lt: cutoff },
          status: { in: ['FILLED', 'CANCELLED'] },
          // A long-lived order may have a recent fill. Keep it until every
          // dependent fill is gone rather than violating the foreign key.
          fills: { none: {} },
        },
      });

      return { fills: fills.count, orders: orders.count };
    });

    if (deleted.fills > 0 || deleted.orders > 0) {
      console.log(
        `[DB Retention] deleted ${deleted.fills} fills and ${deleted.orders} terminal orders older than ${getRetentionDays()} days`,
      );
    }
  } catch (err) {
    // Retention is best-effort and must never stop the consumer or the engine.
    console.log('[DB Retention] cleanup failed:', err);
  }
}
