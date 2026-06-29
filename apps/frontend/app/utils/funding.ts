export const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;
export const MAX_FUNDING_RATE = 0.0005;

export function startFundingTimer(from = Date.now()): number {
  return from + FUNDING_INTERVAL_MS;
}

export function fundingMsRemaining(deadline: number, now = Date.now()): number {
  return Math.max(0, deadline - now);
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
  if (rate > 0) return "text-[#ff3b30]";
  if (rate < 0) return "text-[#00c087]";
  return "text-[#8491a5]";
}
