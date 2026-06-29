export function formatUsd(value: number, fractionDigits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = Math.abs(safe).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return safe < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function balanceColorClass(value: number): string {
  return value < 0 ? "text-[#ff3b30]" : "text-[#00c087]";
}
