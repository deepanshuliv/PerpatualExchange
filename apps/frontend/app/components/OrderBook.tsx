"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Unlock, Minus, Plus } from "lucide-react";
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
    const timer = setTimeout(() => setFlashes(new Map()), 450);
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
  const isBid = side === "bid";
  const color = isBid ? "rgba(0, 192, 135, 0.1)" : "rgba(239, 68, 68, 0.1)";
  const priceColor = isBid ? "text-[#00c087]" : "text-[#ff3b30]";
  const flashClass =
    flash === "up" ? "ob-flash-up" : flash === "down" ? "ob-flash-down" : "";

  return (
    <div
      className={`relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/[0.02] cursor-pointer items-center ob-row-enter ${flashClass}`}
    >
      <div
        className="absolute inset-0 ob-depth-bar pointer-events-none"
        style={{
          background: `linear-gradient(to left, ${color} ${depthPercent}%, transparent ${depthPercent}%)`,
        }}
      />
      <div className={`relative z-10 ${priceColor} font-bold`}>{formatPrice(row.price)}</div>
      <div className="relative z-10 text-right text-[#b0bbcb] ob-size-cell tabular-nums">
        {row.size.toFixed(5)}
      </div>
      <div className="relative z-10 text-right text-[#5d6b7e] tabular-nums">
        {row.total.toFixed(5)}
      </div>
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
    return price.toLocaleString(undefined, { minimumFractionDigits: 1 });
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

  const displayedAsks = layout === "bids" ? [] : groupedAsks;
  const displayedBids = layout === "asks" ? [] : groupedBids;
  const asksToRender = layout === "both" ? [...displayedAsks].reverse() : displayedAsks;

  const maxTotalAsks = displayedAsks.length > 0 ? Math.max(...displayedAsks.map((a) => a.total)) : 1;
  const maxTotalBids = displayedBids.length > 0 ? Math.max(...displayedBids.map((b) => b.total)) : 1;

  const wasLockedRef = useRef(isLocked);
  useEffect(() => {
    if (isLocked && !wasLockedRef.current && spreadRef.current) {
      spreadRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    wasLockedRef.current = isLocked;
  }, [isLocked]);

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg overflow-hidden select-none font-sans">
      <div className="flex items-center justify-between border-b border-[#171a1f] bg-[#0c0d10] px-3 h-10 shrink-0">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("book")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              activeTab === "book" ? "text-white border-b-2 border-white" : "text-[#8491a5] hover:text-white"
            }`}
          >
            Book
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              activeTab === "trades" ? "text-white border-b-2 border-white" : "text-[#8491a5] hover:text-white"
            }`}
          >
            Trades
          </button>
          <button
            onClick={() => setActiveTab("liquidations")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              activeTab === "liquidations" ? "text-white border-b-2 border-white" : "text-[#8491a5] hover:text-white"
            }`}
          >
            Liquidation
          </button>
        </div>
      </div>

      {activeTab === "book" ? (
        <>
          <div className="flex items-center justify-between px-3 h-9 bg-[#0c0d10] border-b border-[#171a1f] shrink-0">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLayout("both")}
                className={`p-1 rounded transition-colors ${
                  layout === "both" ? "bg-[#171a1f] text-white" : "text-[#8491a5] hover:text-white"
                }`}
                title="Show both buys and sells"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" className={layout === "both" ? "stroke-white" : "stroke-zinc-500"} />
                  <path d="M4 6h16" className="stroke-red-500" />
                  <path d="M4 18h16" className="stroke-emerald-500" />
                </svg>
              </button>
              <button
                onClick={() => setLayout("asks")}
                className={`p-1 rounded transition-colors ${
                  layout === "asks" ? "bg-[#171a1f] text-white" : "text-[#8491a5] hover:text-white"
                }`}
                title="Show sells only"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" className="stroke-red-500" />
                </svg>
              </button>
              <button
                onClick={() => setLayout("bids")}
                className={`p-1 rounded transition-colors ${
                  layout === "bids" ? "bg-[#171a1f] text-white" : "text-[#8491a5] hover:text-white"
                }`}
                title="Show buys only"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" className="stroke-emerald-500" />
                </svg>
              </button>

              <button
                onClick={() => setIsLocked(!isLocked)}
                className="text-[#8491a5] hover:text-white p-1 rounded transition-colors"
                title={isLocked ? "Unlock scroll (spread won't auto-center)" : "Lock scroll to spread"}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center bg-[#12161c] border border-[#171a1f] rounded px-1.5 h-6">
              <button
                onClick={() => handlePrecisionChange("dec")}
                className="text-[#8491a5] hover:text-white disabled:opacity-30"
                disabled={precision <= 0.1}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-white font-mono px-2 font-semibold">{precision}</span>
              <button
                onClick={() => handlePrecisionChange("inc")}
                className="text-[#8491a5] hover:text-white disabled:opacity-30"
                disabled={precision >= 10}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Price (USD)</div>
            <div className="text-right">Size ({asset})</div>
            <div className="text-right">Total ({asset})</div>
          </div>

          <div
            ref={bookRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar font-mono text-xs"
          >
            {loadingDepth ? (
              <div className="flex items-center justify-center h-full text-zinc-600 text-[10px]">
                Loading order book...
              </div>
            ) : (
              <>
                {layout !== "bids" && (
                  <div className="flex flex-col">
                    {asksToRender.length === 0 ? (
                      <div className="text-center text-zinc-600 text-[10px] py-4">No Asks</div>
                    ) : (
                      asksToRender.map((ask) => {
                        const depthPercent = Math.min((ask.total / maxTotalAsks) * 100, 100);
                        return (
                          <DepthRow
                            key={`ask-${ask.price}`}
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
                  className="sticky top-0 z-20 flex items-center justify-between px-3 py-2 bg-[#12161c] border-y border-[#171a1f] shrink-0"
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-sm font-bold transition-colors duration-200 ${
                        lastPrice > 0 && markPrice > 0
                          ? lastPrice >= markPrice
                            ? "text-[#00c087]"
                            : "text-[#ff3b30]"
                          : "text-white"
                      }`}
                    >
                      {formatDisplayPrice(lastPrice)}
                    </span>
                    <span className="text-[10px] text-[#8491a5] font-semibold">
                      {formatDisplayPrice(markPrice)}
                    </span>
                  </div>
                </div>

                {layout !== "asks" && (
                  <div className="flex flex-col">
                    {displayedBids.length === 0 ? (
                      <div className="text-center text-zinc-600 text-[10px] py-4">No Bids</div>
                    ) : (
                      displayedBids.map((bid) => {
                        const depthPercent = Math.min((bid.total / maxTotalBids) * 100, 100);
                        return (
                          <DepthRow
                            key={`bid-${bid.price}`}
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
        </>
      ) : activeTab === "trades" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-3 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Time</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">Quantity ({asset})</div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar font-mono text-xs divide-y divide-[#171a1f]/20">
            {marketTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#8491a5] font-sans">
                <span>No market trades yet</span>
              </div>
            ) : (
              marketTrades.map((trade, idx) => (
                <div
                  key={`trade-${trade.time}-${trade.price}-${idx}`}
                  className="grid grid-cols-3 px-3 py-1.5 hover:bg-white/[0.02] items-center ob-row-enter"
                >
                  <div className="text-[#8491a5] text-[10px]">
                    {new Date(trade.time).toLocaleTimeString()}
                  </div>
                  <div className="text-right text-white font-bold tabular-nums">
                    {trade.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-right text-[#b0bbcb] tabular-nums">{trade.qty.toFixed(5)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[#171a1f] bg-[#12161c]/40 shrink-0">
            <p className="text-[10px] text-[#8491a5] leading-relaxed">
              Liquidations trigger when mark price moves against a position past its maintenance margin.
            </p>
          </div>
          <div className="grid grid-cols-4 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Time</div>
            <div>Side</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">Quantity ({asset})</div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar font-mono text-xs divide-y divide-[#171a1f]/20">
            {marketLiquidations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#8491a5] font-sans">
                <span>No liquidations yet</span>
              </div>
            ) : (
              marketLiquidations.map((liq, idx) => (
                <div
                  key={`liq-${liq.time}-${liq.userId}-${idx}`}
                  className="grid grid-cols-4 px-3 py-1.5 hover:bg-white/[0.02] items-center"
                >
                  <div className="text-[#8491a5] text-[10px]">
                    {new Date(liq.time).toLocaleTimeString()}
                  </div>
                  <div className={liq.kind === "LONG" ? "text-[#ff3b30]" : "text-[#00c087]"}>
                    {liq.kind}
                  </div>
                  <div className="text-right text-white font-bold">
                    {liq.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-right text-[#b0bbcb]">{liq.qty.toFixed(5)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
