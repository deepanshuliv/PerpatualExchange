"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Unlock, Minus, Plus, LocateFixed } from "lucide-react";
import { EmptyState, Panel, PanelTabs } from "./ui";
import type { OrderBookRow } from "types";
import { useTrading } from "../context/TradingContext";
import { groupOrderBookRows } from "../utils/orderbook";

type SizeFlash = "up" | "down";

function useSizeFlashes(rows: OrderBookRow[]) {
  const prevRef = useRef<Map<number, number>>(new Map());
  const [flashes, setFlashes] = useState<Map<number, SizeFlash>>(new Map());

  useEffect(() => {
    const next = new Map<number, SizeFlash>();
    const activePrices = new Set<number>();

    for (const row of rows) {
      activePrices.add(row.price);
      const prev = prevRef.current.get(row.price);
      if (prev !== undefined && prev !== row.size) {
        next.set(row.price, row.size > prev ? "up" : "down");
      }
      prevRef.current.set(row.price, row.size);
    }

    for (const price of prevRef.current.keys()) {
      if (!activePrices.has(price)) {
        prevRef.current.delete(price);
      }
    }

    if (next.size === 0) return;

    setFlashes(next);
    const timer = setTimeout(() => setFlashes(new Map()), 350);
    return () => clearTimeout(timer);
  }, [rows]);

  return flashes;
}

interface DepthRowProps {
  row: OrderBookRow;
  side: "bid" | "ask";
  depthPercent: number;
  flash?: SizeFlash;
  formatPrice: (price: number) => string;
}

function DepthRow({ row, side, depthPercent, flash, formatPrice }: DepthRowProps) {
  if (row.price === 0) {
    return (
      <div aria-hidden className="px-3 py-[3px]">
        &nbsp;
      </div>
    );
  }

  const isBid = side === "bid";
  const flashClass =
    flash === "up" ? "ob-flash-up" : flash === "down" ? "ob-flash-down" : "";

  return (
    <div
      className={`relative grid grid-cols-3 items-center px-3 py-[3px] transition-colors duration-150 hover:bg-hover/60 ${flashClass}`}
    >
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 transition-[width] duration-300 ease-out ${isBid ? "bg-up/10" : "bg-down/10"}`}
        style={{ width: `${depthPercent}%` }}
      />
      <div className={`relative ${isBid ? "text-up" : "text-down"}`}>{formatPrice(row.price)}</div>
      <div className="relative text-right text-fg/85">{row.size.toFixed(4)}</div>
      <div className="relative text-right text-subtle">{row.total.toFixed(4)}</div>
    </div>
  );
}

export default function OrderBook() {
  const { bids, asks, lastPrice, markPrice, marketTrades, marketLiquidations, market, loadingDepth } =
    useTrading();
  const [activeTab, setActiveTab] = useState<"book" | "trades" | "liquidations">("book");
  const [layout, setLayout] = useState<"both" | "asks" | "bids">("both");
  const [isLocked, setIsLocked] = useState(true);
  const [precision, setPrecision] = useState(0.1);
  const spreadRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);

  const getAssetSymbol = () => {
    if (market === "ETHUSD") return "ETH";
    if (market === "SOLUSD") return "SOL";
    return "BTC";
  };

  const asset = getAssetSymbol();

  const handlePrecisionChange = (action: "inc" | "dec") => {
    if (action === "inc") {
      if (precision === 0.1) setPrecision(1);
      else if (precision === 1) setPrecision(10);
    } else {
      if (precision === 10) setPrecision(1);
      else if (precision === 1) setPrecision(0.1);
    }
  };

  const formatPrice = (price: number) => {
    if (precision === 0.1) return price.toFixed(1);
    return price.toFixed(0);
  };

  const formatDisplayPrice = (price: number) => {
    if (price <= 0) return "—";
    return price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  };

  const groupedBids = useMemo(
    () => groupOrderBookRows(bids, precision, true),
    [bids, precision],
  );
  const groupedAsks = useMemo(
    () => groupOrderBookRows(asks, precision, false),
    [asks, precision],
  );

  const bidFlashes = useSizeFlashes(groupedBids);
  const askFlashes = useSizeFlashes(groupedAsks);

  const ROW_COUNT = layout === "both" ? 17 : 34;

  const slicedAsks = useMemo(() => {
    const arr = groupedAsks.slice(0, ROW_COUNT);
    while (arr.length < ROW_COUNT) arr.push({ price: 0, size: 0, total: 0 });
    return arr;
  }, [groupedAsks, ROW_COUNT]);

  const slicedBids = useMemo(() => {
    const arr = groupedBids.slice(0, ROW_COUNT);
    while (arr.length < ROW_COUNT) arr.push({ price: 0, size: 0, total: 0 });
    return arr;
  }, [groupedBids, ROW_COUNT]);

  const displayedAsks = layout === "bids" ? [] : slicedAsks;
  const displayedBids = layout === "asks" ? [] : slicedBids;
  const asksToRender = layout === "both" ? [...displayedAsks].reverse() : displayedAsks;

  const maxTotalAsks = displayedAsks.length > 0 ? Math.max(...displayedAsks.map((a) => a.total)) : 1;
  const maxTotalBids = displayedBids.length > 0 ? Math.max(...displayedBids.map((b) => b.total)) : 1;

  const displayLastPrice = lastPrice > 0 ? lastPrice : markPrice;

  const bestAsk = groupedAsks[0]?.price ?? 0;
  const bestBid = groupedBids[0]?.price ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestAsk > 0 ? (spread / bestAsk) * 100 : null;

  // --- keep the current price (spread row) centred in the scrollable book ---
  const asksBlockRef = useRef<HTMLDivElement>(null);
  const [offCenter, setOffCenter] = useState(false);

  const centerTarget = () => {
    const book = bookRef.current;
    if (!book) return 0;
    const asksHeight = asksBlockRef.current?.offsetHeight ?? 0;
    const spreadHeight = spreadRef.current?.offsetHeight ?? 0;
    const max = book.scrollHeight - book.clientHeight;
    return Math.max(0, Math.min(max, asksHeight + spreadHeight / 2 - book.clientHeight / 2));
  };

  const centerBook = (behavior: ScrollBehavior = "smooth") => {
    bookRef.current?.scrollTo({ top: centerTarget(), behavior });
    setOffCenter(false);
  };

  const handleBookScroll = () => {
    const book = bookRef.current;
    if (!book) return;
    setOffCenter(Math.abs(book.scrollTop - centerTarget()) > 24);
  };

  // Start centred whenever the market or layout changes and rows are available.
  const hasRows = bids.length > 0 || asks.length > 0;
  const centeredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeTab !== "book" || !hasRows) return;
    const key = `${market}|${layout}`;
    if (centeredForRef.current === key) return;
    centeredForRef.current = key;
    requestAnimationFrame(() => centerBook("auto"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, layout, hasRows, activeTab]);

  const wasLockedRef = useRef(isLocked);
  useEffect(() => {
    if (isLocked && !wasLockedRef.current) centerBook();
    wasLockedRef.current = isLocked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  const layoutIcon = (mode: "both" | "asks" | "bids") => (
    <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" aria-hidden>
      <rect x="1" y="1.5" width="12" height="4.5" rx="1" className={mode === "bids" ? "fill-up" : "fill-down"} opacity={0.85} />
      <rect x="1" y="8" width="12" height="4.5" rx="1" className={mode === "asks" ? "fill-down" : "fill-up"} opacity={0.85} />
    </svg>
  );

  return (
    <Panel>
      <PanelTabs
        tabs={[
          { id: "book" as const, label: "Order book" },
          {
            id: "trades" as const,
            label: (
              <>
                Trades
                {marketTrades.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-up" />}
              </>
            ),
          },
          { id: "liquidations" as const, label: "Liquidations" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "book" ? (
        <>
          <div className="flex h-9 shrink-0 items-center justify-between px-3">
            <div className="flex items-center gap-0.5">
              {(
                [
                  { id: "both", title: "Show bids and asks" },
                  { id: "asks", title: "Show asks only" },
                  { id: "bids", title: "Show bids only" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id)}
                  title={opt.title}
                  aria-label={opt.title}
                  aria-pressed={layout === opt.id}
                  className={`rounded p-1 transition-opacity ${
                    layout === opt.id ? "bg-raised opacity-100" : "opacity-40 hover:opacity-80"
                  }`}
                >
                  {layoutIcon(opt.id)}
                </button>
              ))}

              <button
                onClick={() => setIsLocked(!isLocked)}
                className="ml-1 rounded p-1 text-subtle transition-colors hover:text-fg"
                title={isLocked ? "Unlock scroll (spread won't auto-center)" : "Lock scroll to spread"}
                aria-label={isLocked ? "Unlock scroll" : "Lock scroll to spread"}
              >
                {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex h-6 items-center rounded-md bg-raised">
              <button
                onClick={() => handlePrecisionChange("dec")}
                className="flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-fg disabled:opacity-30"
                disabled={precision <= 0.1}
                aria-label="Decrease grouping"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-7 text-center font-mono text-[11px] text-fg">{precision}</span>
              <button
                onClick={() => handlePrecisionChange("inc")}
                className="flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-fg disabled:opacity-30"
                disabled={precision >= 10}
                aria-label="Increase grouping"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 px-3 pb-1.5 text-[11px] text-subtle">
            <div>Price (USD)</div>
            <div className="text-right">Size ({asset})</div>
            <div className="text-right">Total ({asset})</div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={bookRef}
            onScroll={handleBookScroll}
            className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto font-mono text-xs"
          >
            {loadingDepth && bids.length === 0 && asks.length === 0 ? (
              <EmptyState title="Connecting to order book…" />
            ) : (
              <>
                {layout !== "bids" && (
                  <div ref={asksBlockRef} className="flex flex-col">
                    {asksToRender.length === 0 ? (
                      <EmptyState title="No asks" />
                    ) : (
                      asksToRender.map((ask, idx) => {
                        const depthPercent = ask.price === 0 ? 0 : Math.min((ask.total / maxTotalAsks) * 100, 100);
                        return (
                          <DepthRow
                            key={`ask-${idx}`}
                            row={ask}
                            side="ask"
                            depthPercent={depthPercent}
                            flash={askFlashes.get(ask.price)}
                            formatPrice={formatPrice}
                          />
                        );
                      })
                    )}
                  </div>
                )}

                <div
                  ref={spreadRef}
                  className="sticky top-0 z-20 flex items-center justify-between gap-2 border-y border-line bg-surface px-3 py-1.5"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span
                      className={`text-[15px] font-medium transition-colors duration-200 ${
                        displayLastPrice <= 0
                          ? "text-subtle"
                          : displayLastPrice >= markPrice
                            ? "text-up"
                            : "text-down"
                      }`}
                    >
                      {formatDisplayPrice(displayLastPrice)}
                    </span>
                    <span className="truncate text-[11px] text-subtle" title="Mark price">
                      {formatDisplayPrice(markPrice)}
                    </span>
                  </div>
                  {spread !== null && spreadPct !== null && (
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-subtle" title="Spread">
                      Spread <span className="text-muted">{spread.toFixed(precision < 1 ? 1 : 0)}</span>{" "}
                      ({spreadPct.toFixed(3)}%)
                    </span>
                  )}
                </div>

                {layout !== "asks" && (
                  <div className="flex flex-col">
                    {displayedBids.length === 0 ? (
                      <EmptyState title="No bids" />
                    ) : (
                      displayedBids.map((bid, idx) => {
                        const depthPercent = bid.price === 0 ? 0 : Math.min((bid.total / maxTotalBids) * 100, 100);
                        return (
                          <DepthRow
                            key={`bid-${idx}`}
                            row={bid}
                            side="bid"
                            depthPercent={depthPercent}
                            flash={bidFlashes.get(bid.price)}
                            formatPrice={formatPrice}
                          />
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => centerBook()}
            tabIndex={offCenter ? 0 : -1}
            aria-hidden={!offCenter}
            title="Scroll back to the current price"
            className={`absolute bottom-3 left-1/2 z-30 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-strong bg-raised/95 px-3 text-[11px] font-medium text-fg shadow-lg shadow-black/40 backdrop-blur transition-all duration-200 hover:bg-hover ${
              offCenter ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Center
          </button>
          </div>
        </>
      ) : activeTab === "trades" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid shrink-0 grid-cols-3 px-3 py-2 text-[11px] text-subtle">
            <div>Price (USD)</div>
            <div className="text-right">Size ({asset})</div>
            <div className="text-right">Time</div>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto font-mono text-xs">
            {marketTrades.length === 0 ? (
              <EmptyState title="No trades yet" hint="Trades stream in as orders match." />
            ) : (
              marketTrades.map((trade, idx) => (
                <div
                  key={`trade-${trade.time}-${trade.price}-${idx}`}
                  className="grid grid-cols-3 items-center px-3 py-[3px] transition-colors hover:bg-hover/60"
                >
                  <div className={trade.price >= markPrice ? "text-up" : "text-down"}>
                    {trade.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-right text-fg/85">{trade.qty.toFixed(4)}</div>
                  <div className="text-right text-subtle">
                    {new Date(trade.time).toLocaleTimeString(undefined, { hour12: false })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid shrink-0 grid-cols-4 px-3 py-2 text-[11px] text-subtle">
            <div>Side</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">Size ({asset})</div>
            <div className="text-right">Time</div>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto font-mono text-xs">
            {marketLiquidations.length === 0 ? (
              <EmptyState title="No liquidations" hint="Forced closes on this market appear here in real time." />
            ) : (
              marketLiquidations.map((liq, idx) => (
                <div
                  key={`liq-${liq.time}-${liq.userId}-${idx}`}
                  className="grid grid-cols-4 items-center px-3 py-[3px] transition-colors hover:bg-hover/60"
                >
                  <div className={`font-sans ${liq.kind === "LONG" ? "text-down" : "text-up"}`}>
                    {liq.kind === "LONG" ? "Long" : "Short"}
                  </div>
                  <div className="text-right text-fg">
                    {liq.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-right text-fg/85">{liq.qty.toFixed(4)}</div>
                  <div className="text-right text-subtle">
                    {new Date(liq.time).toLocaleTimeString(undefined, { hour12: false })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
