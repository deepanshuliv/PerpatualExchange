// Mirrors FUNDING_INTERVAL_MS / nextFundingTime in packages/shared-types/shared.ts:
// the engine settles funding on the 00:00, 08:00 and 16:00 UTC boundaries.
export const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;
const MAX_FUNDING_RATE = 0.0005;

export function nextFundingTime(now = Date.now()): number {
  return Math.floor(now / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS + FUNDING_INTERVAL_MS;
}

export function fundingMsRemaining(now = Date.now()): number {
  return nextFundingTime(now) - now;
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function computeFundingRatePreview(markPrice: number, lastPrice: number): number | null {
  if (!markPrice || !lastPrice) return null;
  const raw = (lastPrice - markPrice) / markPrice;
  return Math.max(-MAX_FUNDING_RATE, Math.min(MAX_FUNDING_RATE, raw));
}

export function formatFundingRate(rate: number): string {
  const pct = rate * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(4)}%`;
}

export function fundingRateColorClass(rate: number): string {
  if (rate > 0) return "text-down";
  if (rate < 0) return "text-up";
  return "text-muted";
}
