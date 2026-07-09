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

export function groupOrderBookRows(
  orders: OrderBookRow[],
  precision: number,
  isBid: boolean,
): OrderBookRow[] {
  const grouped: Record<string, { price: number; size: number }> = {};

  for (const order of orders) {
    const roundedPrice = Math.round(order.price / precision) * precision;
    const decimals = precision < 1 ? 1 : 0;
    const key = roundedPrice.toFixed(decimals);

    if (!grouped[key]) {
      grouped[key] = { price: roundedPrice, size: 0 };
    }
    grouped[key].size += order.size;
  }

  const list = Object.values(grouped).sort((a, b) =>
    isBid ? b.price - a.price : a.price - b.price,
  );

  let accum = 0;
  return list.map((item) => {
    accum += item.size;
    return { price: item.price, size: item.size, total: accum };
  });
}

export function midPriceFromOrderbook(
  bids: OrderBookRow[],
  asks: OrderBookRow[],
): number | null {
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;

  if (bestBid && bestAsk) {
    return (bestBid + bestAsk) / 2;
  }
  if (bestBid) return bestBid;
  if (bestAsk) return bestAsk;
  return null;
}

