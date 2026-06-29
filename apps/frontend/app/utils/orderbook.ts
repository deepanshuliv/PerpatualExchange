import type { OrderBookRow } from "types";

export function parseDepthSnapshot(
  rawBids: unknown,
  rawAsks: unknown
): { bids: OrderBookRow[]; asks: OrderBookRow[] } {
  const parseSide = (raw: unknown, isBid: boolean): OrderBookRow[] => {
    let entries: [number, number][] = [];

    if (Array.isArray(raw)) {
      entries = raw.map(([price, qty]) => [Number(price), Number(qty)]);
    } else if (raw && typeof raw === "object") {
      entries = Object.entries(raw as Record<string, number>).map(([price, qty]) => [
        parseFloat(price),
        parseFloat(String(qty)),
      ]);
    }

    const sorted = entries
      .filter(([price, qty]) => price > 0 && qty > 0)
      .map(([price, size]) => ({ price, size, total: 0 }))
      .sort((a, b) => (isBid ? b.price - a.price : a.price - b.price));

    let accum = 0;
    return sorted.map((row) => {
      accum += row.size;
      return { ...row, total: accum };
    });
  };

  return {
    bids: parseSide(rawBids, true),
    asks: parseSide(rawAsks, false),
  };
}
