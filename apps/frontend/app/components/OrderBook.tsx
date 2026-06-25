"use client";

import React, { useState } from "react";
import { useTrading } from "../context/TradingContext";
import { Lock, Unlock, Minus, Plus } from "lucide-react";

export default function OrderBook() {
  const { bids, asks, lastPrice, markPrice, fills, market } = useTrading();
  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");
  const [layout, setLayout] = useState<"both" | "asks" | "bids">("both");
  const [isLocked, setIsLocked] = useState(true);
  const [precision, setPrecision] = useState(0.1);

  // Map market to asset names
  const getAssetSymbol = () => {
    if (market === "ETHUSD") return "ETH";
    if (market === "SOLUSD") return "SOL";
    return "BTC";
  };

  const asset = getAssetSymbol();

  // Handle precision change
  const handlePrecisionChange = (action: "inc" | "dec") => {
    if (action === "inc") {
      if (precision === 0.1) setPrecision(1);
      else if (precision === 1) setPrecision(10);
    } else {
      if (precision === 10) setPrecision(1);
      else if (precision === 1) setPrecision(0.1);
    }
  };

  // Format price based on precision
  const formatPrice = (price: number) => {
    if (precision === 0.1) return price.toFixed(1);
    return price.toFixed(0);
  };

  // Grouping orders by precision
  const groupOrders = (orders: typeof bids, isBid: boolean) => {
    const grouped: { [key: string]: { price: number; size: number } } = {};
    orders.forEach((o) => {
      const roundedPrice = Math.round(o.price / precision) * precision;
      const key = roundedPrice.toFixed(precision === 0.1 ? 1 : 0);
      if (!grouped[key]) {
        grouped[key] = { price: roundedPrice, size: 0 };
      }
      grouped[key].size += o.size;
    });

    const list = Object.values(grouped).sort((a, b) =>
      isBid ? b.price - a.price : a.price - b.price
    );

    let accum = 0;
    return list.map((item) => {
      accum += item.size;
      return { ...item, total: accum };
    });
  };

  const groupedBids = groupOrders(bids, true);
  // For asks, we want the lowest asks at the bottom of the list when showing both, or standard sorting.
  const groupedAsks = groupOrders(asks, false);

  // Determine how many items to show based on layout
  const maxRows = layout === "both" ? 12 : 24;
  const displayedAsks = layout === "bids" ? [] : groupedAsks.slice(0, maxRows);
  const displayedBids = layout === "asks" ? [] : groupedBids.slice(0, maxRows);

  // Reversing asks for "both" layout so the spread is in the middle
  const asksToRender = layout === "both" ? [...displayedAsks].reverse() : displayedAsks;

  const maxTotalAsks = displayedAsks.length > 0 ? Math.max(...displayedAsks.map((a) => a.total)) : 1;
  const maxTotalBids = displayedBids.length > 0 ? Math.max(...displayedBids.map((b) => b.total)) : 1;

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg overflow-hidden select-none font-sans">
      {/* Top Tabs */}
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
        </div>
      </div>

      {activeTab === "book" ? (
        <>
          {/* Orderbook Controls */}
          <div className="flex items-center justify-between px-3 h-9 bg-[#0c0d10] border-b border-[#171a1f] shrink-0">
            {/* Layout Selectors */}
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
              
              {/* Lock Icon */}
              <button
                onClick={() => setIsLocked(!isLocked)}
                className="text-[#8491a5] hover:text-white p-1 rounded transition-colors"
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Precision Selector */}
            <div className="flex items-center bg-[#12161c] border border-[#171a1f] rounded px-1.5 h-6">
              <button
                onClick={() => handlePrecisionChange("dec")}
                className="text-[#8491a5] hover:text-white disabled:opacity-30"
                disabled={precision <= 0.1}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-white font-mono px-2 font-semibold">
                {precision}
              </span>
              <button
                onClick={() => handlePrecisionChange("inc")}
                className="text-[#8491a5] hover:text-white disabled:opacity-30"
                disabled={precision >= 10}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-3 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Price (USD)</div>
            <div className="text-right">Size ({asset})</div>
            <div className="text-right">Total ({asset})</div>
          </div>

          {/* Content Scroll Area */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto no-scrollbar font-mono text-xs">
            
            {/* Asks (Sells) */}
            {layout !== "bids" && (
              <div className="flex-1 flex flex-col justify-end min-h-[100px] overflow-hidden">
                {asksToRender.length === 0 ? (
                  <div className="text-center text-zinc-600 text-[10px] py-4">No Asks</div>
                ) : (
                  asksToRender.map((ask, idx) => {
                    const depthPercent = Math.min((ask.total / maxTotalAsks) * 100, 100);
                    return (
                      <div
                        key={`ask-${idx}`}
                        className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/[0.02] cursor-pointer items-center"
                        style={{
                          background: `linear-gradient(to left, rgba(239, 68, 68, 0.08) ${depthPercent}%, transparent ${depthPercent}%)`,
                        }}
                      >
                        <div className="text-[#ff3b30] font-bold">{formatPrice(ask.price)}</div>
                        <div className="text-right text-[#b0bbcb]">{ask.size.toFixed(5)}</div>
                        <div className="text-right text-[#5d6b7e]">{ask.total.toFixed(5)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Spread / Last Price Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#12161c]/40 border-y border-[#171a1f] shrink-0">
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-bold ${lastPrice >= markPrice ? "text-[#00c087]" : "text-[#ff3b30]"}`}>
                  {lastPrice > 0 ? lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1 }) : "61,643.2"}
                </span>
                <span className="text-[10px] text-[#8491a5] font-semibold">
                  {markPrice > 0 ? markPrice.toLocaleString(undefined, { minimumFractionDigits: 1 }) : "61,644.0"}
                </span>
              </div>
              <button className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Recenter
              </button>
            </div>

            {/* Bids (Buys) */}
            {layout !== "asks" && (
              <div className="flex-1 flex flex-col justify-start min-h-[100px] overflow-hidden">
                {displayedBids.length === 0 ? (
                  <div className="text-center text-zinc-600 text-[10px] py-4">No Bids</div>
                ) : (
                  displayedBids.map((bid, idx) => {
                    const depthPercent = Math.min((bid.total / maxTotalBids) * 100, 100);
                    return (
                      <div
                        key={`bid-${idx}`}
                        className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/[0.02] cursor-pointer items-center"
                        style={{
                          background: `linear-gradient(to left, rgba(0, 192, 135, 0.08) ${depthPercent}%, transparent ${depthPercent}%)`,
                        }}
                      >
                        <div className="text-[#00c087] font-bold">{formatPrice(bid.price)}</div>
                        <div className="text-right text-[#b0bbcb]">{bid.size.toFixed(5)}</div>
                        <div className="text-right text-[#5d6b7e]">{bid.total.toFixed(5)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        </>
      ) : (
        /* Trades Tab content */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-3 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Side</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">Quantity ({asset})</div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar font-mono text-xs divide-y divide-[#171a1f]/20">
            {fills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#8491a5] font-sans">
                <span>No trades executed yet</span>
              </div>
            ) : (
              [...fills].reverse().slice(0, 50).map((fill, idx) => {
                const isLong = fill.qty > 0 || fill.kind === "LONG";
                return (
                  <div
                    key={`trade-${idx}`}
                    className="grid grid-cols-3 px-3 py-1.5 hover:bg-white/[0.02] items-center"
                  >
                    <div className={isLong ? "text-[#00c087] font-bold" : "text-[#ff3b30] font-bold"}>
                      {isLong ? "BUY" : "SELL"}
                    </div>
                    <div className="text-right text-white font-bold">
                      {fill.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </div>
                    <div className="text-right text-[#b0bbcb]">
                      {fill.qty.toFixed(5)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
